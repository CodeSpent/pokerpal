/**
 * Hand Repository
 *
 * Database operations for poker hands, actions, pots, and showdown results.
 */

import { eq, and, sql, ne, desc, asc } from 'drizzle-orm';
import { getDb } from '../index';
import {
  hands,
  actions,
  pots,
  showdownResults,
  type Hand,
  type NewHand,
  type Action,
  type NewAction,
  type Pot,
  type NewPot,
  type ShowdownResult,
  type NewShowdownResult,
} from '../schema';
import { generateId, now } from '../transaction';

// =============================================================================
// Hand CRUD
// =============================================================================

/**
 * Get a hand by ID
 */
export async function getHand(id: string): Promise<Hand | null> {
  const db = getDb();
  const [hand] = await db.select().from(hands).where(eq(hands.id, id));
  return hand ?? null;
}

/**
 * Get the current active hand for a table
 * Includes 'dealing' phase to avoid race conditions during hand start
 */
export async function getCurrentHand(tableId: string): Promise<Hand | null> {
  const db = getDb();
  const [hand] = await db
    .select()
    .from(hands)
    .where(
      and(
        eq(hands.tableId, tableId),
        ne(hands.phase, 'complete')
      )
    )
    .orderBy(desc(hands.handNumber))
    .limit(1);
  return hand ?? null;
}

/**
 * Get the most recent hand for a table (any phase)
 */
export async function getLatestHand(tableId: string): Promise<Hand | null> {
  const db = getDb();
  const [hand] = await db
    .select()
    .from(hands)
    .where(eq(hands.tableId, tableId))
    .orderBy(desc(hands.handNumber))
    .limit(1);
  return hand ?? null;
}

/**
 * Get next hand number for a table
 */
export async function getNextHandNumber(tableId: string): Promise<number> {
  const latest = await getLatestHand(tableId);
  return (latest?.handNumber ?? 0) + 1;
}

/**
 * Create a new hand
 */
export async function createHand(
  data: Omit<NewHand, 'id' | 'version' | 'startedAt'>
): Promise<Hand> {
  const db = getDb();
  const newHand: NewHand = {
    id: generateId(),
    version: 1,
    startedAt: now(),
    ...data,
  };

  await db.insert(hands).values(newHand);
  return newHand as Hand;
}

/**
 * Update hand fields
 */
export async function updateHand(
  id: string,
  fields: Partial<Omit<Hand, 'id' | 'version'>>
): Promise<void> {
  const db = getDb();
  await db
    .update(hands)
    .set({
      ...fields,
      version: sql`${hands.version} + 1`,
    })
    .where(eq(hands.id, id));
}

/**
 * Update hand phase
 */
export async function updateHandPhase(id: string, phase: string): Promise<void> {
  await updateHand(id, { phase });
}

/**
 * Update current actor
 */
export async function updateCurrentActor(
  id: string,
  seatIndex: number | null,
  actionDeadline?: number | null
): Promise<void> {
  await updateHand(id, {
    currentActorSeat: seatIndex,
    actionDeadline: actionDeadline ?? null,
  });
}

/**
 * Update betting state
 */
export async function updateBettingState(
  id: string,
  currentBet: number,
  minRaise: number,
  pot: number
): Promise<void> {
  await updateHand(id, { currentBet, minRaise, pot });
}

/**
 * Update community cards
 */
export async function updateCommunityCards(
  id: string,
  communityCards: string
): Promise<void> {
  await updateHand(id, { communityCards });
}

/**
 * Set showdown started timestamp
 */
export async function setShowdownStarted(id: string): Promise<void> {
  await updateHand(id, { showdownStartedAt: now() });
}

/**
 * Complete a hand
 */
export async function completeHand(id: string): Promise<void> {
  await updateHand(id, { phase: 'complete', endedAt: now() });
}

// =============================================================================
// Actions
// =============================================================================

/**
 * Get the next action sequence number for a hand
 */
export async function getNextActionSequence(handId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(${actions.sequence}), 0)` })
    .from(actions)
    .where(eq(actions.handId, handId));
  return (Number(result[0]?.maxSeq) || 0) + 1;
}

/**
 * Record an action
 */
export async function recordAction(
  data: Omit<NewAction, 'id' | 'sequence' | 'createdAt'>
): Promise<Action> {
  const db = getDb();
  const sequence = await getNextActionSequence(data.handId);

  const newAction: NewAction = {
    id: generateId(),
    sequence,
    createdAt: now(),
    ...data,
  };

  await db.insert(actions).values(newAction);
  return newAction as Action;
}

/**
 * Get all actions for a hand
 */
export async function getHandActions(handId: string): Promise<Action[]> {
  const db = getDb();
  return db
    .select()
    .from(actions)
    .where(eq(actions.handId, handId))
    .orderBy(asc(actions.sequence));
}

/**
 * Get actions for a specific phase
 */
export async function getPhaseActions(handId: string, phase: string): Promise<Action[]> {
  const db = getDb();
  return db
    .select()
    .from(actions)
    .where(and(eq(actions.handId, handId), eq(actions.phase, phase)))
    .orderBy(asc(actions.sequence));
}

// =============================================================================
// Pots
// =============================================================================

/**
 * Get all pots for a hand
 */
export async function getHandPots(handId: string): Promise<Pot[]> {
  const db = getDb();
  return db
    .select()
    .from(pots)
    .where(eq(pots.handId, handId))
    .orderBy(asc(pots.potIndex));
}

/**
 * Save pots for a hand (replaces existing)
 */
export async function savePots(handId: string, potData: Array<Omit<NewPot, 'id' | 'handId'>>): Promise<void> {
  const db = getDb();

  // Delete existing pots
  await db.delete(pots).where(eq(pots.handId, handId));

  // Insert new pots
  if (potData.length > 0) {
    const newPots = potData.map((p) => ({
      id: generateId(),
      handId,
      ...p,
    }));
    await db.insert(pots).values(newPots);
  }
}

/**
 * Update pot amount
 */
export async function updatePotAmount(potId: string, amount: number): Promise<void> {
  const db = getDb();
  await db.update(pots).set({ amount }).where(eq(pots.id, potId));
}

// =============================================================================
// Showdown Results
// =============================================================================

/**
 * Record showdown result
 */
export async function recordShowdownResult(
  data: Omit<NewShowdownResult, 'id'>
): Promise<ShowdownResult> {
  const db = getDb();
  const result: NewShowdownResult = {
    id: generateId(),
    ...data,
  };

  await db.insert(showdownResults).values(result);
  return result as ShowdownResult;
}

/**
 * Get showdown results for a hand
 */
export async function getShowdownResults(handId: string): Promise<ShowdownResult[]> {
  const db = getDb();
  return db
    .select()
    .from(showdownResults)
    .where(eq(showdownResults.handId, handId))
    .orderBy(desc(showdownResults.winnings));
}

/**
 * Update showdown result winnings
 */
export async function updateShowdownWinnings(
  resultId: string,
  winnings: number
): Promise<void> {
  const db = getDb();
  await db
    .update(showdownResults)
    .set({ winnings })
    .where(eq(showdownResults.id, resultId));
}
