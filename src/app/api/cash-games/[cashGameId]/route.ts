import { NextResponse } from 'next/server';
import { cashGameRepo } from '@/lib/db/repositories';

/**
 * GET /api/cash-games/[cashGameId]
 * Get cash game details with players
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cashGameId: string }> }
) {
  try {
    const { cashGameId } = await params;
    const data = await cashGameRepo.getCashGameWithPlayers(cashGameId);

    if (!data) {
      return NextResponse.json({ error: 'Cash game not found' }, { status: 404 });
    }

    return NextResponse.json({
      cashGame: data.game,
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
    console.error('Error fetching cash game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cash game' },
      { status: 500 }
    );
  }
}
