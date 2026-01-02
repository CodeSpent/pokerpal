import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getTournament,
  registerPlayer,
  unregisterPlayer,
  startTournament,
  ensurePlayer,
  getDatabase,
} from '@/lib/poker-engine-v2';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

/**
 * POST /api/tournaments/[tournamentId]/register
 * Register for a tournament
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
    const body = await request.json();
    const { displayName } = body;

    // Check if tournament exists
    const tournament = getTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Ensure player exists
    const playerName = displayName || 'Player';
    const playerResult = ensurePlayer(playerId, playerName);
    if (!playerResult.success) {
      return NextResponse.json(
        { error: 'Failed to create player' },
        { status: 500 }
      );
    }

    // Register for tournament
    const result = registerPlayer(tournamentId, playerId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Check if tournament should auto-start (SNG style)
    if (result.data!.shouldAutoStart) {
      const startResult = startTournament(tournamentId);

      if (startResult.success) {
        return NextResponse.json({
          registered: true,
          tournamentStarted: true,
          tables: startResult.data!.tables.map((t) => t.id),
        });
      }
    }

    return NextResponse.json({
      registered: true,
      registeredCount: result.data!.playerCount,
      maxPlayers: tournament.max_players,
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
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { tournamentId } = await params;
    const result = unregisterPlayer(tournamentId, playerId);

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
