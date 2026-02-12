/**
 * Game Service
 *
 * Async poker game logic using Drizzle repositories.
 * This replaces the synchronous poker-engine-v2 functions.
 */

import Pusher from 'pusher';
import { getDb } from '@/lib/db';
import { tableRepo, handRepo, eventRepo, tournamentRepo } from '@/lib/db/repositories';
import { generateId, now } from '@/lib/db/transaction';
import { hands, tablePlayers, tables } from '@/lib/db/schema';
import type { Hand, TablePlayer, Table, Event } from '@/lib/db/schema';
import { eq, and, ne, sql, notInArray, inArray, desc } from 'drizzle-orm';

// @ts-expect-error - pokersolver doesn't have proper types
import { Hand as PokersolverHand } from 'pokersolver';

// =============================================================================
// Types
// =============================================================================

export type HandPhase = 'dealing' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'awarding' | 'hand-complete' | 'complete';
export type PlayerStatus = 'waiting' | 'active' | 'acted' | 'folded' | 'all_in' | 'sitting_out' | 'eliminated';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | 'post_sb' | 'post_bb' | 'post_ante';

export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Card = { rank: Rank; suit: Suit };
export type HandRank = 'high-card' | 'pair' | 'two-pair' | 'three-of-a-kind' | 'straight' | 'flush' | 'full-house' | 'four-of-a-kind' | 'straight-flush' | 'royal-flush';

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ValidActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  minBet: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
}

export interface AdvanceResult {
  timeoutHandled: boolean;
  showdownCompleted: boolean;
  newHandStarted: boolean;
  cleanedUpHands: number;
  recoveredActor: boolean;
  hand: Hand | null;
}

export interface SubmitActionParams {
  tableId: string;
  playerId: string;
  action: ActionType;
  amount?: number;
  handVersion?: number;
  bypassExpiry?: boolean;
}

export interface ActionDetails {
  seatIndex: number;
  action: ActionType;
  actualAmount: number;
  newPlayerBet: number;
  newStack: number;
  isAllIn: boolean;
}

export interface SubmitActionResult {
  hand: Hand;
  players: Array<TablePlayer & { name: string; avatar: string | null }>;
  nextActorSeat: number | null;
  phaseChanged: boolean;
  newPhase?: HandPhase;
  isHandComplete: boolean;
  actionDetails: ActionDetails;
}

export interface PollResponse {
  upToDate: boolean;
  events?: Event[];
  fullState?: TableStateResponse;
  version: number;
  lastEventId: number;
}

export interface TableStateResponse {
  table: Table;
  players: Array<TablePlayer & { name: string; avatar: string | null }>;
  hand?: Hand;
  pots: Array<{ id: string; amount: number; potIndex: number }>;
  version: number;
  lastEventId: number;
}

export interface TimeoutResult {
  success: boolean;
  playerId?: string;
  seatIndex?: number;
  error?: string;
}

// =============================================================================
// Pusher Setup
// =============================================================================

let pusher: Pusher | null = null;
if (process.env.PUSHER_APP_ID) {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });
}

// =============================================================================
// Pure Game Logic (no DB access)
// =============================================================================

const SUITS: Suit[] = ['h', 'd', 'c', 's'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const CANNOT_ACT_STATUSES: PlayerStatus[] = ['folded', 'all_in', 'sitting_out', 'eliminated'];
const INACTIVE_STATUSES: PlayerStatus[] = ['folded', 'sitting_out', 'eliminated'];

const COMMUNITY_CARDS_BY_PHASE: Record<HandPhase, number> = {
  dealing: 0,
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
  awarding: 5,
  'hand-complete': 5,
  complete: 5,
};

const RANK_MAP: Record<string, HandRank> = {
  'High Card': 'high-card',
  'Pair': 'pair',
  'Two Pair': 'two-pair',
  'Three of a Kind': 'three-of-a-kind',
  'Straight': 'straight',
  'Flush': 'flush',
  'Full House': 'full-house',
  'Four of a Kind': 'four-of-a-kind',
  'Straight Flush': 'straight-flush',
  'Royal Flush': 'royal-flush',
};

function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function getActivePlayers<T extends { status: string }>(players: T[]): T[] {
  return players.filter((p) => !INACTIVE_STATUSES.includes(p.status as PlayerStatus));
}

function getPlayersWhoCanAct<T extends { status: string }>(players: T[]): T[] {
  return players.filter((p) => ['waiting', 'active', 'acted'].includes(p.status));
}

function shouldGoToShowdown(hand: Hand, players: Array<{ status: string; currentBet: number }>): boolean {
  const active = getActivePlayers(players);
  if (active.length <= 1) return false;
  if (active.every((p) => p.status === 'all_in')) return true;
  const notAllIn = active.filter((p) => p.status !== 'all_in');
  if (notAllIn.length === 1) {
    const lastStanding = notAllIn[0];
    if (lastStanding.currentBet >= hand.currentBet) return true;
  }
  return false;
}

function shouldAwardWithoutShowdown<T extends { status: string }>(players: T[]): boolean {
  return getActivePlayers(players).length === 1;
}

function isBettingComplete(hand: Hand, players: Array<{ status: string; currentBet: number }>): boolean {
  const active = getActivePlayers(players);
  if (active.length <= 1) return true;
  for (const player of active) {
    if (player.status === 'all_in') continue;
    if (player.status === 'waiting' || player.status === 'active') return false;
    if (player.status === 'acted' && player.currentBet < hand.currentBet) return false;
  }
  return true;
}

function getNextBettingPhase(current: HandPhase): HandPhase | null {
  const progression: Record<string, HandPhase> = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
  };
  return progression[current] ?? null;
}

function getPhaseAfterBetting(
  currentPhase: HandPhase,
  hand: Hand,
  players: Array<{ status: string; currentBet: number }>
): HandPhase {
  if (shouldAwardWithoutShowdown(players)) return 'awarding';
  // Progress through streets naturally even when all-in to build anticipation
  // Only go to showdown when we've reached the river
  const nextPhase = getNextBettingPhase(currentPhase);
  if (nextPhase) return nextPhase;
  if (currentPhase === 'river') return 'showdown';
  return 'showdown';
}

function findNextActor(
  hand: Hand,
  players: Array<{ seatIndex: number; status: string; currentBet: number }>,
  currentSeat: number
): { seatIndex: number } | null {
  const activePlayers = players.filter((p) => !CANNOT_ACT_STATUSES.includes(p.status as PlayerStatus));
  if (activePlayers.length === 0) return null;
  if (activePlayers.length === 1) {
    const player = activePlayers[0];
    if (player.currentBet < hand.currentBet) return player;
    return null;
  }
  const maxSeat = Math.max(...players.map((p) => p.seatIndex));
  const numPositions = maxSeat + 1;
  for (let i = 1; i <= numPositions; i++) {
    const nextSeat = (currentSeat + i) % numPositions;
    const player = players.find((p) => p.seatIndex === nextSeat);
    if (!player) continue;
    if (CANNOT_ACT_STATUSES.includes(player.status as PlayerStatus)) continue;
    if (player.status === 'waiting' || player.status === 'active') return player;
    if (player.status === 'acted' && player.currentBet < hand.currentBet) return player;
  }
  return null;
}

function getFirstPostflopActor(
  players: Array<{ seatIndex: number; status: string }>,
  dealerSeat: number,
  isHeadsUp: boolean,
  bigBlindSeat: number
): { seatIndex: number } | null {
  const activePlayers = players.filter((p) => !CANNOT_ACT_STATUSES.includes(p.status as PlayerStatus));
  if (activePlayers.length <= 1) return null;
  if (isHeadsUp) {
    const bbPlayer = activePlayers.find((p) => p.seatIndex === bigBlindSeat);
    if (bbPlayer && !CANNOT_ACT_STATUSES.includes(bbPlayer.status as PlayerStatus)) return bbPlayer;
    return activePlayers.find((p) => p.seatIndex === dealerSeat) || null;
  }
  const maxSeat = Math.max(...players.map((p) => p.seatIndex));
  const numPositions = maxSeat + 1;
  for (let i = 1; i <= numPositions; i++) {
    const nextSeat = (dealerSeat + i) % numPositions;
    const player = activePlayers.find((p) => p.seatIndex === nextSeat);
    if (player && !CANNOT_ACT_STATUSES.includes(player.status as PlayerStatus)) return player;
  }
  return null;
}

function isHeadsUp(players: Array<{ status: string }>): boolean {
  return players.filter((p) => !['sitting_out', 'eliminated'].includes(p.status)).length === 2;
}

// Delay between streets when running out all-in hands (milliseconds)
const ALL_IN_STREET_DELAY_MS = 2000;

/**
 * Schedule automatic street progression when all players are all-in.
 * This creates anticipation by dealing each street one at a time with delays.
 */
