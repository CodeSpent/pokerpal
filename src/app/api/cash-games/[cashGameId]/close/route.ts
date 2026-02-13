import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { closeCashGame } from '@/lib/game/cash-game-service';

/**
 * POST /api/cash-games/[cashGameId]/close
 * Close a cash game (host only)
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
    await closeCashGame(cashGameId, authPlayer.playerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error closing cash game:', error);
    const message = error instanceof Error ? error.message : 'Failed to close cash game';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
