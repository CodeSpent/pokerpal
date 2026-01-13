/**
 * Event Repository
 *
 * Database operations for event sourcing and client sync.
 */

import { eq, and, gt, lt, desc, asc, sql } from 'drizzle-orm';
import { getDb } from '../index';
import { events, type Event, type NewEvent } from '../schema';
import { now } from '../transaction';

// =============================================================================
// Event Emission
// =============================================================================

/**
 * Emit a new event
 */
export async function emitEvent(
  entityType: string,
  entityId: string,
  eventType: string,
  payload: unknown,
  entityVersion: number
): Promise<Event> {
  const db = getDb();

  const [newEvent] = await db
    .insert(events)
    .values({
      entityType,
      entityId,
      eventType,
      payload: JSON.stringify(payload),
      entityVersion,
      createdAt: now(),
    })
    .returning();

  return newEvent;
}

// =============================================================================
// Event Queries
// =============================================================================

/**
 * Get events after a specific event ID
 */
export async function getEventsAfter(
  entityType: string,
  entityId: string,
  afterEventId: number
): Promise<Event[]> {
  const db = getDb();
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.entityType, entityType),
        eq(events.entityId, entityId),
        gt(events.id, afterEventId)
      )
    )
    .orderBy(asc(events.id));
}

/**
 * Get events since a timestamp
 */
export async function getEventsSince(
  entityType: string,
  entityId: string,
  sinceTimestamp: number
): Promise<Event[]> {
  const db = getDb();
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.entityType, entityType),
        eq(events.entityId, entityId),
        gt(events.createdAt, sinceTimestamp)
      )
    )
    .orderBy(asc(events.id));
}

/**
 * Get the latest event for an entity
 */
export async function getLatestEvent(
  entityType: string,
  entityId: string
): Promise<Event | null> {
  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(
      and(eq(events.entityType, entityType), eq(events.entityId, entityId))
    )
    .orderBy(desc(events.id))
    .limit(1);
  return event ?? null;
}

/**
 * Get the latest event ID for an entity
 */
export async function getLatestEventId(
  entityType: string,
  entityId: string
): Promise<number> {
  const latest = await getLatestEvent(entityType, entityId);
  return latest?.id ?? 0;
}

/**
 * Get all events for an entity
 */
export async function getAllEvents(
  entityType: string,
  entityId: string
): Promise<Event[]> {
  const db = getDb();
  return db
    .select()
    .from(events)
    .where(
      and(eq(events.entityType, entityType), eq(events.entityId, entityId))
    )
    .orderBy(asc(events.id));
}

/**
 * Get recent events (last N)
 */
export async function getRecentEvents(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<Event[]> {
  const db = getDb();
  return db
    .select()
    .from(events)
    .where(
      and(eq(events.entityType, entityType), eq(events.entityId, entityId))
    )
    .orderBy(desc(events.id))
    .limit(limit);
}

/**
 * Check if there are events after a specific ID
 */
export async function hasEventsAfter(
  entityType: string,
  entityId: string,
  afterEventId: number
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        eq(events.entityType, entityType),
        eq(events.entityId, entityId),
        gt(events.id, afterEventId)
      )
    );
  return Number(result[0]?.count ?? 0) > 0;
}

/**
 * Get event count for an entity
 */
export async function getEventCount(
  entityType: string,
  entityId: string
): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(eq(events.entityType, entityType), eq(events.entityId, entityId))
    );
  return Number(result[0]?.count ?? 0);
}

// =============================================================================
// Event Cleanup
// =============================================================================

/**
 * Delete old events (older than specified timestamp)
 */
export async function cleanupOldEvents(
  olderThan: number,
  keepMinimum: number = 100
): Promise<number> {
  const db = getDb();

  // For each entity, keep at least the minimum number of events
  // This is a simplified version - in production you might want a more sophisticated approach
  const result = await db
    .delete(events)
    .where(lt(events.createdAt, olderThan));

  // Note: Drizzle doesn't return affected rows count easily in Postgres
  // You may need to handle this differently based on your needs
  return 0;
}

// =============================================================================
// Utility
// =============================================================================

/**
 * Parse event payload from JSON string
 */
export function parseEventPayload<T>(event: Event): T {
  return JSON.parse(event.payload) as T;
}