function scheduleAllInStreetProgression(handId: string, tableId: string, currentPhase: HandPhase): void {
  console.log(`[scheduleAllInStreetProgression] hand=${handId} scheduling from phase=${currentPhase} (delay=${ALL_IN_STREET_DELAY_MS}ms)`);
  setTimeout(async () => {
    try {
      const db = getDb();
      const [hand] = await db.select().from(hands).where(eq(hands.id, handId));
      if (!hand || hand.phase === 'complete' || hand.phase === 'showdown') {
        console.log(`[scheduleAllInStreetProgression] hand=${handId} skipping — phase=${hand?.phase ?? 'not found'}`);
        return;
      }
      console.log(`[scheduleAllInStreetProgression] hand=${handId} executing, current phase=${hand.phase}`);

      const { players } = await tableRepo.getTableWithPlayers(tableId);

      // Check if we should proceed to showdown (on river) or continue to next street
      const phase = hand.phase as HandPhase;
      if (phase === 'river') {
        // We're on river, go to showdown
        await runShowdown(handId, tableId, players, phase);
      } else {
        // Deal next street
        const nextPhase = getNextBettingPhase(phase);
        if (nextPhase) {
          await advanceToNextPhase(handId, tableId, players, nextPhase);

          // Broadcast phase change
          if (pusher) {
            const [updatedHand] = await db.select().from(hands).where(eq(hands.id, handId));
            const communityCards: string[] = JSON.parse(updatedHand?.communityCards || '[]');
            pusher.trigger(`table-${tableId}`, 'PHASE_CHANGED', {
              eventId: `phase-${nextPhase}-${handId}`,
              phase: nextPhase,
              communityCards,
            }).catch((err) => console.error('[scheduleAllInStreetProgression] Failed to broadcast PHASE_CHANGED:', err));
          }

          // Schedule next advancement
          scheduleAllInStreetProgression(handId, tableId, nextPhase);
        } else {
          // No more streets, go to showdown
          await runShowdown(handId, tableId, players, phase);
        }
      }
    } catch (err) {
      console.error('[scheduleAllInStreetProgression] Error:', err);
    }
  }, ALL_IN_STREET_DELAY_MS);
}

function findNextActiveSeat(players: Array<{ seatIndex: number }>, currentSeat: number): number {
  const seats = players.map((p) => p.seatIndex).sort((a, b) => a - b);
  const numSeats = Math.max(...seats) + 1;
  for (let i = 1; i <= numSeats; i++) {
    const nextSeat = (currentSeat + i) % numSeats;
    if (seats.includes(nextSeat)) return nextSeat;
  }
  return seats[0];
}

function isPlayersTurn(hand: Hand, playerId: string, players: Array<{ seatIndex: number; playerId: string }>): boolean {
  if (hand.currentActorSeat === null || hand.currentActorSeat === undefined) return false;
  const currentActor = players.find((p) => p.seatIndex === hand.currentActorSeat);
  return currentActor?.playerId === playerId;
}

export function getValidActions(params: {
  status: string;
  currentBet: number;
  playerBet: number;
  playerStack: number;
  minRaise: number;
  bigBlind: number;
  canCheck: boolean;
}): ValidActions {
  const { status, currentBet, playerBet, playerStack, minRaise, bigBlind } = params;
  const result: ValidActions = {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canBet: false,
    minBet: 0,
    canRaise: false,
    minRaise: 0,
    maxRaise: 0,
  };
  // Compute validActions for any player that CAN act (not folded/all_in/sitting_out/eliminated)
  // The actual turn check (currentActorSeatIndex) is done separately by the client
  // This allows computing validActions for the next actor before their status is set to 'active'
  const cannotActStatuses = ['folded', 'all_in', 'sitting_out', 'eliminated'];
  if (cannotActStatuses.includes(status)) return result;
  result.canFold = true;
  const toCall = currentBet - playerBet;
  if (toCall <= 0) {
    result.canCheck = true;
    if (playerStack > 0) {
      result.canBet = true;
      result.minBet = Math.min(bigBlind, playerStack);
    }
  } else {
    result.canCall = true;
    result.callAmount = Math.min(toCall, playerStack);
    if (playerStack > toCall) {
      const minRaiseAbsolute = currentBet + minRaise;
      const maxRaiseAbsolute = playerBet + playerStack;
      if (minRaiseAbsolute <= maxRaiseAbsolute) {
        result.canRaise = true;
        result.minRaise = minRaiseAbsolute;
        result.maxRaise = maxRaiseAbsolute;
      }
    }
  }
  return result;
}

function isValidAction(
  action: ActionType,
  amount: number,
  validActions: ValidActions
): { valid: boolean; error?: string } {
  switch (action) {
    case 'fold':
      return validActions.canFold ? { valid: true } : { valid: false, error: 'Cannot fold' };
    case 'check':
      return validActions.canCheck ? { valid: true } : { valid: false, error: 'Cannot check - must call or fold' };
    case 'call':
      return validActions.canCall ? { valid: true } : { valid: false, error: 'Cannot call - nothing to call' };
    case 'bet':
      if (!validActions.canBet) return { valid: false, error: 'Cannot bet' };
      if (amount < validActions.minBet) return { valid: false, error: `Bet must be at least ${validActions.minBet}` };
      return { valid: true };
    case 'raise':
      if (!validActions.canRaise) return { valid: false, error: 'Cannot raise' };
      if (amount < validActions.minRaise) return { valid: false, error: `Raise must be at least ${validActions.minRaise}` };
      return { valid: true };
    case 'all_in':
      return { valid: true };
    default:
      return { valid: false, error: `Unknown action: ${action}` };
  }
}

function getStatusAfterAction(currentStatus: string, action: ActionType, isAllIn: boolean): PlayerStatus {
  if (action === 'fold') return 'folded';
  if (isAllIn || action === 'all_in') return 'all_in';
  if (['check', 'call', 'bet', 'raise', 'post_sb', 'post_bb', 'post_ante'].includes(action)) return 'acted';
  return currentStatus as PlayerStatus;
}

// =============================================================================
// Game State Advancement (async DB operations)
// =============================================================================

/**
 * Advance game state for a table (idempotent)
 */
export async function advanceGameState(tableId: string): Promise<AdvanceResult> {
  const result: AdvanceResult = {
    timeoutHandled: false,
    showdownCompleted: false,
    newHandStarted: false,
    cleanedUpHands: 0,
    recoveredActor: false,
    hand: null,
  };

  // 1. Clean up broken 'dealing' phase hands
  result.cleanedUpHands = await cleanupBrokenHands(tableId);

  // 2. Handle expired turn timeouts
  result.timeoutHandled = await maybeHandleTimeout(tableId);

  // 3. Recover invalid actor state
  result.recoveredActor = await maybeRecoverActorState(tableId);
  if (result.recoveredActor) {
    console.log(`[advanceGameState] table=${tableId} recovered actor state`);
  }

  // 4. Complete stale showdowns
  result.showdownCompleted = await maybeCompleteShowdown(tableId);

  // 5. Start new hand if needed
  const newHandResult = await maybeStartNewHand(tableId);
  result.newHandStarted = newHandResult.started;
  result.hand = newHandResult.hand;

  // If no new hand was started, get current hand
  if (!result.hand) {
    result.hand = await handRepo.getCurrentHand(tableId);
  }

  return result;
}

async function cleanupBrokenHands(tableId: string): Promise<number> {
  const db = getDb();
  // Only delete 'dealing' hands that are older than 10 seconds (stale/broken)
  // This prevents deleting hands that are actively being set up
  const staleThreshold = now() - 10000;
  await db
    .delete(hands)
    .where(and(
      eq(hands.tableId, tableId),
      eq(hands.phase, 'dealing'),
      sql`${hands.startedAt} < ${staleThreshold}`
    ));
  return 0; // Drizzle doesn't easily return affected count
}

async function maybeHandleTimeout(tableId: string): Promise<boolean> {
  const hand = await getBettingHand(tableId);
  if (!hand) return false;
  if (hand.currentActorSeat === null || hand.currentActorSeat === undefined) return false;
  if (hand.actionDeadline === null || hand.actionDeadline === undefined) return false;
  if (now() < hand.actionDeadline) return false;

  const currentActor = await tableRepo.getPlayerBySeat(tableId, hand.currentActorSeat);
  if (!currentActor) return false;
  if (CANNOT_ACT_STATUSES.includes(currentActor.status as PlayerStatus)) return false;

  const result = await handleTurnTimeout(tableId);
  return result.success;
}

