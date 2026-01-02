/**
 * Database Connection
 *
 * Uses Vercel Postgres in production, SQLite locally.
 * All operations are async to support both backends.
 */

import { drizzle as drizzlePg } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

// Re-export schema for convenience
export * from './schema';

// Type for the database instance
export type Database = ReturnType<typeof drizzlePg<typeof schema>>;

// Singleton database instance
let _db: Database | null = null;

/**
 * Get the database connection
 *
 * Uses Vercel Postgres via @vercel/postgres which automatically
 * reads POSTGRES_URL from environment variables.
 */
export function getDb(): Database {
  if (!_db) {
    _db = drizzlePg(sql, { schema });
    console.log('[Database] Connected to Vercel Postgres');
  }
  return _db;
}

// Export a convenience alias
export const db = {
  get instance(): Database {
    return getDb();
  },
};
