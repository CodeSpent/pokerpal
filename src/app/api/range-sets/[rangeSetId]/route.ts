import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { rangeSetRepo } from '@/lib/db/repositories';

interface RouteContext {
  params: Promise<{ rangeSetId: string }>;
}

/**
 * GET /api/range-sets/[rangeSetId]
 * Get a single range set (must own it)
 */
export async function GET(_request: Request, { params }: RouteContext) {
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

    return NextResponse.json({
      rangeSet: {
        ...rangeSet,
        positions: JSON.parse(rangeSet.positions),
      },
    });
  } catch (error) {
    console.error('Error getting range set:', error);
    return NextResponse.json({ error: 'Failed to get range set' }, { status: 500 });
  }
}

/**
 * PUT /api/range-sets/[rangeSetId]
 * Update a range set (must own it)
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
    const updates: { name?: string; description?: string; positions?: Record<string, { hands: string[] }> } = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.positions !== undefined) updates.positions = body.positions;

    await rangeSetRepo.updateRangeSet(rangeSetId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating range set:', error);
    return NextResponse.json({ error: 'Failed to update range set' }, { status: 500 });
  }
}

/**
 * DELETE /api/range-sets/[rangeSetId]
 * Delete a range set (must own it, cannot delete defaults)
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
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

    if (rangeSet.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default range set' }, { status: 400 });
    }

    await rangeSetRepo.deleteRangeSet(rangeSetId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting range set:', error);
    return NextResponse.json({ error: 'Failed to delete range set' }, { status: 500 });
  }
}