async function maybeRecoverActorState(tableId: string): Promise<boolean> {
  const hand = await getBettingHand(tableId);
  if (!hand) return false;

  if (hand.currentActorSeat === null) {
    // Actor seat is null during an active betting phase — this is the "no one's turn" bug
    console.warn(`[maybeRecoverActorState] hand=${hand.id} phase=${hand.phase} currentActorSeat=null — attempting recovery`);
    const { players } = await tableRepo.getTableWithPlayers(tableId);
    const mappedPlayers = players.map((p) => ({
      seatIndex: p.seatIndex,
      status: p.status,
      currentBet: p.currentBet,
    }));
    console.warn(`[maybeRecoverActorState] players:`, mappedPlayers.map(p => `s${p.seatIndex}:${p.status}:bet${p.currentBet}`).join(', '), `handCurrentBet=${hand.currentBet}`);

    // Try to find any valid actor
    const playersWhoCanAct = getPlayersWhoCanAct(mappedPlayers);
    if (playersWhoCanAct.length > 0) {
      // Find the first waiting/active player to give the turn to
      const recoveredActor = playersWhoCanAct[0];
      console.warn(`[maybeRecoverActorState] hand=${hand.id} recovering → seat ${recoveredActor.seatIndex}`);
      await handRepo.updateHand(hand.id, {
        currentActorSeat: recoveredActor.seatIndex,
        actionDeadline: now() + 30000,
      });
      await tableRepo.updatePlayerBySeat(tableId, recoveredActor.seatIndex, { status: 'active' });
      return true;
    } else {
      console.warn(`[maybeRecoverActorState] hand=${hand.id} no players who can act — checking if should advance phase or showdown`);
      // Check if all players are all-in and we need to run through streets
      const active = getActivePlayers(mappedPlayers);
      if (active.length >= 2 && active.every(p => p.status === 'all_in')) {
        console.warn(`[maybeRecoverActorState] hand=${hand.id} all players all-in, scheduling street progression`);
        scheduleAllInStreetProgression(hand.id, tableId, hand.phase as HandPhase);
        return true;
      }
    }
    return false;
  }

  const { players } = await tableRepo.getTableWithPlayers(tableId);
  const currentActor = players.find((p) => p.seatIndex === hand.currentActorSeat);

  if (!currentActor || !CANNOT_ACT_STATUSES.includes(currentActor.status as PlayerStatus)) {
    return false;
  }

  console.log(`[maybeRecoverActorState] hand=${hand.id} actor at seat ${hand.currentActorSeat} has status ${currentActor.status}, finding next actor`);

  const mappedPlayers = players.map((p) => ({
    seatIndex: p.seatIndex,
    status: p.status,
    currentBet: p.currentBet,
  }));
  const nextActor = findNextActor(hand, mappedPlayers, hand.currentActorSeat);

  if (nextActor) {
    await handRepo.updateHand(hand.id, {
      currentActorSeat: nextActor.seatIndex,
      actionDeadline: now() + 30000,
    });
    await tableRepo.updatePlayerBySeat(tableId, nextActor.seatIndex, { status: 'active' });
    console.log(`[maybeRecoverActorState] hand=${hand.id} advanced to seat ${nextActor.seatIndex}`);
    return true;
  } else {
    console.warn(`[maybeRecoverActorState] hand=${hand.id} findNextActor returned null from seat ${hand.currentActorSeat}. players:`, mappedPlayers.map(p => `s${p.seatIndex}:${p.status}:bet${p.currentBet}`).join(', '));
  }

  return false;
}

async function maybeCompleteShowdown(tableId: string): Promise<boolean> {
  const db = getDb();
  // Handle hands stuck in 'showdown' phase (the only terminal phase in the database that can get stuck)
  // Note: 'awarding' and 'hand-complete' are client-side only phases in the Zustand store
  const [hand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, tableId), eq(hands.phase, 'showdown')))
    .orderBy(desc(hands.handNumber))
    .limit(1);

  if (!hand) return false;

  const showdownStartedAt = hand.showdownStartedAt;
  if (!showdownStartedAt) {
    const handAge = now() - hand.startedAt;
    if (handAge < 8000) return false;
  } else {
    const showdownAge = now() - showdownStartedAt;
    if (showdownAge < 7000) return false;
  }

  console.log(`[maybeCompleteShowdown] Completing stale showdown for hand ${hand.id}`);

  // Fetch current player states for debugging
  const { players: debugPlayers, table: debugTable } = await tableRepo.getTableWithPlayers(tableId);
  console.log(`[maybeCompleteShowdown] Current players before completeHand:`,
    debugPlayers.map(p => ({ seat: p.seatIndex, stack: p.stack, status: p.status, name: p.name })));
  console.log(`[maybeCompleteShowdown] Table status: ${debugTable?.status}`);

  // Use completeHand which handles:
  // 1. Marking hand as complete
  // 2. Broadcasting HAND_COMPLETE
  // 3. Marking eliminated players (stack === 0)
  // 4. Detecting tournament winner
  // 5. Starting next hand
  await completeHand(hand.id, tableId);

  return true;
}

async function maybeStartNewHand(tableId: string): Promise<{ started: boolean; hand: Hand | null }> {
  const db = getDb();

  // Check if there's already an active hand
  const [existingHand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, tableId), ne(hands.phase, 'complete')))
    .orderBy(desc(hands.handNumber))
    .limit(1);

  if (existingHand) {
    return { started: false, hand: existingHand };
  }

  // Get table and players
  const { table, players } = await tableRepo.getTableWithPlayers(tableId);
  if (!table) return { started: false, hand: null };

  // Skip if table/tournament is already complete (avoid duplicate broadcasts)
  if (table.status === 'complete') {
    console.log(`[maybeStartNewHand] Table status is 'complete', skipping new hand`);
    return { started: false, hand: null };
  }

  // Get players with chips (not eliminated and stack > 0)
  const activePlayers = players.filter((p) => !['eliminated', 'sitting_out'].includes(p.status) && p.stack > 0);
  console.log(`[maybeStartNewHand] Active players (stack > 0, not eliminated):`,
    activePlayers.map(p => ({ seat: p.seatIndex, stack: p.stack, status: p.status, name: p.name })));

  // Tournament winner - only 1 player with chips remaining
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    console.log(`[maybeStartNewHand] Tournament winner detected: ${winner.name}`);

    // Mark tournament and table as complete
    await tournamentRepo.updateTournamentStatus(table.tournamentId, 'complete');
    await db.update(tables).set({ status: 'complete' }).where(eq(tables.id, tableId));

    // Broadcast tournament complete
    if (pusher) {
      pusher.trigger(`table-${tableId}`, 'TOURNAMENT_COMPLETE', {
        eventId: `tournament-complete-${table.tournamentId}`,
        winner: {
          playerId: winner.playerId,
          name: winner.name,
          seatIndex: winner.seatIndex,
          stack: winner.stack,
        },
      }).catch((err) => console.error('[maybeStartNewHand] Failed to broadcast TOURNAMENT_COMPLETE:', err));
    }

    return { started: false, hand: null };
  }

  if (activePlayers.length < 2) return { started: false, hand: null };

  // Get the next hand number
  const nextHandNumber = await handRepo.getNextHandNumber(tableId);

  try {
    console.log(`[advanceGameState] Starting new hand #${nextHandNumber}`);
    const hand = await startNewHand(tableId, nextHandNumber);

    if (pusher && hand) {
      const firstActorPlayer = players.find((p) => p.seatIndex === hand.currentActorSeat);
      const toCall = Math.max(0, hand.currentBet - (firstActorPlayer?.currentBet || 0));
      const validActionsForActor = firstActorPlayer
        ? getValidActions({
            status: firstActorPlayer.status,
            currentBet: hand.currentBet,
            playerBet: firstActorPlayer.currentBet,
            playerStack: firstActorPlayer.stack,
            minRaise: hand.minRaise,
            bigBlind: table.bigBlind,
            canCheck: toCall === 0,
          })
        : null;

      pusher.trigger(`table-${tableId}`, 'HAND_STARTED', {
        eventId: `hand-started-${hand.id}`,
        handNumber: hand.handNumber,
        dealerSeatIndex: hand.dealerSeat,
        smallBlindSeatIndex: hand.smallBlindSeat,
        bigBlindSeatIndex: hand.bigBlindSeat,
        firstActorSeat: hand.currentActorSeat,
        blinds: { sb: table.smallBlind, bb: table.bigBlind },
      }).catch((err) => console.error('[advanceGameState] Failed to broadcast HAND_STARTED:', err));

      pusher.trigger(`table-${tableId}`, 'TURN_STARTED', {
        eventId: `turn-${hand.id}-0-${hand.currentActorSeat}`,
        seatIndex: hand.currentActorSeat,
        expiresAt: hand.actionDeadline ?? null,
        isUnlimited: hand.actionDeadline === null,
        validActions: validActionsForActor,
      }).catch((err) => console.error('[advanceGameState] Failed to broadcast TURN_STARTED:', err));
    }

    return { started: true, hand };
  } catch (err) {
    console.log(`[advanceGameState] Hand start skipped (likely concurrent):`, err);
    return { started: false, hand: null };
  }
}

