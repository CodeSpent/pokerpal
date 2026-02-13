import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { playerRepo } from '@/lib/db/repositories';
import {
  validateUsername,
  validateCountry,
  validateState,
} from '@/lib/validation/profile';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username, country, state } = body;

    // Validate all fields
    const errors: Record<string, string> = {};
    const usernameErr = validateUsername(username);
    if (usernameErr) errors.username = usernameErr;
    const countryErr = validateCountry(country);
    if (countryErr) errors.country = countryErr;
    const stateErr = validateState(state ?? '', country);
    if (stateErr) errors.state = stateErr;

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    // Check if user already has a player record
    const existing = await playerRepo.getPlayerByUserId(session.user.id);
    if (existing) {
      return NextResponse.json(
        { error: 'Player profile already exists' },
        { status: 409 }
      );
    }

    // Check username availability
    const taken = await playerRepo.getPlayerByName(username);
    if (taken) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 409 }
      );
    }

    try {
      const player = await playerRepo.createPlayerForUser(session.user.id, {
        username,
        country,
        state,
      });

      return NextResponse.json({
        playerId: player.id,
        displayName: player.name,
      });
    } catch (dbError: unknown) {
      // Handle unique constraint violation (race condition)
      if (
        dbError instanceof Error &&
        'code' in dbError &&
        (dbError as { code: string }).code === '23505'
      ) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Setup profile error:', error);
    return NextResponse.json(
      { error: 'Failed to set up profile' },
      { status: 500 }
    );
  }
}
