import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { tableRepo } from '@/lib/db/repositories';
import { handlePoll } from '@/lib/game/game-service';

/**
 * GET /api/tables/[tableId]/poll
 * Poll for table updates
 *
 * Query params:
 * - version: last known table version
 * - lastEventId: last known event ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
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

    const { tableId } = await params;

    // Verify table exists and player is seated
    const { table, players } = await tableRepo.getTableWithPlayers(tableId);

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    const playerSeat = players.find((p) => p.playerId === playerId);

    if (!playerSeat) {
      return NextResponse.json(
        { error: 'You are not seated at this table' },
        { status: 403 }
      );
    }

    // Get query params
    const url = new URL(request.url);
    const clientVersion = parseInt(url.searchParams.get('version') || '0', 10);
    const lastEventId = parseInt(url.searchParams.get('lastEventId') || '0', 10);

    // Get poll response
    const pollResponse = await handlePoll(tableId, clientVersion, lastEventId);

    return NextResponse.json(pollResponse);
  } catch (error) {
    console.error('Error polling table:', error);
    return NextResponse.json(
      { error: 'Failed to poll table' },
      { status: 500 }
    );
  }
}