async function getBettingHand(tableId: string): Promise<Hand | null> {
  const db = getDb();
  const [hand] = await db
    .select()
    .from(hands)
    .where(
      and(
        eq(hands.tableId, tableId),
        notInArray(hands.phase, ['complete', 'awarding', 'showdown'])
      )
    )
    .orderBy(desc(hands.handNumber))
    .limit(1);
  return hand ?? null;
}

// =============================================================================
// Start New Hand
// =============================================================================

export async function startNewHand(tableId: string, handNumber: number): Promise<Hand> {
  const db = getDb();
  const timestamp = now();

  // Idempotency guard: check if there's already an active hand
  const [existingHand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, tableId), ne(hands.phase, 'complete')))
    .limit(1);

  if (existingHand) {
    throw new Error(`Active hand already exists: ${existingHand.id} (phase: ${existingHand.phase})`);
  }

  // Get table
  const table = await tableRepo.getTable(tableId);
  if (!table) throw new Error('Table not found');

  // Get tournament for timer settings
  const tournament = await tournamentRepo.getTournament(table.tournamentId);
  const turnTimerSeconds = tournament?.turnTimerSeconds;

  // Get active players (must have chips and not be eliminated/sitting out)
  const { players } = await tableRepo.getTableWithPlayers(tableId);
  const activePlayers = players.filter((p) =>
    !['eliminated', 'sitting_out'].includes(p.status) && p.stack > 0
  );
  console.log(`[startNewHand] Active players for new hand:`,
    activePlayers.map(p => ({ seat: p.seatIndex, stack: p.stack, status: p.status, name: p.name })));

  if (activePlayers.length < 2) {
    console.log(`[startNewHand] ERROR: Only ${activePlayers.length} active players, need at least 2`);
    throw new Error('Need at least 2 players to start a hand');
  }

  // Determine dealer position
  const currentDealerSeat = table.dealerSeat;
  const newDealerSeat = handNumber === 1
    ? findNextActiveSeat(activePlayers, -1)
    : findNextActiveSeat(activePlayers, currentDealerSeat);

  // Determine blind positions
  const headsUp = activePlayers.length === 2;
  let smallBlindSeat: number;
  let bigBlindSeat: number;

  if (headsUp) {
    smallBlindSeat = newDealerSeat;
    bigBlindSeat = findNextActiveSeat(activePlayers, newDealerSeat);
  } else {
    smallBlindSeat = findNextActiveSeat(activePlayers, newDealerSeat);
    bigBlindSeat = findNextActiveSeat(activePlayers, smallBlindSeat);
  }

  // Create and shuffle deck
  const deck = createShuffledDeck();

  // Create hand record
  const handId = generateId();
  await db.insert(hands).values({
    id: handId,
    tableId,
    handNumber,
    phase: 'dealing',
    dealerSeat: newDealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    currentActorSeat: null,
    currentBet: 0,
    minRaise: table.bigBlind,
    pot: 0,
    communityCards: '[]',
    deck: JSON.stringify(deck.map(cardToString)),
    startedAt: timestamp,
    version: 1,
  });

  // Update table's dealer seat
  await tableRepo.updateDealerSeat(tableId, newDealerSeat);

  // Reset all active players for new hand
  await tableRepo.resetPlayerStatusesForNewHand(tableId);

  // Post blinds
  let totalPot = 0;
  const sbPlayer = activePlayers.find((p) => p.seatIndex === smallBlindSeat);
  const bbPlayer = activePlayers.find((p) => p.seatIndex === bigBlindSeat);

  if (!sbPlayer || !bbPlayer) throw new Error('Could not find blind players');

  // Post small blind
  const sbAmount = Math.min(table.smallBlind, sbPlayer.stack);
  await db
    .update(tablePlayers)
    .set({
      stack: sql`${tablePlayers.stack} - ${sbAmount}`,
      currentBet: sql`${tablePlayers.currentBet} + ${sbAmount}`,
    })
    .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, smallBlindSeat)));
  await handRepo.recordAction({
    handId,
    playerId: sbPlayer.playerId,
    seatIndex: smallBlindSeat,
    actionType: 'post_sb',
    amount: sbAmount,
    phase: 'preflop',
  });
  totalPot += sbAmount;

  // Post big blind
  const bbAmount = Math.min(table.bigBlind, bbPlayer.stack);
  await db
    .update(tablePlayers)
    .set({
      stack: sql`${tablePlayers.stack} - ${bbAmount}`,
      currentBet: sql`${tablePlayers.currentBet} + ${bbAmount}`,
    })
    .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, bigBlindSeat)));
  await handRepo.recordAction({
    handId,
    playerId: bbPlayer.playerId,
    seatIndex: bigBlindSeat,
    actionType: 'post_bb',
    amount: bbAmount,
    phase: 'preflop',
  });
  totalPot += bbAmount;

  // Update hand with pot
  await db.update(hands).set({ currentBet: table.bigBlind, pot: totalPot }).where(eq(hands.id, handId));

  // Deal hole cards and broadcast to private channels
  let deckIndex = 0;
  const dealtCards: Array<{ playerId: string; cards: [Card, Card] }> = [];
  for (const player of activePlayers) {
    const card1 = deck[deckIndex++];
    const card2 = deck[deckIndex++];
    await db
      .update(tablePlayers)
      .set({ holeCard1: cardToString(card1), holeCard2: cardToString(card2) })
      .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, player.seatIndex)));
    dealtCards.push({ playerId: player.playerId, cards: [card1, card2] });
  }

  // Update deck
  const remainingDeck = deck.slice(deckIndex).map(cardToString);
  await db.update(hands).set({ deck: JSON.stringify(remainingDeck) }).where(eq(hands.id, handId));

  // Broadcast hole cards to each player's private channel
  if (pusher) {
    for (const { playerId, cards } of dealtCards) {
      pusher.trigger(`private-player-${playerId}`, 'HOLE_CARDS_DEALT', {
        eventId: `hole-cards-${handId}-${playerId}`,
        cards, // Cards in { rank, suit } format
      }).catch((err) => {
        console.error(`[startNewHand] Failed to send hole cards to player ${playerId}:`, err);
      });
    }
  }

  // Get first actor
  const firstActorSeat = headsUp
    ? newDealerSeat
    : findNextActiveSeat(activePlayers, bigBlindSeat);

  // Calculate deadline
  const actionDeadline = turnTimerSeconds !== null && turnTimerSeconds !== undefined
    ? timestamp + turnTimerSeconds * 1000
    : null;

  // Update to preflop phase and set first actor
  await db
    .update(hands)
    .set({ phase: 'preflop', currentActorSeat: firstActorSeat, actionDeadline })
    .where(eq(hands.id, handId));

  // Set first actor's status to active
  await db
    .update(tablePlayers)
    .set({ status: 'active' })
    .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, firstActorSeat)));

  // Emit events
  await eventRepo.emitEvent('hand', handId, 'HAND_STARTED', {
    tableId,
    handNumber,
    dealerSeat: newDealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    firstActorSeat,
  }, 1);

  await eventRepo.emitEvent('hand', handId, 'TURN_STARTED', {
    seatIndex: firstActorSeat,
    expiresAt: actionDeadline,
    isUnlimited: actionDeadline === null,
  }, 1);

  // Return the hand
  const [finalHand] = await db.select().from(hands).where(eq(hands.id, handId));
  return finalHand;
}

// =============================================================================
// Submit Action
// =============================================================================

