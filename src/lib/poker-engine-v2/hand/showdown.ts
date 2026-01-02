/**
 * Showdown and Pot Award Logic
 *
 * Handles:
 * - Running out remaining community cards
 * - Hand evaluation
 * - Pot splitting
 * - Award distribution
 */

import type Database from 'better-sqlite3';
import type { Hand, TablePlayer, HandPhase, HandRank, Card, Suit, Rank, Table } from '../types';
import { generateId, now } from '../db/transaction';
import { COMMUNITY_CARDS_BY_PHASE } from '../state-machine/hand-fsm';
import Pusher from 'pusher';

// @ts-expect-error - pokersolver doesn't have proper types
import { Hand as PokersolverHand } from 'pokersolver';

// Initialize Pusher server (only if credentials exist)
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

/**
 * Run showdown: deal remaining cards, evaluate hands, award pots
 */
export function runShowdown(
  db: Database.Database,
  handId: string,
  tableId: string,
  players: TablePlayer[],
  currentPhase: HandPhase
): void {
  const hand = db.prepare('SELECT * FROM hands WHERE id = ?').get(handId) as Hand;

  // Deal remaining community cards if needed
  const communityCards: string[] = JSON.parse(hand.community_cards || '[]');
  const deck: string[] = JSON.parse(hand.deck);

  // Deal cards up to river
  while (communityCards.length < 5 && deck.length > 0) {
    // Burn and deal
    if (deck.length > 0) deck.shift(); // Burn
    if (deck.length > 0) {
      communityCards.push(deck.shift()!);
    }
  }

  // Update hand with final community cards
  db.prepare(`
    UPDATE hands
    SET community_cards = ?, deck = ?, phase = 'showdown'
    WHERE id = ?
  `).run(JSON.stringify(communityCards), JSON.stringify(deck), handId);

  // Get eligible players (not folded)
  const eligiblePlayers = players.filter(
    (p) => !['folded', 'sitting_out', 'eliminated'].includes(p.status) && p.hole_card_1 && p.hole_card_2
  );

  if (eligiblePlayers.length === 0) {
    console.error('[runShowdown] No eligible players');
    return;
  }

  // Single player - award entire pot
  if (eligiblePlayers.length === 1) {
    awardPotToPlayer(db, handId, tableId, eligiblePlayers[0], hand.pot, 'Winner by fold');
    completeHand(db, handId);
    return;
  }

  // Evaluate all hands
  const evaluatedHands: Array<{
    player: TablePlayer;
    solvedHand: unknown;
    rank: HandRank;
    description: string;
    bestCards: string[]; // The 5 cards that make up the best hand
  }> = [];

  for (const player of eligiblePlayers) {
    const allCards = [
      player.hole_card_1!,
      player.hole_card_2!,
      ...communityCards,
    ];

    try {
      const solved = PokersolverHand.solve(allCards);
      // Extract the 5 cards that make up the best hand
      // pokersolver returns cards as objects with value and suit
      const bestCards = (solved.cards || []).map((c: { value: string; suit: string }) => {
        // Convert pokersolver format back to our format (e.g., "A" + "s" -> "As")
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
      console.error('[runShowdown] Failed to evaluate hand:', err);
      // Give them a losing high card
      evaluatedHands.push({
        player,
        solvedHand: null,
        rank: 'high-card',
        description: 'Error evaluating hand',
        bestCards: [],
      });
    }
  }

  // Find winner(s) using pokersolver
  const solvedHands = evaluatedHands
    .filter((e) => e.solvedHand !== null)
    .map((e) => e.solvedHand);

  if (solvedHands.length === 0) {
    // Fallback: give pot to first player
    awardPotToPlayer(db, handId, tableId, eligiblePlayers[0], hand.pot, 'Default winner');
    completeHand(db, handId);
    return;
  }

  const winners = PokersolverHand.winners(solvedHands);

  // Map winners back to players
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

  // Award pot to winners
  for (let i = 0; i < winningPlayers.length; i++) {
    const { player, rank, description } = winningPlayers[i];
    // First winner gets remainder (closest to button would be better but this is simpler)
    const amount = potShare + (i === 0 ? remainder : 0);

    awardPotToPlayer(db, handId, tableId, player, amount, description);

    // Log showdown result
    db.prepare(`
      INSERT INTO showdown_results (
        id, hand_id, player_id, seat_index, hand_rank, hand_description, best_hand, winnings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      handId,
      player.player_id,
      player.seat_index,
      rank,
      description,
      JSON.stringify([player.hole_card_1, player.hole_card_2]),
      amount
    );
  }

  // Build showdown payload
  const showdownPayload: ShowdownPayload = {
    handNumber: hand.hand_number,
    communityCards,
    winners: winningPlayers.map((w, i) => ({
      playerId: w.player.player_id,
      seatIndex: w.player.seat_index,
      holeCards: [w.player.hole_card_1!, w.player.hole_card_2!] as [string, string],
      handRank: w.rank,
      description: w.description,
      bestCards: w.bestCards, // The 5 cards that make up the best hand
      amount: potShare + (i === 0 ? remainder : 0), // Include winnings
    })),
    pot: hand.pot,
  };

  // Emit showdown event to database
  emitEvent(db, 'hand', handId, 'SHOWDOWN', showdownPayload, hand.version + 1);

  // Broadcast via Pusher so all clients receive it immediately
  if (pusher) {
    const showdownWithId = {
      ...showdownPayload,
      eventId: `showdown-${hand.hand_number}`,
    };
    pusher.trigger(`table-${tableId}`, 'SHOWDOWN', showdownWithId).catch((err) => {
      console.error('[runShowdown] Failed to broadcast SHOWDOWN:', err);
    });
  }

  // Delay completing hand to allow showdown display (10 seconds)
  // The phase stays 'showdown' during this time
  setTimeout(() => {
    try {
      const { getDatabase } = require('../db/connection');
      const freshDb = getDatabase();
      completeHand(freshDb, handId, tableId, showdownPayload);
    } catch (err) {
      console.error('[runShowdown] Failed to complete hand:', err);
    }
  }, 10000);
}

/**
 * Award pot without showdown (everyone else folded)
 */
export function awardPotWithoutShowdown(
  db: Database.Database,
  handId: string,
  tableId: string,
  players: TablePlayer[]
): void {
  const hand = db.prepare('SELECT * FROM hands WHERE id = ?').get(handId) as Hand;

  // Find the only remaining player
  const winner = players.find(
    (p) => !['folded', 'sitting_out', 'eliminated'].includes(p.status)
  );

  if (!winner) {
    console.error('[awardPotWithoutShowdown] No winner found');
    return;
  }

  awardPotToPlayer(db, handId, tableId, winner, hand.pot, 'Winner by fold');

  // Emit pot awarded event
  emitEvent(db, 'hand', handId, 'POT_AWARDED', {
    playerId: winner.player_id,
    seatIndex: winner.seat_index,
    amount: hand.pot,
    showdown: false,
  }, hand.version + 1);

  // Complete hand
  completeHand(db, handId);
}

/**
 * Award pot to a specific player
 */
function awardPotToPlayer(
  db: Database.Database,
  handId: string,
  tableId: string,
  player: TablePlayer,
  amount: number,
  description: string
): void {
  // Add chips to player's stack
  db.prepare(`
    UPDATE table_players
    SET stack = stack + ?
    WHERE table_id = ? AND seat_index = ?
  `).run(amount, tableId, player.seat_index);

  console.log(
    `[awardPotToPlayer] Awarded ${amount} to ${player.player_id} (seat ${player.seat_index}): ${description}`
  );
}

interface ShowdownPayload {
  handNumber: number;
  communityCards: string[];
  winners: Array<{
    playerId: string;
    seatIndex: number;
    holeCards: [string, string];
    handRank: string;
    description: string;
    bestCards: string[];
    amount: number;
  }>;
  pot: number;
}

/**
 * Mark hand as complete and start next hand
 */
function completeHand(
  db: Database.Database,
  handId: string,
  tableId?: string,
  showdownPayload?: ShowdownPayload
): void {
  db.prepare(`
    UPDATE hands
    SET phase = 'complete', ended_at = ?, current_actor_seat = NULL, action_deadline = NULL
    WHERE id = ?
  `).run(now(), handId);

  const hand = db.prepare('SELECT * FROM hands WHERE id = ?').get(handId) as Hand;

  // Build HAND_COMPLETE payload with winner info
  const handCompletePayload = {
    handNumber: hand.hand_number,
    winners: showdownPayload?.winners || [],
  };

  // Emit hand complete event
  emitEvent(db, 'hand', handId, 'HAND_COMPLETE', handCompletePayload, hand.version + 1);

  // Broadcast HAND_COMPLETE via Pusher
  const effectiveTableId = tableId || hand.table_id;
  if (pusher) {
    const handCompleteWithId = {
      ...handCompletePayload,
      eventId: `hand-complete-${handId}`,
    };
    pusher.trigger(`table-${effectiveTableId}`, 'HAND_COMPLETE', handCompleteWithId).catch((err) => {
      console.error('[completeHand] Failed to broadcast HAND_COMPLETE:', err);
    });
  }

  // Check if we should start next hand
  const players = db.prepare(`
    SELECT * FROM table_players
    WHERE table_id = ? AND status NOT IN ('eliminated', 'sitting_out')
  `).all(effectiveTableId) as TablePlayer[];

  // Check for eliminated players (stack = 0)
  for (const player of players) {
    if (player.stack === 0 && player.status !== 'eliminated') {
      db.prepare(`
        UPDATE table_players
        SET status = 'eliminated'
        WHERE id = ?
      `).run(player.id);

      emitEvent(db, 'table', effectiveTableId, 'PLAYER_ELIMINATED', {
        playerId: player.player_id,
        seatIndex: player.seat_index,
        finishPosition: players.length,
      }, 1);
    }
  }

  // Get remaining active players
  const remainingPlayers = db.prepare(`
    SELECT * FROM table_players
    WHERE table_id = ? AND status NOT IN ('eliminated', 'sitting_out')
  `).all(effectiveTableId) as TablePlayer[];

  if (remainingPlayers.length >= 2) {
    // Start next hand
    setTimeout(async () => {
      try {
        const { startNewHand } = require('./start');
        const { getDatabase } = require('../db/connection');
        const db = getDatabase();
        const newHand = startNewHand(db, effectiveTableId, hand.hand_number + 1);

        // Broadcast Pusher events so all clients get notified
        if (pusher && newHand) {
          // Get table for blind info
          const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(effectiveTableId) as Table;

          // Broadcast HAND_STARTED event
          await pusher.trigger(`table-${effectiveTableId}`, 'HAND_STARTED', {
            eventId: `hand-started-${newHand.id}`,
            handNumber: newHand.hand_number,
            dealerSeatIndex: newHand.dealer_seat,
            smallBlindSeatIndex: newHand.small_blind_seat,
            bigBlindSeatIndex: newHand.big_blind_seat,
            firstActorSeat: newHand.current_actor_seat,
            blinds: {
              sb: table.small_blind,
              bb: table.big_blind,
            },
          });

          // Broadcast TURN_STARTED event
          await pusher.trigger(`table-${effectiveTableId}`, 'TURN_STARTED', {
            eventId: `turn-${newHand.id}-0-${newHand.current_actor_seat}`,
            seatIndex: newHand.current_actor_seat,
            expiresAt: newHand.action_deadline ?? null,
            isUnlimited: newHand.action_deadline === null,
          });
        }
      } catch (err) {
        console.error('[completeHand] Failed to start next hand:', err);
      }
    }, 2000); // 2 second delay between hands (showdown delay already handled)
  } else {
    // Tournament over at this table
    console.log(`[completeHand] Tournament over - only ${remainingPlayers.length} player(s) left`);
  }
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
