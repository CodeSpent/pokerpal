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

// Game Advancement
export { advanceGameState } from './game/advance-game';
export type { AdvanceResult } from './game/advance-game';

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
 * Get current active hand for a table
 *
 * Returns hands in any active phase (betting phases or showdown).
 * Excludes 'dealing' (incomplete setup) and 'complete' (finished).
 */
export function getCurrentHand(tableId: string): import('./types').Hand | null {
  const { getDatabase: getDb } = require('./db/connection');
  const db = getDb();

  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase NOT IN ('complete', 'dealing')
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