export async function submitAction(params: SubmitActionParams): Promise<ApiResult<SubmitActionResult>> {
  const { tableId, playerId, action, amount = 0, bypassExpiry = false } = params;
  let normalizedAction = action;

  try {
    const db = getDb();

    // Get current hand
    const [hand] = await db
      .select()
      .from(hands)
      .where(and(eq(hands.tableId, tableId), inArray(hands.phase, ['preflop', 'flop', 'turn', 'river'])))
      .orderBy(desc(hands.handNumber))
      .limit(1);

    if (!hand) {
      return { success: false, error: 'No active hand', code: 'NO_ACTIVE_HAND' };
    }

    // Get table and players
    const { table, players } = await tableRepo.getTableWithPlayers(tableId);
    if (!table) return { success: false, error: 'Table not found' };

    // Find the acting player
    const player = players.find((p) => p.playerId === playerId);
    if (!player) return { success: false, error: 'Player not at this table' };

    // Validate it's their turn
    const mappedPlayers = players.map((p) => ({ seatIndex: p.seatIndex, playerId: p.playerId }));
    if (!isPlayersTurn(hand, playerId, mappedPlayers)) {
      return { success: false, error: `Not your turn. Current actor: seat ${hand.currentActorSeat}` };
    }

    // Check timeout
    if (!bypassExpiry && hand.actionDeadline && now() > hand.actionDeadline) {
      return { success: false, error: 'Turn expired - action timed out' };
    }

    // Get valid actions
    const toCall = Math.max(0, hand.currentBet - player.currentBet);
    const validActions = getValidActions({
      status: player.status,
      currentBet: hand.currentBet,
      playerBet: player.currentBet,
      playerStack: player.stack,
      minRaise: hand.minRaise,
      bigBlind: table.bigBlind,
      canCheck: toCall === 0,
    });

    // Normalize actions
    if (action === 'raise' && toCall <= 0 && validActions.canBet) {
      normalizedAction = 'bet';
    }
    if (action === 'call' && toCall <= 0 && validActions.canCheck) {
      normalizedAction = 'check';
    }

    // Validate the action
    const validation = isValidAction(normalizedAction, amount, validActions);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Calculate amounts
    let actualAmount = 0;
    let newPlayerBet = player.currentBet;
    let newStack = player.stack;
    let isAllIn = false;

    switch (normalizedAction) {
      case 'fold':
      case 'check':
        break;
      case 'call':
        actualAmount = Math.min(toCall, player.stack);
        newPlayerBet += actualAmount;
        newStack -= actualAmount;
        isAllIn = newStack === 0;
        break;
      case 'bet':
      case 'raise':
        const deltaNeeded = amount - player.currentBet;
        actualAmount = Math.min(Math.max(0, deltaNeeded), player.stack);
        newPlayerBet = player.currentBet + actualAmount;
        newStack = player.stack - actualAmount;
        isAllIn = newStack === 0;
        break;
      case 'all_in':
        actualAmount = player.stack;
        newPlayerBet += actualAmount;
        newStack = 0;
        isAllIn = true;
        break;
    }

    // Update player
    const newStatus = getStatusAfterAction(player.status, normalizedAction, isAllIn);
    await db
      .update(tablePlayers)
      .set({ stack: newStack, currentBet: newPlayerBet, status: newStatus })
      .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, player.seatIndex)));

    // Update hand
    let newCurrentBet = hand.currentBet;
    let newMinRaise = hand.minRaise;
    const newPot = hand.pot + actualAmount;

    if (['bet', 'raise', 'all_in'].includes(normalizedAction)) {
      if (newPlayerBet > newCurrentBet) {
        const raiseSize = newPlayerBet - newCurrentBet;
        newMinRaise = Math.max(hand.minRaise, raiseSize);
        newCurrentBet = newPlayerBet;
      }
    }

    await db
      .update(hands)
      .set({ pot: newPot, currentBet: newCurrentBet, minRaise: newMinRaise, version: sql`${hands.version} + 1` })
      .where(eq(hands.id, hand.id));

    // Record action
    await handRepo.recordAction({
      handId: hand.id,
      playerId,
      seatIndex: player.seatIndex,
      actionType: normalizedAction,
      amount: actualAmount,
      phase: hand.phase,
    });

    // Get updated players
    const { players: updatedPlayers } = await tableRepo.getTableWithPlayers(tableId);
    const mappedUpdatedPlayers = updatedPlayers.map((p) => ({
      seatIndex: p.seatIndex,
      status: p.status,
      currentBet: p.currentBet,
    }));

    // Update hand object for checks
    const updatedHand: Hand = { ...hand, pot: newPot, currentBet: newCurrentBet, minRaise: newMinRaise };

    // Determine next state
    let nextActorSeat: number | null = null;
    let phaseChanged = false;
    let newPhase: HandPhase | undefined;
    let isHandComplete = false;

    console.log(`[submitAction] hand=${hand.id} phase=${hand.phase} seat=${player.seatIndex} action=${normalizedAction} players:`, mappedUpdatedPlayers.map(p => `s${p.seatIndex}:${p.status}:bet${p.currentBet}`).join(', '));
    console.log(`[submitAction] hand=${hand.id} currentBet=${newCurrentBet} pot=${newPot} bettingComplete=${isBettingComplete(updatedHand, mappedUpdatedPlayers)} awardWithoutShowdown=${shouldAwardWithoutShowdown(mappedUpdatedPlayers)}`);

    if (shouldAwardWithoutShowdown(mappedUpdatedPlayers)) {
      // Award pot to last remaining player
      const winner = updatedPlayers.find((p) => !INACTIVE_STATUSES.includes(p.status as PlayerStatus));
      if (winner) {
        await db
          .update(tablePlayers)
          .set({ stack: sql`${tablePlayers.stack} + ${newPot}` })
          .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, winner.seatIndex)));

        if (pusher) {
          pusher.trigger(`table-${tableId}`, 'POT_AWARDED', {
            eventId: `pot-awarded-${hand.id}`,
            playerId: winner.playerId,
            seatIndex: winner.seatIndex,
            amount: newPot,
            showdown: false,
          }).catch((err) => console.error('Failed to broadcast POT_AWARDED:', err));
        }
      }

      await db.update(hands).set({ phase: 'complete', endedAt: now() }).where(eq(hands.id, hand.id));
      phaseChanged = true;
      newPhase = 'complete';
      isHandComplete = true;
    } else if (isBettingComplete(updatedHand, mappedUpdatedPlayers)) {
      const nextPhaseValue = getPhaseAfterBetting(hand.phase as HandPhase, updatedHand, mappedUpdatedPlayers);
      phaseChanged = true;
      newPhase = nextPhaseValue;
      console.log(`[submitAction] hand=${hand.id} bettingComplete → nextPhase=${nextPhaseValue}`);

      if (nextPhaseValue === 'showdown') {
        await runShowdown(hand.id, tableId, updatedPlayers, hand.phase as HandPhase);
        isHandComplete = true;
      } else if (nextPhaseValue === 'awarding') {
        // Non-showdown win: award pot to last remaining player
        const winner = updatedPlayers.find((p) => !INACTIVE_STATUSES.includes(p.status as PlayerStatus));
        if (winner) {
          await db
            .update(tablePlayers)
            .set({ stack: sql`${tablePlayers.stack} + ${newPot}` })
            .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, winner.seatIndex)));
        }
        await db.update(hands).set({ phase: 'complete', endedAt: now() }).where(eq(hands.id, hand.id));
        newPhase = 'complete';
        isHandComplete = true;

        // Broadcast WINNER event for non-showdown wins
        if (pusher && winner) {
          pusher.trigger(`table-${tableId}`, 'WINNER', {
            eventId: `winner-${hand.id}`,
            winners: [{
              playerId: winner.playerId,
              seatIndex: winner.seatIndex,
              amount: newPot,
            }],
          }).catch((err) => console.error('[submitAction] Failed to broadcast WINNER:', err));
        }

        // Broadcast HAND_COMPLETE and schedule next hand
        if (pusher) {
          pusher.trigger(`table-${tableId}`, 'HAND_COMPLETE', {
            eventId: `hand-complete-${hand.id}`,
            handNumber: hand.handNumber,
            winners: winner ? [{
              playerId: winner.playerId,
              seatIndex: winner.seatIndex,
              amount: newPot,
              holeCards: [winner.holeCard1, winner.holeCard2].filter(Boolean),
              handRank: 'uncalled',
              description: 'Uncalled bet',
            }] : [],
          }).catch((err) => console.error('[submitAction] Failed to broadcast HAND_COMPLETE:', err));
        }

        // Re-fetch players AFTER pot is awarded to get accurate stack values
        const { players: playersAfterPot, table: refreshedTable } = await tableRepo.getTableWithPlayers(tableId);

        // Mark eliminated players (those with 0 chips)
        for (const p of playersAfterPot) {
          if (p.stack === 0 && p.status !== 'eliminated') {
            await db.update(tablePlayers).set({ status: 'eliminated' }).where(eq(tablePlayers.id, p.id));
          }
        }

        // Re-fetch to get updated statuses after elimination
        const { players: refreshedAfterElim } = await tableRepo.getTableWithPlayers(tableId);
        const remainingPlayers = refreshedAfterElim.filter((p) => p.stack > 0 && p.status !== 'eliminated');

        // Tournament winner - only one player left
        if (remainingPlayers.length === 1 && refreshedTable) {
          const tournamentWinner = remainingPlayers[0];
          console.log(`[submitAction] Tournament winner: ${tournamentWinner.name}`);

          await tournamentRepo.updateTournamentStatus(refreshedTable.tournamentId, 'complete');
          await db.update(tables).set({ status: 'complete' }).where(eq(tables.id, tableId));

          if (pusher) {
            pusher.trigger(`table-${tableId}`, 'TOURNAMENT_COMPLETE', {
              eventId: `tournament-complete-${refreshedTable.tournamentId}`,
              winner: {
                playerId: tournamentWinner.playerId,
                name: tournamentWinner.name,
                seatIndex: tournamentWinner.seatIndex,
                stack: tournamentWinner.stack,
              },
            }).catch((err) => console.error('[submitAction] Failed to broadcast TOURNAMENT_COMPLETE:', err));
          }
        } else if (remainingPlayers.length >= 2) {
          // Schedule next hand (with delay for UI transition)
          console.log(`[submitAction] hand=${hand.id} scheduling next hand in 2000ms (awarding path, ${remainingPlayers.length} remaining)`);
          setTimeout(async () => {
            try {
              const nextHandNumber = (hand.handNumber || 0) + 1;
              console.log(`[submitAction] setTimeout fired — starting hand #${nextHandNumber} for table ${tableId} (awarding path)`);
              const newHand = await startNewHand(tableId, nextHandNumber);

              if (pusher && newHand) {
                const { table: tableForHand, players: playersForHand } = await tableRepo.getTableWithPlayers(tableId);
                const firstActorPlayer = playersForHand.find((p) => p.seatIndex === newHand.currentActorSeat);
                const toCall = Math.max(0, newHand.currentBet - (firstActorPlayer?.currentBet || 0));
                const validActionsForActor = firstActorPlayer && tableForHand
                  ? getValidActions({
                      status: firstActorPlayer.status,
                      currentBet: newHand.currentBet,
                      playerBet: firstActorPlayer.currentBet,
                      playerStack: firstActorPlayer.stack,
                      minRaise: newHand.minRaise,
                      bigBlind: tableForHand.bigBlind,
                      canCheck: toCall === 0,
                    })
                  : null;

                pusher.trigger(`table-${tableId}`, 'HAND_STARTED', {
                  eventId: `hand-started-${newHand.handNumber}`,
                  handNumber: newHand.handNumber,
                  dealerSeatIndex: newHand.dealerSeat,
                  smallBlindSeatIndex: newHand.smallBlindSeat,
                  bigBlindSeatIndex: newHand.bigBlindSeat,
                  firstActorSeat: newHand.currentActorSeat,
                  blinds: tableForHand ? { sb: tableForHand.smallBlind, bb: tableForHand.bigBlind } : undefined,
                }).catch((err) => console.error('[submitAction] Failed to broadcast HAND_STARTED:', err));

                pusher.trigger(`table-${tableId}`, 'TURN_STARTED', {
                  eventId: `turn-${newHand.currentActorSeat}-${newHand.actionDeadline ?? 'unlimited'}`,
                  seatIndex: newHand.currentActorSeat,
                  expiresAt: newHand.actionDeadline,
                  isUnlimited: newHand.actionDeadline === null,
                  validActions: validActionsForActor,
                }).catch((err) => console.error('[submitAction] Failed to broadcast TURN_STARTED:', err));
              }
            } catch (err) {
              console.error('[submitAction] Failed to start next hand:', err);
            }
          }, 2000);
        }
      } else {
        console.log(`[submitAction] hand=${hand.id} advancing ${hand.phase} → ${nextPhaseValue}`);
        await advanceToNextPhase(hand.id, tableId, updatedPlayers, nextPhaseValue);

        // Broadcast phase change with community cards
        if (pusher) {
          const [handAfterAdvance] = await db.select().from(hands).where(eq(hands.id, hand.id));
          const communityCards: string[] = JSON.parse(handAfterAdvance?.communityCards || '[]');
          pusher.trigger(`table-${tableId}`, 'PHASE_CHANGED', {
            eventId: `phase-${nextPhaseValue}-${hand.id}`,
            phase: nextPhaseValue,
            communityCards,
          }).catch((err) => console.error('[submitAction] Failed to broadcast PHASE_CHANGED:', err));
        }

        const { players: refreshedPlayers } = await tableRepo.getTableWithPlayers(tableId);
        const mappedRefreshed = refreshedPlayers.map((p) => ({ seatIndex: p.seatIndex, status: p.status }));
        const headsUpNow = isHeadsUp(mappedRefreshed);
        console.log(`[submitAction] hand=${hand.id} after phase advance, finding first actor. dealer=${table.dealerSeat} headsUp=${headsUpNow} bb=${hand.bigBlindSeat} players:`, mappedRefreshed.map(p => `s${p.seatIndex}:${p.status}`).join(', '));
        const firstActor = getFirstPostflopActor(mappedRefreshed, table.dealerSeat, headsUpNow, hand.bigBlindSeat);
        if (firstActor) {
          nextActorSeat = firstActor.seatIndex;
          console.log(`[submitAction] hand=${hand.id} firstActor for ${nextPhaseValue} → seat ${firstActor.seatIndex}`);
          await setNextActor(hand.id, tableId, firstActor.seatIndex);
        } else {
          // No one can act - all players are all-in
          // Auto-advance through streets with delays to build anticipation
          console.log(`[submitAction] hand=${hand.id} no actor for ${nextPhaseValue}, scheduling all-in street progression`);
          const [updatedHandForPhase] = await db.select().from(hands).where(eq(hands.id, hand.id));
          if (updatedHandForPhase) {
            scheduleAllInStreetProgression(hand.id, tableId, updatedHandForPhase.phase as HandPhase);
          }
        }
      }
    } else {
      const nextPlayer = findNextActor(updatedHand, mappedUpdatedPlayers, player.seatIndex);
      if (nextPlayer) {
        nextActorSeat = nextPlayer.seatIndex;
        console.log(`[submitAction] hand=${hand.id} nextActor → seat ${nextPlayer.seatIndex}`);
        await setNextActor(hand.id, tableId, nextPlayer.seatIndex);
      } else {
        console.warn(`[submitAction] BUG: hand=${hand.id} phase=${hand.phase} betting NOT complete but findNextActor returned null! players:`, mappedUpdatedPlayers.map(p => `s${p.seatIndex}:${p.status}:bet${p.currentBet}`).join(', '), `handCurrentBet=${newCurrentBet}`);
      }
    }

    // Fetch final state
    const [finalHand] = await db.select().from(hands).where(eq(hands.id, hand.id));
    const { players: finalPlayers } = await tableRepo.getTableWithPlayers(tableId);

    // Telemetry: warn if hand is active but no one has the turn
    if (!isHandComplete && nextActorSeat === null && finalHand && !['complete', 'showdown', 'awarding'].includes(finalHand.phase)) {
      console.warn(`[submitAction] WARNING: hand=${hand.id} phase=${finalHand.phase} dbActorSeat=${finalHand.currentActorSeat} — returning nextActorSeat=null for active hand! This will cause "no one's turn".`);
      console.warn(`[submitAction] Final players:`, finalPlayers.map(p => `s${p.seatIndex}:${p.status}:stack${p.stack}:bet${p.currentBet}`).join(', '));
    }

    return {
      success: true,
      data: {
        hand: finalHand,
        players: finalPlayers,
        nextActorSeat,
        phaseChanged,
        newPhase,
        isHandComplete,
        actionDetails: {
          seatIndex: player.seatIndex,
          action: normalizedAction,
          actualAmount,
          newPlayerBet,
          newStack,
          isAllIn,
        },
      },
    };
  } catch (error) {
    console.error('[submitAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Action failed',
    };
  }
}

