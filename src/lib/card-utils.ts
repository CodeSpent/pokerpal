/**
 * Card Utilities
 *
 * Shared utilities for card parsing and comparison.
 */

import type { Card, Rank, Suit } from '@/types/poker';

/**
 * Parse a card string (e.g., "As", "Kh") into a Card object
 */
export function parseCard(cardStr: string): Card {
  return {
    rank: cardStr[0] as Rank,
    suit: cardStr[1] as Suit,
  };
}

/**
 * Parse multiple card strings into Card objects
 */
export function parseCards(cardStrs: string[]): Card[] {
  return cardStrs.map(parseCard);
}

/**
 * Check if two cards are equal (same rank and suit)
 */
export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/**
 * Check if a card is in a list of highlighted cards
 */
export function isCardHighlighted(card: Card, highlightedCards?: Card[]): boolean {
  if (!highlightedCards || highlightedCards.length === 0) return false;
  return highlightedCards.some(hc => cardsEqual(card, hc));
}

/**
 * Convert a Card object back to a card string (e.g., { rank: 'A', suit: 's' } -> "As")
 */
export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}
