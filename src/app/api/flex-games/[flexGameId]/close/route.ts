import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { closeFlexGame } from '@/lib/game/flex-game-service';

/**
 * POST /api/flex-games/[flexGameId]/close
 * Close a flex game (host only)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ flexGameId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { flexGameId } = await params;
    await closeFlexGame(flexGameId, authPlayer.playerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error closing flex game:', error);
    const message = error instanceof Error ? error.message : 'Failed to close flex game';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