async function setNextActor(handId: string, tableId: string, seatIndex: number): Promise<void> {
  const db = getDb();

  console.log(`[setNextActor] hand=${handId} → seat ${seatIndex}`);

  // Get tournament timer
  const [table] = await db.select().from(tables).where(eq(tables.id, tableId));
  const tournament = table ? await tournamentRepo.getTournament(table.tournamentId) : null;
  const turnTimerSeconds = tournament?.turnTimerSeconds;
  const deadline = turnTimerSeconds !== null && turnTimerSeconds !== undefined
    ? now() + turnTimerSeconds * 1000
    : null;

  // Clear previous actor's active status
  await db
    .update(tablePlayers)
    .set({ status: 'acted' })
    .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.status, 'active')));

  // Set new actor
  await db
    .update(tablePlayers)
    .set({ status: 'active' })
    .where(
      and(
        eq(tablePlayers.tableId, tableId),
        eq(tablePlayers.seatIndex, seatIndex),
        inArray(tablePlayers.status, ['waiting', 'acted', 'active'])
      )
    );

  await db
    .update(hands)
    .set({ currentActorSeat: seatIndex, actionDeadline: deadline })
    .where(eq(hands.id, handId));
}

async function advanceToNextPhase(
  handId: string,
  tableId: string,
  players: Array<TablePlayer & { name: string; avatar: string | null }>,
  newPhase: HandPhase
): Promise<void> {
  const db = getDb();
  const [hand] = await db.select().from(hands).where(eq(hands.id, handId));
  if (!hand) return;

  console.log(`[advanceToNextPhase] hand=${handId} ${hand.phase} → ${newPhase} (currentActorSeat=${hand.currentActorSeat} will NOT be updated here — caller must set next actor)`);

  // Deal community cards
  const currentCards: string[] = JSON.parse(hand.communityCards || '[]');
  const targetCardCount = COMMUNITY_CARDS_BY_PHASE[newPhase];
  const cardsToDeal = targetCardCount - currentCards.length;

  if (cardsToDeal > 0) {
    const deck: string[] = JSON.parse(hand.deck);
    deck.shift(); // Burn
    const newCards = deck.splice(0, cardsToDeal);
    currentCards.push(...newCards);

    await db
      .update(hands)
      .set({ communityCards: JSON.stringify(currentCards), deck: JSON.stringify(deck), phase: newPhase, currentBet: 0 })
      .where(eq(hands.id, handId));
  } else {
    await db.update(hands).set({ phase: newPhase, currentBet: 0 }).where(eq(hands.id, handId));
  }

  // Reset player bets and statuses for new round
  for (const player of players) {
    if (INACTIVE_STATUSES.includes(player.status as PlayerStatus) || player.status === 'all_in') {
      await db
        .update(tablePlayers)
        .set({ currentBet: 0 })
        .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, player.seatIndex)));
    } else {
      await db
        .update(tablePlayers)
        .set({ status: 'waiting', currentBet: 0 })
        .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, player.seatIndex)));
    }
  }
}

