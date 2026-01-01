// Card Ranks (T = Ten)
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

// Card Suits
export type Suit = 'h' | 'd' | 'c' | 's';

// Suit display names
export const SUIT_NAMES: Record<Suit, string> = {
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
  s: 'Spades',
};

// Suit symbols
export const SUIT_SYMBOLS: Record<Suit, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

// Single card
export interface Card {
  rank: Rank;
  suit: Suit;
}

// Two-card starting hand (specific cards)
export interface HoleCards {
  card1: Card;
  card2: Card;
}

// Hand notation for ranges (e.g., 'AA', 'AKs', 'AKo')
export type HandNotation = string;

// All ranks in order (high to low)
export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// All suits
export const SUITS: Suit[] = ['h', 'd', 'c', 's'];

// Table positions
export type Position = 'UTG' | 'UTG1' | 'UTG2' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

// 6-max positions
export const POSITIONS_6MAX: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// 9-max positions
export const POSITIONS_9MAX: Position[] = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// Position display names
export const POSITION_NAMES: Record<Position, string> = {
  UTG: 'Under the Gun',
  UTG1: 'Under the Gun +1',
  UTG2: 'Under the Gun +2',
  LJ: 'Lojack',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
  SB: 'Small Blind',
  BB: 'Big Blind',
};

// Position short names for display
export const POSITION_SHORT: Record<Position, string> = {
  UTG: 'UTG',
  UTG1: 'UTG+1',
  UTG2: 'UTG+2',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
};

// Player actions
export type Action = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

// Action with optional bet size
export interface ActionWithSize {
  action: Action;
  size?: number; // In BB or chips
}

// Street/round
export type Street = 'preflop' | 'flop' | 'turn' | 'river';

// Community cards (board)
export interface Board {
  flop?: [Card, Card, Card];
  turn?: Card;
  river?: Card;
}

// Generate hand notation from two ranks
export function getHandNotation(rank1: Rank, rank2: Rank, suited: boolean): HandNotation {
  // Pairs
  if (rank1 === rank2) {
    return `${rank1}${rank2}`;
  }

  // Put higher rank first
  const r1Index = RANKS.indexOf(rank1);
  const r2Index = RANKS.indexOf(rank2);
  const [high, low] = r1Index < r2Index ? [rank1, rank2] : [rank2, rank1];

  return `${high}${low}${suited ? 's' : 'o'}`;
}

// Check if a hand notation is a pair
export function isPair(hand: HandNotation): boolean {
  return hand.length === 2 && hand[0] === hand[1];
}

// Check if a hand notation is suited
export function isSuited(hand: HandNotation): boolean {
  return hand.endsWith('s');
}

// Check if a hand notation is offsuit (non-pair)
export function isOffsuit(hand: HandNotation): boolean {
  return hand.endsWith('o');
}

// Get the ranks from a hand notation
export function getHandRanks(hand: HandNotation): [Rank, Rank] {
  return [hand[0] as Rank, hand[1] as Rank];
}

// All 169 unique starting hands in the matrix
export function generateAllHands(): HandNotation[] {
  const hands: HandNotation[] = [];

  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      if (i === j) {
        // Pairs on diagonal
        hands.push(`${RANKS[i]}${RANKS[j]}`);
      } else if (i < j) {
        // Suited hands above diagonal
        hands.push(`${RANKS[i]}${RANKS[j]}s`);
      } else {
        // Offsuit hands below diagonal
        hands.push(`${RANKS[j]}${RANKS[i]}o`);
      }
    }
  }

  return hands;
}

// Get matrix position for a hand (row, col)
export function getMatrixPosition(hand: HandNotation): [number, number] {
  const [r1, r2] = getHandRanks(hand);
  const row = RANKS.indexOf(r1);
  const col = RANKS.indexOf(r2);

  if (isPair(hand)) {
    return [row, col];
  } else if (isSuited(hand)) {
    // Suited: higher rank row, lower rank col
    return [Math.min(row, col), Math.max(row, col)];
  } else {
    // Offsuit: lower rank row, higher rank col
    return [Math.max(row, col), Math.min(row, col)];
  }
}

// Get hand at matrix position
export function getHandAtPosition(row: number, col: number): HandNotation {
  const r1 = RANKS[row];
  const r2 = RANKS[col];

  if (row === col) {
    return `${r1}${r2}`; // Pair
  } else if (row < col) {
    return `${r1}${r2}s`; // Suited
  } else {
    return `${r2}${r1}o`; // Offsuit
  }
}
