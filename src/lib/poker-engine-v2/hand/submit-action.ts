/**
 * Submit Action
 *
 * Atomic action submission with:
 * - Optimistic locking on hand version
 * - Complete validation
 * - State transitions
 * - Event emission
 */

import type Database from 'better-sqlite3';
import type { Hand, TablePlayer, ActionType, HandPhase, ApiResult, Tournament } from '../types';
import { withOptimisticLock, generateId, now, OptimisticLockError } from '../db/transaction';
import { getDatabase } from '../db/connection';
import { getValidActions, isValidAction, getStatusAfterAction } from '../state-machine/player-fsm';
import {
  isBettingComplete,
  getPhaseAfterBetting,
  shouldGoToShowdown,
  shouldAwardWithoutShowdown,
  getStatusForNewRound,
  COMMUNITY_CARDS_BY_PHASE,
} from '../state-machine/hand-fsm';
import { findNextActor, getFirstPostflopActor, isHeadsUp, isPlayersTurn } from './turn-order';

export interface SubmitActionParams {
  tableId: string;
  playerId: string;
  action: ActionType;
  amount?: number;
  handVersion?: number;
  /** When true, bypasses the expiry check (used by timeout handler) */
  bypassExpiry?: boolean;
}

export interface SubmitActionResult {
  hand: Hand;
  players: TablePlayer[];
  nextActorSeat: number | null;
  phaseChanged: boolean;
  newPhase?: HandPhase;
  isHandComplete: boolean;
}

/**
 * Submit a player action
 */
export function submitAction(
  params: SubmitActionParams
): ApiResult<SubmitActionResult> {
  const { tableId, playerId, action, amount = 0, handVersion, bypassExpiry = false } = params;

  try {
    const db = getDatabase();

    // Get current hand - must be in an active betting phase
    // This query must match getCurrentHand() in index.ts
    const hand = db.prepare(`
      SELECT * FROM hands
      WHERE table_id = ? AND phase IN ('preflop', 'flop', 'turn', 'river')
      ORDER BY hand_number DESC
      LIMIT 1
    `).get(tableId) as Hand | undefined;

    if (!hand) {
      return { success: false, error: 'No active hand', code: 'NO_ACTIVE_HAND' };
    }

    // If version provided, use optimistic locking
    const expectedVersion = handVersion ?? hand.version;

    try {
      const result = withOptimisticLock<Hand, SubmitActionResult>(
        'hands',
        hand.id,
        expectedVersion,
        (txDb, currentHand) => {
          return executeAction(txDb, currentHand, tableId, playerId, action, amount, bypassExpiry);
        }
      );

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        return {
          success: false,
          error: 'State changed, please retry',
          code: 'VERSION_CONFLICT',
        };
      }
      throw error;
    }
  } catch (error) {
    console.error('[submitAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Action failed',
    };
  }
}

/**
 * Execute the action within a transaction
 */
