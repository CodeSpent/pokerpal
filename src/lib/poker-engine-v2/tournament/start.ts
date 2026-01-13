/**
 * Tournament Start
 *
 * Critical function that:
 * 1. Atomically transitions to 'starting' status (prevents double-start)
 * 2. Creates tables and seats players
 * 3. Starts first hand on each table
 */

import type Database from 'better-sqlite3';
import type { Tournament, TournamentRegistration, Table, TablePlayer, Player, ApiResult } from '../types';
import { withTransaction, generateId, now } from '../db/transaction';
import { canTournamentStart, assertValidTransition } from '../state-machine/tournament-fsm';
import { getBlindLevel, STANDARD_SNG_STRUCTURE } from './blind-structures';

export interface StartTournamentResult {
  tournament: Tournament;
  tables: Table[];
}

/**
 * Start a tournament
 *
 * Uses atomic status transition to prevent double-start race condition.
 */
export function startTournament(
  tournamentId: string,
  initiatorId?: string
): ApiResult<StartTournamentResult> {
  try {
    const result = withTransaction((db) => {
      // Get tournament with current status
      const tournament = db
        .prepare('SELECT * FROM tournaments WHERE id = ?')
        .get(tournamentId) as Tournament | undefined;

      if (!tournament) {
        return { error: 'Tournament not found', code: 'NOT_FOUND' };
      }

      // Get registrations
      const registrations = db
        .prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ?')
        .all(tournamentId) as TournamentRegistration[];

      // Check guard conditions
      const guard = canTournamentStart(tournament, registrations);
      if (!guard.canStart) {
        return { error: guard.reason!, code: 'CANNOT_START' };
      }

      // CRITICAL: Atomically update status to 'starting'
      // This prevents race conditions where two requests both try to start
      const updateResult = db
        .prepare(`
          UPDATE tournaments
          SET status = 'starting', version = version + 1
          WHERE id = ? AND status = 'registering'
        `)
        .run(tournamentId);

      // If no rows changed, another request already started it
      if (updateResult.changes === 0) {
        return { error: 'Tournament already starting or started', code: 'ALREADY_STARTED' };
      }

      // Get player details
      const players = db.prepare(`
        SELECT p.*
        FROM players p
        JOIN tournament_registrations tr ON tr.player_id = p.id
        WHERE tr.tournament_id = ?
      `).all(tournamentId) as Player[];

      // Create tables and seat players
      const createdTables = createTablesAndSeatPlayers(
        db,
        tournament,
        players
      );

      // Get blind level
      const blindLevel = getBlindLevel(STANDARD_SNG_STRUCTURE, 1);
      const timestamp = now();

      // Update tournament to running status
      db.prepare(`
        UPDATE tournaments
        SET
          status = 'running',
          version = version + 1,
          players_remaining = ?,
          prize_pool = ?,
          current_level = 1,
          level_started_at = ?,
          started_at = ?
        WHERE id = ?
      `).run(
        players.length,
        players.length * 100, // Placeholder buy-in
        timestamp,
        timestamp,
        tournamentId
      );

      // Get updated tournament
      const updatedTournament = db
        .prepare('SELECT * FROM tournaments WHERE id = ?')
        .get(tournamentId) as Tournament;

      // Start first hand on each table
      for (const table of createdTables) {
        startFirstHand(db, table.id, blindLevel.smallBlind, blindLevel.bigBlind, blindLevel.ante);
      }

      // Emit tournament started event
      emitEvent(db, 'tournament', tournamentId, 'TOURNAMENT_STARTED', {
        tables: createdTables.map((t) => t.id),
        playerCount: players.length,
        prizePool: players.length * 100,
      }, updatedTournament.version);

      return {
        data: {
          tournament: updatedTournament,
          tables: createdTables,
        },
      };
    });

    if ('error' in result) {
      return { success: false, error: result.error, code: result.code };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[startTournament] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start tournament',
    };
  }
}

/**
 * Create tables and seat players
 */
function createTablesAndSeatPlayers(
  db: Database.Database,
  tournament: Tournament,
  players: Player[]
): Table[] {
  const tableSize = tournament.table_size;
  const playerCount = players.length;
  const numTables = Math.ceil(playerCount / tableSize);
  const timestamp = now();

  // Get blind level
  const blindLevel = getBlindLevel(STANDARD_SNG_STRUCTURE, 1);

  // Shuffle players for random seating
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

  const createdTables: Table[] = [];

  for (let tableNum = 0; tableNum < numTables; tableNum++) {
    const tableId = generateId();

    // Create table
    db.prepare(`
      INSERT INTO tables (
        id, tournament_id, table_number, max_seats,
        dealer_seat, small_blind, big_blind, ante,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tableId,
      tournament.id,
      tableNum + 1,
      tableSize,
      0, // Dealer starts at seat 0
      blindLevel.smallBlind,
      blindLevel.bigBlind,
      blindLevel.ante,
      'waiting',
      timestamp
    );

    // Seat players at this table
    const startIdx = tableNum * tableSize;
    const endIdx = Math.min(startIdx + tableSize, playerCount);

    for (let seatIdx = 0; seatIdx < endIdx - startIdx; seatIdx++) {
      const player = shuffledPlayers[startIdx + seatIdx];
      const tablePlayerId = generateId();

      db.prepare(`
        INSERT INTO table_players (
          id, table_id, player_id, seat_index, stack, status, current_bet
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        tablePlayerId,
        tableId,
        player.id,
        seatIdx,
        tournament.starting_chips,
        'waiting',
        0
      );

      // Emit player seated event
      emitEvent(db, 'table', tableId, 'PLAYER_SEATED', {
        playerId: player.id,
        playerName: player.name,
        seatIndex: seatIdx,
        stack: tournament.starting_chips,
      }, 1);
    }

    const table = db
      .prepare('SELECT * FROM tables WHERE id = ?')
      .get(tableId) as Table;

    createdTables.push(table);
  }

  return createdTables;
}

/**
 * Start the first hand on a table
 */
function startFirstHand(
  db: Database.Database,
  tableId: string,
  smallBlind: number,
  bigBlind: number,
  ante: number
): void {
  const { startNewHand } = require('../hand/start');
  startNewHand(db, tableId, 1);
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
