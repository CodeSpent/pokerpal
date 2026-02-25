import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { getDb } from '@/lib/db';
import { flexGames, tables, tablePlayers, hands } from '@/lib/db/schema';
import { eq, and, ne, inArray } from 'drizzle-orm';

/**
 * GET /api/flex-games/my-turns
 * Get flex games where it's the current player's turn
 */
export async function GET() {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = getDb();

    // Find all tables where this player is seated in a flex game
    const playerTables = await db
      .select({
        tableId: tablePlayers.tableId,
        seatIndex: tablePlayers.seatIndex,
        flexGameId: tables.flexGameId,
      })
      .from(tablePlayers)
      .innerJoin(tables, eq(tablePlayers.tableId, tables.id))
      .where(
        and(
          eq(tablePlayers.playerId, authPlayer.playerId),
          ne(tablePlayers.status, 'eliminated')
        )
      );

    const flexTables = playerTables.filter((t) => t.flexGameId !== null);

    const myTurnGameIds: string[] = [];

    for (const ft of flexTables) {
      // Check if there's an active hand where it's this player's turn
      const [activeHand] = await db
        .select()
        .from(hands)
        .where(
          and(
            eq(hands.tableId, ft.tableId),
            ne(hands.phase, 'complete'),
            eq(hands.currentActorSeat, ft.seatIndex)
          )
        );

      if (activeHand && ft.flexGameId) {
        myTurnGameIds.push(ft.flexGameId);
      }
    }

    return NextResponse.json({ myTurnGameIds });
  } catch (error) {
    console.error('Error fetching my turns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch turns' },
      { status: 500 }
    );
  }
}
