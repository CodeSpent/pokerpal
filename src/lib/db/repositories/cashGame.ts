/**
 * Cash Game Repository
 *
 * Database operations for cash game management.
 */

import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../index';
import { cashGames, tables, tablePlayers, players, type CashGame, type NewCashGame } from '../schema';
import { generateId, now } from '../transaction';

/**
 * Get a cash game by ID
 */
export async function getCashGame(id: string): Promise<CashGame | null> {
  const db = getDb();
  const [game] = await db.select().from(cashGames).where(eq(cashGames.id, id));
  return game ?? null;
}

/**
 * Get open cash games (status = 'open' or 'running')
 */
export async function getOpenCashGames(): Promise<CashGame[]> {
  const db = getDb();
  return db.select().from(cashGames).where(inArray(cashGames.status, ['open', 'running']));
}

/**
 * Create a new cash game
 */
export async function createCashGame(
  data: Omit<NewCashGame, 'id' | 'version' | 'createdAt'>
): Promise<CashGame> {
  const db = getDb();
  const newGame: NewCashGame = {
    id: generateId(),
    version: 1,
    createdAt: now(),
    ...data,
  };

  await db.insert(cashGames).values(newGame);
  return newGame as CashGame;
}

/**
 * Update cash game status
 */
export async function updateCashGameStatus(
  id: string,
  status: string
): Promise<void> {
  const db = getDb();
  await db.update(cashGames).set({ status }).where(eq(cashGames.id, id));
}

/**
 * Close a cash game
 */
export async function closeCashGame(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(cashGames)
    .set({ status: 'closed', closedAt: now() })
    .where(eq(cashGames.id, id));
}

/**
 * Get the table associated with a cash game
 */
export async function getCashGameTable(cashGameId: string) {
  const db = getDb();
  const [table] = await db
    .select()
    .from(tables)
    .where(eq(tables.cashGameId, cashGameId));
  return table ?? null;
}

/**
 * Get cash game with player count
 */
export async function getCashGameWithPlayerCount(cashGameId: string) {
  const game = await getCashGame(cashGameId);
  if (!game) return null;

  const table = await getCashGameTable(cashGameId);
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
 * Get cash game details with seated players
 */
export async function getCashGameWithPlayers(cashGameId: string) {
  const game = await getCashGame(cashGameId);
  if (!game) return null;

  const table = await getCashGameTable(cashGameId);
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
