/**
 * Poker Engine V2
 *
 * A complete rewrite with SQLite for bulletproof state management.
 *
 * Key features:
 * - ACID transactions for all state changes
 * - Optimistic locking to prevent race conditions
 * - Explicit state machines with guards
 * - Event sourcing for client sync
 */

// Database
export { getDatabase, closeDatabase, clearAllData } from './db/connection';
export {
  withTransaction,
  withOptimisticLock,
  withRetry,
  OptimisticLockError,
  EntityNotFoundError,
  InvalidStateTransitionError,
  generateId,
  now,
} from './db/transaction';

// Types
export * from './types';

// Tournament State Machine
export {
  isValidTransition as isValidTournamentTransition,
  canTournamentStart,
  canPlayerRegister,
  canPlayerUnregister,
  shouldAutoStart,
  getNextTournamentStatus,
  getTournamentStatusDisplay,
} from './state-machine/tournament-fsm';

// Hand Phase State Machine
export {
  isValidPhaseTransition,
  getNextBettingPhase,
  isBettingPhase,
  getActivePlayers,
  getPlayersWhoCanAct,
  shouldGoToShowdown,
  shouldAwardWithoutShowdown,
  isBettingComplete,
  getPhaseAfterBetting,
  getStatusForNewRound,
  getCardsToDeal,
  getPhaseDisplay,
  COMMUNITY_CARDS_BY_PHASE,
} from './state-machine/hand-fsm';

// Player Status State Machine
export {
  isValidStatusTransition,
  getStatusAfterAction,
  canPlayerAct,
  isPlayerInHand,
  canPlayerBet,
  getValidActions,
  isValidAction,
  getStatusDisplay,
} from './state-machine/player-fsm';

// Tournament Functions
export {
  createTournament,
  ensurePlayer,
  getTournament,
  getTournamentsByStatus,
  getOpenTournaments,
} from './tournament/create';

export {
  registerPlayer,
  unregisterPlayer,
  getTournamentRegistrations,
  getRegistrationCount,
  isPlayerRegistered,
  getRegistrationsWithPlayers,
} from './tournament/register';

export { startTournament } from './tournament/start';

export {
  getBlindLevel,
  getBlindStructure,
  getNextLevelTime,
  shouldAdvanceLevel,
  STANDARD_SNG_STRUCTURE,
  TURBO_STRUCTURE,
  BLIND_STRUCTURES,
} from './tournament/blind-structures';

// Hand Functions
export { startNewHand } from './hand/start';

export { submitAction } from './hand/submit-action';

export {
  findNextActor,
  getFirstPostflopActor,
  isPlayersTurn,
  isBettingRoundComplete,
  getPlayersToAct,
  getPlayersInHand,
  isHeadsUp,
  getStatusesForNewRound,
} from './hand/turn-order';

export { runShowdown, awardPotWithoutShowdown } from './hand/showdown';

// Pot Functions
export {
  calculatePots,
  getTotalPot,
  getMainPot,
  getSidePots,
  isPlayerEligible,
  getPlayerEligiblePots,
  formatPot,
  getPotDescriptions,
} from './pot/calculator';

export { awardPots, savePots, loadPots } from './pot/award';

// Events
export {
  emitEvent,
  getEventsAfter,
  getEventsSince,
  getLatestEvent,
  getLatestEventId,
  getAllEvents,
  getRecentEvents,
  parseEventPayload,
  hasEventsAfter,
  getEventCount,
  cleanupOldEvents,
} from './events/broadcaster';

// Sync
export {
  getSyncResponse,
  getFullTableState,
  handlePoll,
  getTableStateForPlayer,
} from './sync/reconnection';

/**
 * Initialize the database
 * Call this on app startup
 */
export function initializeDatabase(): void {
  const { getDatabase: getDb } = require('./db/connection');
  console.log('[PokerEngine] Initializing database...');
  getDb();
  console.log('[PokerEngine] Database ready');
}

/**
 * Get table by ID with players
 */
