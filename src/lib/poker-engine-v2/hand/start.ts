/**
 * Hand Start
 *
 * Handles starting a new hand, including:
 * - Determining dealer position
 * - Posting blinds and antes
 * - Dealing hole cards
 * - Setting first actor
 */

import type Database from 'better-sqlite3';
import type { Hand, Table, TablePlayer, Card, Suit, Rank } from '../types';
import { generateId, now } from '../db/transaction';

import type { Tournament } from '../types';

const SUITS: Suit[] = ['h', 'd', 'c', 's'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/**
 * Create a shuffled deck
 */
function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Convert card to string format (e.g., "Ah" for Ace of hearts)
 */
function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

/**
 * Start a new hand on a table
 *
 * This function is idempotent - if a hand already exists (including showdown),
 * it returns the existing hand instead of creating a new one.
 *
 * This is wrapped in a transaction to ensure atomicity.
 * If any step fails, the entire operation is rolled back.
 */
export function startNewHand(
  db: Database.Database,
  tableId: string,
  handNumber: number
): Hand {
  // Wrap everything in a transaction for atomicity
  const startHandTransaction = db.transaction(() => {
    // Idempotency check: if a non-complete hand already exists, return it
    const existingHand = db.prepare(`
      SELECT * FROM hands
      WHERE table_id = ? AND phase NOT IN ('complete')
      ORDER BY hand_number DESC
      LIMIT 1
    `).get(tableId) as Hand | undefined;

    if (existingHand) {
      console.log(`[startNewHand] Hand #${existingHand.hand_number} already exists, returning existing`);
      return existingHand;
    }

    // Also check if this specific hand number was already created
    const handWithNumber = db.prepare(`
      SELECT * FROM hands
      WHERE table_id = ? AND hand_number = ?
    `).get(tableId, handNumber) as Hand | undefined;

    if (handWithNumber) {
      console.log(`[startNewHand] Hand #${handNumber} already exists (may be complete), skipping`);
      // Return null to indicate we shouldn't start - caller should fetch current state
      return handWithNumber;
    }

    return startNewHandInternal(db, tableId, handNumber);
  });

  return startHandTransaction();
}

/**
 * Internal implementation - must be called within a transaction
 */
function startNewHandInternal(
  db: Database.Database,
  tableId: string,
  handNumber: number
): Hand {
  const timestamp = now();

  // Get table
  const table = db
    .prepare('SELECT * FROM tables WHERE id = ?')
    .get(tableId) as Table;

  // Get active players (not eliminated or sitting out)
  const players = db.prepare(`
    SELECT tp.*, p.name, p.avatar
    FROM table_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.table_id = ? AND tp.status NOT IN ('eliminated', 'sitting_out')
    ORDER BY tp.seat_index
  `).all(tableId) as TablePlayer[];

  if (players.length < 2) {
    throw new Error('Need at least 2 players to start a hand');
  }

  // Determine dealer position
  // For first hand, dealer is at seat 0
  // For subsequent hands, move dealer clockwise
  const currentDealerSeat = table.dealer_seat;
  const newDealerSeat = handNumber === 1
    ? findNextActiveSeat(players, -1) // Start from first active seat
    : findNextActiveSeat(players, currentDealerSeat);

  // Determine blind positions (special case for heads-up)
  const isHeadsUp = players.length === 2;
  let smallBlindSeat: number;
  let bigBlindSeat: number;

  if (isHeadsUp) {
    // Heads-up: dealer posts SB and acts first preflop
    smallBlindSeat = newDealerSeat;
    bigBlindSeat = findNextActiveSeat(players, newDealerSeat);
  } else {
    // Normal: SB is left of dealer, BB is left of SB
    smallBlindSeat = findNextActiveSeat(players, newDealerSeat);
    bigBlindSeat = findNextActiveSeat(players, smallBlindSeat);
  }

  // Create and shuffle deck
  const deck = createShuffledDeck();

  // Create hand record
  const handId = generateId();

  db.prepare(`
    INSERT INTO hands (
      id, table_id, hand_number, phase,
      dealer_seat, small_blind_seat, big_blind_seat,
      current_actor_seat, current_bet, min_raise, pot,
      community_cards, deck, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    handId,
    tableId,
    handNumber,
    'dealing',
    newDealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    null, // Will be set after dealing
    0,
    table.big_blind,
    0,
    '[]',
    JSON.stringify(deck.map(cardToString)),
    timestamp
  );

  // Update table's dealer seat
  db.prepare('UPDATE tables SET dealer_seat = ? WHERE id = ?')
    .run(newDealerSeat, tableId);

  // Reset all active players for new hand
  db.prepare(`
    UPDATE table_players
    SET status = 'waiting', current_bet = 0, hole_card_1 = NULL, hole_card_2 = NULL
    WHERE table_id = ? AND status NOT IN ('eliminated', 'sitting_out')
  `).run(tableId);

  // Post blinds and antes
  postBlinds(db, handId, tableId, players, table.small_blind, table.big_blind, table.ante, smallBlindSeat, bigBlindSeat);

  // Deal hole cards
  dealHoleCards(db, handId, tableId, players, deck);

  // Update to preflop phase and set first actor
  const firstActorSeat = getFirstPreflopActor(players, bigBlindSeat, isHeadsUp, newDealerSeat);

  // Get tournament's turn timer setting
  const tournament = db.prepare(`
    SELECT turn_timer_seconds FROM tournaments WHERE id = (
      SELECT tournament_id FROM tables WHERE id = ?
    )
  `).get(tableId) as Pick<Tournament, 'turn_timer_seconds'> | undefined;

  // Calculate deadline - null if unlimited
  const turnTimerSeconds = tournament?.turn_timer_seconds;
  const actionDeadline = turnTimerSeconds !== null && turnTimerSeconds !== undefined
    ? timestamp + turnTimerSeconds * 1000
    : null;

  db.prepare(`
    UPDATE hands
    SET phase = 'preflop', current_actor_seat = ?, action_deadline = ?
    WHERE id = ?
  `).run(firstActorSeat, actionDeadline, handId);

  // Set the first actor's status to 'active'
  db.prepare(`
    UPDATE table_players
    SET status = 'active'
    WHERE table_id = ? AND seat_index = ?
  `).run(tableId, firstActorSeat);

  // Emit hand started event
  emitEvent(db, 'hand', handId, 'HAND_STARTED', {
    tableId,
    handNumber,
    dealerSeat: newDealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    firstActorSeat,
  }, 1);

  // Emit turn started event so clients know whose turn it is
  emitEvent(db, 'hand', handId, 'TURN_STARTED', {
    seatIndex: firstActorSeat,
    expiresAt: actionDeadline,
    isUnlimited: actionDeadline === null,
  }, 1);

  // Return the hand
  return db.prepare('SELECT * FROM hands WHERE id = ?').get(handId) as Hand;
}

/**
 * Post blinds (and antes if applicable)
 */
function postBlinds(
  db: Database.Database,
  handId: string,
  tableId: string,
  players: TablePlayer[],
  smallBlind: number,
  bigBlind: number,
  ante: number,
  smallBlindSeat: number,
  bigBlindSeat: number
): void {
  let totalPot = 0;
  let sequence = 0;

  // Post antes first
  if (ante > 0) {
    for (const player of players) {
      const anteAmount = Math.min(ante, player.stack);
      if (anteAmount > 0) {
        db.prepare(`
          UPDATE table_players
          SET stack = stack - ?, current_bet = current_bet + ?
          WHERE table_id = ? AND seat_index = ?
        `).run(anteAmount, anteAmount, tableId, player.seat_index);

        // Log action
        db.prepare(`
          INSERT INTO actions (id, hand_id, player_id, seat_index, action_type, amount, phase, sequence, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(generateId(), handId, player.player_id, player.seat_index, 'post_ante', anteAmount, 'preflop', sequence++, now());

        totalPot += anteAmount;
      }
    }
  }

  // Find SB and BB players
  const sbPlayer = players.find((p) => p.seat_index === smallBlindSeat);
  const bbPlayer = players.find((p) => p.seat_index === bigBlindSeat);

  if (!sbPlayer || !bbPlayer) {
    throw new Error('Could not find blind players');
  }

  // Post small blind
  const sbAmount = Math.min(smallBlind, sbPlayer.stack);
  db.prepare(`
    UPDATE table_players
    SET stack = stack - ?, current_bet = current_bet + ?
    WHERE table_id = ? AND seat_index = ?
  `).run(sbAmount, sbAmount, tableId, smallBlindSeat);

  db.prepare(`
    INSERT INTO actions (id, hand_id, player_id, seat_index, action_type, amount, phase, sequence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), handId, sbPlayer.player_id, smallBlindSeat, 'post_sb', sbAmount, 'preflop', sequence++, now());

  totalPot += sbAmount;

  // Post big blind
  const bbAmount = Math.min(bigBlind, bbPlayer.stack);
  db.prepare(`
    UPDATE table_players
    SET stack = stack - ?, current_bet = current_bet + ?
    WHERE table_id = ? AND seat_index = ?
  `).run(bbAmount, bbAmount, tableId, bigBlindSeat);

  db.prepare(`
    INSERT INTO actions (id, hand_id, player_id, seat_index, action_type, amount, phase, sequence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), handId, bbPlayer.player_id, bigBlindSeat, 'post_bb', bbAmount, 'preflop', sequence++, now());

  totalPot += bbAmount;

  // Update hand with current bet and pot
  db.prepare(`
    UPDATE hands
    SET current_bet = ?, pot = ?
    WHERE id = ?
  `).run(bigBlind, totalPot, handId);

  // Emit blinds posted event
  emitEvent(db, 'hand', handId, 'BLINDS_POSTED', {
    smallBlindSeat,
    smallBlindAmount: sbAmount,
    bigBlindSeat,
    bigBlindAmount: bbAmount,
    ante,
    pot: totalPot,
  }, 1);
}

