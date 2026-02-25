import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { flexGameRepo } from '@/lib/db/repositories';
import { createFlexGame } from '@/lib/game/flex-game-service';

/**
 * GET /api/flex-games
 * List open/running flex games (with lazy expiration)
 */
export async function GET() {
  try {
    const games = await flexGameRepo.getOpenFlexGames();

    // Lazy expiration: close expired games
    const now = Date.now();
    const activeGames = [];
    for (const g of games) {
      const expiresAt = g.lastActivityAt + g.expiresAfterDays * 24 * 60 * 60 * 1000;
      if (now > expiresAt) {
        await flexGameRepo.updateFlexGameStatus(g.id, 'expired');
        continue;
      }
      activeGames.push(g);
    }

    const summaries = await Promise.all(
      activeGames.map(async (g) => {
        const details = await flexGameRepo.getFlexGameWithPlayerCount(g.id);
        return {
          id: g.id,
          name: g.name,
          status: g.status,
          maxPlayers: g.maxPlayers,
          playerCount: details?.playerCount ?? 0,
          smallBlind: g.smallBlind,
          bigBlind: g.bigBlind,
          minBuyIn: g.minBuyIn,
          maxBuyIn: g.maxBuyIn,
          turnTimerHours: g.turnTimerHours,
        };
      })
    );

    return NextResponse.json({ flexGames: summaries });
  } catch (error) {
    console.error('Error listing flex games:', error);
    return NextResponse.json(
      { error: 'Failed to list flex games' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flex-games
 * Create a new flex game
 */
export async function POST(request: Request) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      maxPlayers = 6,
      tableSize = 6,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      turnTimerHours = 24,
      expiresAfterDays = 14,
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Game name is required' }, { status: 400 });
    }

    if (!smallBlind || !bigBlind || smallBlind <= 0 || bigBlind <= 0) {
      return NextResponse.json({ error: 'Valid blinds are required' }, { status: 400 });
    }

    if (!minBuyIn || !maxBuyIn || minBuyIn <= 0 || maxBuyIn < minBuyIn) {
      return NextResponse.json({ error: 'Valid buy-in range is required' }, { status: 400 });
    }

    if (maxPlayers < 2 || maxPlayers > 6) {
      return NextResponse.json({ error: 'Max players must be between 2 and 6' }, { status: 400 });
    }

    if (![12, 24, 48].includes(turnTimerHours)) {
      return NextResponse.json({ error: 'Turn timer must be 12, 24, or 48 hours' }, { status: 400 });
    }

    const { game } = await createFlexGame({
      name: name.trim(),
      creatorId: authPlayer.playerId,
      maxPlayers,
      tableSize,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      turnTimerHours,
      expiresAfterDays,
    });

    return NextResponse.json({
      flexGame: {
        id: game.id,
        name: game.name,
        status: game.status,
        maxPlayers: game.maxPlayers,
        playerCount: 0,
        smallBlind: game.smallBlind,
        bigBlind: game.bigBlind,
        minBuyIn: game.minBuyIn,
        maxBuyIn: game.maxBuyIn,
        turnTimerHours: game.turnTimerHours,
      },
    });
  } catch (error) {
    console.error('Error creating flex game:', error);
    return NextResponse.json(
      { error: 'Failed to create flex game' },
      { status: 500 }
    );
  }
}
