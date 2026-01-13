import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { playerRepo } from '@/lib/db/repositories';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

/**
 * GET /api/player/me
 * Get the current player's data
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch player from database
    const player = await playerRepo.getPlayer(playerId);

    if (!player) {
      // Player ID exists in cookie but not in database
      return NextResponse.json({ playerId, player: null });
    }

    return NextResponse.json({
      playerId,
      player: {
        id: player.id,
        displayName: player.name,
        avatar: player.avatar,
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
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
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

    // Validate display name
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      return NextResponse.json(
        { error: 'Display name must be 2-20 characters' },
        { status: 400 }
      );
    }

    // Update player in database
    await playerRepo.updatePlayerName(playerId, trimmedName);

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
