/**
 * Database Schema (Drizzle ORM)
 *
 * Defines all tables for the poker application.
 * Works with both PostgreSQL (production) and SQLite (local dev).
 */

import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';

// =============================================================================
// Players
// =============================================================================

export const players = pgTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  createdAt: integer('created_at').notNull(),
});

// =============================================================================
// Tournaments
// =============================================================================

export const tournaments = pgTable(
  'tournaments',
  {
    id: text('id').primaryKey(),
    version: integer('version').notNull().default(1),
    status: text('status').notNull().default('registering'),
    name: text('name').notNull(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => players.id),
    maxPlayers: integer('max_players').notNull().default(9),
    tableSize: integer('table_size').notNull().default(9),
    startingChips: integer('starting_chips').notNull().default(1500),
    blindStructure: text('blind_structure').notNull().default('standard'),
    blindLevelMinutes: integer('blind_level_minutes').notNull().default(10),
    turnTimerSeconds: integer('turn_timer_seconds').default(30),
    currentLevel: integer('current_level').notNull().default(1),
    levelStartedAt: integer('level_started_at'),
    playersRemaining: integer('players_remaining').notNull().default(0),
    prizePool: integer('prize_pool').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    endedAt: integer('ended_at'),
  },
  (table) => [index('idx_tournaments_status').on(table.status)]
);

export const tournamentRegistrations = pgTable(
  'tournament_registrations',
  {
    id: text('id').primaryKey(),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    registeredAt: integer('registered_at').notNull(),
  },
  (table) => [
    unique('uniq_tournament_player').on(table.tournamentId, table.playerId),
    index('idx_registrations_tournament').on(table.tournamentId),
    index('idx_registrations_player').on(table.playerId),
  ]
);

export const earlyStartVotes = pgTable(
  'early_start_votes',
  {
    id: text('id').primaryKey(),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    votedAt: integer('voted_at').notNull(),
  },
  (table) => [
    unique('uniq_vote_tournament_player').on(table.tournamentId, table.playerId),
  ]
);

// =============================================================================
// Tables
// =============================================================================

export const tables = pgTable(
  'tables',
  {
    id: text('id').primaryKey(),
    version: integer('version').notNull().default(1),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    tableNumber: integer('table_number').notNull(),
    maxSeats: integer('max_seats').notNull().default(9),
    dealerSeat: integer('dealer_seat').notNull().default(0),
    smallBlind: integer('small_blind').notNull(),
    bigBlind: integer('big_blind').notNull(),
    ante: integer('ante').notNull().default(0),
    status: text('status').notNull().default('waiting'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_tables_tournament').on(table.tournamentId)]
);

export const tablePlayers = pgTable(
  'table_players',
  {
    id: text('id').primaryKey(),
    tableId: text('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    seatIndex: integer('seat_index').notNull(),
    stack: integer('stack').notNull(),
    status: text('status').notNull().default('waiting'),
    currentBet: integer('current_bet').notNull().default(0),
    holeCard1: text('hole_card_1'),
    holeCard2: text('hole_card_2'),
  },
  (table) => [
    unique('uniq_table_seat').on(table.tableId, table.seatIndex),
    unique('uniq_table_player').on(table.tableId, table.playerId),
    index('idx_table_players_table').on(table.tableId),
    index('idx_table_players_player').on(table.playerId),
  ]
);

// =============================================================================
// Hands
// =============================================================================

export const hands = pgTable(
  'hands',
  {
    id: text('id').primaryKey(),
    version: integer('version').notNull().default(1),
    tableId: text('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    handNumber: integer('hand_number').notNull(),
    phase: text('phase').notNull().default('dealing'),
    dealerSeat: integer('dealer_seat').notNull(),
    smallBlindSeat: integer('small_blind_seat').notNull(),
    bigBlindSeat: integer('big_blind_seat').notNull(),
    currentActorSeat: integer('current_actor_seat'),
    currentBet: integer('current_bet').notNull().default(0),
    minRaise: integer('min_raise').notNull(),
    pot: integer('pot').notNull().default(0),
    communityCards: text('community_cards').notNull().default('[]'),
    deck: text('deck').notNull(),
    actionDeadline: integer('action_deadline'),
    showdownStartedAt: integer('showdown_started_at'),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
  },
  (table) => [index('idx_hands_table').on(table.tableId)]
);

export const pots = pgTable('pots', {
  id: text('id').primaryKey(),
  handId: text('hand_id')
    .notNull()
    .references(() => hands.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  eligiblePlayers: text('eligible_players').notNull(),
  potIndex: integer('pot_index').notNull().default(0),
});

export const actions = pgTable(
  'actions',
  {
    id: text('id').primaryKey(),
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    seatIndex: integer('seat_index').notNull(),
    actionType: text('action_type').notNull(),
    amount: integer('amount').notNull().default(0),
    phase: text('phase').notNull(),
    sequence: integer('sequence').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_actions_hand').on(table.handId)]
);

export const showdownResults = pgTable('showdown_results', {
  id: text('id').primaryKey(),
  handId: text('hand_id')
    .notNull()
    .references(() => hands.id, { onDelete: 'cascade' }),
  playerId: text('player_id')
    .notNull()
    .references(() => players.id),
  seatIndex: integer('seat_index').notNull(),
  handRank: text('hand_rank').notNull(),
  handDescription: text('hand_description').notNull(),
  bestHand: text('best_hand').notNull(),
  winnings: integer('winnings').notNull().default(0),
});

// =============================================================================
// Events (for client sync)
// =============================================================================

export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: text('payload').notNull(),
    entityVersion: integer('entity_version').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_events_entity').on(table.entityType, table.entityId),
    index('idx_events_created').on(table.createdAt),
  ]
);

// =============================================================================
// Migrations Tracking
// =============================================================================

export const migrations = pgTable('migrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  appliedAt: integer('applied_at').notNull(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;

export type TournamentRegistration = typeof tournamentRegistrations.$inferSelect;
export type NewTournamentRegistration = typeof tournamentRegistrations.$inferInsert;

export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;

export type TablePlayer = typeof tablePlayers.$inferSelect;
export type NewTablePlayer = typeof tablePlayers.$inferInsert;

export type Hand = typeof hands.$inferSelect;
export type NewHand = typeof hands.$inferInsert;

export type Pot = typeof pots.$inferSelect;
export type NewPot = typeof pots.$inferInsert;

export type Action = typeof actions.$inferSelect;
export type NewAction = typeof actions.$inferInsert;

export type ShowdownResult = typeof showdownResults.$inferSelect;
export type NewShowdownResult = typeof showdownResults.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
