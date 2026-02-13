/**
 * Tournament Service
 *
 * Business logic for tournament operations.
 * Orchestrates repository calls and enforces game rules.
 */

import { tournamentRepo, playerRepo, tableRepo, eventRepo, chipTxRepo } from '@/lib/db/repositories';
import { withTransaction, generateId, now } from '@/lib/db/transaction';
import { getDb } from '@/lib/db';
import { players } from '@/lib/db/schema';
import type { Tournament, Table, TablePlayer } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getPusher, channels, tournamentEvents } from '@/lib/pusher-server';

const COUNTDOWN_DURATION_MS = 20_000; // 20 seconds

// =============================================================================
// Types
// =============================================================================

export interface RegisterResult {
  registered: boolean;
  playerCount: number;
  shouldStartCountdown: boolean;
  countdownExpiresAt?: number;
}

export interface StartTournamentResult {
  tables: Table[];
  players: TablePlayer[];
}

export interface CountdownResult {
  countdownStarted: boolean;
  expiresAt: number;
}

export interface ReadyResult {
  isReady: boolean;
  readyCount: number;
  playerCount: number;
  allReady: boolean;
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

    // Check balance and deduct buy-in (buy-in = starting chips)
    if (player.chipBalance < tournament.startingChips) {
      return { success: false, error: `Insufficient chips: need ${tournament.startingChips}, have ${player.chipBalance}` };
    }

    await chipTxRepo.recordTransaction({
      playerId,
      type: 'buy_in',
      amount: -tournament.startingChips,
      tournamentId,
      description: `Buy-in for ${tournament.name}`,
    });

    // Register
    await tournamentRepo.registerPlayer(tournamentId, playerId);

    // Get updated count and all registrations for broadcast
    const newCount = await tournamentRepo.getRegistrationCount(tournamentId);
    const registrations = await tournamentRepo.getRegistrationsWithReadyStatus(tournamentId);

    // Emit event to database
    await eventRepo.emitEvent('tournament', tournamentId, 'PLAYER_REGISTERED', {
      playerId,
      playerName: player.name,
      playerCount: newCount,
    }, tournament.version);

    // Broadcast via Pusher
    const pusher = getPusher();
    if (pusher) {
      await pusher.trigger(channels.tournament(tournamentId), tournamentEvents.PLAYER_REGISTERED, {
        playerId,
        playerName: player.name,
        playerCount: newCount,
        players: registrations.map(r => ({
          id: r.playerId,
          displayName: r.playerName,
          isReady: r.isReady,
        })),
      }).catch(err => console.error('Failed to broadcast PLAYER_REGISTERED:', err));
    }

    // Check if should start countdown (SNG style - when full)
    const shouldStartCountdown = newCount >= tournament.maxPlayers;
    let countdownExpiresAt: number | undefined;

    if (shouldStartCountdown) {
      // Start the countdown
      const countdownResult = await startCountdown(tournamentId);
      if (countdownResult.success) {
        countdownExpiresAt = countdownResult.data.expiresAt;
      }
    }

