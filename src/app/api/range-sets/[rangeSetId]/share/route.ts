import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { rangeSetRepo } from '@/lib/db/repositories';

interface RouteContext {
  params: Promise<{ rangeSetId: string }>;
}

/**
 * PUT /api/range-sets/[rangeSetId]/share
 * Toggle sharing on/off
 */
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { rangeSetId } = await params;
    const rangeSet = await rangeSetRepo.getRangeSet(rangeSetId);

    if (!rangeSet || rangeSet.playerId !== authPlayer.playerId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body.isShared !== 'boolean') {
      return NextResponse.json({ error: 'isShared must be a boolean' }, { status: 400 });
    }

    const { shareCode } = await rangeSetRepo.setShared(rangeSetId, body.isShared);

    return NextResponse.json({ isShared: body.isShared, shareCode });
  } catch (error) {
    console.error('Error toggling share:', error);
    return NextResponse.json({ error: 'Failed to toggle sharing' }, { status: 500 });
  }
}
