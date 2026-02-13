import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { cashGameRepo } from '@/lib/db/repositories';
import { createCashGame } from '@/lib/game/cash-game-service';

/**
 * GET /api/cash-games
 * List open/running cash games
 */
export async function GET() {
  try {
    const games = await cashGameRepo.getOpenCashGames();

    const summaries = await Promise.all(
      games.map(async (g) => {
        const details = await cashGameRepo.getCashGameWithPlayerCount(g.id);
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
        };
      })
    );

    return NextResponse.json({ cashGames: summaries });
  } catch (error) {
    console.error('Error listing cash games:', error);
    return NextResponse.json(
      { error: 'Failed to list cash games' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cash-games
 * Create a new cash game
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
      turnTimerSeconds = 30,
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

    const { game } = await createCashGame({
      name: name.trim(),
      creatorId: authPlayer.playerId,
      maxPlayers,
      tableSize,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      turnTimerSeconds,
    });

    return NextResponse.json({
      cashGame: {
        id: game.id,
        name: game.name,
        status: game.status,
        maxPlayers: game.maxPlayers,
        playerCount: 0,
        smallBlind: game.smallBlind,
        bigBlind: game.bigBlind,
        minBuyIn: game.minBuyIn,
        maxBuyIn: game.maxBuyIn,
      },
    });
  } catch (error) {
    console.error('Error creating cash game:', error);
    return NextResponse.json(
      { error: 'Failed to create cash game' },
      { status: 500 }
    );
  }
}
