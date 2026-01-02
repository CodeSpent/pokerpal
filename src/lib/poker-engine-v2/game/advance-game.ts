/**
 * Idempotent Game Advancement
 *
 * Central function that safely advances game state. Calling multiple times
 * has the same effect as calling once - safe for concurrent pollers.
 */

import type Database from 'better-sqlite3';
import type { Hand, Table, TablePlayer } from '../types';
import { now } from '../db/transaction';
import { handleTurnTimeout } from '../hand/timeout';
import { startNewHand } from '../hand/start';
import { getValidActions } from '../state-machine/player-fsm';
import Pusher from 'pusher';

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

export interface AdvanceResult {
  timeoutHandled: boolean;
  showdownCompleted: boolean;
  newHandStarted: boolean;
  cleanedUpHands: number;
  recoveredActor: boolean;
  hand: Hand | null;
}

/**
 * Advance game state for a table.
 *
 * This function is idempotent - calling it multiple times concurrently
 * will not cause race conditions. Each operation checks preconditions
 * before acting.
 *
 * Operations performed (in order):
 * 1. Clean up broken 'dealing' phase hands
 * 2. Handle expired turn timeouts
 * 3. Recover from invalid actor state
 * 4. Complete stale showdowns
 * 5. Start new hand if needed
 */
export function advanceGameState(
  db: Database.Database,
  tableId: string
): AdvanceResult {
  const result: AdvanceResult = {
    timeoutHandled: false,
    showdownCompleted: false,
    newHandStarted: false,
    cleanedUpHands: 0,
    recoveredActor: false,
    hand: null,
  };

  // 1. Clean up broken 'dealing' phase hands (idempotent - deletes are safe)
  result.cleanedUpHands = cleanupBrokenHands(db, tableId);

  // 2. Handle expired turn timeouts (idempotent - checks if already handled)
  result.timeoutHandled = maybeHandleTimeout(db, tableId);

  // 3. Recover invalid actor state (idempotent - checks current state)
  result.recoveredActor = maybeRecoverActorState(db, tableId);

  // 4. Complete stale showdowns (idempotent - checks timing)
  result.showdownCompleted = maybeCompleteShowdown(db, tableId);

  // 5. Start new hand if needed (idempotent - checks if hand exists)
  const newHandResult = maybeStartNewHand(db, tableId);
  result.newHandStarted = newHandResult.started;
  result.hand = newHandResult.hand;

  // If no new hand was started, get current hand
  if (!result.hand) {
    result.hand = getCurrentActiveHand(db, tableId);
  }

  return result;
}

/**
 * Clean up broken 'dealing' phase hands
 */
function cleanupBrokenHands(db: Database.Database, tableId: string): number {
  const result = db.prepare(`
    DELETE FROM hands
    WHERE table_id = ? AND phase = 'dealing'
  `).run(tableId);

  if (result.changes > 0) {
    console.log(`[advanceGameState] Deleted ${result.changes} incomplete hands`);
  }

  return result.changes;
}

/**
 * Handle turn timeout if expired
 * Returns true if a timeout was handled
 */
function maybeHandleTimeout(db: Database.Database, tableId: string): boolean {
  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase NOT IN ('complete', 'awarding', 'showdown')
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as Hand | undefined;

  if (!hand) return false;
  if (hand.current_actor_seat === null || hand.current_actor_seat === undefined) return false;
  if (hand.action_deadline === null || hand.action_deadline === undefined) return false;
  if (now() < hand.action_deadline) return false;

  // Check if current actor has already acted/folded (idempotency check)
  const currentActor = db.prepare(`
    SELECT * FROM table_players
    WHERE table_id = ? AND seat_index = ?
  `).get(tableId, hand.current_actor_seat) as TablePlayer | undefined;

  if (!currentActor) return false;

  // If player is already folded or not in an actionable state, skip
  if (['folded', 'all_in', 'sitting_out', 'eliminated'].includes(currentActor.status)) {
    return false;
  }

  // Turn is expired and player can still act - handle timeout
  const result = handleTurnTimeout(tableId);
  return result.success;
}

/**
 * Recover from invalid actor state
 * Returns true if recovery was performed
 */
function maybeRecoverActorState(db: Database.Database, tableId: string): boolean {
  const { findNextActor } = require('../hand/turn-order');

  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase NOT IN ('complete', 'awarding', 'showdown')
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as Hand | undefined;

  if (!hand || hand.current_actor_seat === null) return false;

  const players = db.prepare(`
    SELECT tp.*, p.name
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ?
    ORDER BY tp.seat_index
  `).all(tableId) as TablePlayer[];

  const currentActor = players.find(p => p.seat_index === hand.current_actor_seat);

  // Check if current actor can actually act
  const cannotActStatuses = ['folded', 'all_in', 'sitting_out', 'eliminated'];
  if (!currentActor || !cannotActStatuses.includes(currentActor.status)) {
    return false; // Current actor is valid
  }

  console.log(`[advanceGameState] Current actor at seat ${hand.current_actor_seat} has status ${currentActor.status}, finding next actor`);

  const nextActor = findNextActor(hand, players, hand.current_actor_seat);

  if (nextActor) {
    db.prepare(`
      UPDATE hands SET current_actor_seat = ?, action_deadline = ?
      WHERE id = ?
    `).run(nextActor.seat_index, now() + 30000, hand.id);

    db.prepare(`
      UPDATE table_players SET status = 'active'
      WHERE table_id = ? AND seat_index = ? AND status IN ('waiting', 'acted')
    `).run(tableId, nextActor.seat_index);

    console.log(`[advanceGameState] Advanced to seat ${nextActor.seat_index}`);
    return true;
  }

  return false;
}