/**
 * Deal hole cards to all active players
 */
function dealHoleCards(
  db: Database.Database,
  handId: string,
  tableId: string,
  players: TablePlayer[],
  deck: Card[]
): void {
  let deckIndex = 0;

  for (const player of players) {
    const card1 = deck[deckIndex++];
    const card2 = deck[deckIndex++];

    db.prepare(`
      UPDATE table_players
      SET hole_card_1 = ?, hole_card_2 = ?
      WHERE table_id = ? AND seat_index = ?
    `).run(cardToString(card1), cardToString(card2), tableId, player.seat_index);
  }

  // Update deck in hand (remove dealt cards)
  const remainingDeck = deck.slice(deckIndex).map(cardToString);
  db.prepare('UPDATE hands SET deck = ? WHERE id = ?')
    .run(JSON.stringify(remainingDeck), handId);

  // Emit cards dealt event (without revealing cards - that's handled per-player)
  emitEvent(db, 'hand', handId, 'CARDS_DEALT', {
    playerCount: players.length,
  }, 1);
}

/**
 * Find the next active seat after a given seat
 */
function findNextActiveSeat(players: TablePlayer[], currentSeat: number): number {
  const seats = players.map((p) => p.seat_index).sort((a, b) => a - b);
  const numSeats = Math.max(...seats) + 1;

  for (let i = 1; i <= numSeats; i++) {
    const nextSeat = (currentSeat + i) % numSeats;
    if (seats.includes(nextSeat)) {
      return nextSeat;
    }
  }

  return seats[0];
}

/**
 * Get the first actor preflop (left of BB, or dealer in heads-up)
 */
function getFirstPreflopActor(
  players: TablePlayer[],
  bigBlindSeat: number,
  isHeadsUp: boolean,
  dealerSeat: number
): number {
  if (isHeadsUp) {
    // Heads-up: dealer/SB acts first preflop
    return dealerSeat;
  }

  // Normal: player left of BB acts first
  return findNextActiveSeat(players, bigBlindSeat);
}

/**
 * Helper to emit an event
 */
function emitEvent(
  db: Database.Database,
  entityType: 'tournament' | 'table' | 'hand',
  entityId: string,
  eventType: string,
  payload: unknown,
  entityVersion: number
): void {
  db.prepare(`
    INSERT INTO events (entity_type, entity_id, event_type, payload, entity_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entityType,
    entityId,
    eventType,
    JSON.stringify(payload),
    entityVersion,
    now()
  );
}
