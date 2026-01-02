/**
 * Transaction helpers with optimistic locking support
 */

import type Database from 'better-sqlite3';
import { getDatabase } from './connection';

/**
 * Error thrown when an optimistic lock fails
 */
export class OptimisticLockError extends Error {
  constructor(
    public readonly tableName: string,
    public readonly entityId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Optimistic lock failed for ${tableName}:${entityId}. ` +
      `Expected version ${expectedVersion}, got ${actualVersion}`
    );
    this.name = 'OptimisticLockError';
  }
}

/**
 * Error thrown when an entity is not found
 */
export class EntityNotFoundError extends Error {
  constructor(
    public readonly tableName: string,
    public readonly entityId: string
  ) {
    super(`Entity not found: ${tableName}:${entityId}`);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Error thrown when a state transition is invalid
 */
export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly entityType: string,
    public readonly currentState: string,
    public readonly attemptedState: string
  ) {
    super(
      `Invalid state transition for ${entityType}: ` +
      `${currentState} -> ${attemptedState}`
    );
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Execute a function within a database transaction
 * Automatically commits on success, rolls back on error
 */
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDatabase();
  const transaction = db.transaction(() => fn(db));
  return transaction();
}

/**
 * Execute a function with optimistic locking on an entity
 *
 * @param tableName - The table to lock
 * @param entityId - The entity ID
 * @param expectedVersion - The version we expect the entity to have
 * @param fn - The function to execute (receives the database and current entity)
 * @returns The result of fn, with the entity's version incremented
 */
export function withOptimisticLock<TEntity, TResult>(
  tableName: 'tournaments' | 'tables' | 'hands',
  entityId: string,
  expectedVersion: number,
  fn: (db: Database.Database, entity: TEntity) => TResult
): TResult {
  return withTransaction((db) => {
    // Fetch current entity and check version
    const entity = db
      .prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
      .get(entityId) as (TEntity & { version: number }) | undefined;

    if (!entity) {
      throw new EntityNotFoundError(tableName, entityId);
    }

    if (entity.version !== expectedVersion) {
      throw new OptimisticLockError(
        tableName,
        entityId,
        expectedVersion,
        entity.version
      );
    }

    // Execute the function
    const result = fn(db, entity);

    // Increment version
    const updateResult = db
      .prepare(`UPDATE ${tableName} SET version = version + 1 WHERE id = ? AND version = ?`)
      .run(entityId, expectedVersion);

    // Double-check the update succeeded (race condition protection)
    if (updateResult.changes === 0) {
      throw new OptimisticLockError(
        tableName,
        entityId,
        expectedVersion,
        expectedVersion + 1
      );
    }

    return result;
  });
}

/**
 * Execute a function with a pessimistic lock (row-level lock)
 * SQLite doesn't have true row-level locks, but we can use exclusive transaction
 * This is a heavier lock but guarantees no concurrent modifications
 */
export function withExclusiveLock<T>(fn: (db: Database.Database) => T): T {
  const db = getDatabase();

  // Begin exclusive transaction
  db.exec('BEGIN EXCLUSIVE');

  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Retry a function with optimistic locking a set number of times
 */
export async function withRetry<T>(
  fn: () => T,
  maxRetries: number = 3,
  delayMs: number = 50
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return fn();
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        lastError = error;
        // Wait before retrying
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Generate a UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}
