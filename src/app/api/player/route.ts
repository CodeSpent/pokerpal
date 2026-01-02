import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { playerRepo } from '@/lib/db/repositories';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

/**
 * POST /api/player
 * Create a new player (or update existing)
 */
export async function POST(request: Request) {
  try {
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

    // Get player ID from cookie (set by middleware)
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID not found. Please refresh the page.' },
        { status: 401 }
      );
    }

    // Create or update player in database
    const playerData = await playerRepo.ensurePlayer(playerId, trimmedName);

    // Return player object matching the old format for compatibility
    const player = {
      id: playerData.id,
      displayName: playerData.name,
      chipBalance: 10000, // Default starting chips
      createdAt: playerData.createdAt,
    };

    return NextResponse.json({ player });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json(
      { error: 'Failed to create player' },
      { status: 500 }
    );
  }
}
