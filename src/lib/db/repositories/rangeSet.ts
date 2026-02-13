/**
 * Range Set Repository
 *
 * Database operations for range set management.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../index';
import {
  rangeSets,
  players,
  type RangeSet,
  type NewRangeSet,
} from '../schema';
import { generateId, now } from '../transaction';
import { POSITIONS_6MAX, type Position } from '@/types/poker';
import { STANDARD_RANGES } from '@/data/preflop-ranges';

// =============================================================================
// Queries
// =============================================================================

/**
 * Get all range sets for a player
 */
export async function getRangeSetsByPlayer(playerId: string): Promise<RangeSet[]> {
  const db = getDb();
  return db.select().from(rangeSets).where(eq(rangeSets.playerId, playerId));
}

/**
 * Get a single range set by ID
 */
export async function getRangeSet(id: string): Promise<RangeSet | null> {
  const db = getDb();
  const [rangeSet] = await db.select().from(rangeSets).where(eq(rangeSets.id, id));
  return rangeSet ?? null;
}

/**
 * Get a shared range set by its share code (only if sharing is enabled)
 */
export async function getRangeSetByShareCode(
  shareCode: string
): Promise<(RangeSet & { creatorName: string }) | null> {
  const db = getDb();
  const [result] = await db
    .select({
      rangeSet: rangeSets,
      creatorName: players.name,
    })
    .from(rangeSets)
    .innerJoin(players, eq(rangeSets.playerId, players.id))
    .where(and(eq(rangeSets.shareCode, shareCode), eq(rangeSets.isShared, true)));

  if (!result) return null;
  return { ...result.rangeSet, creatorName: result.creatorName };
}

/**
 * Check if a player has any range sets
 */
export async function hasRangeSets(playerId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select({ id: rangeSets.id }).from(rangeSets).where(eq(rangeSets.playerId, playerId)).limit(1);
  return !!row;
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create a new range set
 */
export async function createRangeSet(data: {
  playerId: string;
  name: string;
  description?: string;
  positions?: Record<string, { hands: string[] }>;
  isDefault?: boolean;
}): Promise<RangeSet> {
  const db = getDb();
  const timestamp = now();
  const newRangeSet: NewRangeSet = {
    id: generateId(),
    playerId: data.playerId,
    name: data.name,
    description: data.description ?? null,
    positions: JSON.stringify(data.positions ?? {}),
    isDefault: data.isDefault ?? false,
    isShared: false,
    shareCode: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.insert(rangeSets).values(newRangeSet);
  return newRangeSet as RangeSet;
}

/**
 * Update a range set
 */
export async function updateRangeSet(
  id: string,
  updates: { name?: string; description?: string; positions?: Record<string, { hands: string[] }> }
): Promise<void> {
  const db = getDb();
  const fields: Record<string, unknown> = { updatedAt: now() };
  if (updates.name !== undefined) fields.name = updates.name;
  if (updates.description !== undefined) fields.description = updates.description;
  if (updates.positions !== undefined) fields.positions = JSON.stringify(updates.positions);

  await db.update(rangeSets).set(fields).where(eq(rangeSets.id, id));
}

/**
 * Delete a range set
 */
export async function deleteRangeSet(id: string): Promise<void> {
  const db = getDb();
  await db.delete(rangeSets).where(eq(rangeSets.id, id));
}

/**
 * Toggle sharing on/off. Generates a shareCode on first enable.
 */
export async function setShared(
  id: string,
  isShared: boolean
): Promise<{ shareCode: string | null }> {
  const db = getDb();
  const existing = await getRangeSet(id);
  if (!existing) throw new Error('Range set not found');

  const shareCode = isShared
    ? existing.shareCode ?? generateId().slice(0, 8)
    : existing.shareCode; // keep code even when unsharing

  await db
    .update(rangeSets)
    .set({ isShared, shareCode, updatedAt: now() })
    .where(eq(rangeSets.id, id));

  return { shareCode: isShared ? shareCode : null };
}

/**
 * Adopt (deep copy) a shared range set into another player's collection
 */
export async function adoptRangeSet(
  sourceId: string,
  adoptingPlayerId: string
): Promise<RangeSet> {
  const source = await getRangeSet(sourceId);
  if (!source || !source.isShared) throw new Error('Range set not available for adoption');

  return createRangeSet({
    playerId: adoptingPlayerId,
    name: source.name,
    description: source.description ?? undefined,
    positions: JSON.parse(source.positions),
    isDefault: false,
  });
}

/**
 * Seed default range sets for a new player
 */
export async function seedDefaultRangeSets(playerId: string): Promise<void> {
  const positions: Record<string, { hands: string[] }> = {};
  for (const pos of POSITIONS_6MAX) {
    positions[pos] = { hands: STANDARD_RANGES[pos as Position].openRaise };
  }

  await createRangeSet({
    playerId,
    name: 'Standard Opening Ranges',
    description: 'Balanced 6-max open-raise ranges',
    positions,
    isDefault: true,
  });
}
