import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { joinCashGame } from '@/lib/game/cash-game-service';

/**
 * POST /api/cash-games/[cashGameId]/join
 * Join a cash game with a buy-in amount
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ cashGameId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { cashGameId } = await params;
    const body = await request.json();
    const { buyInAmount } = body;

    if (!buyInAmount || typeof buyInAmount !== 'number' || buyInAmount <= 0) {
      return NextResponse.json({ error: 'Valid buy-in amount is required' }, { status: 400 });
    }

    const result = await joinCashGame(cashGameId, authPlayer.playerId, buyInAmount);

    return NextResponse.json({
      success: true,
      seatIndex: result.seatIndex,
      tableId: result.tableId,
    });
  } catch (error) {
    console.error('Error joining cash game:', error);
    const message = error instanceof Error ? error.message : 'Failed to join cash game';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
