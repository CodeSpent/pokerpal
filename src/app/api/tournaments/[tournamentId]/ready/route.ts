import { NextResponse } from 'next/server';
import { tournamentRepo } from '@/lib/db/repositories';
import {
  markPlayerReady,
  startTournament,
  broadcastGameStarting,
} from '@/lib/game/tournament-service';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';

/**
 * POST /api/tournaments/[tournamentId]/ready
 * Mark player as ready during countdown
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

    // Mark player ready (Pusher broadcasts happen in service)
    const result = await markPlayerReady(tournamentId, playerId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // If all players are ready, start the tournament immediately
    if (result.data.allReady) {
      const startResult = await startTournament(tournamentId);

      if (startResult.success) {
        // Broadcast game starting
        await broadcastGameStarting(
          tournamentId,
          startResult.data.tables.map(t => t.id)
        );

        return NextResponse.json({
          ready: true,
          readyCount: result.data.readyCount,
          playerCount: result.data.playerCount,
          allReady: true,
          tournamentStarted: true,
          tables: startResult.data.tables.map(t => t.id),
        });
      }
    }

    return NextResponse.json({
      ready: true,
      readyCount: result.data.readyCount,
      playerCount: result.data.playerCount,
      allReady: result.data.allReady,
    });
  } catch (error) {
    console.error('Error marking ready:', error);
    return NextResponse.json(
      { error: 'Failed to mark ready' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tournaments/[tournamentId]/ready
 * Get ready status for tournament
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

    const registrations = await tournamentRepo.getRegistrationsWithReadyStatus(tournamentId);
    const readyCount = registrations.filter(r => r.isReady).length;

    return NextResponse.json({
      countdownActive: !!tournament.countdownStartedAt,
      countdownStartedAt: tournament.countdownStartedAt,
      readyCount,
      playerCount: registrations.length,
      players: registrations.map(r => ({
        id: r.playerId,
        displayName: r.playerName,
        isReady: r.isReady,
      })),
    });
  } catch (error) {
    console.error('Error getting ready status:', error);
    return NextResponse.json(
      { error: 'Failed to get ready status' },
      { status: 500 }
    );
  }
}
