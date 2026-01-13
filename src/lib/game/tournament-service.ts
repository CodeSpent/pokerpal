/**
 * Tournament Service
 *
 * Business logic for tournament operations.
 * Orchestrates repository calls and enforces game rules.
 */

import { tournamentRepo, playerRepo, tableRepo, eventRepo } from '@/lib/db/repositories';
import { withTransaction, generateId, now } from '@/lib/db/transaction';
import type { Tournament, Table, TablePlayer } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface RegisterResult {
  registered: boolean;
  playerCount: number;
  shouldAutoStart: boolean;
}

export interface StartTournamentResult {
  tables: Table[];
  players: TablePlayer[];
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Register a player for a tournament
 */
export async function registerPlayerForTournament(
  tournamentId: string,
  playerId: string
): Promise<{ success: true; data: RegisterResult } | { success: false; error: string }> {
  try {
    // Get tournament
    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Check tournament status
    if (tournament.status !== 'registering') {
      return { success: false, error: 'Tournament is not accepting registrations' };
    }

    // Check if already registered
    const isRegistered = await tournamentRepo.isPlayerRegistered(tournamentId, playerId);
    if (isRegistered) {
      return { success: false, error: 'Already registered for this tournament' };
    }

    // Check player count
    const currentCount = await tournamentRepo.getRegistrationCount(tournamentId);
    if (currentCount >= tournament.maxPlayers) {
      return { success: false, error: 'Tournament is full' };
    }

    // Check player exists
    const player = await playerRepo.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Register
    await tournamentRepo.registerPlayer(tournamentId, playerId);

    // Get updated count
    const newCount = await tournamentRepo.getRegistrationCount(tournamentId);

    // Emit event
    await eventRepo.emitEvent('tournament', tournamentId, 'PLAYER_REGISTERED', {
      playerId,
      playerName: player.name,
      playerCount: newCount,
    }, tournament.version);

    // Check if should auto-start (SNG style - when full)
    const shouldAutoStart = newCount >= tournament.maxPlayers;

    return {
      success: true,
      data: {
        registered: true,
        playerCount: newCount,
        shouldAutoStart,
      },
    };
  } catch (error) {
    console.error('[registerPlayerForTournament] Error:', error);
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return { success: false, error: 'Already registered for this tournament' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register',
    };
  }
}

/**
 * Unregister a player from a tournament
 */
export async function unregisterPlayerFromTournament(
  tournamentId: string,
  playerId: string
): Promise<{ success: true; data: { playerCount: number } } | { success: false; error: string }> {
  try {
    // Get tournament
    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Check tournament status
    if (tournament.status !== 'registering') {
      return { success: false, error: 'Cannot unregister after tournament has started' };
    }

    // Check if registered
    const isRegistered = await tournamentRepo.isPlayerRegistered(tournamentId, playerId);
    if (!isRegistered) {
      return { success: false, error: 'Not registered for this tournament' };
    }

    // Unregister
    await tournamentRepo.unregisterPlayer(tournamentId, playerId);

    // Get updated count
    const playerCount = await tournamentRepo.getRegistrationCount(tournamentId);

    // Emit event
    await eventRepo.emitEvent('tournament', tournamentId, 'PLAYER_UNREGISTERED', {
      playerId,
      playerCount,
    }, tournament.version);

    return {
      success: true,
      data: { playerCount },
    };
  } catch (error) {
    console.error('[unregisterPlayerFromTournament] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unregister',
    };
  }
}

// =============================================================================
// Tournament Start
// =============================================================================

/**
 * Start a tournament
 *
 * Creates tables, assigns seats, and transitions to 'running' status.
 */
export async function startTournament(
  tournamentId: string
): Promise<{ success: true; data: StartTournamentResult } | { success: false; error: string }> {
  try {
    // Get tournament
    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Check status
    if (tournament.status !== 'registering') {
      return { success: false, error: 'Tournament has already started or ended' };
    }

    // Get registrations
    const registrations = await tournamentRepo.getTournamentRegistrations(tournamentId);
    if (registrations.length < 2) {
      return { success: false, error: 'Need at least 2 players to start' };
    }

    // Shuffle players for random seating
    const shuffledPlayers = [...registrations].sort(() => Math.random() - 0.5);

    // Create table(s) - for now, single table
    const table = await tableRepo.createTable({
      tournamentId,
      tableNumber: 1,
      maxSeats: tournament.tableSize,
      dealerSeat: 0,
      smallBlind: 15, // Starting blinds
      bigBlind: 30,
      ante: 0,
      status: 'waiting',
    });

    // Seat players
    const seatedPlayers: TablePlayer[] = [];
    for (let i = 0; i < shuffledPlayers.length; i++) {
      const seated = await tableRepo.seatPlayer({
        tableId: table.id,
        playerId: shuffledPlayers[i].playerId,
        seatIndex: i,
        stack: tournament.startingChips,
        status: 'waiting',
        currentBet: 0,
        holeCard1: null,
        holeCard2: null,
      });
      seatedPlayers.push(seated);
    }

    // Update tournament status
    await tournamentRepo.updateTournamentStatus(tournamentId, 'running', {
      startedAt: now(),
      playersRemaining: shuffledPlayers.length,
      levelStartedAt: now(),
    });

    // Update table status
    await tableRepo.updateTableStatus(table.id, 'playing');

    // Emit event
    await eventRepo.emitEvent('tournament', tournamentId, 'TOURNAMENT_STARTED', {
      tableIds: [table.id],
      playerCount: shuffledPlayers.length,
    }, tournament.version + 1);

    return {
      success: true,
      data: {
        tables: [table],
        players: seatedPlayers,
      },
    };
  } catch (error) {
    console.error('[startTournament] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start tournament',
    };
  }
}

// =============================================================================
// Early Start
// =============================================================================

/**
 * Vote for early start
 */
export async function voteForEarlyStart(
  tournamentId: string,
  playerId: string
): Promise<{ success: true; data: { voteCount: number; threshold: number; shouldStart: boolean } } | { success: false; error: string }> {
  try {
    // Get tournament
    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Check status
    if (tournament.status !== 'registering') {
      return { success: false, error: 'Tournament has already started' };
    }

    // Check if registered
    const isRegistered = await tournamentRepo.isPlayerRegistered(tournamentId, playerId);
    if (!isRegistered) {
      return { success: false, error: 'Must be registered to vote' };
    }

    // Add vote
    await tournamentRepo.addEarlyStartVote(tournamentId, playerId);

    // Get counts
    const voteCount = await tournamentRepo.getEarlyStartVoteCount(tournamentId);
    const playerCount = await tournamentRepo.getRegistrationCount(tournamentId);

    // Check threshold (all players must vote)
    const threshold = playerCount;
    const shouldStart = voteCount >= threshold && playerCount >= 2;

    // Emit event
    await eventRepo.emitEvent('tournament', tournamentId, 'EARLY_START_VOTE', {
      playerId,
      voteCount,
      threshold,
    }, tournament.version);

    return {
      success: true,
      data: {
        voteCount,
        threshold,
        shouldStart,
      },
    };
  } catch (error) {
    console.error('[voteForEarlyStart] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to vote',
    };
  }
}
