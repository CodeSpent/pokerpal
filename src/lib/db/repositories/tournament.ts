/**
 * Tournament Repository
 *
 * Database operations for tournament management.
 */

import { eq, and, sql, inArray } from 'drizzle-orm';
import { getDb } from '../index';
import {
  tournaments,
  tournamentRegistrations,
  earlyStartVotes,
  players,
  type Tournament,
  type NewTournament,
  type TournamentRegistration,
  type Player,
} from '../schema';
import { generateId, now, withTransaction } from '../transaction';

// =============================================================================
// Tournament CRUD
// =============================================================================

/**
 * Get a tournament by ID
 */
export async function getTournament(id: string): Promise<Tournament | null> {
  const db = getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  return tournament ?? null;
}

/**
 * Get tournaments by status
 */
export async function getTournamentsByStatus(
  status: string | string[]
): Promise<Tournament[]> {
  const db = getDb();
  const statuses = Array.isArray(status) ? status : [status];
  return db.select().from(tournaments).where(inArray(tournaments.status, statuses));
}

/**
 * Get open tournaments (registering status)
 */
export async function getOpenTournaments(): Promise<Tournament[]> {
  return getTournamentsByStatus('registering');
}

/**
 * Create a new tournament
 */
export async function createTournament(
  data: Omit<NewTournament, 'id' | 'version' | 'createdAt'>
): Promise<Tournament> {
  const db = getDb();
  const newTournament: NewTournament = {
    id: generateId(),
    version: 1,
    createdAt: now(),
    ...data,
  };

  await db.insert(tournaments).values(newTournament);
  return newTournament as Tournament;
}

/**
 * Update tournament status
 */
export async function updateTournamentStatus(
  id: string,
  status: string,
  additionalFields?: Partial<Tournament>
): Promise<void> {
  const db = getDb();
  await db
    .update(tournaments)
    .set({
      status,
      version: sql`${tournaments.version} + 1`,
      ...additionalFields,
    })
    .where(eq(tournaments.id, id));
}

/**
 * Update tournament fields
 */
export async function updateTournament(
  id: string,
  fields: Partial<Omit<Tournament, 'id' | 'version'>>
): Promise<void> {
  const db = getDb();
  await db
    .update(tournaments)
    .set({
      ...fields,
      version: sql`${tournaments.version} + 1`,
    })
    .where(eq(tournaments.id, id));
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Register a player for a tournament
 */
export async function registerPlayer(
  tournamentId: string,
  playerId: string
): Promise<TournamentRegistration> {
  const db = getDb();
  const registration = {
    id: generateId(),
    tournamentId,
    playerId,
    registeredAt: now(),
  };

  await db.insert(tournamentRegistrations).values(registration);
  return registration as TournamentRegistration;
}

/**
 * Unregister a player from a tournament
 */
export async function unregisterPlayer(
  tournamentId: string,
  playerId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(tournamentRegistrations)
    .where(
      and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        eq(tournamentRegistrations.playerId, playerId)
      )
    );
}

/**
 * Check if a player is registered for a tournament
 */
export async function isPlayerRegistered(
  tournamentId: string,
  playerId: string
): Promise<boolean> {
  const db = getDb();
  const [registration] = await db
    .select()
    .from(tournamentRegistrations)
    .where(
      and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        eq(tournamentRegistrations.playerId, playerId)
      )
    );
  return !!registration;
}

/**
 * Get registration count for a tournament
 */
export async function getRegistrationCount(tournamentId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(tournamentRegistrations)
    .where(eq(tournamentRegistrations.tournamentId, tournamentId));
  return Number(result[0]?.count ?? 0);
}

/**
 * Get all registrations for a tournament
 */
export async function getTournamentRegistrations(
  tournamentId: string
): Promise<TournamentRegistration[]> {
  const db = getDb();
  return db
    .select()
    .from(tournamentRegistrations)
    .where(eq(tournamentRegistrations.tournamentId, tournamentId));
}

/**
 * Get registrations with player details
 */
export async function getRegistrationsWithPlayers(
  tournamentId: string
): Promise<Array<TournamentRegistration & { player: Player }>> {
  const db = getDb();
  const results = await db
    .select({
      registration: tournamentRegistrations,
      player: players,
    })
    .from(tournamentRegistrations)
    .innerJoin(players, eq(tournamentRegistrations.playerId, players.id))
    .where(eq(tournamentRegistrations.tournamentId, tournamentId));

  return results.map((r) => ({
    ...r.registration,
    player: r.player,
  }));
}

// =============================================================================
// Early Start Votes
// =============================================================================

/**
 * Add an early start vote
 */
export async function addEarlyStartVote(
  tournamentId: string,
  playerId: string
): Promise<void> {
  const db = getDb();
  await db.insert(earlyStartVotes).values({
    id: generateId(),
    tournamentId,
    playerId,
    votedAt: now(),
  }).onConflictDoNothing();
}

/**
 * Get early start vote count
 */
export async function getEarlyStartVoteCount(tournamentId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(earlyStartVotes)
    .where(eq(earlyStartVotes.tournamentId, tournamentId));
  return Number(result[0]?.count ?? 0);
}

/**
 * Check if player has voted for early start
 */
export async function hasVotedForEarlyStart(
  tournamentId: string,
  playerId: string
): Promise<boolean> {
  const db = getDb();
  const [vote] = await db
    .select()
    .from(earlyStartVotes)
    .where(
      and(
        eq(earlyStartVotes.tournamentId, tournamentId),
        eq(earlyStartVotes.playerId, playerId)
      )
    );
  return !!vote;
}

/**
 * Get all early start votes for a tournament
 */
export async function getEarlyStartVotes(
  tournamentId: string
): Promise<Array<{ playerId: string }>> {
  const db = getDb();
  const votes = await db
    .select({ playerId: earlyStartVotes.playerId })
    .from(earlyStartVotes)
    .where(eq(earlyStartVotes.tournamentId, tournamentId));
  return votes;
}
