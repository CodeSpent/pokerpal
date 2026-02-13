/**
 * Core types for the poker engine v2
 */

// ============================================
// PLAYER TYPES
// ============================================

export interface Player {
  id: string;
  name: string;
  displayName?: string;  // Alias for name (client compatibility)
  avatar?: string;
  chipBalance?: number;  // For client display
  created_at: number;
}

export type PlayerStatus =
  | 'waiting'     // Waiting for hand to start
  | 'active'      // Can act
  | 'acted'       // Has acted this round
  | 'folded'      // Folded this hand
  | 'all_in'      // All-in
  | 'sitting_out' // Sitting out
  | 'eliminated'; // Eliminated from tournament

export interface TablePlayer {
  id: string;
  table_id: string;
  player_id: string;
  seat_index: number;
  stack: number;
  status: PlayerStatus;
  current_bet: number;
  hole_card_1?: string;
  hole_card_2?: string;
  // Joined from players table
  name?: string;
  avatar?: string;
}

// ============================================
// TOURNAMENT TYPES
// ============================================

export type TournamentStatus =
  | 'registering' // Open for registration
  | 'starting'    // Creating tables, seating players
  | 'running'     // Active play
  | 'final_table' // Down to final table
  | 'heads_up'    // Two players remaining
  | 'complete'    // Tournament finished
  | 'cancelled';  // Tournament cancelled

export interface Tournament {
  id: string;
  version: number;
  status: TournamentStatus;
  name: string;
  creator_id: string;
  max_players: number;
  table_size: number;
  starting_chips: number;
  blind_structure: string;
  blind_level_minutes: number;
  turn_timer_seconds: number | null; // null = unlimited
  current_level: number;
  level_started_at?: number;
  players_remaining: number;
  prize_pool: number;
  created_at: number;
  started_at?: number;
  ended_at?: number;
}

export interface TournamentRegistration {
  id: string;
  tournament_id: string;
  player_id: string;
  registered_at: number;
}

export interface EarlyStartVote {
  id: string;
  tournament_id: string;
  player_id: string;
  voted_at: number;
}

/**
 * Summary type for lobby display
 */
export interface TournamentSummary {
  id: string;
  name: string;
  status: TournamentStatus;
  maxPlayers: number;
  registeredCount: number;
  startingChips: number;
  isPasswordProtected: boolean;
}

// ============================================
// CASH GAME TYPES
// ============================================

export type CashGameStatus = 'open' | 'running' | 'closed';

export interface CashGameSummary {
  id: string;
  name: string;
  status: CashGameStatus;
  maxPlayers: number;
  playerCount: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
}

// ============================================
// TABLE TYPES
// ============================================

export type TableStatus =
  | 'waiting'  // Waiting for hand to start
  | 'playing'  // Hand in progress
  | 'breaking' // Table is breaking (consolidation)
  | 'closed';  // Table is closed

export interface Table {
  id: string;
  version: number;
  tournament_id: string | null;
  cash_game_id?: string | null;
  table_number: number;
  max_seats: number;
  dealer_seat: number;
  small_blind: number;
  big_blind: number;
  ante: number;
  status: TableStatus;
  created_at: number;
}

// ============================================
// HAND TYPES
// ============================================

export type HandPhase =
  | 'dealing'   // Dealing cards
  | 'preflop'   // Pre-flop betting
  | 'flop'      // Flop betting
  | 'turn'      // Turn betting
  | 'river'     // River betting
  | 'showdown'  // Revealing cards
  | 'awarding'  // Awarding pots
  | 'complete'; // Hand finished

export interface Hand {
  id: string;
  version: number;
  table_id: string;
  hand_number: number;
  phase: HandPhase;
  dealer_seat: number;
  small_blind_seat: number;
  big_blind_seat: number;
  current_actor_seat?: number;
  current_bet: number;
  min_raise: number;
  pot: number;
  community_cards: string; // JSON array of card strings
  deck: string;            // JSON array of remaining cards
  action_deadline?: number;
  showdown_started_at?: number; // Timestamp when showdown phase began
  started_at: number;
  ended_at?: number;
}

export interface Pot {
  id: string;
  hand_id: string;
  amount: number;
  eligible_players: string; // JSON array of player IDs
  pot_index: number;
}

// ============================================
// ACTION TYPES
// ============================================

export type ActionType =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'all_in'
  | 'post_sb'
  | 'post_bb'
  | 'post_ante';

export interface Action {
  id: string;
  hand_id: string;
  player_id: string;
  seat_index: number;
  action_type: ActionType;
  amount: number;
  phase: HandPhase;
  sequence: number;
  created_at: number;
}

// ============================================
// EVENT TYPES
// ============================================

export type EntityType = 'tournament' | 'table' | 'hand';

