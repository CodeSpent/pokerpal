import { NextResponse } from 'next/server';
import { flexGameRepo } from '@/lib/db/repositories';

/**
 * GET /api/flex-games/[flexGameId]
 * Get flex game details with players
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flexGameId: string }> }
) {
  try {
    const { flexGameId } = await params;
    const data = await flexGameRepo.getFlexGameWithPlayers(flexGameId);

    if (!data) {
      return NextResponse.json({ error: 'Flex game not found' }, { status: 404 });
    }

    return NextResponse.json({
      flexGame: data.game,
      table: data.table,
      players: data.players.map((p) => ({
        id: p.playerId,
        name: p.name,
        avatar: p.avatar,
        seatIndex: p.seatIndex,
        stack: p.stack,
        status: p.status,
      })),
    });
  } catch (error) {
    console.error('Error fetching flex game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flex game' },
      { status: 500 }
    );
  }
}