    return {
      success: true,
      data: {
        registered: true,
        playerCount: newCount,
        shouldStartCountdown,
        countdownExpiresAt,
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

    // Refund buy-in
    await chipTxRepo.recordTransaction({
      playerId,
      type: 'refund',
      amount: tournament.startingChips,
      tournamentId,
      description: `Refund for ${tournament.name}`,
    });

    // Get updated count and registrations
    const playerCount = await tournamentRepo.getRegistrationCount(tournamentId);
    const registrations = await tournamentRepo.getRegistrationsWithReadyStatus(tournamentId);

    // If countdown was active and player left, cancel countdown
    if (tournament.countdownStartedAt) {
      await cancelCountdown(tournamentId);
    }

    // Emit event
    await eventRepo.emitEvent('tournament', tournamentId, 'PLAYER_UNREGISTERED', {
      playerId,
      playerCount,
    }, tournament.version);

    // Broadcast via Pusher
    const pusher = getPusher();
    if (pusher) {
      await pusher.trigger(channels.tournament(tournamentId), tournamentEvents.PLAYER_UNREGISTERED, {
        playerId,
        playerCount,
        players: registrations.map(r => ({
          id: r.playerId,
          displayName: r.playerName,
          isReady: r.isReady,
        })),
      }).catch(err => console.error('Failed to broadcast PLAYER_UNREGISTERED:', err));
    }

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

    // Set prize pool
    const prizePool = registrations.length * tournament.startingChips;
    await tournamentRepo.updateTournament(tournamentId, { prizePool });

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

// =============================================================================
// Countdown & Ready-Up
// =============================================================================

/**
 * Start the ready-up countdown
 */
export async function startCountdown(
  tournamentId: string
): Promise<{ success: true; data: CountdownResult } | { success: false; error: string }> {
  try {
    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    if (tournament.status !== 'registering') {
      return { success: false, error: 'Tournament has already started' };
    }

    const playerCount = await tournamentRepo.getRegistrationCount(tournamentId);
    if (playerCount < 2) {
      return { success: false, error: 'Need at least 2 players to start' };
    }

    // Set countdown started
    const countdownStartedAt = now();
    const expiresAt = countdownStartedAt + COUNTDOWN_DURATION_MS;
    await tournamentRepo.setCountdownStarted(tournamentId, countdownStartedAt);

    // Get registrations for broadcast
    const registrations = await tournamentRepo.getRegistrationsWithReadyStatus(tournamentId);

    // Broadcast via Pusher
    const pusher = getPusher();
    if (pusher) {
      await pusher.trigger(channels.tournament(tournamentId), tournamentEvents.COUNTDOWN_STARTED, {
        expiresAt,
        durationMs: COUNTDOWN_DURATION_MS,
        players: registrations.map(r => ({
          id: r.playerId,
          displayName: r.playerName,
          isReady: r.isReady,
        })),
      }).catch(err => console.error('Failed to broadcast COUNTDOWN_STARTED:', err));
    }

    return {
      success: true,
      data: {
        countdownStarted: true,
        expiresAt,
      },
    };
  } catch (error) {
    console.error('[startCountdown] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start countdown',
    };
  }
}

/**
 * Cancel the countdown
 */
export async function cancelCountdown(
  tournamentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Clear countdown and reset ready states
    await tournamentRepo.setCountdownStarted(tournamentId, null);
    await tournamentRepo.resetReadyStates(tournamentId);

    // Broadcast via Pusher
    const pusher = getPusher();
    if (pusher) {
      await pusher.trigger(channels.tournament(tournamentId), tournamentEvents.COUNTDOWN_CANCELLED, {})
        .catch(err => console.error('Failed to broadcast COUNTDOWN_CANCELLED:', err));
    }

    return { success: true };
  } catch (error) {
    console.error('[cancelCountdown] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel countdown',
    };
  }
}

/**
 * Mark player as ready
 */
export async function markPlayerReady(
  tournamentId: string,
  playerId: string
): Promise<{ success: true; data: ReadyResult } | { success: false; error: string }> {
  try {
    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    if (tournament.status !== 'registering') {
      return { success: false, error: 'Tournament has already started' };
    }

    if (!tournament.countdownStartedAt) {
      return { success: false, error: 'Countdown has not started' };
    }

    // Check if registered
    const isRegistered = await tournamentRepo.isPlayerRegistered(tournamentId, playerId);
    if (!isRegistered) {
      return { success: false, error: 'Not registered for this tournament' };
    }

    // Mark ready
    await tournamentRepo.setPlayerReady(tournamentId, playerId, true);

    // Get counts
    const readyCount = await tournamentRepo.getReadyCount(tournamentId);
    const playerCount = await tournamentRepo.getRegistrationCount(tournamentId);
    const allReady = readyCount >= playerCount;

    // Get registrations for broadcast
    const registrations = await tournamentRepo.getRegistrationsWithReadyStatus(tournamentId);

    // Broadcast via Pusher
    const pusher = getPusher();
    if (pusher) {
      await pusher.trigger(channels.tournament(tournamentId), tournamentEvents.PLAYER_READY, {
        playerId,
        readyCount,
        playerCount,
        allReady,
        players: registrations.map(r => ({
          id: r.playerId,
          displayName: r.playerName,
          isReady: r.isReady,
        })),
      }).catch(err => console.error('Failed to broadcast PLAYER_READY:', err));
    }

    return {
      success: true,
      data: {
        isReady: true,
        readyCount,
        playerCount,
        allReady,
      },
    };
  } catch (error) {
    console.error('[markPlayerReady] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark ready',
    };
  }
}

/**
 * Broadcast game starting event
 */
export async function broadcastGameStarting(
  tournamentId: string,
  tableIds: string[]
): Promise<void> {
  const pusher = getPusher();
  if (pusher) {
    await pusher.trigger(channels.tournament(tournamentId), tournamentEvents.GAME_STARTING, {
      tableIds,
    }).catch(err => console.error('Failed to broadcast GAME_STARTING:', err));
  }
}

// =============================================================================
// Tournament Payouts
// =============================================================================

const PAYOUT_STRUCTURES: Record<number, number[]> = {
  2: [1.0],
  3: [0.75, 0.25],
  4: [0.75, 0.25],
  5: [0.65, 0.25, 0.10],
  6: [0.65, 0.25, 0.10],
};

/**
 * Award tournament prizes based on finish order.
 * Idempotent — skips if payouts have already been recorded for this tournament.
 */
export async function awardTournamentPrizes(tournamentId: string): Promise<void> {
  try {
    // Idempotency check: skip if payouts already exist
    const existingTxs = await chipTxRepo.getTournamentTransactions(tournamentId);
    if (existingTxs.some((tx) => tx.type === 'payout')) {
      console.log(`[awardTournamentPrizes] Payouts already exist for tournament ${tournamentId}, skipping`);
      return;
    }

    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      console.error(`[awardTournamentPrizes] Tournament not found: ${tournamentId}`);
      return;
    }

    const registrations = await tournamentRepo.getTournamentRegistrations(tournamentId);
    const playerCount = registrations.length;
    const prizePool = tournament.prizePool || playerCount * tournament.startingChips;

    // Get the payout structure
    const payouts = PAYOUT_STRUCTURES[Math.min(playerCount, 6)] || PAYOUT_STRUCTURES[6];

    // Get table players to determine finish order
    const tablesList = await tableRepo.getTournamentTables(tournamentId);
    if (tablesList.length === 0) {
      console.error(`[awardTournamentPrizes] No tables found for tournament ${tournamentId}`);
      return;
    }

    const { players: tPlayers } = await tableRepo.getTableWithPlayers(tablesList[0].id);

    // Determine finish order:
    // - Non-eliminated player is 1st place
    // - Eliminated players sorted by eliminatedAt DESC (last eliminated = 2nd place)
    const winner = tPlayers.find((p) => p.status !== 'eliminated');
    const eliminated = tPlayers
      .filter((p) => p.status === 'eliminated')
      .sort((a, b) => (b.eliminatedAt ?? 0) - (a.eliminatedAt ?? 0));

    const finishOrder = winner ? [winner, ...eliminated] : eliminated;

    const db = getDb();

    // Award payouts
    for (let i = 0; i < payouts.length && i < finishOrder.length; i++) {
      const player = finishOrder[i];
      const payoutAmount = Math.floor(prizePool * payouts[i]);

      if (payoutAmount > 0) {
        await chipTxRepo.recordTransaction({
          playerId: player.playerId,
          type: 'payout',
          amount: payoutAmount,
          tournamentId,
          description: `${getOrdinal(i + 1)} place in ${tournament.name}`,
        });
      }
    }

    // Update player stats for all participants
    for (const reg of registrations) {
      await db
        .update(players)
        .set({ totalGamesPlayed: sql`${players.totalGamesPlayed} + 1` })
        .where(eq(players.id, reg.playerId));
    }

    // Update winner stats
    if (finishOrder.length > 0) {
      const winnerId = finishOrder[0].playerId;
      const winnerPayout = Math.floor(prizePool * payouts[0]);
      await db
        .update(players)
        .set({
          tournamentsWon: sql`${players.tournamentsWon} + 1`,
          totalWinnings: sql`${players.totalWinnings} + ${winnerPayout}`,
        })
        .where(eq(players.id, winnerId));
    }

    console.log(`[awardTournamentPrizes] Awarded prizes for tournament ${tournamentId}: ${finishOrder.length} players, pool=${prizePool}`);
  } catch (error) {
    console.error('[awardTournamentPrizes] Error:', error);
  }
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
