import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { chipTxRepo } from '@/lib/db/repositories';

/**
 * GET /api/player/transactions
 * Get paginated transaction history
 */
export async function GET(request: Request) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const transactions = await chipTxRepo.getTransactionHistory(
      authPlayer.playerId,
      limit,
      offset
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error getting transactions:', error);
    return NextResponse.json({ error: 'Failed to get transactions' }, { status: 500 });
  }
}