export type EventType =
  // Tournament events
  | 'TOURNAMENT_CREATED'
  | 'PLAYER_REGISTERED'
  | 'PLAYER_UNREGISTERED'
  | 'EARLY_START_INITIATED'
  | 'EARLY_START_VOTE'
  | 'EARLY_START_CANCELLED'
  | 'TOURNAMENT_STARTING'
  | 'TOURNAMENT_STARTED'
  | 'TOURNAMENT_COMPLETE'
  | 'TOURNAMENT_CANCELLED'
  | 'LEVEL_CHANGED'
  // Table events
  | 'TABLE_CREATED'
  | 'PLAYER_SEATED'
  | 'PLAYER_ELIMINATED'
  | 'TABLE_BREAKING'
  | 'TABLE_CLOSED'
  // Hand events
  | 'HAND_STARTED'
  | 'BLINDS_POSTED'
  | 'CARDS_DEALT'
  | 'PLAYER_ACTION'
  | 'PHASE_CHANGED'
  | 'SHOWDOWN'
  | 'POT_AWARDED'
  | 'HAND_COMPLETE'
  | 'PLAYER_TIMEOUT';

export interface GameEvent {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  event_type: EventType;
  payload: string; // JSON
  entity_version: number;
  created_at: number;
}

// ============================================
// SHOWDOWN TYPES
// ============================================

export type HandRank =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'royal-flush';

export interface ShowdownResult {
  id: string;
  hand_id: string;
  player_id: string;
  seat_index: number;
  hand_rank: HandRank;
  hand_description: string;
  best_hand: string; // JSON array of cards
  winnings: number;
}

// ============================================
// CARD TYPES
// Re-export from @/types/poker for consistency
// ============================================

// Use short suit notation ('h', 'd', 'c', 's') to match @/types/poker
export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface TableStateResponse {
  table: Table;
  players: TablePlayer[];
  hand?: Hand;
  pots: Pot[];
  version: number;
  lastEventId: number;
}

export interface TournamentStateResponse {
  tournament: Tournament;
  registrations: TournamentRegistration[];
  tables: Table[];
  version: number;
}

// ============================================
// SYNC TYPES
// ============================================

export interface SyncRequest {
  lastKnownEventId: number;
  tableVersion?: number;
}

export interface SyncResponse {
  type: 'incremental' | 'full';
  events?: GameEvent[];
  fullState?: TableStateResponse;
}

// ============================================
// CLIENT-SIDE TYPES (for store and components)
// ============================================

/**
 * Client-side player representation at a seat
 */
export interface SeatPlayer {
  id: string;
  displayName: string;
  seatIndex: number;
  stack: number;
  status: PlayerStatus;
  currentBet: number;
  hasActed: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  holeCards?: [Card, Card];
}

/**
 * Client-side seat representation
 */
export interface Seat {
  index: number;
  player: SeatPlayer | null;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
}

/**
 * Side pot for all-in situations
 */
export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

/**
 * Client-side table state
 */
export interface TableState {
  id: string;
  tournamentId: string | null;
  cashGameId?: string | null;
  tableNumber: number;
  maxSeats: 6 | 9;
  status: TableStatus;
  phase: HandPhase | 'waiting' | 'hand-complete' | 'awarding' | 'tournament-complete';
  handNumber: number;
  dealerSeatIndex: number;
  smallBlindSeatIndex?: number | null;
  bigBlindSeatIndex?: number | null;
  currentActorSeatIndex?: number | null;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  pot: number;
  currentBet: number;
  minRaise: number;
  communityCards: Card[];
  seats: Seat[];
  sidePots: SidePot[];
  turnExpiresAt?: number | null;
  turnIsUnlimited?: boolean;
  lastAction?: ActionRecord | null;
  version: number;
}

/**
 * Record of an action taken
 */
export interface ActionRecord {
  seatIndex: number;
  action: ActionType;
  amount?: number;
  timestamp: number;
}

/**
 * Table events for real-time sync
 */
export type TableEvent =
  | { type: 'PLAYER_SEATED'; seat: Seat }
  | { type: 'PLAYER_LEFT'; seatIndex: number }
  | { type: 'HAND_STARTED'; handNumber: number; dealerSeatIndex: number; blinds: { sb: number; bb: number } }
  | { type: 'HOLE_CARDS_DEALT'; cards: [Card, Card] }
  | { type: 'ACTION'; record: ActionRecord }
  | { type: 'STREET_DEALT'; street: string; cards: Card[] }
  | { type: 'POT_UPDATED'; pot: number; sidePots: SidePot[] }
  | { type: 'TURN_STARTED'; seatIndex: number; expiresAt: number | null; isUnlimited?: boolean }
  | { type: 'PLAYER_TIMEOUT'; seatIndex: number }
  | { type: 'SHOWDOWN'; reveals: { seatIndex: number; cards: [Card, Card] }[] }
  | { type: 'WINNER'; winners: { seatIndex: number; amount: number }[] }
  | { type: 'HAND_COMPLETE' }
  | { type: 'TOURNAMENT_COMPLETE'; winner: { playerId: string; name: string; seatIndex: number; stack: number } }
  | { type: 'CARDS_SHOWN'; seatIndex: number; cards: [string | null, string | null]; handNumber: number };
