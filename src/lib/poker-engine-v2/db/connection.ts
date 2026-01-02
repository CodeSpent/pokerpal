/**
 * SQLite database connection with WAL mode for concurrent access
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Database file location
const DB_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DB_DIR, 'poker.db');

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get the database connection (creates if not exists)
 */
export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Create database with WAL mode for better concurrency
  db = new Database(DB_PATH);

  // Enable WAL mode for concurrent reads during writes
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Synchronous mode for durability (NORMAL is a good balance)
  db.pragma('synchronous = NORMAL');

  // Cache size (negative = KB, so -64000 = 64MB)
  db.pragma('cache_size = -64000');

  // Busy timeout for lock contention (10 seconds)
  db.pragma('busy_timeout = 10000');

  // Run migrations on first connection
  runMigrations(db);

  console.log('[Database] Connected to SQLite with WAL mode');

  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Database] Connection closed');
  }
}

/**
 * Run pending migrations
 */
function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');

  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.log('[Database] No migrations directory found, creating schema inline');
    applyInitialSchema(database);
    return;
  }

  // Get applied migrations
  const applied = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[];
  const appliedSet = new Set(applied.map((m) => m.name));

  // Get migration files
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    console.log(`[Database] Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    database.exec(sql);
    database.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
  }
}

/**
 * Apply initial schema (when migrations directory doesn't exist)
 */
function applyInitialSchema(database: Database.Database): void {
  const checkTable = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tournaments'")
    .get();

  if (checkTable) {
    console.log('[Database] Schema already exists, checking for migrations...');
    // Add missing columns to existing tables
    applySchemaUpdates(database);
    return;
  }

  console.log('[Database] Creating initial schema');

  database.exec(`
    -- Players table
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    -- Tournaments table with optimistic locking
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'registering'
        CHECK (status IN ('registering', 'starting', 'running', 'final_table', 'heads_up', 'complete', 'cancelled')),
      name TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      max_players INTEGER NOT NULL DEFAULT 9,
      table_size INTEGER NOT NULL DEFAULT 9,
      starting_chips INTEGER NOT NULL DEFAULT 1500,
      blind_structure TEXT NOT NULL DEFAULT 'standard',
      blind_level_minutes INTEGER NOT NULL DEFAULT 10,
      turn_timer_seconds INTEGER DEFAULT 30,
      current_level INTEGER NOT NULL DEFAULT 1,
      level_started_at INTEGER,
      players_remaining INTEGER NOT NULL DEFAULT 0,
      prize_pool INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      started_at INTEGER,
      ended_at INTEGER,
      FOREIGN KEY (creator_id) REFERENCES players(id)
    );

    -- Tournament registrations with unique constraint
    CREATE TABLE IF NOT EXISTS tournament_registrations (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      registered_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id),
      UNIQUE (tournament_id, player_id)
    );

    -- Early start votes
    CREATE TABLE IF NOT EXISTS early_start_votes (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      voted_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id),
      UNIQUE (tournament_id, player_id)
    );

    -- Tables with optimistic locking
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      tournament_id TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      max_seats INTEGER NOT NULL DEFAULT 9,
      dealer_seat INTEGER NOT NULL DEFAULT 0,
      small_blind INTEGER NOT NULL,
      big_blind INTEGER NOT NULL,
      ante INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'playing', 'breaking', 'closed')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    );

    -- Table players (seats)
    CREATE TABLE IF NOT EXISTS table_players (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      seat_index INTEGER NOT NULL,
      stack INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'active', 'acted', 'folded', 'all_in', 'sitting_out', 'eliminated')),
      current_bet INTEGER NOT NULL DEFAULT 0,
      hole_card_1 TEXT,
      hole_card_2 TEXT,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id),
      UNIQUE (table_id, seat_index),
      UNIQUE (table_id, player_id)
    );

    -- Hands with optimistic locking
    CREATE TABLE IF NOT EXISTS hands (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      table_id TEXT NOT NULL,
      hand_number INTEGER NOT NULL,
      phase TEXT NOT NULL DEFAULT 'dealing'
        CHECK (phase IN ('dealing', 'preflop', 'flop', 'turn', 'river', 'showdown', 'awarding', 'complete')),
      dealer_seat INTEGER NOT NULL,
      small_blind_seat INTEGER NOT NULL,
      big_blind_seat INTEGER NOT NULL,
      current_actor_seat INTEGER,
      current_bet INTEGER NOT NULL DEFAULT 0,
      min_raise INTEGER NOT NULL,
      pot INTEGER NOT NULL DEFAULT 0,
      community_cards TEXT NOT NULL DEFAULT '[]',
      deck TEXT NOT NULL,
      action_deadline INTEGER,
      started_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      ended_at INTEGER,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
    );

    -- Side pots
    CREATE TABLE IF NOT EXISTS pots (
      id TEXT PRIMARY KEY,
      hand_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      eligible_players TEXT NOT NULL,
      pot_index INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (hand_id) REFERENCES hands(id) ON DELETE CASCADE
    );

    -- Action log (immutable)
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      hand_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      seat_index INTEGER NOT NULL,
      action_type TEXT NOT NULL
        CHECK (action_type IN ('fold', 'check', 'call', 'bet', 'raise', 'all_in', 'post_sb', 'post_bb', 'post_ante')),
      amount INTEGER NOT NULL DEFAULT 0,
      phase TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (hand_id) REFERENCES hands(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    -- Events for client sync (monotonic ordering)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('tournament', 'table', 'hand')),
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      entity_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    -- Showdown results
    CREATE TABLE IF NOT EXISTS showdown_results (
      id TEXT PRIMARY KEY,
      hand_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      seat_index INTEGER NOT NULL,
      hand_rank TEXT NOT NULL,
      hand_description TEXT NOT NULL,
      best_hand TEXT NOT NULL,
      winnings INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (hand_id) REFERENCES hands(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
    CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON tournament_registrations(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_player ON tournament_registrations(player_id);
    CREATE INDEX IF NOT EXISTS idx_tables_tournament ON tables(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_table_players_table ON table_players(table_id);
    CREATE INDEX IF NOT EXISTS idx_table_players_player ON table_players(player_id);
    CREATE INDEX IF NOT EXISTS idx_hands_table ON hands(table_id);
    CREATE INDEX IF NOT EXISTS idx_actions_hand ON actions(hand_id);
    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  `);

  console.log('[Database] Initial schema created');
}

/**
 * Apply schema updates to existing databases
 * This adds new columns that were added after initial schema creation
 */
function applySchemaUpdates(database: Database.Database): void {
  // Check if turn_timer_seconds column exists in tournaments table
  const columns = database
    .prepare("PRAGMA table_info(tournaments)")
    .all() as { name: string }[];

  const columnNames = new Set(columns.map(c => c.name));

  if (!columnNames.has('turn_timer_seconds')) {
    console.log('[Database] Adding turn_timer_seconds column to tournaments');
    database.exec(`
      ALTER TABLE tournaments ADD COLUMN turn_timer_seconds INTEGER DEFAULT 30
    `);
  }

  console.log('[Database] Schema updates complete');
}

/**
 * Clear all data (for testing)
 */
export function clearAllData(): void {
  const database = getDatabase();
  database.exec(`
    DELETE FROM showdown_results;
    DELETE FROM events;
    DELETE FROM actions;
    DELETE FROM pots;
    DELETE FROM hands;
    DELETE FROM table_players;
    DELETE FROM tables;
    DELETE FROM early_start_votes;
    DELETE FROM tournament_registrations;
    DELETE FROM tournaments;
    DELETE FROM players;
  `);
  console.log('[Database] All data cleared');
}
