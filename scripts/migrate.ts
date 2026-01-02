/**
 * Database migration runner
 * Run with: npx tsx scripts/migrate.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const DB_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DB_DIR, 'poker.db');
const MIGRATIONS_DIR = path.join(process.cwd(), 'src/lib/poker-engine-v2/db/migrations');

function runMigrations() {
  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('[Migrate] Connected to database:', DB_PATH);

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  // Check if migrations directory exists and has files
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[Migrate] No migrations directory found at:', MIGRATIONS_DIR);
    console.log('[Migrate] Creating migrations directory...');
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }

  // Get migration files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[Migrate] No migration files found. Schema is applied inline by connection.ts');

    // Check current schema status
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all() as { name: string }[];

    console.log('\n[Migrate] Current tables in database:');
    tables.forEach(t => console.log(`  - ${t.name}`));

    db.close();
    return;
  }

  // Get applied migrations
  const applied = db
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[];
  const appliedSet = new Set(applied.map((m) => m.name));

  console.log(`[Migrate] Found ${files.length} migration files`);
  console.log(`[Migrate] Already applied: ${applied.length}`);

  let pendingCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[Migrate] ✓ ${file} (already applied)`);
      continue;
    }

    pendingCount++;
    console.log(`[Migrate] Applying: ${file}`);

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    try {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
      console.log(`[Migrate] ✓ ${file} applied successfully`);
    } catch (error) {
      console.error(`[Migrate] ✗ ${file} failed:`, error);
      db.close();
      process.exit(1);
    }
  }

  if (pendingCount === 0) {
    console.log('\n[Migrate] All migrations already applied.');
  } else {
    console.log(`\n[Migrate] Applied ${pendingCount} new migration(s).`);
  }

  db.close();
  console.log('[Migrate] Done.');
}

runMigrations();
