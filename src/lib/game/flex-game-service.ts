/**
 * Flex Game Service
 *
 * Manages async flex game lifecycle: create, join, rebuy, leave, close.
 */

import { getDb } from '@/lib/db';
import { flexGameRepo, tableRepo, chipTxRepo } from '@/lib/db/repositories';
import { tablePlayers, tables, hands } from '@/lib/db/schema';
import { generateId, now } from '@/lib/db/transaction';
import { getPusher, channels, flexGameEvents } from '@/lib/pusher-server';
import { eq, and, ne } from 'drizzle-orm';

// =============================================================================
// Create Flex Game
// =============================================================================

export async function createFlexGame(params: {
  name: string;
  creatorId: string;
  maxPlayers: number;
  tableSize: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  turnTimerHours: number;
  expiresAfterDays?: number;
}) {
  const {
    name, creatorId, maxPlayers, tableSize,
    smallBlind, bigBlind, minBuyIn, maxBuyIn,
    turnTimerHours, expiresAfterDays = 14,
  } = params;

  const turnTimerSeconds = turnTimerHours * 3600;

  const game = await flexGameRepo.createFlexGame({
    name,
    creatorId,
    maxPlayers,
    tableSize,
    smallBlind,
    bigBlind,
    minBuyIn,
    maxBuyIn,
    turnTimerHours,
    turnTimerSeconds,
    expiresAfterDays,
    status: 'open',
    closedAt: null,
  });

  const table = await tableRepo.createTable({
    tournamentId: null,
    cashGameId: null,
    flexGameId: game.id,
    tableNumber: 1,
    maxSeats: tableSize,
    dealerSeat: 0,
    smallBlind,
    bigBlind,
    ante: 0,
    status: 'waiting',
  });

  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.flexGames, flexGameEvents.FLEX_GAME_CREATED, {
      id: game.id,
      name: game.name,
      status: game.status,
      maxPlayers: game.maxPlayers,
      playerCount: 0,
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      minBuyIn: game.minBuyIn,
      maxBuyIn: game.maxBuyIn,
      turnTimerHours: game.turnTimerHours,
    }).catch((err) => console.error('[createFlexGame] Pusher error:', err));
  }

  return { game, table };
}

// =============================================================================
// Join Flex Game
// =============================================================================

export async function joinFlexGame(
  flexGameId: string,
  playerId: string,
  buyInAmount: number
) {
  const game = await flexGameRepo.getFlexGame(flexGameId);
  if (!game) throw new Error('Flex game not found');
  if (game.status === 'closed' || game.status === 'expired') throw new Error('Flex game is closed');

  if (buyInAmount < game.minBuyIn || buyInAmount > game.maxBuyIn) {
    throw new Error(`Buy-in must be between ${game.minBuyIn} and ${game.maxBuyIn}`);
  }

  const table = await flexGameRepo.getFlexGameTable(flexGameId);
  if (!table) throw new Error('Flex game table not found');

  const existing = await tableRepo.getPlayerAtTable(table.id, playerId);
  if (existing) throw new Error('Already seated at this table');

  const db = getDb();
  const seated = await db
    .select()
    .from(tablePlayers)
    .where(eq(tablePlayers.tableId, table.id));
  const activeSeatCount = seated.filter((p) => p.status !== 'eliminated').length;
  if (activeSeatCount >= game.maxPlayers) throw new Error('Table is full');

  const occupiedSeats = new Set(seated.map((p) => p.seatIndex));
  let seatIndex = -1;
  for (let i = 0; i < game.tableSize; i++) {
    if (!occupiedSeats.has(i)) {
      seatIndex = i;
      break;
    }
  }
  if (seatIndex === -1) throw new Error('No open seats');

  await chipTxRepo.recordTransaction({
    playerId,
    type: 'flex_buy_in',
    amount: -buyInAmount,
    flexGameId,
    description: `Buy-in for ${game.name}`,
  });

  await tableRepo.seatPlayer({
    tableId: table.id,
    playerId,
    seatIndex,
    stack: buyInAmount,
    status: 'waiting',
    currentBet: 0,
    holeCard1: null,
    holeCard2: null,
    eliminatedAt: null,
  });

  if (activeSeatCount + 1 >= 2 && game.status === 'open') {
    await flexGameRepo.updateFlexGameStatus(flexGameId, 'running');
  }

  await flexGameRepo.touchActivity(flexGameId);

  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.flexGame(flexGameId), flexGameEvents.PLAYER_JOINED, {
      playerId,
      seatIndex,
      stack: buyInAmount,
    }).catch((err) => console.error('[joinFlexGame] Pusher error:', err));
  }

  return { seatIndex, tableId: table.id };
}

