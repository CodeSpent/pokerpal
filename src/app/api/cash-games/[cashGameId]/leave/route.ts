import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { leaveCashGame } from '@/lib/game/cash-game-service';

/**
 * POST /api/cash-games/[cashGameId]/leave
 * Leave a cash game (cash out)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ cashGameId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { cashGameId } = await params;
    const result = await leaveCashGame(cashGameId, authPlayer.playerId);

    return NextResponse.json({
      success: true,
      cashedOut: result.cashedOut,
    });
  } catch (error) {
    console.error('Error leaving cash game:', error);
    const message = error instanceof Error ? error.message : 'Failed to leave cash game';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
