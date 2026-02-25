import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { getDb } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint' },
        { status: 400 }
      );
    }

    const db = getDb();
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.playerId, authPlayer.playerId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push Unsubscribe]', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
