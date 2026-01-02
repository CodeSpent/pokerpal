import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getOpenTournaments,
  createTournament,
  ensurePlayer,
  getRegistrationCount,
  getDatabase,
} from '@/lib/poker-engine-v2';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

/**
 * GET /api/tournaments
 * List open tournaments
 */
export async function GET() {
  try {
    const tournaments = getOpenTournaments();

    const summaries = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      registeredCount: getRegistrationCount(t.id),
      maxPlayers: t.max_players,
      buyIn: 100, // Placeholder
      startingChips: t.starting_chips,
      createdAt: t.created_at,
      isPasswordProtected: false, // TODO: Add password support
    }));

    return NextResponse.json({ tournaments: summaries });
  } catch (error) {
    console.error('Error listing tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to list tournaments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments
 * Create a new tournament
 */
export async function POST(request: Request) {
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
    const {
      name,
      maxPlayers = 6,
      tableSize = 6,
      startingChips = 3000,
      turnTimerSeconds = 30,
      displayName,
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Tournament name is required' },
        { status: 400 }
      );
    }

    // Validate max players (2-6 for 6-max, 2-9 for 9-max)
    const maxAllowed = tableSize === 9 ? 9 : 6;
    if (typeof maxPlayers !== 'number' || maxPlayers < 2 || maxPlayers > maxAllowed) {
      return NextResponse.json(
        { error: `Max players must be between 2 and ${maxAllowed}` },
        { status: 400 }
      );
    }

    // Validate table size
    if (tableSize !== 6 && tableSize !== 9) {
      return NextResponse.json(
        { error: 'Table size must be 6 or 9' },
        { status: 400 }
      );
    }

    // Validate turn timer (30, 60, 120, or null for unlimited)
    const validTimers = [30, 60, 120, null];
    if (!validTimers.includes(turnTimerSeconds)) {
      return NextResponse.json(
        { error: 'Turn timer must be 30, 60, 120, or null (unlimited)' },
        { status: 400 }
      );
    }

    // Ensure creator player exists
    const playerName = displayName || 'Player';
    const playerResult = ensurePlayer(playerId, playerName);
    if (!playerResult.success) {
      return NextResponse.json(
        { error: 'Failed to create player' },
        { status: 500 }
      );
    }

    // Create tournament
    const result = createTournament({
      name: name.trim(),
      creatorId: playerId,
      maxPlayers,
      tableSize,
      startingChips,
      turnTimerSeconds,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create tournament' },
        { status: 500 }
      );
    }

    const tournament = result.data!.tournament;

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        registeredCount: 1, // Creator is auto-registered
        maxPlayers: tournament.max_players,
        startingChips: tournament.starting_chips,
        createdAt: tournament.created_at,
        isPasswordProtected: false,
      },
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