// =============================================================================
// Showdown
// =============================================================================

async function runShowdown(
  handId: string,
  tableId: string,
  players: Array<TablePlayer & { name: string; avatar: string | null }>,
  currentPhase: HandPhase
): Promise<void> {
  const db = getDb();
  const [hand] = await db.select().from(hands).where(eq(hands.id, handId));
  if (!hand) return;

  // Deal remaining community cards
  const communityCards: string[] = JSON.parse(hand.communityCards || '[]');
  const deck: string[] = JSON.parse(hand.deck);

  while (communityCards.length < 5 && deck.length > 0) {
    if (deck.length > 0) deck.shift(); // Burn
    if (deck.length > 0) communityCards.push(deck.shift()!);
  }

  // Update hand
  const showdownStartedAt = now();
  await db
    .update(hands)
    .set({ communityCards: JSON.stringify(communityCards), deck: JSON.stringify(deck), phase: 'showdown', showdownStartedAt })
    .where(eq(hands.id, handId));

  // Get eligible players
  const eligiblePlayers = players.filter(
    (p) => !INACTIVE_STATUSES.includes(p.status as PlayerStatus) && p.holeCard1 && p.holeCard2
  );

  if (eligiblePlayers.length === 0) return;

  if (eligiblePlayers.length === 1) {
    await awardPotToPlayer(tableId, eligiblePlayers[0].seatIndex, hand.pot);
    await completeHand(handId, tableId);
    return;
  }

  // Evaluate hands
  const evaluatedHands: Array<{
    player: typeof eligiblePlayers[0];
    solvedHand: unknown;
    rank: HandRank;
    description: string;
    bestCards: string[];
  }> = [];

  for (const player of eligiblePlayers) {
    const allCards = [player.holeCard1!, player.holeCard2!, ...communityCards];
    try {
      const solved = PokersolverHand.solve(allCards);
      const bestCards = (solved.cards || []).map((c: { value: string; suit: string }) => {
        const rank = c.value === '10' ? 'T' : c.value;
        return `${rank}${c.suit}`;
      });
      evaluatedHands.push({
        player,
        solvedHand: solved,
        rank: RANK_MAP[solved.name] || 'high-card',
        description: solved.descr,
        bestCards,
      });
    } catch (err) {
      evaluatedHands.push({
        player,
        solvedHand: null,
        rank: 'high-card',
        description: 'Error evaluating hand',
        bestCards: [],
      });
    }
  }

  // Find winners
  const solvedHands = evaluatedHands.filter((e) => e.solvedHand !== null).map((e) => e.solvedHand);
  if (solvedHands.length === 0) {
    await awardPotToPlayer(tableId, eligiblePlayers[0].seatIndex, hand.pot);
    await completeHand(handId, tableId);
    return;
  }

  const winners = PokersolverHand.winners(solvedHands);
  const winningPlayers = evaluatedHands.filter((e) =>
    winners.some(
      (w: { descr: string; name: string }) =>
        e.solvedHand && w.descr === (e.solvedHand as { descr: string }).descr &&
        w.name === (e.solvedHand as { name: string }).name
    )
  );

  // Calculate pot split
  const potShare = Math.floor(hand.pot / winningPlayers.length);
  const remainder = hand.pot % winningPlayers.length;

  // Award pots
  for (let i = 0; i < winningPlayers.length; i++) {
    const { player, rank, description } = winningPlayers[i];
    const winAmount = potShare + (i === 0 ? remainder : 0);
    await awardPotToPlayer(tableId, player.seatIndex, winAmount);
    await handRepo.recordShowdownResult({
      handId,
      playerId: player.playerId,
      seatIndex: player.seatIndex,
      handRank: rank,
      handDescription: description,
      bestHand: JSON.stringify([player.holeCard1, player.holeCard2]),
      winnings: winAmount,
    });
  }

  // Build showdown payload
  const showdownPayload = {
    handNumber: hand.handNumber,
    communityCards,
    winners: winningPlayers.map((w, i) => ({
      playerId: w.player.playerId,
      seatIndex: w.player.seatIndex,
      holeCards: [w.player.holeCard1!, w.player.holeCard2!],
      handRank: w.rank,
      description: w.description,
      bestCards: w.bestCards,
      amount: potShare + (i === 0 ? remainder : 0),
    })),
    pot: hand.pot,
  };

  // Emit showdown event
  await eventRepo.emitEvent('hand', handId, 'SHOWDOWN', showdownPayload, hand.version + 1);

  if (pusher) {
    pusher.trigger(`table-${tableId}`, 'SHOWDOWN', {
      ...showdownPayload,
      eventId: `showdown-${hand.handNumber}`,
    }).catch((err) => console.error('Failed to broadcast SHOWDOWN:', err));
  }

  // Complete hand after delay
  setTimeout(async () => {
    try {
      await completeHand(handId, tableId, showdownPayload);
    } catch (err) {
      console.error('Failed to complete hand:', err);
    }
  }, 5000);
}

async function awardPotToPlayer(tableId: string, seatIndex: number, amount: number): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set({ stack: sql`${tablePlayers.stack} + ${amount}` })
    .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, seatIndex)));
}

