import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { rangeSetRepo } from '@/lib/db/repositories';

interface RouteContext {
  params: Promise<{ rangeSetId: string }>;
}

/**
 * POST /api/range-sets/[rangeSetId]/adopt
 * Copy a shared range set into the authenticated player's collection
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { rangeSetId } = await params;

    const adopted = await rangeSetRepo.adoptRangeSet(rangeSetId, authPlayer.playerId);

    return NextResponse.json({
      rangeSet: {
        ...adopted,
        positions: JSON.parse(adopted.positions),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to adopt range set';
    console.error('Error adopting range set:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