export function getTableWithPlayers(tableId: string): {
  table: import('./types').Table | null;
  players: import('./types').TablePlayer[];
} {
  const { getDatabase: getDb } = require('./db/connection');
  const db = getDb();

  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId) as
    | import('./types').Table
    | undefined;

  if (!table) {
    return { table: null, players: [] };
  }

  const players = db.prepare(`
    SELECT tp.*, p.name, p.avatar
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ?
    ORDER BY tp.seat_index
  `).all(tableId) as import('./types').TablePlayer[];

  return { table, players };
}

/**
 * Get current hand for a table
 *
 * Only returns hands in active betting phases.
 * Excludes 'dealing' (incomplete setup) and 'complete'/'showdown' (finished).
 */
export function getCurrentHand(tableId: string): import('./types').Hand | null {
  const { getDatabase: getDb } = require('./db/connection');
  const db = getDb();

  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase IN ('preflop', 'flop', 'turn', 'river')
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as import('./types').Hand | undefined;

  return hand || null;
}

/**
 * Get player at table
 */
export function getPlayerAtTable(
  tableId: string,
  playerId: string
): import('./types').TablePlayer | null {
  const { getDatabase: getDb } = require('./db/connection');
  const db = getDb();

  const player = db.prepare(`
    SELECT tp.*, p.name, p.avatar
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ? AND tp.player_id = ?
  `).get(tableId, playerId) as import('./types').TablePlayer | undefined;

  return player || null;
}

/**
 * Cleanup: Remove any broken 'dealing' phase hands
 * These can occur if startNewHand fails mid-transaction (though rare with transaction wrapping)
 */
export function cleanupBrokenHands(tableId: string): number {
  const { getDatabase: getDb } = require('./db/connection');
  const db = getDb();

  // Delete any hands stuck in 'dealing' phase (incomplete hand creation)
  const result = db.prepare(`
    DELETE FROM hands
    WHERE table_id = ? AND phase = 'dealing'
  `).run(tableId);

  if (result.changes > 0) {
    console.log(`[cleanupBrokenHands] Deleted ${result.changes} incomplete hands for table ${tableId}`);
  }

  return result.changes;
}

/**
 * Recovery: Check if current actor can actually act, and fix if not
 * This handles corrupted state where current_actor points to all_in/folded player
 */
export function recoverInvalidActorState(tableId: string): boolean {
  const { getDatabase: getDb } = require('./db/connection');
  const { findNextActor } = require('./hand/turn-order');

  const db = getDb();

  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase NOT IN ('complete', 'awarding', 'showdown')
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as import('./types').Hand | undefined;

  if (!hand || hand.current_actor_seat === null) {
    return false;
  }

  const players = db.prepare(`
    SELECT tp.*, p.name
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ?
    ORDER BY tp.seat_index
  `).all(tableId) as import('./types').TablePlayer[];

  const currentActor = players.find(p => p.seat_index === hand.current_actor_seat);

  // Check if current actor can actually act
  const cannotActStatuses = ['folded', 'all_in', 'sitting_out', 'eliminated'];
  if (currentActor && cannotActStatuses.includes(currentActor.status)) {
    console.log(`[recoverInvalidActorState] Current actor at seat ${hand.current_actor_seat} has status ${currentActor.status}, finding next actor`);

    // Find the next valid actor
    const nextActor = findNextActor(hand, players, hand.current_actor_seat);

    if (nextActor) {
      // Update to next actor
      db.prepare(`
        UPDATE hands SET current_actor_seat = ?, action_deadline = ?
        WHERE id = ?
      `).run(nextActor.seat_index, Date.now() + 30000, hand.id);

      db.prepare(`
        UPDATE table_players SET status = 'active'
        WHERE table_id = ? AND seat_index = ? AND status IN ('waiting', 'acted')
      `).run(tableId, nextActor.seat_index);

      console.log(`[recoverInvalidActorState] Advanced to seat ${nextActor.seat_index}`);
      return true;
    } else {
      // No next actor - betting complete, might need to advance phase
      console.log(`[recoverInvalidActorState] No next actor found, betting may be complete`);
      return false;
    }
  }

  return false;
}
