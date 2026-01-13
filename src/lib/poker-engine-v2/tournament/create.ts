/**
 * Tournament Creation
 */

import type Database from 'better-sqlite3';
import type { Tournament, Player, ApiResult } from '../types';
import { withTransaction, generateId, now } from '../db/transaction';
import { getDatabase } from '../db/connection';

export interface CreateTournamentParams {
  name: string;
  creatorId: string;
  maxPlayers?: number;
  tableSize?: number;
  startingChips?: number;
  blindStructure?: string;
  blindLevelMinutes?: number;
  turnTimerSeconds?: number | null; // null = unlimited, default 30
}

export interface CreateTournamentResult {
  tournament: Tournament;
  alreadyRegistered: boolean;
}

/**
 * Create a new tournament
 *
 * Atomically creates tournament and registers creator
 */
export function createTournament(
  params: CreateTournamentParams
): ApiResult<CreateTournamentResult> {
  const {
    name,
    creatorId,
    maxPlayers = 9,
    tableSize = 9,
    startingChips = 1500,
    blindStructure = 'standard',
    blindLevelMinutes = 10,
    turnTimerSeconds = 30,
  } = params;

  try {
    const result = withTransaction((db) => {
      // Check if player exists, create if not
      const player = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(creatorId) as Player | undefined;

      if (!player) {
        return { error: 'Player not found', code: 'PLAYER_NOT_FOUND' };
      }

      // Create tournament
      const tournamentId = generateId();
      const timestamp = now();

      db.prepare(`
        INSERT INTO tournaments (
          id, name, creator_id, max_players, table_size,
          starting_chips, blind_structure, blind_level_minutes, turn_timer_seconds, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tournamentId,
        name,
        creatorId,
        maxPlayers,
        tableSize,
        startingChips,
        blindStructure,
        blindLevelMinutes,
        turnTimerSeconds,
        timestamp
      );

      // Auto-register creator
      const registrationId = generateId();
      db.prepare(`
        INSERT INTO tournament_registrations (id, tournament_id, player_id, registered_at)
        VALUES (?, ?, ?, ?)
      `).run(registrationId, tournamentId, creatorId, timestamp);

      // Fetch the created tournament
      const tournament = db
        .prepare('SELECT * FROM tournaments WHERE id = ?')
        .get(tournamentId) as Tournament;

      // Emit event
      emitEvent(db, 'tournament', tournamentId, 'TOURNAMENT_CREATED', {
        tournament,
        creatorId,
      }, 1);

      return {
        data: {
          tournament,
          alreadyRegistered: true,
        },
      };
    });

    if ('error' in result) {
      return { success: false, error: result.error, code: result.code };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[createTournament] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create tournament',
    };
  }
}

/**
 * Ensure a player exists in the database
 */
export function ensurePlayer(
  playerId: string,
  name: string,
  avatar?: string
): ApiResult<Player> {
  try {
    const result = withTransaction((db) => {
      // Check if player exists
      let player = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(playerId) as Player | undefined;

      if (!player) {
        // Create player
        db.prepare(`
          INSERT INTO players (id, name, avatar, created_at)
          VALUES (?, ?, ?, ?)
        `).run(playerId, name, avatar || null, now());

        player = db
          .prepare('SELECT * FROM players WHERE id = ?')
          .get(playerId) as Player;
      } else if (player.name !== name) {
        // Update player's name if it changed
        db.prepare('UPDATE players SET name = ? WHERE id = ?').run(name, playerId);
        player = { ...player, name };
      }

      return player;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('[ensurePlayer] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to ensure player',
    };
  }
}

/**
 * Get a tournament by ID
 */
export function getTournament(tournamentId: string): Tournament | null {
  const db = getDatabase();
  const tournament = db
    .prepare('SELECT * FROM tournaments WHERE id = ?')
    .get(tournamentId) as Tournament | undefined;
  return tournament || null;
}

/**
 * Get all tournaments with a specific status
 */
export function getTournamentsByStatus(status: string): Tournament[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM tournaments WHERE status = ? ORDER BY created_at DESC')
    .all(status) as Tournament[];
}

/**
 * Get all open tournaments (registering status)
 */
export function getOpenTournaments(): Tournament[] {
  return getTournamentsByStatus('registering');
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
