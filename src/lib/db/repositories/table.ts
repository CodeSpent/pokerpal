/**
 * Table Repository
 *
 * Database operations for poker tables and seats.
 */

import { eq, and, sql, ne } from 'drizzle-orm';
import { getDb } from '../index';
import {
  tables,
  tablePlayers,
  players,
  type Table,
  type NewTable,
  type TablePlayer,
  type NewTablePlayer,
} from '../schema';
import { generateId, now } from '../transaction';

// =============================================================================
// Table CRUD
// =============================================================================

/**
 * Get a table by ID
 */
export async function getTable(id: string): Promise<Table | null> {
  const db = getDb();
  const [table] = await db.select().from(tables).where(eq(tables.id, id));
  return table ?? null;
}

/**
 * Get tables for a tournament
 */
export async function getTournamentTables(tournamentId: string): Promise<Table[]> {
  const db = getDb();
  return db.select().from(tables).where(eq(tables.tournamentId, tournamentId));
}

/**
 * Create a new table
 */
export async function createTable(
  data: Omit<NewTable, 'id' | 'version' | 'createdAt'>
): Promise<Table> {
  const db = getDb();
  const newTable: NewTable = {
    id: generateId(),
    version: 1,
    createdAt: now(),
    ...data,
  };

  await db.insert(tables).values(newTable);
  return newTable as Table;
}

/**
 * Update table fields
 */
export async function updateTable(
  id: string,
  fields: Partial<Omit<Table, 'id' | 'version'>>
): Promise<void> {
  const db = getDb();
  await db
    .update(tables)
    .set({
      ...fields,
      version: sql`${tables.version} + 1`,
    })
    .where(eq(tables.id, id));
}

/**
 * Update table status
 */
export async function updateTableStatus(id: string, status: string): Promise<void> {
  await updateTable(id, { status });
}

/**
 * Update dealer position
 */
export async function updateDealerSeat(id: string, dealerSeat: number): Promise<void> {
  await updateTable(id, { dealerSeat });
}

/**
 * Update blind levels
 */
export async function updateBlinds(
  id: string,
  smallBlind: number,
  bigBlind: number,
  ante?: number
): Promise<void> {
  await updateTable(id, { smallBlind, bigBlind, ante: ante ?? 0 });
}

// =============================================================================
// Table with Players
// =============================================================================

/**
 * Get table with all seated players
 */
export async function getTableWithPlayers(
  tableId: string
): Promise<{ table: Table | null; players: Array<TablePlayer & { name: string; avatar: string | null }> }> {
  const db = getDb();

  const [table] = await db.select().from(tables).where(eq(tables.id, tableId));

  if (!table) {
    return { table: null, players: [] };
  }

  const seatedPlayers = await db
    .select({
      tablePlayer: tablePlayers,
      name: players.name,
      avatar: players.avatar,
    })
    .from(tablePlayers)
    .innerJoin(players, eq(tablePlayers.playerId, players.id))
    .where(eq(tablePlayers.tableId, tableId))
    .orderBy(tablePlayers.seatIndex);

  return {
    table,
    players: seatedPlayers.map((sp) => ({
      ...sp.tablePlayer,
      name: sp.name,
      avatar: sp.avatar,
    })),
  };
}

// =============================================================================
// Table Players (Seats)
// =============================================================================

/**
 * Get a player at a specific table
 */
export async function getPlayerAtTable(
  tableId: string,
  playerId: string
): Promise<(TablePlayer & { name: string; avatar: string | null }) | null> {
  const db = getDb();
  const [result] = await db
    .select({
      tablePlayer: tablePlayers,
      name: players.name,
      avatar: players.avatar,
    })
    .from(tablePlayers)
    .innerJoin(players, eq(tablePlayers.playerId, players.id))
    .where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.playerId, playerId))
    );

  if (!result) return null;

  return {
    ...result.tablePlayer,
    name: result.name,
    avatar: result.avatar,
  };
}

/**
 * Get all players at a table
 */
export async function getPlayersAtTable(tableId: string): Promise<TablePlayer[]> {
  const db = getDb();
  return db
    .select()
    .from(tablePlayers)
    .where(eq(tablePlayers.tableId, tableId))
    .orderBy(tablePlayers.seatIndex);
}

/**
 * Seat a player at a table
 */
export async function seatPlayer(
  data: Omit<NewTablePlayer, 'id'>
): Promise<TablePlayer> {
  const db = getDb();
  const newSeat: NewTablePlayer = {
    id: generateId(),
    ...data,
  };

  await db.insert(tablePlayers).values(newSeat);
  return newSeat as TablePlayer;
}

/**
 * Update a player's stack
 */
export async function updatePlayerStack(
  tableId: string,
  playerId: string,
  stack: number
): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set({ stack })
    .where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.playerId, playerId))
    );
}

/**
 * Update a player's status
 */
export async function updatePlayerStatus(
  tableId: string,
  playerId: string,
  status: string
): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set({ status })
    .where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.playerId, playerId))
    );
}

/**
 * Update a player's current bet
 */
export async function updatePlayerBet(
  tableId: string,
  playerId: string,
  currentBet: number
): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set({ currentBet })
    .where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.playerId, playerId))
    );
}

/**
 * Update a player's hole cards
 */
export async function updatePlayerHoleCards(
  tableId: string,
  playerId: string,
  holeCard1: string | null,
  holeCard2: string | null
): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set({ holeCard1, holeCard2 })
    .where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.playerId, playerId))
    );
}

/**
 * Update player by seat index
 */
export async function updatePlayerBySeat(
  tableId: string,
  seatIndex: number,
  fields: Partial<Omit<TablePlayer, 'id' | 'tableId' | 'playerId' | 'seatIndex'>>
): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set(fields)
    .where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, seatIndex))
    );
}

/**
 * Reset all player bets for new betting round
 */
export async function resetAllPlayerBets(tableId: string): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set({ currentBet: 0 })
    .where(eq(tablePlayers.tableId, tableId));
}

/**
 * Reset player statuses for new hand
 */
export async function resetPlayerStatusesForNewHand(tableId: string): Promise<void> {
  const db = getDb();
  await db
    .update(tablePlayers)
    .set({ status: 'waiting', currentBet: 0, holeCard1: null, holeCard2: null })
    .where(
      and(
        eq(tablePlayers.tableId, tableId),
        ne(tablePlayers.status, 'eliminated'),
        ne(tablePlayers.status, 'sitting_out')
      )
    );
}

/**
 * Get player by seat index
 */
export async function getPlayerBySeat(
  tableId: string,
  seatIndex: number
): Promise<TablePlayer | null> {
  const db = getDb();
  const [player] = await db
    .select()
    .from(tablePlayers)
    .where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.seatIndex, seatIndex))
    );
  return player ?? null;
}

/**
 * Count active players at table
 */
export async function countActivePlayers(tableId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(tablePlayers)
    .where(
      and(
        eq(tablePlayers.tableId, tableId),
        ne(tablePlayers.status, 'eliminated'),
        ne(tablePlayers.status, 'sitting_out')
      )
    );
  return Number(result[0]?.count ?? 0);
}
