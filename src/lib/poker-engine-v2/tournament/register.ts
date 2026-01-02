/**
 * Tournament Registration
 *
 * Handles player registration with atomic checks to prevent race conditions.
 */

import type Database from 'better-sqlite3';
import type { Tournament, TournamentRegistration, Player, ApiResult } from '../types';
import { withTransaction, generateId, now } from '../db/transaction';
import { canPlayerRegister, canPlayerUnregister, shouldAutoStart } from '../state-machine/tournament-fsm';

export interface RegisterResult {
  tournament: Tournament;
  registration: TournamentRegistration;
  shouldAutoStart: boolean;
  playerCount: number;
}

/**
 * Register a player for a tournament
 *
 * All checks and insert happen in a single transaction to prevent race conditions.
 * The UNIQUE constraint on (tournament_id, player_id) is a backup.
 */
export function registerPlayer(
  tournamentId: string,
  playerId: string
): ApiResult<RegisterResult> {
  try {
    const result = withTransaction((db) => {
      // Get tournament
      const tournament = db
        .prepare('SELECT * FROM tournaments WHERE id = ?')
        .get(tournamentId) as Tournament | undefined;

      if (!tournament) {
        return { error: 'Tournament not found', code: 'NOT_FOUND' };
      }

      // Get current registrations
      const registrations = db
        .prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ?')
        .all(tournamentId) as TournamentRegistration[];

      // Check if player exists
      const player = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(playerId) as Player | undefined;

      if (!player) {
        return { error: 'Player not found', code: 'PLAYER_NOT_FOUND' };
      }

      // Check guard conditions
      const guard = canPlayerRegister(tournament, registrations, playerId);
      if (!guard.canRegister) {
        return { error: guard.reason!, code: 'INVALID_REGISTRATION' };
      }

      // Register player
      const registrationId = generateId();
      const timestamp = now();

      try {
        db.prepare(`
          INSERT INTO tournament_registrations (id, tournament_id, player_id, registered_at)
          VALUES (?, ?, ?, ?)
        `).run(registrationId, tournamentId, playerId, timestamp);
      } catch (err) {
        // UNIQUE constraint violation = already registered (race condition caught)
        if ((err as Error).message.includes('UNIQUE')) {
          return { error: 'Already registered for this tournament', code: 'ALREADY_REGISTERED' };
        }
        throw err;
      }

      // Fetch updated data
      const updatedRegistrations = db
        .prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ?')
        .all(tournamentId) as TournamentRegistration[];

      const registration = db
        .prepare('SELECT * FROM tournament_registrations WHERE id = ?')
        .get(registrationId) as TournamentRegistration;

      // Emit event
      emitEvent(db, 'tournament', tournamentId, 'PLAYER_REGISTERED', {
        playerId,
        playerName: player.name,
        playerCount: updatedRegistrations.length,
      }, tournament.version);

      return {
        data: {
          tournament,
          registration,
          shouldAutoStart: shouldAutoStart(tournament, updatedRegistrations),
          playerCount: updatedRegistrations.length,
        },
      };
    });

    if ('error' in result) {
      return { success: false, error: result.error, code: result.code };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[registerPlayer] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register',
    };
  }
}

/**
 * Unregister a player from a tournament
 */
export function unregisterPlayer(
  tournamentId: string,
  playerId: string
): ApiResult<{ tournament: Tournament; playerCount: number }> {
  try {
    const result = withTransaction((db) => {
      // Get tournament
      const tournament = db
        .prepare('SELECT * FROM tournaments WHERE id = ?')
        .get(tournamentId) as Tournament | undefined;

      if (!tournament) {
        return { error: 'Tournament not found', code: 'NOT_FOUND' };
      }

      // Get current registrations
      const registrations = db
        .prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ?')
        .all(tournamentId) as TournamentRegistration[];

      // Check guard conditions
      const guard = canPlayerUnregister(tournament, registrations, playerId);
      if (!guard.canUnregister) {
        return { error: guard.reason!, code: 'INVALID_UNREGISTRATION' };
      }

      // Delete registration
      const deleteResult = db
        .prepare('DELETE FROM tournament_registrations WHERE tournament_id = ? AND player_id = ?')
        .run(tournamentId, playerId);

      if (deleteResult.changes === 0) {
        return { error: 'Registration not found', code: 'NOT_FOUND' };
      }

      // Also delete any early start vote
      db.prepare('DELETE FROM early_start_votes WHERE tournament_id = ? AND player_id = ?')
        .run(tournamentId, playerId);

      // Get updated count
      const countResult = db
        .prepare('SELECT COUNT(*) as count FROM tournament_registrations WHERE tournament_id = ?')
        .get(tournamentId) as { count: number };

      // Emit event
      emitEvent(db, 'tournament', tournamentId, 'PLAYER_UNREGISTERED', {
        playerId,
        playerCount: countResult.count,
      }, tournament.version);

      return {
        data: {
          tournament,
          playerCount: countResult.count,
        },
      };
    });

    if ('error' in result) {
      return { success: false, error: result.error, code: result.code };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[unregisterPlayer] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unregister',
    };
  }
}

/**
 * Get all registrations for a tournament
 */
export function getTournamentRegistrations(
  tournamentId: string
): TournamentRegistration[] {
  const db = require('../db/connection').getDatabase();
  return db
    .prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ?')
    .all(tournamentId) as TournamentRegistration[];
}

/**
 * Get registration count for a tournament
 */
export function getRegistrationCount(tournamentId: string): number {
  const db = require('../db/connection').getDatabase();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM tournament_registrations WHERE tournament_id = ?')
    .get(tournamentId) as { count: number };
  return result.count;
}

/**
 * Check if a player is registered for a tournament
 */
export function isPlayerRegistered(
  tournamentId: string,
  playerId: string
): boolean {
  const db = require('../db/connection').getDatabase();
  const result = db
    .prepare('SELECT 1 FROM tournament_registrations WHERE tournament_id = ? AND player_id = ?')
    .get(tournamentId, playerId);
  return !!result;
}

/**
 * Get registrations with player details
 */
export function getRegistrationsWithPlayers(
  tournamentId: string
): Array<TournamentRegistration & { name: string; avatar?: string }> {
  const db = require('../db/connection').getDatabase();
  return db.prepare(`
    SELECT tr.*, p.name, p.avatar
    FROM tournament_registrations tr
    JOIN players p ON tr.player_id = p.id
    WHERE tr.tournament_id = ?
    ORDER BY tr.registered_at
  `).all(tournamentId) as Array<TournamentRegistration & { name: string; avatar?: string }>;
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
