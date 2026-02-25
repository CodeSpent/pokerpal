import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { leaveFlexGame } from '@/lib/game/flex-game-service';

/**
 * POST /api/flex-games/[flexGameId]/leave
 * Leave a flex game (cash out)
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
    const result = await leaveFlexGame(flexGameId, authPlayer.playerId);

    return NextResponse.json({
      success: true,
      cashedOut: result.cashedOut,
    });
  } catch (error) {
    console.error('Error leaving flex game:', error);
    const message = error instanceof Error ? error.message : 'Failed to leave flex game';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
