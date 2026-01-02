import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

/**
 * GET /api/player/me
 * Get the current player's ID from cookie
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

    // TODO: In production, fetch full player data from database
    // For MVP, just return the ID (client fetches rest from localStorage)

    return NextResponse.json({ playerId });
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

    // TODO: In production, update database
    // For MVP, just return success (client updates localStorage)

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
