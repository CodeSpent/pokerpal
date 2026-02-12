import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';

/**
 * POST /api/player
 * Get or confirm the current authenticated player
 */
export async function POST() {
  try {
    const authPlayer = await getAuthenticatedPlayer();

    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      player: {
        id: authPlayer.playerId,
        displayName: authPlayer.displayName,
        chipBalance: 10000,
        createdAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('Error getting player:', error);
    return NextResponse.json(
      { error: 'Failed to get player' },
      { status: 500 }
    );
  }
}
