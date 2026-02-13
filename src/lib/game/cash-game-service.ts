/**
 * Cash Game Service
 *
 * Manages cash game lifecycle: create, join, rebuy, leave, close.
 */

import { getDb } from '@/lib/db';
import { cashGameRepo, tableRepo, chipTxRepo } from '@/lib/db/repositories';
import { tablePlayers, tables, hands } from '@/lib/db/schema';
import { generateId, now } from '@/lib/db/transaction';
import { getPusher, channels, cashGameEvents } from '@/lib/pusher-server';
import { eq, and, ne } from 'drizzle-orm';

// =============================================================================
// Create Cash Game
// =============================================================================

export async function createCashGame(params: {
  name: string;
  creatorId: string;
  maxPlayers: number;
  tableSize: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  turnTimerSeconds: number | null;
}) {
  const {
    name, creatorId, maxPlayers, tableSize,
    smallBlind, bigBlind, minBuyIn, maxBuyIn, turnTimerSeconds,
  } = params;

  // Create cash game record
  const game = await cashGameRepo.createCashGame({
    name,
    creatorId,
    maxPlayers,
    tableSize,
    smallBlind,
    bigBlind,
    minBuyIn,
    maxBuyIn,
    turnTimerSeconds,
    status: 'open',
    closedAt: null,
  });

  // Create table for the cash game (no tournamentId)
  const table = await tableRepo.createTable({
    tournamentId: null,
    cashGameId: game.id,
    tableNumber: 1,
    maxSeats: tableSize,
    dealerSeat: 0,
    smallBlind,
    bigBlind,
    ante: 0,
    status: 'waiting',
  });

  // Broadcast to lobby
  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.cashGames, cashGameEvents.CASH_GAME_CREATED, {
      id: game.id,
      name: game.name,
      status: game.status,
      maxPlayers: game.maxPlayers,
      playerCount: 0,
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      minBuyIn: game.minBuyIn,
      maxBuyIn: game.maxBuyIn,
    }).catch((err) => console.error('[createCashGame] Pusher error:', err));
  }

  return { game, table };
}

// =============================================================================
// Join Cash Game
// =============================================================================

export async function joinCashGame(
  cashGameId: string,
  playerId: string,
  buyInAmount: number
) {
  const game = await cashGameRepo.getCashGame(cashGameId);
  if (!game) throw new Error('Cash game not found');
  if (game.status === 'closed') throw new Error('Cash game is closed');

  // Validate buy-in range
  if (buyInAmount < game.minBuyIn || buyInAmount > game.maxBuyIn) {
    throw new Error(`Buy-in must be between ${game.minBuyIn} and ${game.maxBuyIn}`);
  }

  // Get table
  const table = await cashGameRepo.getCashGameTable(cashGameId);
  if (!table) throw new Error('Cash game table not found');

  // Check if already seated
  const existing = await tableRepo.getPlayerAtTable(table.id, playerId);
  if (existing) throw new Error('Already seated at this table');

  // Check seat availability
  const db = getDb();
  const seated = await db
    .select()
    .from(tablePlayers)
    .where(eq(tablePlayers.tableId, table.id));
  const activeSeatCount = seated.filter((p) => p.status !== 'eliminated').length;
  if (activeSeatCount >= game.maxPlayers) throw new Error('Table is full');

  // Find open seat
  const occupiedSeats = new Set(seated.map((p) => p.seatIndex));
  let seatIndex = -1;
  for (let i = 0; i < game.tableSize; i++) {
    if (!occupiedSeats.has(i)) {
      seatIndex = i;
      break;
    }
  }
  if (seatIndex === -1) throw new Error('No open seats');

  // Deduct from chip balance
  await chipTxRepo.recordTransaction({
    playerId,
    type: 'cash_buy_in',
    amount: -buyInAmount,
    cashGameId,
    description: `Buy-in for ${game.name}`,
  });

  // Seat player
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

  // If 2+ players seated, set status to 'running'
  if (activeSeatCount + 1 >= 2 && game.status === 'open') {
    await cashGameRepo.updateCashGameStatus(cashGameId, 'running');
  }

  // Broadcast
  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.cashGame(cashGameId), cashGameEvents.PLAYER_JOINED, {
      playerId,
      seatIndex,
      stack: buyInAmount,
    }).catch((err) => console.error('[joinCashGame] Pusher error:', err));
  }

  return { seatIndex, tableId: table.id };
}

// =============================================================================
// Rebuy
// =============================================================================

