import { NextResponse } from 'next/server';
import { tournamentRepo } from '@/lib/db/repositories';
import {
  registerPlayerForTournament,
  unregisterPlayerFromTournament,
} from '@/lib/game/tournament-service';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';

/**
 * POST /api/tournaments/[tournamentId]/register
 * Register for a tournament
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    const { playerId } = authPlayer;

    const { tournamentId } = await params;

    // Register for tournament (Pusher broadcasts happen in service)
    const result = await registerPlayerForTournament(tournamentId, playerId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Get tournament for max players
    const tournament = await tournamentRepo.getTournament(tournamentId);

    // Return countdown info if it started
    return NextResponse.json({
      registered: true,
      registeredCount: result.data.playerCount,
      maxPlayers: tournament?.maxPlayers ?? 9,
      countdownStarted: result.data.shouldStartCountdown,
      countdownExpiresAt: result.data.countdownExpiresAt,
    });
  } catch (error) {
    console.error('Error registering for tournament:', error);
    return NextResponse.json(
      { error: 'Failed to register' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tournaments/[tournamentId]/register
 * Unregister from a tournament
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    const { playerId } = authPlayer;

    const { tournamentId } = await params;
    const result = await unregisterPlayerFromTournament(tournamentId, playerId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ unregistered: true });
  } catch (error) {
    console.error('Error unregistering from tournament:', error);
    return NextResponse.json(
      { error: 'Failed to unregister' },
      { status: 500 }
    );
  }
}