async function completeHand(
  handId: string,
  tableId: string,
  showdownPayload?: { winners: Array<{ playerId: string; seatIndex: number; amount: number }> }
): Promise<void> {
  const db = getDb();

  // Idempotency guard: only complete if hand is still in showdown phase
  // This prevents double completion from concurrent setTimeout + maybeCompleteShowdown
  const [currentHand] = await db.select().from(hands).where(eq(hands.id, handId));
  if (!currentHand || currentHand.phase === 'complete') {
    console.log(`[completeHand] Hand ${handId} already completed or not found, skipping`);
    return;
  }

  // Use atomic update with phase check for extra safety
  const result = await db
    .update(hands)
    .set({ phase: 'complete', endedAt: now(), currentActorSeat: null, actionDeadline: null })
    .where(and(eq(hands.id, handId), ne(hands.phase, 'complete')));

  // If no rows updated, hand was already completed by another process
  // Note: Drizzle doesn't easily return affected count, so we re-check
  const [hand] = await db.select().from(hands).where(eq(hands.id, handId));
  if (hand?.phase !== 'complete') {
    console.log(`[completeHand] Failed to complete hand ${handId}, phase is ${hand?.phase}`);
    return;
  }

  const handCompletePayload = {
    handNumber: hand?.handNumber,
    winners: showdownPayload?.winners || [],
  };

  await eventRepo.emitEvent('hand', handId, 'HAND_COMPLETE', handCompletePayload, (hand?.version || 0) + 1);

  if (pusher) {
    pusher.trigger(`table-${tableId}`, 'HAND_COMPLETE', {
      ...handCompletePayload,
      eventId: `hand-complete-${handId}`,
    }).catch((err) => console.error('Failed to broadcast HAND_COMPLETE:', err));
  }

  // Check for eliminated players and start next hand
  const { players } = await tableRepo.getTableWithPlayers(tableId);
  console.log(`[completeHand] Players after fetching:`,
    players.map(p => ({ seat: p.seatIndex, stack: p.stack, status: p.status, name: p.name })));

  for (const player of players) {
    if (player.stack === 0 && player.status !== 'eliminated') {
      console.log(`[completeHand] Marking player ${player.name} (seat ${player.seatIndex}) as eliminated (stack=0)`);
      await db.update(tablePlayers).set({ status: 'eliminated' }).where(eq(tablePlayers.id, player.id));
    }
  }

  // Re-fetch players after elimination updates
  const { players: refreshedPlayers, table } = await tableRepo.getTableWithPlayers(tableId);
  const remainingPlayers = refreshedPlayers.filter((p) => p.stack > 0 && p.status !== 'eliminated');
  console.log(`[completeHand] Remaining players after elimination:`,
    remainingPlayers.map(p => ({ seat: p.seatIndex, stack: p.stack, status: p.status, name: p.name })));
  console.log(`[completeHand] Table status: ${table?.status}`);

  // Tournament winner - only one player left with chips
  if (remainingPlayers.length === 1 && table) {
    const winner = remainingPlayers[0];
    console.log(`[completeHand] Tournament winner: ${winner.name} (seat ${winner.seatIndex})`);

    // Mark tournament as complete
    await tournamentRepo.updateTournamentStatus(table.tournamentId, 'complete');

    // Update table status
    await db.update(tables).set({ status: 'complete' }).where(eq(tables.id, tableId));

    // Broadcast tournament complete
    if (pusher) {
      pusher.trigger(`table-${tableId}`, 'TOURNAMENT_COMPLETE', {
        eventId: `tournament-complete-${table.tournamentId}`,
        winner: {
          playerId: winner.playerId,
          name: winner.name,
          seatIndex: winner.seatIndex,
          stack: winner.stack,
        },
      }).catch((err) => console.error('[completeHand] Failed to broadcast TOURNAMENT_COMPLETE:', err));
    }
    return;
  }

  // No players left (edge case - shouldn't happen)
  if (remainingPlayers.length === 0 && table) {
    console.warn('[completeHand] No remaining players - ending tournament');
    await tournamentRepo.updateTournamentStatus(table.tournamentId, 'complete');
    await db.update(tables).set({ status: 'complete' }).where(eq(tables.id, tableId));
    return;
  }

  // Start next hand if 2+ players remain
  if (remainingPlayers.length >= 2) {
    console.log(`[completeHand] hand=${handId} scheduling next hand in 2000ms (${remainingPlayers.length} players remaining)`);
    setTimeout(async () => {
      try {
        const nextHandNumber = (hand?.handNumber || 0) + 1;
        console.log(`[completeHand] setTimeout fired — starting hand #${nextHandNumber} for table ${tableId}`);
        const newHand = await startNewHand(tableId, nextHandNumber);
        console.log(`[completeHand] hand #${nextHandNumber} started: id=${newHand.id} currentActorSeat=${newHand.currentActorSeat}`);

        // Broadcast HAND_STARTED via Pusher so clients don't have to wait for polling
        if (pusher && newHand) {
          const { table: refreshedTable, players: updatedPlayers } = await tableRepo.getTableWithPlayers(tableId);
          const firstActorPlayer = updatedPlayers.find((p) => p.seatIndex === newHand.currentActorSeat);
          const toCall = Math.max(0, newHand.currentBet - (firstActorPlayer?.currentBet || 0));
          const validActionsForActor = firstActorPlayer && refreshedTable
            ? getValidActions({
                status: firstActorPlayer.status,
                currentBet: newHand.currentBet,
                playerBet: firstActorPlayer.currentBet,
                playerStack: firstActorPlayer.stack,
                minRaise: newHand.minRaise,
                bigBlind: refreshedTable.bigBlind,
                canCheck: toCall === 0,
              })
            : null;

          pusher.trigger(`table-${tableId}`, 'HAND_STARTED', {
            eventId: `hand-started-${newHand.handNumber}`,
            handNumber: newHand.handNumber,
            dealerSeatIndex: newHand.dealerSeat,
            smallBlindSeatIndex: newHand.smallBlindSeat,
            bigBlindSeatIndex: newHand.bigBlindSeat,
            firstActorSeat: newHand.currentActorSeat,
            blinds: refreshedTable ? { sb: refreshedTable.smallBlind, bb: refreshedTable.bigBlind } : undefined,
          }).catch((err) => console.error('[completeHand] Failed to broadcast HAND_STARTED:', err));

          pusher.trigger(`table-${tableId}`, 'TURN_STARTED', {
            eventId: `turn-${newHand.currentActorSeat}-${newHand.actionDeadline ?? 'unlimited'}`,
            seatIndex: newHand.currentActorSeat,
            expiresAt: newHand.actionDeadline,
            isUnlimited: newHand.actionDeadline === null,
            validActions: validActionsForActor,
          }).catch((err) => console.error('[completeHand] Failed to broadcast TURN_STARTED:', err));
        }
      } catch (err) {
        console.error(`[completeHand] Failed to start next hand for table ${tableId}:`, err);
      }
    }, 2000);
  }
}

// =============================================================================
// Timeout Handler
// =============================================================================

export async function handleTurnTimeout(tableId: string): Promise<ApiResult<TimeoutResult>> {
  const db = getDb();

  try {
    const [hand] = await db
      .select()
      .from(hands)
      .where(and(eq(hands.tableId, tableId), notInArray(hands.phase, ['complete', 'awarding'])))
      .orderBy(desc(hands.handNumber))
      .limit(1);

    if (!hand) {
      return { success: false, error: 'No active hand', code: 'NO_ACTIVE_HAND' };
    }

    if (hand.currentActorSeat === null || hand.currentActorSeat === undefined) {
      return { success: false, error: 'No current actor', code: 'NO_ACTOR' };
    }

    if (hand.actionDeadline === null || hand.actionDeadline === undefined) {
      return { success: false, error: 'Unlimited timer - no timeout', code: 'UNLIMITED_TIMER' };
    }

    if (now() < hand.actionDeadline) {
      return { success: false, error: 'Turn has not expired yet', code: 'NOT_EXPIRED' };
    }

    const player = await tableRepo.getPlayerBySeat(tableId, hand.currentActorSeat);
    if (!player) {
      return { success: false, error: 'Current actor not found', code: 'ACTOR_NOT_FOUND' };
    }

    const result = await submitAction({
      tableId,
      playerId: player.playerId,
      action: 'fold',
      amount: 0,
      bypassExpiry: true,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to auto-fold player' };
    }

    return {
      success: true,
      data: {
        success: true,
        playerId: player.playerId,
        seatIndex: player.seatIndex,
      },
    };
  } catch (error) {
    console.error('[handleTurnTimeout] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Timeout handling failed',
    };
  }
}

// =============================================================================
// Polling
// =============================================================================

export async function handlePoll(
  tableId: string,
  clientVersion: number,
  lastEventId: number
): Promise<PollResponse> {
  const table = await tableRepo.getTable(tableId);
  if (!table) throw new Error('Table not found');

  const latestTableEventId = await eventRepo.getLatestEventId('table', tableId);
  const currentHand = await handRepo.getCurrentHand(tableId);

  let latestHandEventId = 0;
  if (currentHand) {
    latestHandEventId = await eventRepo.getLatestEventId('hand', currentHand.id);
  }

  const serverLastEventId = Math.max(latestTableEventId, latestHandEventId);

  if (table.version === clientVersion && serverLastEventId === lastEventId) {
    return {
      upToDate: true,
      version: table.version,
      lastEventId: serverLastEventId,
    };
  }

  // Get sync response
  const sync = await getSyncResponse(tableId, lastEventId);

  if (sync.type === 'full') {
    return {
      upToDate: false,
      fullState: sync.fullState,
      version: table.version,
      lastEventId: serverLastEventId,
    };
  }

  return {
    upToDate: false,
    events: sync.events,
    version: table.version,
    lastEventId: serverLastEventId,
  };
}

async function getSyncResponse(
  tableId: string,
  lastKnownEventId: number
): Promise<{ type: 'full'; fullState: TableStateResponse } | { type: 'incremental'; events: Event[] }> {
  const MAX_INCREMENTAL_EVENTS = 100;

  const latestEventId = await eventRepo.getLatestEventId('table', tableId);
  const currentHand = await handRepo.getCurrentHand(tableId);

  let handLatestEventId = 0;
  if (currentHand) {
    handLatestEventId = await eventRepo.getLatestEventId('hand', currentHand.id);
  }

  const maxEventId = Math.max(latestEventId, handLatestEventId);
  const eventsBehind = maxEventId - lastKnownEventId;

  if (lastKnownEventId === 0 || eventsBehind > MAX_INCREMENTAL_EVENTS) {
    return {
      type: 'full',
      fullState: await getFullTableState(tableId),
    };
  }

  const tableEvents = await eventRepo.getEventsAfter('table', tableId, lastKnownEventId);
  let handEvents: Event[] = [];
  if (currentHand) {
    handEvents = await eventRepo.getEventsAfter('hand', currentHand.id, lastKnownEventId);
  }

  const allEvents = [...tableEvents, ...handEvents].sort((a, b) => a.id - b.id);

  return {
    type: 'incremental',
    events: allEvents,
  };
}

export async function getFullTableState(tableId: string): Promise<TableStateResponse> {
  const { table, players } = await tableRepo.getTableWithPlayers(tableId);
  if (!table) throw new Error('Table not found');

  const hand = await handRepo.getCurrentHand(tableId);
  const handPots = hand ? await handRepo.getHandPots(hand.id) : [];

  const latestEventId = await eventRepo.getLatestEventId('table', tableId);
  let handLatestEventId = 0;
  if (hand) {
    handLatestEventId = await eventRepo.getLatestEventId('hand', hand.id);
  }

  return {
    table,
    players,
    hand: hand ?? undefined,
    pots: handPots.map((p) => ({ id: p.id, amount: p.amount, potIndex: p.potIndex })),
    version: table.version,
    lastEventId: Math.max(latestEventId, handLatestEventId),
  };
}
