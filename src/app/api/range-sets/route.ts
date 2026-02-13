import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { rangeSetRepo } from '@/lib/db/repositories';

/**
 * GET /api/range-sets
 * List authenticated player's range sets. Auto-seeds if none exist.
 */
export async function GET() {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { playerId } = authPlayer;

    // Auto-seed on first visit
    const hasAny = await rangeSetRepo.hasRangeSets(playerId);
    if (!hasAny) {
      await rangeSetRepo.seedDefaultRangeSets(playerId);
    }

    const rangeSets = await rangeSetRepo.getRangeSetsByPlayer(playerId);

    return NextResponse.json({
      rangeSets: rangeSets.map((rs) => ({
        ...rs,
        positions: JSON.parse(rs.positions),
      })),
    });
  } catch (error) {
    console.error('Error listing range sets:', error);
    return NextResponse.json({ error: 'Failed to list range sets' }, { status: 500 });
  }
}

/**
 * POST /api/range-sets
 * Create a new range set
 */
export async function POST(request: Request) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, positions } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const rangeSet = await rangeSetRepo.createRangeSet({
      playerId: authPlayer.playerId,
      name: name.trim(),
      description: description || undefined,
      positions: positions || {},
    });

    return NextResponse.json({
      rangeSet: {
        ...rangeSet,
        positions: JSON.parse(rangeSet.positions),
      },
    });
  } catch (error) {
    console.error('Error creating range set:', error);
    return NextResponse.json({ error: 'Failed to create range set' }, { status: 500 });
  }
}
