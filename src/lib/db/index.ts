/**
 * Database Connection
 *
 * Uses Neon Serverless Postgres for both local and production.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
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
 * Uses Neon HTTP driver which works in all environments.
 */
export function getDb(): Database {
  if (!_db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    const sql = neon(connectionString);
    _db = drizzle(sql, { schema });
    console.log('[Database] Connected to Neon Postgres');
  }
  return _db;
}

// Export a convenience alias
export const db = {
  get instance(): Database {
    return getDb();
  },
};
