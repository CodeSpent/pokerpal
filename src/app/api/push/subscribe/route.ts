import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { getDb } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';

export async function POST(request: Request) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { endpoint, p256dh, auth } = await request.json();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Missing subscription fields' },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = crypto.randomUUID();

    await db
      .insert(pushSubscriptions)
      .values({
        id,
        playerId: authPlayer.playerId,
        endpoint,
        p256dh,
        auth,
        createdAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          playerId: authPlayer.playerId,
          p256dh,
          auth,
          createdAt: Date.now(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push Subscribe]', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}
