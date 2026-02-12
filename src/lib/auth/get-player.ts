import { auth } from './config';
import { getDb } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthenticatedPlayer {
  userId: string;
  playerId: string;
  displayName: string;
}

/**
 * Get the authenticated player from the current session.
 *
 * Fast path: reads playerId/displayName from the JWT (no DB hit).
 * Slow path: falls back to DB lookup if JWT doesn't have playerId yet.
 *
 * Returns null if not authenticated or no player record exists.
 */
export async function getAuthenticatedPlayer(): Promise<AuthenticatedPlayer | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const userId = session.user.id;

  // Fast path: JWT already has player info
  if (session.user.playerId && session.user.displayName) {
    return {
      userId,
      playerId: session.user.playerId,
      displayName: session.user.displayName,
    };
  }

  // Slow path: look up player by userId
  const db = getDb();
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.userId, userId));

  if (!player) {
    return null;
  }

  return {
    userId,
    playerId: player.id,
    displayName: player.name,
  };
}
