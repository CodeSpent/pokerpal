/**
 * Flex Game Repository
 *
 * Database operations for async flex game management.
 */

import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../index';
import { flexGames, tables, tablePlayers, players, type FlexGame, type NewFlexGame } from '../schema';
import { generateId, now } from '../transaction';

/**
 * Get a flex game by ID
 */
export async function getFlexGame(id: string): Promise<FlexGame | null> {
  const db = getDb();
  const [game] = await db.select().from(flexGames).where(eq(flexGames.id, id));
  return game ?? null;
}

/**
 * Get open flex games (status = 'open' or 'running')
 */
export async function getOpenFlexGames(): Promise<FlexGame[]> {
  const db = getDb();
  return db.select().from(flexGames).where(inArray(flexGames.status, ['open', 'running']));
}

/**
 * Create a new flex game
 */
export async function createFlexGame(
  data: Omit<NewFlexGame, 'id' | 'version' | 'createdAt' | 'lastActivityAt'>
): Promise<FlexGame> {
  const db = getDb();
  const timestamp = now();
  const newGame: NewFlexGame = {
    id: generateId(),
    version: 1,
    createdAt: timestamp,
    lastActivityAt: timestamp,
    ...data,
  };

  await db.insert(flexGames).values(newGame);
  return newGame as FlexGame;
}

/**
 * Update flex game status
 */
export async function updateFlexGameStatus(
  id: string,
  status: string
): Promise<void> {
  const db = getDb();
  await db.update(flexGames).set({ status }).where(eq(flexGames.id, id));
}

/**
 * Close a flex game
 */
export async function closeFlexGame(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(flexGames)
    .set({ status: 'closed', closedAt: now() })
    .where(eq(flexGames.id, id));
}

/**
 * Get the table associated with a flex game
 */
export async function getFlexGameTable(flexGameId: string) {
  const db = getDb();
  const [table] = await db
    .select()
    .from(tables)
    .where(eq(tables.flexGameId, flexGameId));
  return table ?? null;
}

/**
 * Get flex game with player count
 */
export async function getFlexGameWithPlayerCount(flexGameId: string) {
  const game = await getFlexGame(flexGameId);
  if (!game) return null;

  const table = await getFlexGameTable(flexGameId);
  if (!table) return { ...game, playerCount: 0, tableId: null as string | null };

  const db = getDb();
  const seated = await db
    .select()
    .from(tablePlayers)
    .where(eq(tablePlayers.tableId, table.id));

  const activePlayers = seated.filter((p) => p.status !== 'eliminated');

  return {
    ...game,
    playerCount: activePlayers.length,
    tableId: table.id,
  };
}

/**
 * Get flex game details with seated players
 */
export async function getFlexGameWithPlayers(flexGameId: string) {
  const game = await getFlexGame(flexGameId);
  if (!game) return null;

  const table = await getFlexGameTable(flexGameId);
  if (!table) return { game, table: null, players: [] };

  const db = getDb();
  const seated = await db
    .select({
      tablePlayer: tablePlayers,
      name: players.name,
      avatar: players.avatar,
    })
    .from(tablePlayers)
    .innerJoin(players, eq(tablePlayers.playerId, players.id))
    .where(eq(tablePlayers.tableId, table.id));

  return {
    game,
    table,
    players: seated.map((s) => ({
      ...s.tablePlayer,
      name: s.name,
      avatar: s.avatar,
    })),
  };
}

/**
 * Update lastActivityAt timestamp
 */
export async function touchActivity(flexGameId: string): Promise<void> {
  const db = getDb();
  await db
    .update(flexGames)
    .set({ lastActivityAt: now() })
    .where(eq(flexGames.id, flexGameId));
}
