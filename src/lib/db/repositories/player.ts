/**
 * Player Repository
 *
 * Database operations for player management.
 */

import { eq, sql } from 'drizzle-orm';
import { getDb } from '../index';
import { players, type Player, type NewPlayer } from '../schema';
import { generateId, now } from '../transaction';

/**
 * Get a player by ID
 */
export async function getPlayer(id: string): Promise<Player | null> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, id));
  return player ?? null;
}

/**
 * Create a new player
 */
export async function createPlayer(data: Omit<NewPlayer, 'id' | 'createdAt'>): Promise<Player> {
  const db = getDb();
  const newPlayer: NewPlayer = {
    id: generateId(),
    createdAt: now(),
    ...data,
  };

  await db.insert(players).values(newPlayer);
  return newPlayer as Player;
}

/**
 * Ensure a player exists (create if not)
 */
export async function ensurePlayer(id: string, name: string, avatar?: string): Promise<Player> {
  const existing = await getPlayer(id);
  if (existing) {
    return existing;
  }

  const db = getDb();
  const newPlayer: NewPlayer = {
    id,
    name,
    avatar: avatar ?? null,
    createdAt: now(),
  };

  await db.insert(players).values(newPlayer).onConflictDoNothing();

  // Return the player (might have been created by another request)
  const player = await getPlayer(id);
  return player!;
}

/**
 * Update a player's name
 */
export async function updatePlayerName(id: string, name: string): Promise<void> {
  const db = getDb();
  await db.update(players).set({ name }).where(eq(players.id, id));
}

/**
 * Update a player's avatar
 */
export async function updatePlayerAvatar(id: string, avatar: string): Promise<void> {
  const db = getDb();
  await db.update(players).set({ avatar }).where(eq(players.id, id));
}

/**
 * Get a player by their auth user ID
 */
export async function getPlayerByUserId(userId: string): Promise<Player | null> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.userId, userId));
  return player ?? null;
}

/**
 * Get a player by their username (case-insensitive)
 */
export async function getPlayerByName(name: string): Promise<Player | null> {
  const db = getDb();
  const [player] = await db
    .select()
    .from(players)
    .where(sql`lower(${players.name}) = ${name.toLowerCase()}`);
  return player ?? null;
}

export interface CreatePlayerProfile {
  username: string;
  country: string;
  state: string;
}

/**
 * Create a player record linked to an authenticated user
 */
export async function createPlayerForUser(userId: string, profile: CreatePlayerProfile): Promise<Player> {
  const db = getDb();
  const newPlayer: NewPlayer = {
    id: generateId(),
    name: profile.username.toLowerCase(),
    userId,
    country: profile.country,
    state: profile.state,
    createdAt: now(),
  };

  await db.insert(players).values(newPlayer);
  return newPlayer as Player;
}
