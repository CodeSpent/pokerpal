import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { tournamentRepo, eventRepo } from '@/lib/db/repositories';
import { getPusher, channels, tournamentEvents } from '@/lib/pusher-server';

/**
 * GET /api/tournaments
 * List open tournaments
 */
export async function GET() {
  try {
    const tournaments = await tournamentRepo.getOpenTournaments();

    const summaries = await Promise.all(
      tournaments.map(async (t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        registeredCount: await tournamentRepo.getRegistrationCount(t.id),
        maxPlayers: t.maxPlayers,
        buyIn: 100,
        startingChips: t.startingChips,
        createdAt: t.createdAt,
        isPasswordProtected: false,
      }))
    );

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
    const authPlayer = await getAuthenticatedPlayer();

    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { playerId } = authPlayer;

    const body = await request.json();
    const {
      name,
      maxPlayers = 6,
      tableSize = 6,
      startingChips = 3000,
      turnTimerSeconds = 30,
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

    // Create tournament
    const tournament = await tournamentRepo.createTournament({
      name: name.trim(),
      creatorId: playerId,
      maxPlayers,
      tableSize,
      startingChips,
      blindStructure: 'standard',
      blindLevelMinutes: 10,
      turnTimerSeconds,
      status: 'registering',
      currentLevel: 1,
      levelStartedAt: null,
      playersRemaining: 0,
      prizePool: 0,
      startedAt: null,
      endedAt: null,
    });

    // Auto-register creator
    await tournamentRepo.registerPlayer(tournament.id, playerId);

    // Emit event
    await eventRepo.emitEvent('tournament', tournament.id, 'TOURNAMENT_CREATED', {
      tournamentId: tournament.id,
      creatorId: playerId,
    }, 1);

    // Broadcast via Pusher to lobby
    const pusher = getPusher();
    if (pusher) {
      await pusher.trigger(channels.tournaments, tournamentEvents.TOURNAMENT_CREATED, {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        registeredCount: 1,
        maxPlayers: tournament.maxPlayers,
        startingChips: tournament.startingChips,
        createdAt: tournament.createdAt,
        isPasswordProtected: false,
      }).catch(err => console.error('Failed to broadcast TOURNAMENT_CREATED:', err));
    }

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        registeredCount: 1,
        maxPlayers: tournament.maxPlayers,
        startingChips: tournament.startingChips,
        createdAt: tournament.createdAt,
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
