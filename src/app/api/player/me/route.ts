import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { playerRepo } from '@/lib/db/repositories';

/**
 * GET /api/player/me
 * Get the current player's data
 */
export async function GET() {
  try {
    const authPlayer = await getAuthenticatedPlayer();

    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const player = await playerRepo.getPlayer(authPlayer.playerId);

    if (!player) {
      return NextResponse.json({ playerId: authPlayer.playerId, player: null });
    }

    return NextResponse.json({
      playerId: authPlayer.playerId,
      player: {
        id: player.id,
        displayName: player.name,
        avatar: player.avatar,
        country: player.country,
        state: player.state,
        createdAt: player.createdAt,
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

/**
 * PUT /api/player/me
 * Update current player's display name
 */
export async function PUT(request: Request) {
  try {
    const authPlayer = await getAuthenticatedPlayer();

    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName } = body;

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      );
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      return NextResponse.json(
        { error: 'Display name must be 2-20 characters' },
        { status: 400 }
      );
    }

    await playerRepo.updatePlayerName(authPlayer.playerId, trimmedName);

    return NextResponse.json({
      success: true,
      displayName: trimmedName,
    });
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json(
      { error: 'Failed to update player' },
      { status: 500 }
    );
  }
}
