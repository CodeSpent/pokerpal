/**
 * Transaction Utilities
 *
 * Provides async transaction helpers with optimistic locking support.
 */

import { eq, and, sql } from 'drizzle-orm';
import { getDb, type Database } from './index';
import { tournaments, tables, hands } from './schema';

// =============================================================================
// Custom Errors
// =============================================================================

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

export class EntityNotFoundError extends Error {
  constructor(
    public readonly tableName: string,
    public readonly entityId: string
  ) {
    super(`Entity not found: ${tableName}:${entityId}`);
    this.name = 'EntityNotFoundError';
  }
}

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

// =============================================================================
// Transaction Helpers
// =============================================================================

/**
 * Execute a function within a database transaction
 */
export async function withTransaction<T>(
  fn: (tx: Database) => Promise<T>
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    return fn(tx as unknown as Database);
  });
}

/**
 * Execute a function with optimistic locking on an entity
 */
export async function withOptimisticLock<TEntity extends { version: number }, TResult>(
  tableName: 'tournaments' | 'tables' | 'hands',
  entityId: string,
  expectedVersion: number,
  fn: (tx: Database, entity: TEntity) => Promise<TResult>
): Promise<TResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // Get the table reference
    const tableRef = tableName === 'tournaments' ? tournaments :
                     tableName === 'tables' ? tables : hands;

    // Fetch current entity and check version
    const [entity] = await tx
      .select()
      .from(tableRef)
      .where(eq(tableRef.id, entityId));

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
    const result = await fn(tx as unknown as Database, entity as TEntity);

    // Increment version
    const updateResult = await tx
      .update(tableRef)
      .set({ version: sql`${tableRef.version} + 1` })
      .where(and(eq(tableRef.id, entityId), eq(tableRef.version, expectedVersion)));

    return result;
  });
}

/**
 * Retry a function with exponential backoff on optimistic lock failures
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 50
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        lastError = error;
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

// =============================================================================
// Utility Functions
// =============================================================================

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