/**
 * Complete showdown if it's been running too long
 * Returns true if showdown was completed
 *
 * This handles the case where setTimeout doesn't fire (serverless)
 */
function maybeCompleteShowdown(db: Database.Database, tableId: string): boolean {
  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase = 'showdown'
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as Hand | undefined;

  if (!hand) return false;

  // Check if showdown has been going on long enough
  // The showdown_started_at field tracks when we entered showdown
  const showdownStartedAt = hand.showdown_started_at;

  if (!showdownStartedAt) {
    // Old hand without timestamp - check started_at as fallback
    // Give 8 seconds total for showdown display
    const handAge = now() - hand.started_at;
    if (handAge < 8000) return false;
  } else {
    // New hand with showdown timestamp
    const showdownAge = now() - showdownStartedAt;
    if (showdownAge < 7000) return false; // Give setTimeout 7 seconds before recovery
  }

  console.log(`[advanceGameState] Completing stale showdown for hand ${hand.id}`);

  // Complete the hand
  db.prepare(`
    UPDATE hands
    SET phase = 'complete', ended_at = ?, current_actor_seat = NULL, action_deadline = NULL
    WHERE id = ? AND phase = 'showdown'
  `).run(now(), hand.id);

  // Broadcast HAND_COMPLETE event
  if (pusher) {
    pusher.trigger(`table-${tableId}`, 'HAND_COMPLETE', {
      eventId: `hand-complete-recovery-${hand.id}`,
      handNumber: hand.hand_number,
      winners: [],
    }).catch(err => {
      console.error('[advanceGameState] Failed to broadcast HAND_COMPLETE:', err);
    });
  }

  return true;
}

/**
 * Start a new hand if conditions are met
 * Returns whether a hand was started and the hand object
 */
function maybeStartNewHand(
  db: Database.Database,
  tableId: string
): { started: boolean; hand: Hand | null } {
  // Check if there's already an active hand
  const existingHand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase NOT IN ('complete')
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as Hand | undefined;

  if (existingHand) {
    // Hand already exists (including showdown phase)
    return { started: false, hand: existingHand };
  }

  // Get table and players
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId) as Table | undefined;
  if (!table) return { started: false, hand: null };

  const players = db.prepare(`
    SELECT * FROM table_players
    WHERE table_id = ? AND status NOT IN ('eliminated', 'sitting_out')
  `).all(tableId) as TablePlayer[];

  if (players.length < 2) {
    return { started: false, hand: null };
  }

  // Get the last hand number
  const lastHand = db.prepare(`
    SELECT hand_number FROM hands
    WHERE table_id = ?
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as { hand_number: number } | undefined;

  const nextHandNumber = (lastHand?.hand_number || 0) + 1;

  try {
    console.log(`[advanceGameState] Starting new hand #${nextHandNumber}`);
    const hand = startNewHand(db, tableId, nextHandNumber);

    // Broadcast Pusher events
    if (pusher && hand) {
      pusher.trigger(`table-${tableId}`, 'HAND_STARTED', {
        eventId: `hand-started-${hand.id}`,
        handNumber: hand.hand_number,
        dealerSeatIndex: hand.dealer_seat,
        smallBlindSeatIndex: hand.small_blind_seat,
        bigBlindSeatIndex: hand.big_blind_seat,
        firstActorSeat: hand.current_actor_seat,
        blinds: {
          sb: table.small_blind,
          bb: table.big_blind,
        },
      }).catch(err => {
        console.error('[advanceGameState] Failed to broadcast HAND_STARTED:', err);
      });

      // Compute validActions for the first actor
      const firstActorPlayer = players.find(p => p.seat_index === hand.current_actor_seat);
      const toCall = Math.max(0, hand.current_bet - (firstActorPlayer?.current_bet || 0));
      const validActionsForActor = firstActorPlayer
        ? getValidActions({
            status: firstActorPlayer.status,
            currentBet: hand.current_bet,
            playerBet: firstActorPlayer.current_bet,
            playerStack: firstActorPlayer.stack,
            minRaise: hand.min_raise,
            bigBlind: table.big_blind,
            canCheck: toCall === 0,
          })
        : null;

      pusher.trigger(`table-${tableId}`, 'TURN_STARTED', {
        eventId: `turn-${hand.id}-0-${hand.current_actor_seat}`,
        seatIndex: hand.current_actor_seat,
        expiresAt: hand.action_deadline ?? null,
        isUnlimited: hand.action_deadline === null,
        validActions: validActionsForActor,
      }).catch(err => {
        console.error('[advanceGameState] Failed to broadcast TURN_STARTED:', err);
      });
    }

    return { started: true, hand };
  } catch (err) {
    // Expected in concurrent scenarios - another request started the hand
    console.log(`[advanceGameState] Hand start skipped (likely concurrent):`, err);
    return { started: false, hand: null };
  }
}

/**
 * Get current active hand
 * Returns hands in any active phase (betting phases or showdown).
 * Excludes 'dealing' (incomplete setup) and 'complete' (finished).
 * Note: 'dealing' hands are cleaned up by cleanupBrokenHands().
 */
function getCurrentActiveHand(db: Database.Database, tableId: string): Hand | null {
  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase NOT IN ('complete', 'dealing')
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as Hand | undefined;

  return hand || null;
}