function executeAction(
  db: Database.Database,
  hand: Hand,
  tableId: string,
  playerId: string,
  action: ActionType,
  amount: number,
  bypassExpiry: boolean = false
): SubmitActionResult {
  // Get players
  const players = db.prepare(`
    SELECT tp.*, p.name, p.avatar
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ?
    ORDER BY tp.seat_index
  `).all(tableId) as TablePlayer[];

  // Get table
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId) as { small_blind: number; big_blind: number };

  // Find the acting player
  const player = players.find((p) => p.player_id === playerId);
  if (!player) {
    throw new Error('Player not at this table');
  }

  // Validate it's their turn
  if (!isPlayersTurn(hand, playerId, players)) {
    throw new Error(`Not your turn. Current actor: seat ${hand.current_actor_seat}`);
  }

  // Check if action timed out - reject the action instead of silently auto-folding
  // Auto-fold should be handled by a separate timeout mechanism
  // bypassExpiry allows the timeout handler to force-fold after expiry
  if (!bypassExpiry && hand.action_deadline && now() > hand.action_deadline) {
    throw new Error('Turn expired - action timed out');
  }

  // Get valid actions
  const toCall = Math.max(0, hand.current_bet - player.current_bet);
  const validActions = getValidActions({
    status: player.status,
    currentBet: hand.current_bet,
    playerBet: player.current_bet,
    playerStack: player.stack,
    minRaise: hand.min_raise,
    bigBlind: table.big_blind,
    canCheck: toCall === 0,
  });

  // Debug logging for action validation
  console.log('[submitAction] Validation context:', {
    requestedAction: action,
    amount,
    handNumber: hand.hand_number,
    phase: hand.phase,
    handCurrentBet: hand.current_bet,
    playerCurrentBet: player.current_bet,
    playerStack: player.stack,
    playerStatus: player.status,
    toCall,
    validActions,
  });

  // Normalize actions based on actual game state
  // This handles client/server desync gracefully
  let normalizedAction = action;

  // Client sends 'raise' but server needs 'bet' when there's nothing to call
  if (action === 'raise' && toCall <= 0 && validActions.canBet) {
    normalizedAction = 'bet';
  }

  // Client sends 'call' but there's nothing to call - treat as check if possible
  if (action === 'call' && toCall <= 0 && validActions.canCheck) {
    console.log('[submitAction] Converting call to check (nothing to call)');
    normalizedAction = 'check';
  }

  // Validate the action
  const validation = isValidAction(normalizedAction, amount, validActions);
  if (!validation.valid) {
    console.log('[submitAction] Action rejected:', validation.error);
    throw new Error(validation.error);
  }

  // Use normalized action for processing
  action = normalizedAction;

  // Calculate actual amounts
  let actualAmount = 0;
  let newPlayerBet = player.current_bet;
  let newStack = player.stack;
  let isAllIn = false;

  switch (action) {
    case 'fold':
      // No money movement
      break;

    case 'check':
      // No money movement
      break;

    case 'call':
      actualAmount = Math.min(toCall, player.stack);
      newPlayerBet += actualAmount;
      newStack -= actualAmount;
      isAllIn = newStack === 0;
      break;

    case 'bet':
    case 'raise':
      // Amount is ABSOLUTE (total bet player wants to have in)
      // Calculate delta needed to reach that amount
      const targetBet = amount;
      const deltaNeeded = targetBet - player.current_bet;
      actualAmount = Math.min(Math.max(0, deltaNeeded), player.stack);
      newPlayerBet = player.current_bet + actualAmount;
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
  const newStatus = getStatusAfterAction(player.status, action, isAllIn);

  db.prepare(`
    UPDATE table_players
    SET stack = ?, current_bet = ?, status = ?
    WHERE table_id = ? AND seat_index = ?
  `).run(newStack, newPlayerBet, newStatus, tableId, player.seat_index);

  // Update hand pot and current bet
  let newCurrentBet = hand.current_bet;
  let newMinRaise = hand.min_raise;
  let newPot = hand.pot + actualAmount;

  if (action === 'bet' || action === 'raise' || action === 'all_in') {
    if (newPlayerBet > newCurrentBet) {
      const raiseSize = newPlayerBet - newCurrentBet;
      newMinRaise = Math.max(hand.min_raise, raiseSize);
      newCurrentBet = newPlayerBet;
    }
  }

  db.prepare(`
    UPDATE hands
    SET pot = ?, current_bet = ?, min_raise = ?
    WHERE id = ?
  `).run(newPot, newCurrentBet, newMinRaise, hand.id);

  // Log the action
  const actionSequence = db.prepare(`
    SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq
    FROM actions WHERE hand_id = ?
  `).get(hand.id) as { next_seq: number };

  db.prepare(`
    INSERT INTO actions (id, hand_id, player_id, seat_index, action_type, amount, phase, sequence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId(),
    hand.id,
    playerId,
    player.seat_index,
    action,
    actualAmount,
    hand.phase,
    actionSequence.next_seq,
    now()
  );

  // Emit action event
  emitEvent(db, 'hand', hand.id, 'PLAYER_ACTION', {
    playerId,
    seatIndex: player.seat_index,
    action,
    amount: actualAmount,
    newStack,
    newBet: newPlayerBet,
    pot: newPot,
    isAllIn,
  }, hand.version + 1);

  // Refresh players after update
  const updatedPlayers = db.prepare(`
    SELECT tp.*, p.name, p.avatar
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ?
    ORDER BY tp.seat_index
  `).all(tableId) as TablePlayer[];

  // Update hand object for checks
  const updatedHand: Hand = {
    ...hand,
    pot: newPot,
    current_bet: newCurrentBet,
    min_raise: newMinRaise,
  };

  // Determine next state
  let nextActorSeat: number | null = null;
  let phaseChanged = false;
  let newPhase: HandPhase | undefined;
  let isHandComplete = false;

  // Check if everyone folded
  if (shouldAwardWithoutShowdown(updatedPlayers)) {
    // Award pot to last remaining player
    const { awardPotWithoutShowdown } = require('./showdown');
    awardPotWithoutShowdown(db, hand.id, tableId, updatedPlayers);

    db.prepare('UPDATE hands SET phase = ?, ended_at = ? WHERE id = ?')
      .run('complete', now(), hand.id);

    phaseChanged = true;
    newPhase = 'complete';
    isHandComplete = true;
  } else if (isBettingComplete(updatedHand, updatedPlayers)) {
    // Betting round complete
    const nextPhase = getPhaseAfterBetting(hand.phase, updatedHand, updatedPlayers);
    phaseChanged = true;
    newPhase = nextPhase;

    if (nextPhase === 'showdown') {
      // Run out remaining cards if needed, then showdown
      const { runShowdown } = require('./showdown');
      runShowdown(db, hand.id, tableId, updatedPlayers, hand.phase);
      isHandComplete = true;
    } else if (nextPhase === 'awarding') {
      // Direct award (shouldn't happen often)
      const { awardPotWithoutShowdown } = require('./showdown');
      awardPotWithoutShowdown(db, hand.id, tableId, updatedPlayers);

      db.prepare('UPDATE hands SET phase = ?, ended_at = ? WHERE id = ?')
        .run('complete', now(), hand.id);

      newPhase = 'complete';
      isHandComplete = true;
    } else {
      // Advance to next betting round
      advanceToNextPhase(db, hand.id, tableId, updatedPlayers, nextPhase);

      // CRITICAL: Re-fetch players after advanceToNextPhase modified their statuses in DB
      const refreshedPlayers = db.prepare(`
        SELECT tp.*, p.name, p.avatar
        FROM table_players tp
        JOIN players p ON tp.player_id = p.id
        WHERE tp.table_id = ?
        ORDER BY tp.seat_index
      `).all(tableId) as TablePlayer[];

      // Get first actor for new round using FRESH data
      const dealer = db.prepare('SELECT dealer_seat FROM tables WHERE id = ?').get(tableId) as { dealer_seat: number };
      const bbSeat = hand.big_blind_seat;
      const headsUp = isHeadsUp(refreshedPlayers);

      const firstActor = getFirstPostflopActor(refreshedPlayers, dealer.dealer_seat, headsUp, bbSeat);
      if (firstActor) {
        nextActorSeat = firstActor.seat_index;
        setNextActor(db, hand.id, tableId, firstActor.seat_index);
      }
    }
  } else {
    // Find next actor
    const nextPlayer = findNextActor(updatedHand, updatedPlayers, player.seat_index);
    if (nextPlayer) {
      nextActorSeat = nextPlayer.seat_index;
      setNextActor(db, hand.id, tableId, nextPlayer.seat_index);
    }
  }

  // Fetch final hand state
  const finalHand = db.prepare('SELECT * FROM hands WHERE id = ?').get(hand.id) as Hand;
  const finalPlayers = db.prepare(`
    SELECT tp.*, p.name, p.avatar
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ?
    ORDER BY tp.seat_index
  `).all(tableId) as TablePlayer[];

  return {
    hand: finalHand,
    players: finalPlayers,
    nextActorSeat,
    phaseChanged,
    newPhase,
    isHandComplete,
  };
}

/**
 * Set the next actor
 */
function setNextActor(
  db: Database.Database,
  handId: string,
  tableId: string,
  seatIndex: number
): void {
  // Get tournament's turn timer setting
  const tournament = db.prepare(`
    SELECT turn_timer_seconds FROM tournaments WHERE id = (
      SELECT tournament_id FROM tables WHERE id = ?
    )
  `).get(tableId) as Pick<Tournament, 'turn_timer_seconds'> | undefined;

  // Calculate deadline - null if unlimited
  const turnTimerSeconds = tournament?.turn_timer_seconds;
  const deadline = turnTimerSeconds !== null && turnTimerSeconds !== undefined
    ? now() + turnTimerSeconds * 1000
    : null;

  // Clear previous actor's active status
  db.prepare(`
    UPDATE table_players
    SET status = CASE WHEN status = 'active' THEN 'acted' ELSE status END
    WHERE table_id = ? AND status = 'active'
  `).run(tableId);

  // Set new actor
  db.prepare(`
    UPDATE table_players
    SET status = 'active'
    WHERE table_id = ? AND seat_index = ? AND status IN ('waiting', 'acted', 'active')
  `).run(tableId, seatIndex);

  db.prepare(`
    UPDATE hands
    SET current_actor_seat = ?, action_deadline = ?
    WHERE id = ?
  `).run(seatIndex, deadline, handId);
}

/**
 * Advance to the next betting phase
 */
function advanceToNextPhase(
  db: Database.Database,
  handId: string,
  tableId: string,
  players: TablePlayer[],
  newPhase: HandPhase
): void {
  const hand = db.prepare('SELECT * FROM hands WHERE id = ?').get(handId) as Hand;

  // Deal community cards
  const currentCards: string[] = JSON.parse(hand.community_cards || '[]');
  const targetCardCount = COMMUNITY_CARDS_BY_PHASE[newPhase];
  const cardsToDeal = targetCardCount - currentCards.length;

  if (cardsToDeal > 0) {
    const deck: string[] = JSON.parse(hand.deck);
    // Burn one card, then deal
    deck.shift(); // Burn

    const newCards = deck.splice(0, cardsToDeal);
    currentCards.push(...newCards);

    db.prepare(`
      UPDATE hands
      SET community_cards = ?, deck = ?, phase = ?, current_bet = 0
      WHERE id = ?
    `).run(JSON.stringify(currentCards), JSON.stringify(deck), newPhase, handId);
  } else {
    db.prepare(`
      UPDATE hands
      SET phase = ?, current_bet = 0
      WHERE id = ?
    `).run(newPhase, handId);
  }

  // Reset player bets and statuses for new round
  for (const player of players) {
    if (['folded', 'all_in', 'sitting_out', 'eliminated'].includes(player.status)) {
      // Just reset current_bet for these
      db.prepare(`
        UPDATE table_players
        SET current_bet = 0
        WHERE table_id = ? AND seat_index = ?
      `).run(tableId, player.seat_index);
    } else {
      // Reset to waiting
      db.prepare(`
        UPDATE table_players
        SET status = 'waiting', current_bet = 0
        WHERE table_id = ? AND seat_index = ?
      `).run(tableId, player.seat_index);
    }
  }

  // Emit phase change event
  emitEvent(db, 'hand', handId, 'PHASE_CHANGED', {
    phase: newPhase,
    communityCards: currentCards,
  }, hand.version + 1);
}

/**
 * Helper to emit an event
 */
function emitEvent(
  db: Database.Database,
  entityType: 'tournament' | 'table' | 'hand',
  entityId: string,
  eventType: string,
  payload: unknown,
  entityVersion: number
): void {
  db.prepare(`
    INSERT INTO events (entity_type, entity_id, event_type, payload, entity_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entityType,
    entityId,
    eventType,
    JSON.stringify(payload),
    entityVersion,
    now()
  );
}
