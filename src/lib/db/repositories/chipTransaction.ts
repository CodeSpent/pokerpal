/**
 * Chip Transaction Repository
 *
 * Atomic chip balance operations with ledger tracking.
 */

import { eq, and, desc, gte } from 'drizzle-orm';
import { getDb } from '../index';
import { players, chipTransactions } from '../schema';
import type { ChipTransaction } from '../schema';
import { generateId, now } from '../transaction';

export interface RecordTransactionParams {
  playerId: string;
  type: 'initial_grant' | 'buy_in' | 'payout' | 'daily_bonus' | 'refund' | 'cash_buy_in' | 'cash_rebuy' | 'cash_out';
  amount: number; // signed: negative for deductions
  tournamentId?: string;
  cashGameId?: string;
  description: string;
}

/**
 * Record a chip transaction atomically.
 * Updates player balance and inserts ledger entry in a single transaction.
 * Rejects if the resulting balance would be negative.
 */
export async function recordTransaction(params: RecordTransactionParams): Promise<ChipTransaction> {
  const { playerId, type, amount, tournamentId, cashGameId, description } = params;
  const db = getDb();

  return await db.transaction(async (tx) => {
    // Read current balance
    const [player] = await tx
      .select({ chipBalance: players.chipBalance })
      .from(players)
      .where(eq(players.id, playerId));

    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const newBalance = player.chipBalance + amount;
    if (newBalance < 0) {
      throw new Error(`Insufficient chips: has ${player.chipBalance}, needs ${Math.abs(amount)}`);
    }

    // Update balance
    await tx
      .update(players)
      .set({ chipBalance: newBalance })
      .where(eq(players.id, playerId));

    // Insert ledger entry
    const txRecord: ChipTransaction = {
      id: generateId(),
      playerId,
      type,
      amount,
      balanceAfter: newBalance,
      tournamentId: tournamentId ?? null,
      cashGameId: cashGameId ?? null,
      description,
      createdAt: now(),
    };

    await tx.insert(chipTransactions).values(txRecord);

    return txRecord;
  });
}

/**
 * Get paginated transaction history for a player (newest first).
 */
export async function getTransactionHistory(
  playerId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ChipTransaction[]> {
  const db = getDb();
  return db
    .select()
    .from(chipTransactions)
    .where(eq(chipTransactions.playerId, playerId))
    .orderBy(desc(chipTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get current chip balance for a player.
 */
export async function getBalance(playerId: string): Promise<number> {
  const db = getDb();
  const [player] = await db
    .select({ chipBalance: players.chipBalance })
    .from(players)
    .where(eq(players.id, playerId));

  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  return player.chipBalance;
}

/**
 * Check if a player has claimed their daily bonus in the last 24 hours.
 */
export async function hasClaimedDailyBonus(playerId: string): Promise<boolean> {
  const db = getDb();
  const twentyFourHoursAgo = now() - 24 * 60 * 60 * 1000;

  const [recent] = await db
    .select()
    .from(chipTransactions)
    .where(
      and(
        eq(chipTransactions.playerId, playerId),
        eq(chipTransactions.type, 'daily_bonus'),
        gte(chipTransactions.createdAt, twentyFourHoursAgo)
      )
    )
    .limit(1);

  return !!recent;
}

/**
 * Get all transactions for a specific tournament (for idempotency checks).
 */
export async function getTournamentTransactions(tournamentId: string): Promise<ChipTransaction[]> {
  const db = getDb();
  return db
    .select()
    .from(chipTransactions)
    .where(eq(chipTransactions.tournamentId, tournamentId))
    .orderBy(desc(chipTransactions.createdAt));
}

/**
 * Get all transactions for a specific cash game.
 */
export async function getCashGameTransactions(cashGameId: string): Promise<ChipTransaction[]> {
  const db = getDb();
  return db
    .select()
    .from(chipTransactions)
    .where(eq(chipTransactions.cashGameId, cashGameId))
    .orderBy(desc(chipTransactions.createdAt));
}