export async function rebuy(
  cashGameId: string,
  playerId: string,
  amount: number
) {
  const game = await cashGameRepo.getCashGame(cashGameId);
  if (!game) throw new Error('Cash game not found');
  if (game.status === 'closed') throw new Error('Cash game is closed');

  const table = await cashGameRepo.getCashGameTable(cashGameId);
  if (!table) throw new Error('Cash game table not found');

  // Check player is seated
  const tp = await tableRepo.getPlayerAtTable(table.id, playerId);
  if (!tp) throw new Error('Not seated at this table');

  // Only allow rebuy between hands (no active hand or player is not in an active hand)
  const db = getDb();
  const [activeHand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, table.id), ne(hands.phase, 'complete')));

  if (activeHand && !['eliminated', 'sitting_out'].includes(tp.status) && tp.stack > 0) {
    throw new Error('Cannot rebuy during an active hand while you have chips');
  }

  // Validate stack + amount <= maxBuyIn
  if (tp.stack + amount > game.maxBuyIn) {
    throw new Error(`Rebuy would exceed max buy-in of ${game.maxBuyIn}`);
  }

  if (amount < 1) throw new Error('Rebuy amount must be positive');

  // Deduct from balance
  await chipTxRepo.recordTransaction({
    playerId,
    type: 'cash_rebuy',
    amount: -amount,
    cashGameId,
    description: `Rebuy at ${game.name}`,
  });

  // Add to stack
  await db
    .update(tablePlayers)
    .set({ stack: tp.stack + amount, status: 'waiting' })
    .where(and(eq(tablePlayers.tableId, table.id), eq(tablePlayers.playerId, playerId)));

  return { newStack: tp.stack + amount };
}

// =============================================================================
// Leave Cash Game
// =============================================================================

export async function leaveCashGame(
  cashGameId: string,
  playerId: string
) {
  const game = await cashGameRepo.getCashGame(cashGameId);
  if (!game) throw new Error('Cash game not found');

  const table = await cashGameRepo.getCashGameTable(cashGameId);
  if (!table) throw new Error('Cash game table not found');

  const tp = await tableRepo.getPlayerAtTable(table.id, playerId);
  if (!tp) throw new Error('Not seated at this table');

  // Only allow leaving between hands
  const db = getDb();
  const [activeHand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, table.id), ne(hands.phase, 'complete')));

  if (activeHand && !['folded', 'eliminated', 'sitting_out'].includes(tp.status)) {
    throw new Error('Cannot leave during an active hand');
  }

  // Cash out: add stack back to chip balance
  if (tp.stack > 0) {
    await chipTxRepo.recordTransaction({
      playerId,
      type: 'cash_out',
      amount: tp.stack,
      cashGameId,
      description: `Cash out from ${game.name}`,
    });
  }

  // Remove from table
  await db
    .delete(tablePlayers)
    .where(and(eq(tablePlayers.tableId, table.id), eq(tablePlayers.playerId, playerId)));

  // Broadcast
  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.cashGame(cashGameId), cashGameEvents.PLAYER_LEFT, {
      playerId,
    }).catch((err) => console.error('[leaveCashGame] Pusher error:', err));
  }

  return { cashedOut: tp.stack };
}

// =============================================================================
// Close Cash Game (host only)
// =============================================================================

export async function closeCashGame(
  cashGameId: string,
  hostPlayerId: string
) {
  const game = await cashGameRepo.getCashGame(cashGameId);
  if (!game) throw new Error('Cash game not found');
  if (game.creatorId !== hostPlayerId) throw new Error('Only the host can close the game');
  if (game.status === 'closed') throw new Error('Game is already closed');

  const table = await cashGameRepo.getCashGameTable(cashGameId);
  if (!table) throw new Error('Cash game table not found');

  const db = getDb();

  // Auto-cash-out all remaining players
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
        type: 'cash_out',
        amount: tablePlayer.stack,
        cashGameId,
        description: `Auto cash-out: ${game.name} closed`,
      });
    }
  }

  // Remove all players from table
  await db.delete(tablePlayers).where(eq(tablePlayers.tableId, table.id));

  // Mark game and table as closed/complete
  await cashGameRepo.closeCashGame(cashGameId);
  await db.update(tables).set({ status: 'complete' }).where(eq(tables.id, table.id));

  // Broadcast
  const pusher = getPusher();
  if (pusher) {
    pusher.trigger(channels.cashGame(cashGameId), cashGameEvents.CASH_GAME_CLOSED, {
      cashGameId,
    }).catch((err) => console.error('[closeCashGame] Pusher error:', err));
  }

  return { closed: true };
}