// =============================================================================
// Rebuy
// =============================================================================

export async function rebuyFlex(
  flexGameId: string,
  playerId: string,
  amount: number
) {
  const game = await flexGameRepo.getFlexGame(flexGameId);
  if (!game) throw new Error('Flex game not found');
  if (game.status === 'closed' || game.status === 'expired') throw new Error('Flex game is closed');

  const table = await flexGameRepo.getFlexGameTable(flexGameId);
  if (!table) throw new Error('Flex game table not found');

  const tp = await tableRepo.getPlayerAtTable(table.id, playerId);
  if (!tp) throw new Error('Not seated at this table');

  const db = getDb();
  const [activeHand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, table.id), ne(hands.phase, 'complete')));

  if (activeHand && !['eliminated', 'sitting_out'].includes(tp.status) && tp.stack > 0) {
    throw new Error('Cannot rebuy during an active hand while you have chips');
  }

  if (tp.stack + amount > game.maxBuyIn) {
    throw new Error(`Rebuy would exceed max buy-in of ${game.maxBuyIn}`);
  }

  if (amount < 1) throw new Error('Rebuy amount must be positive');

  await chipTxRepo.recordTransaction({
    playerId,
    type: 'flex_rebuy',
    amount: -amount,
    flexGameId,
    description: `Rebuy at ${game.name}`,
  });

  await db
    .update(tablePlayers)
    .set({ stack: tp.stack + amount, status: 'waiting' })
    .where(and(eq(tablePlayers.tableId, table.id), eq(tablePlayers.playerId, playerId)));

  return { newStack: tp.stack + amount };
}

// =============================================================================
// Leave Flex Game
// =============================================================================

export async function leaveFlexGame(
  flexGameId: string,
  playerId: string
) {
  const game = await flexGameRepo.getFlexGame(flexGameId);
  if (!game) throw new Error('Flex game not found');

  const table = await flexGameRepo.getFlexGameTable(flexGameId);
  if (!table) throw new Error('Flex game table not found');

  const tp = await tableRepo.getPlayerAtTable(table.id, playerId);
  if (!tp) throw new Error('Not seated at this table');

  const db = getDb();
  const [activeHand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, table.id), ne(hands.phase, 'complete')));

  if (activeHand && !['folded', 'eliminated', 'sitting_out'].includes(tp.status)) {
    throw new Error('Cannot leave during an active hand');
  }

  if (tp.stack > 0) {
    await chipTxRepo.recordTransaction({
      playerId,
      type: 'flex_cash_out',
      amount: tp.stack,
      flexGameId,
      description: `Cash out from ${game.name}`,
    });
  }

  await db
    .delete(tablePlayers)
    .where(and(eq(tablePlayers.tableId, table.id), eq(tablePlayers.playerId, playerId)));

  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.flexGame(flexGameId), flexGameEvents.PLAYER_LEFT, {
      playerId,
    }).catch((err) => console.error('[leaveFlexGame] Pusher error:', err));
  }

  return { cashedOut: tp.stack };
}

// =============================================================================
// Close Flex Game (host only)
// =============================================================================

export async function closeFlexGame(
  flexGameId: string,
  hostPlayerId: string
) {
  const game = await flexGameRepo.getFlexGame(flexGameId);
  if (!game) throw new Error('Flex game not found');
  if (game.creatorId !== hostPlayerId) throw new Error('Only the host can close the game');
  if (game.status === 'closed') throw new Error('Game is already closed');

  const table = await flexGameRepo.getFlexGameTable(flexGameId);
  if (!table) throw new Error('Flex game table not found');

  const db = getDb();

  const seated = await db
    .select({
      tablePlayer: tablePlayers,
    })
    .from(tablePlayers)
    .where(eq(tablePlayers.tableId, table.id));

  for (const { tablePlayer } of seated) {
    if (tablePlayer.stack > 0) {
      await chipTxRepo.recordTransaction({
        playerId: tablePlayer.playerId,
        type: 'flex_cash_out',
        amount: tablePlayer.stack,
        flexGameId,
        description: `Auto cash-out: ${game.name} closed`,
      });
    }
  }

  await db.delete(tablePlayers).where(eq(tablePlayers.tableId, table.id));

  await flexGameRepo.closeFlexGame(flexGameId);
  await db.update(tables).set({ status: 'complete' }).where(eq(tables.id, table.id));

  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.flexGame(flexGameId), flexGameEvents.FLEX_GAME_CLOSED, {
      flexGameId,
    }).catch((err) => console.error('[closeFlexGame] Pusher error:', err));
  }

  return { closed: true };
}
