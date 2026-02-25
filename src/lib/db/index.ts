/**
 * Database Connection
 *
 * Uses Neon Serverless Postgres for both local and production.
 * Uses the WebSocket driver (neon-serverless) for transaction support.
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema';

// Re-export schema for convenience
export * from './schema';

// Type for the database instance
export type Database = ReturnType<typeof drizzle<typeof schema>>;

// Singleton database instance
let _db: Database | null = null;

/**
 * Get the database connection
 *
 * Uses Neon WebSocket driver which supports transactions.
 */
export function getDb(): Database {
  if (!_db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    const pool = new Pool({ connectionString });
    _db = drizzle(pool, { schema });
    console.log('[Database] Connected to Neon Postgres (WebSocket)');
  }
  return _db;
}

// Export a convenience alias
export const db = {
  get instance(): Database {
    return getDb();
  },
};
