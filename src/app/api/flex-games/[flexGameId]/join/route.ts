import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { joinFlexGame } from '@/lib/game/flex-game-service';

/**
 * POST /api/flex-games/[flexGameId]/join
 * Join a flex game with a buy-in amount
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flexGameId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { flexGameId } = await params;
    const body = await request.json();
    const { buyInAmount } = body;

    if (!buyInAmount || typeof buyInAmount !== 'number' || buyInAmount <= 0) {
      return NextResponse.json({ error: 'Valid buy-in amount is required' }, { status: 400 });
    }

    const result = await joinFlexGame(flexGameId, authPlayer.playerId, buyInAmount);

    return NextResponse.json({
      success: true,
      seatIndex: result.seatIndex,
      tableId: result.tableId,
    });
  } catch (error) {
    console.error('Error joining flex game:', error);
    const message = error instanceof Error ? error.message : 'Failed to join flex game';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
