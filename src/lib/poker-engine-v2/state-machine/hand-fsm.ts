/**
 * Hand Phase State Machine
 *
 * States: dealing -> preflop -> flop -> turn -> river -> showdown -> awarding -> complete
 *
 * Critical fixes:
 * - Showdown detection works on ANY street (not just river)
 * - All-in triggers immediate runout when betting is done
 */

import type { HandPhase, Hand, TablePlayer, PlayerStatus } from '../types';
import { InvalidStateTransitionError } from '../db/transaction';

/**
 * Valid phase transitions
 */
const VALID_TRANSITIONS: Record<HandPhase, HandPhase[]> = {
  dealing: ['preflop'],
  preflop: ['flop', 'showdown', 'awarding', 'complete'],
  flop: ['turn', 'showdown', 'awarding', 'complete'],
  turn: ['river', 'showdown', 'awarding', 'complete'],
  river: ['showdown', 'awarding', 'complete'],
  showdown: ['awarding'],
  awarding: ['complete'],
  complete: [],
};

/**
 * Community card counts per phase
 */
export const COMMUNITY_CARDS_BY_PHASE: Record<HandPhase, number> = {
  dealing: 0,
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
  awarding: 5,
  complete: 5,
};

/**
 * Check if a phase transition is valid
 */
export function isValidPhaseTransition(from: HandPhase, to: HandPhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate and throw if transition is invalid
 */
export function assertValidPhaseTransition(from: HandPhase, to: HandPhase): void {
  if (!isValidPhaseTransition(from, to)) {
    throw new InvalidStateTransitionError('hand_phase', from, to);
  }
}

/**
 * Get the next betting phase (flop -> turn -> river)
 */
export function getNextBettingPhase(current: HandPhase): HandPhase | null {
  const progression: Record<string, HandPhase> = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
  };
  return progression[current] ?? null;
}

/**
 * Is this a betting phase?
 */
export function isBettingPhase(phase: HandPhase): boolean {
  return ['preflop', 'flop', 'turn', 'river'].includes(phase);
}

/**
 * Status values that mean the player is out of the hand
 */
const INACTIVE_STATUSES: PlayerStatus[] = ['folded', 'sitting_out', 'eliminated'];

/**
 * Get players who are still in the hand (not folded/sitting-out/eliminated)
 */
export function getActivePlayers(players: TablePlayer[]): TablePlayer[] {
  return players.filter((p) => !INACTIVE_STATUSES.includes(p.status));
}

/**
 * Get players who can still act (active or acted, but not all-in/folded)
 */
export function getPlayersWhoCanAct(players: TablePlayer[]): TablePlayer[] {
  return players.filter((p) => ['waiting', 'active', 'acted'].includes(p.status));
}

/**
 * CRITICAL: Determine if we should go to showdown
 *
 * This is the key fix - we must check for showdown conditions on EVERY street,
 * not just the river.
 */
export function shouldGoToShowdown(hand: Hand, players: TablePlayer[]): boolean {
  const active = getActivePlayers(players);

  // Only one player left - they win by default (no showdown needed)
  // But we handle this in shouldAwardWithoutShowdown
  if (active.length <= 1) {
    return false;
  }

  // All remaining players are all-in
  if (active.every((p) => p.status === 'all_in')) {
    return true;
  }

  // Everyone except one is all-in, and that one has matched the bet
  const notAllIn = active.filter((p) => p.status !== 'all_in');
  if (notAllIn.length === 1) {
    const lastStanding = notAllIn[0];
    // If their bet matches the current bet, betting is done
    if (lastStanding.current_bet >= hand.current_bet) {
      return true;
    }
  }

  return false;
}

/**
 * Check if we should award pot without showdown (everyone else folded)
 */
export function shouldAwardWithoutShowdown(players: TablePlayer[]): boolean {
  const active = getActivePlayers(players);
  return active.length === 1;
}

/**
 * Check if betting round is complete
 */
export function isBettingComplete(hand: Hand, players: TablePlayer[]): boolean {
  const active = getActivePlayers(players);

  // Only one player left
  if (active.length <= 1) {
    return true;
  }

  // Check each active player who can still act
  for (const player of active) {
    // All-in players don't need to act
    if (player.status === 'all_in') {
      continue;
    }

    // Players who haven't acted yet
    if (player.status === 'waiting' || player.status === 'active') {
      return false;
    }

    // Players who acted but face a raise (their bet is less than current)
    if (player.status === 'acted' && player.current_bet < hand.current_bet) {
      return false;
    }
  }

  return true;
}

/**
 * Determine the next phase after betting is complete
 */
export function getPhaseAfterBetting(
  currentPhase: HandPhase,
  hand: Hand,
  players: TablePlayer[]
): HandPhase {
  // Everyone folded - award without showdown
  if (shouldAwardWithoutShowdown(players)) {
    return 'awarding';
  }

  // All remaining players are all-in (or one left with bet matched)
  if (shouldGoToShowdown(hand, players)) {
    // If we're before river, we still need to deal out cards
    // The showdown phase will handle the runout
    return 'showdown';
  }

  // Normal progression to next street
  const nextPhase = getNextBettingPhase(currentPhase);
  if (nextPhase) {
    return nextPhase;
  }

  // River betting complete - go to showdown
  if (currentPhase === 'river') {
    return 'showdown';
  }

  // Shouldn't reach here
  return 'showdown';
}

/**
 * Reset player statuses for a new betting round
 */
export function getStatusForNewRound(currentStatus: PlayerStatus): PlayerStatus {
  switch (currentStatus) {
    case 'acted':
      return 'waiting';
    case 'all_in':
    case 'folded':
    case 'sitting_out':
    case 'eliminated':
      return currentStatus; // These don't change
    default:
      return 'waiting';
  }
}

/**
 * Get cards to deal for a phase transition
 */
export function getCardsToDeal(
  fromPhase: HandPhase,
  toPhase: HandPhase,
  currentCommunityCount: number
): number {
  const targetCount = COMMUNITY_CARDS_BY_PHASE[toPhase];
  return Math.max(0, targetCount - currentCommunityCount);
}

/**
 * Get phase display name
 */
export function getPhaseDisplay(phase: HandPhase): string {
  const displays: Record<HandPhase, string> = {
    dealing: 'Dealing',
    preflop: 'Pre-Flop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown',
    awarding: 'Awarding',
    complete: 'Complete',
  };
  return displays[phase];
}
