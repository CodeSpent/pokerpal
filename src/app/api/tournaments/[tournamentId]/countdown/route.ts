import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { tournamentRepo } from '@/lib/db/repositories';
import {
  startCountdown,
  cancelCountdown,
  startTournament,
  broadcastGameStarting,
} from '@/lib/game/tournament-service';
import { now } from '@/lib/db/transaction';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';
const COUNTDOWN_DURATION_MS = 20_000;

/**
 * GET /api/tournaments/[tournamentId]/countdown
 * Get countdown status
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;

    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (!tournament.countdownStartedAt) {
      return NextResponse.json({
        active: false,
      });
    }

    const expiresAt = tournament.countdownStartedAt + COUNTDOWN_DURATION_MS;
    const currentTime = now();
    const remainingMs = Math.max(0, expiresAt - currentTime);
    const expired = remainingMs <= 0;

    return NextResponse.json({
      active: !expired,
      startedAt: tournament.countdownStartedAt,
      expiresAt,
      remainingMs,
      expired,
    });
  } catch (error) {
    console.error('Error getting countdown status:', error);
    return NextResponse.json(
      { error: 'Failed to get countdown status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments/[tournamentId]/countdown
 * Start countdown (host only) or handle countdown expiry
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { tournamentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Handle countdown expiry (any registered player can trigger)
    if (action === 'expire') {
      // Verify countdown has actually expired
      if (!tournament.countdownStartedAt) {
        return NextResponse.json(
          { error: 'No active countdown' },
          { status: 400 }
        );
      }

      const expiresAt = tournament.countdownStartedAt + COUNTDOWN_DURATION_MS;
      const currentTime = now();

      if (currentTime < expiresAt) {
        return NextResponse.json(
          { error: 'Countdown has not expired yet' },
          { status: 400 }
        );
      }

      // Verify player is registered
      const isRegistered = await tournamentRepo.isPlayerRegistered(tournamentId, playerId);
      if (!isRegistered) {
        return NextResponse.json(
          { error: 'Not registered for this tournament' },
          { status: 403 }
        );
      }

      // Start the tournament
      const startResult = await startTournament(tournamentId);

      if (!startResult.success) {
        return NextResponse.json(
          { error: startResult.error },
          { status: 400 }
        );
      }

      // Broadcast game starting
      await broadcastGameStarting(
        tournamentId,
        startResult.data.tables.map(t => t.id)
      );

      return NextResponse.json({
        tournamentStarted: true,
        tables: startResult.data.tables.map(t => t.id),
      });
    }

    // Start countdown (host only)
    if (action === 'start') {
      // Verify host
      if (tournament.creatorId !== playerId) {
        return NextResponse.json(
          { error: 'Only the host can start countdown' },
          { status: 403 }
        );
      }

      const result = await startCountdown(tournamentId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        countdownStarted: true,
        expiresAt: result.data.expiresAt,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "expire"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error with countdown:', error);
    return NextResponse.json(
      { error: 'Failed to process countdown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tournaments/[tournamentId]/countdown
 * Cancel countdown (host only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { tournamentId } = await params;

    const tournament = await tournamentRepo.getTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Verify host
    if (tournament.creatorId !== playerId) {
      return NextResponse.json(
        { error: 'Only the host can cancel countdown' },
        { status: 403 }
      );
    }

    const result = await cancelCountdown(tournamentId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      countdownCancelled: true,
    });
  } catch (error) {
    console.error('Error cancelling countdown:', error);
    return NextResponse.json(
      { error: 'Failed to cancel countdown' },
      { status: 500 }
    );
  }
}
