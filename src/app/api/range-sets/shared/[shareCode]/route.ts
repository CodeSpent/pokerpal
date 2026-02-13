import { NextResponse } from 'next/server';
import { rangeSetRepo } from '@/lib/db/repositories';

interface RouteContext {
  params: Promise<{ shareCode: string }>;
}

/**
 * GET /api/range-sets/shared/[shareCode]
 * Public endpoint — no auth required. Returns shared range set data + creator name.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { shareCode } = await params;
    const result = await rangeSetRepo.getRangeSetByShareCode(shareCode);

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { creatorName, ...rangeSet } = result;

    return NextResponse.json({
      rangeSet: {
        ...rangeSet,
        positions: JSON.parse(rangeSet.positions),
      },
      creatorName,
    });
  } catch (error) {
    console.error('Error getting shared range set:', error);
    return NextResponse.json({ error: 'Failed to get shared range set' }, { status: 500 });
  }
}
