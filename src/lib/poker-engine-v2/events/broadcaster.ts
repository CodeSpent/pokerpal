/**
 * Event Broadcasting System
 *
 * Handles emitting events and retrieving event history for client sync.
 */

import type Database from 'better-sqlite3';
import type { GameEvent, EntityType, EventType } from '../types';
import { getDatabase } from '../db/connection';
import { now } from '../db/transaction';

/**
 * Emit an event to the database
 */
export function emitEvent(
  entityType: EntityType,
  entityId: string,
  eventType: EventType,
  payload: unknown,
  entityVersion: number
): GameEvent {
  const db = getDatabase();
  const timestamp = now();

  const result = db.prepare(`
    INSERT INTO events (entity_type, entity_id, event_type, payload, entity_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entityType,
    entityId,
    eventType,
    JSON.stringify(payload),
    entityVersion,
    timestamp
  );

  return {
    id: Number(result.lastInsertRowid),
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    payload: JSON.stringify(payload),
    entity_version: entityVersion,
    created_at: timestamp,
  };
}

/**
 * Get events after a specific event ID
 */
export function getEventsAfter(
  entityType: EntityType,
  entityId: string,
  afterEventId: number,
  limit: number = 100
): GameEvent[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM events
    WHERE entity_type = ? AND entity_id = ? AND id > ?
    ORDER BY id ASC
    LIMIT ?
  `).all(entityType, entityId, afterEventId, limit) as GameEvent[];
}

/**
 * Get events for an entity within a time range
 */
export function getEventsSince(
  entityType: EntityType,
  entityId: string,
  sinceTimestamp: number,
  limit: number = 100
): GameEvent[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM events
    WHERE entity_type = ? AND entity_id = ? AND created_at > ?
    ORDER BY id ASC
    LIMIT ?
  `).all(entityType, entityId, sinceTimestamp, limit) as GameEvent[];
}

/**
 * Get the latest event for an entity
 */
export function getLatestEvent(
  entityType: EntityType,
  entityId: string
): GameEvent | null {
  const db = getDatabase();
  const event = db.prepare(`
    SELECT * FROM events
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(entityType, entityId) as GameEvent | undefined;
  return event || null;
}

/**
 * Get latest event ID for an entity
 */
export function getLatestEventId(
  entityType: EntityType,
  entityId: string
): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COALESCE(MAX(id), 0) as max_id FROM events
    WHERE entity_type = ? AND entity_id = ?
  `).get(entityType, entityId) as { max_id: number };
  return result.max_id;
}

/**
 * Get all events for an entity
 */
export function getAllEvents(
  entityType: EntityType,
  entityId: string
): GameEvent[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM events
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY id ASC
  `).all(entityType, entityId) as GameEvent[];
}

/**
 * Get recent events across all entities of a type
 */
export function getRecentEvents(
  entityType: EntityType,
  limit: number = 50
): GameEvent[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM events
    WHERE entity_type = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(entityType, limit) as GameEvent[];
}

/**
 * Parse event payload
 */
export function parseEventPayload<T = unknown>(event: GameEvent): T {
  return JSON.parse(event.payload) as T;
}

/**
 * Check if there are events after a given ID
 */
export function hasEventsAfter(
  entityType: EntityType,
  entityId: string,
  afterEventId: number
): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT 1 FROM events
    WHERE entity_type = ? AND entity_id = ? AND id > ?
    LIMIT 1
  `).get(entityType, entityId, afterEventId);
  return !!result;
}

/**
 * Get event count for an entity
 */
export function getEventCount(
  entityType: EntityType,
  entityId: string
): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM events
    WHERE entity_type = ? AND entity_id = ?
  `).get(entityType, entityId) as { count: number };
  return result.count;
}

/**
 * Clean up old events (for maintenance)
 */
export function cleanupOldEvents(
  olderThanMs: number = 24 * 60 * 60 * 1000 // 24 hours
): number {
  const db = getDatabase();
  const cutoff = now() - olderThanMs;
  const result = db.prepare(`
    DELETE FROM events WHERE created_at < ?
  `).run(cutoff);
  return result.changes;
}
