/**
 * Client Reconnection and Sync
 *
 * Handles syncing clients after disconnection or version mismatch.
 */

import type { Table, TablePlayer, Hand, Pot, GameEvent, SyncResponse, TableStateResponse } from '../types';
import { getDatabase } from '../db/connection';
import { getEventsAfter, getLatestEventId, getEventCount } from '../events/broadcaster';

const MAX_INCREMENTAL_EVENTS = 100;

/**
 * Get sync response for a table
 *
 * Returns either:
 * - Incremental: list of events since lastKnownEventId
 * - Full: complete current state
 */
export function getSyncResponse(
  tableId: string,
  lastKnownEventId: number
): SyncResponse {
  const db = getDatabase();

  // Check how many events we're behind
  const latestEventId = getLatestEventId('table', tableId);

  // Also check hand events
  const currentHand = getCurrentHand(tableId);
  let handLatestEventId = 0;
  if (currentHand) {
    handLatestEventId = getLatestEventId('hand', currentHand.id);
  }

  const maxEventId = Math.max(latestEventId, handLatestEventId);
  const eventsBehind = maxEventId - lastKnownEventId;

  // If too far behind or no events known, send full state
  if (lastKnownEventId === 0 || eventsBehind > MAX_INCREMENTAL_EVENTS) {
    return {
      type: 'full',
      fullState: getFullTableState(tableId),
    };
  }

  // Get incremental events
  const tableEvents = getEventsAfter('table', tableId, lastKnownEventId, MAX_INCREMENTAL_EVENTS);

  let handEvents: GameEvent[] = [];
  if (currentHand) {
    handEvents = getEventsAfter('hand', currentHand.id, lastKnownEventId, MAX_INCREMENTAL_EVENTS);
  }

  // Combine and sort by ID
  const allEvents = [...tableEvents, ...handEvents].sort((a, b) => a.id - b.id);

  if (allEvents.length === 0) {
    // Up to date
    return {
      type: 'incremental',
      events: [],
    };
  }

  return {
    type: 'incremental',
    events: allEvents,
  };
}

/**
 * Get full table state for sync
 */
export function getFullTableState(tableId: string): TableStateResponse {
  const db = getDatabase();

  // Get table
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId) as Table;
  if (!table) {
    throw new Error('Table not found');
  }

  // Get players
  const players = db.prepare(`
    SELECT tp.*, p.name, p.avatar
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ?
    ORDER BY tp.seat_index
  `).all(tableId) as TablePlayer[];

  // Get current hand
  const hand = getCurrentHand(tableId);

  // Get pots
  let pots: Pot[] = [];
  if (hand) {
    pots = db.prepare('SELECT * FROM pots WHERE hand_id = ? ORDER BY pot_index').all(hand.id) as Pot[];
  }

  // Get latest event ID
  const latestEventId = getLatestEventId('table', tableId);
  let handLatestEventId = 0;
  if (hand) {
    handLatestEventId = getLatestEventId('hand', hand.id);
  }

  return {
    table,
    players,
    hand: hand || undefined,
    pots,
    version: table.version,
    lastEventId: Math.max(latestEventId, handLatestEventId),
  };
}

/**
 * Get the current (active) hand for a table
 */
function getCurrentHand(tableId: string): Hand | null {
  const db = getDatabase();
  const hand = db.prepare(`
    SELECT * FROM hands
    WHERE table_id = ? AND phase NOT IN ('complete')
    ORDER BY hand_number DESC
    LIMIT 1
  `).get(tableId) as Hand | undefined;
  return hand || null;
}

/**
 * Polling endpoint response
 */
export interface PollResponse {
  upToDate: boolean;
  events?: GameEvent[];
  fullState?: TableStateResponse;
  version: number;
  lastEventId: number;
}

/**
 * Handle polling request
 */
export function handlePoll(
  tableId: string,
  clientVersion: number,
  lastEventId: number
): PollResponse {
  const db = getDatabase();

  // Get current table version
  const table = db.prepare('SELECT version FROM tables WHERE id = ?').get(tableId) as { version: number } | undefined;
  if (!table) {
    throw new Error('Table not found');
  }

  // Get latest event ID
  const latestTableEventId = getLatestEventId('table', tableId);

  const currentHand = getCurrentHand(tableId);
  let latestHandEventId = 0;
  if (currentHand) {
    latestHandEventId = getLatestEventId('hand', currentHand.id);
  }

  const serverLastEventId = Math.max(latestTableEventId, latestHandEventId);

  // Check if client is up to date
  if (table.version === clientVersion && serverLastEventId === lastEventId) {
    return {
      upToDate: true,
      version: table.version,
      lastEventId: serverLastEventId,
    };
  }

  // Client is behind - get sync response
  const sync = getSyncResponse(tableId, lastEventId);

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

/**
 * Get table state for a specific player (hides opponents' hole cards)
 */
export function getTableStateForPlayer(
  tableId: string,
  playerId: string
): TableStateResponse {
  const state = getFullTableState(tableId);

  // Hide hole cards except for the requesting player
  // (or during showdown for all remaining players)
  const isShowdown = state.hand?.phase === 'showdown';

  state.players = state.players.map((player) => {
    const showCards =
      player.player_id === playerId ||
      (isShowdown && !['folded', 'sitting_out', 'eliminated'].includes(player.status));

    if (!showCards) {
      return {
        ...player,
        hole_card_1: undefined,
        hole_card_2: undefined,
      };
    }
    return player;
  });

  return state;
}
