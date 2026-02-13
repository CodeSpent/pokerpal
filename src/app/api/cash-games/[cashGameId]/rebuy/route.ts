import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { rebuy } from '@/lib/game/cash-game-service';

/**
 * POST /api/cash-games/[cashGameId]/rebuy
 * Rebuy chips at a cash game
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
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid rebuy amount is required' }, { status: 400 });
    }

    const result = await rebuy(cashGameId, authPlayer.playerId, amount);

    return NextResponse.json({
      success: true,
      newStack: result.newStack,
    });
  } catch (error) {
    console.error('Error rebuying:', error);
    const message = error instanceof Error ? error.message : 'Failed to rebuy';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
