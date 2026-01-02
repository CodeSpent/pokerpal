/**
 * Turn Order Management
 *
 * Critical fixes for turn order bugs:
 * - Correctly skips folded, all-in, sitting_out, eliminated players
 * - Handles players who need to act again (facing a raise)
 * - Special handling for heads-up position rules
 */

import type { Hand, TablePlayer, PlayerStatus, HandPhase } from '../types';

/**
 * Statuses that mean a player cannot act
 */
const CANNOT_ACT_STATUSES: PlayerStatus[] = ['folded', 'all_in', 'sitting_out', 'eliminated'];

/**
 * Find the next actor after an action is taken
 *
 * This is one of the most critical functions - bugs here cause "not your turn" errors.
 *
 * Returns null if betting round is complete.
 */
export function findNextActor(
  hand: Hand,
  players: TablePlayer[],
  currentSeat: number
): TablePlayer | null {
  const activePlayers = players.filter((p) => !CANNOT_ACT_STATUSES.includes(p.status));

  // No players left who can act
  if (activePlayers.length === 0) {
    return null;
  }

  // If only one player can act, check if they need to respond to a bet
  if (activePlayers.length === 1) {
    const player = activePlayers[0];
    // They need to act if they haven't matched the current bet
    if (player.current_bet < hand.current_bet) {
      return player;
    }
    // They've matched or exceeded - betting complete
    return null;
  }

  // Get all seat indices
  const maxSeat = Math.max(...players.map((p) => p.seat_index));
  const numPositions = maxSeat + 1;

  // Search for next actor starting from seat after current
  for (let i = 1; i <= numPositions; i++) {
    const nextSeat = (currentSeat + i) % numPositions;
    const player = players.find((p) => p.seat_index === nextSeat);

    if (!player) continue;

    // Skip players who can't act
    if (CANNOT_ACT_STATUSES.includes(player.status)) continue;

    // Player can act if:
    // 1. They haven't acted yet (status === 'waiting')
    // 2. They are the designated active player (status === 'active')
    // 3. They acted but now face a raise (their bet < current bet)
    if (player.status === 'waiting' || player.status === 'active') {
      return player;
    }

    if (player.status === 'acted' && player.current_bet < hand.current_bet) {
      return player;
    }
  }

  // No one left to act - betting round complete
  return null;
}

/**
 * Get the first actor for a new betting round (post-flop)
 *
 * Post-flop: First active player left of the dealer acts first
 * Heads-up post-flop: Big blind (non-dealer) acts first
 */
export function getFirstPostflopActor(
  players: TablePlayer[],
  dealerSeat: number,
  isHeadsUp: boolean,
  bigBlindSeat: number
): TablePlayer | null {
  const activePlayers = players.filter(
    (p) => !CANNOT_ACT_STATUSES.includes(p.status)
  );

  if (activePlayers.length <= 1) {
    return null;
  }

  if (isHeadsUp) {
    // Heads-up: BB acts first post-flop
    const bbPlayer = activePlayers.find((p) => p.seat_index === bigBlindSeat);
    if (bbPlayer && !CANNOT_ACT_STATUSES.includes(bbPlayer.status)) {
      return bbPlayer;
    }
    // If BB can't act, dealer acts
    return activePlayers.find((p) => p.seat_index === dealerSeat) || null;
  }

  // Normal: first active player left of dealer
  const maxSeat = Math.max(...players.map((p) => p.seat_index));
  const numPositions = maxSeat + 1;

  for (let i = 1; i <= numPositions; i++) {
    const nextSeat = (dealerSeat + i) % numPositions;
    const player = activePlayers.find((p) => p.seat_index === nextSeat);

    if (player && !CANNOT_ACT_STATUSES.includes(player.status)) {
      return player;
    }
  }

  return null;
}

/**
 * Check if it's a specific player's turn
 */
export function isPlayersTurn(
  hand: Hand,
  playerId: string,
  players: TablePlayer[]
): boolean {
  if (hand.current_actor_seat === null || hand.current_actor_seat === undefined) {
    return false;
  }

  const currentActor = players.find(
    (p) => p.seat_index === hand.current_actor_seat
  );

  return currentActor?.player_id === playerId;
}

/**
 * Check if betting round is complete
 */
export function isBettingRoundComplete(
  hand: Hand,
  players: TablePlayer[]
): boolean {
  const activePlayers = players.filter(
    (p) => !['folded', 'sitting_out', 'eliminated'].includes(p.status)
  );

  // Everyone folded except one
  if (activePlayers.length <= 1) {
    return true;
  }

  // Check if all active players have acted and bet matches current bet
  for (const player of activePlayers) {
    // All-in players don't need to act
    if (player.status === 'all_in') continue;

    // Hasn't acted yet
    if (player.status === 'waiting' || player.status === 'active') {
      return false;
    }

    // Acted but faces a raise
    if (player.status === 'acted' && player.current_bet < hand.current_bet) {
      return false;
    }
  }

  return true;
}

/**
 * Get players who still need to act in this round
 */
export function getPlayersToAct(
  hand: Hand,
  players: TablePlayer[]
): TablePlayer[] {
  return players.filter((player) => {
    if (CANNOT_ACT_STATUSES.includes(player.status)) return false;

    // Hasn't acted
    if (player.status === 'waiting' || player.status === 'active') return true;

    // Acted but faces raise
    if (player.status === 'acted' && player.current_bet < hand.current_bet) return true;

    return false;
  });
}

/**
 * Get the number of players remaining in the hand (not folded)
 */
export function getPlayersInHand(players: TablePlayer[]): TablePlayer[] {
  return players.filter(
    (p) => !['folded', 'sitting_out', 'eliminated'].includes(p.status)
  );
}

/**
 * Check if this is a heads-up situation
 */
export function isHeadsUp(players: TablePlayer[]): boolean {
  const activePlayers = players.filter(
    (p) => !['sitting_out', 'eliminated'].includes(p.status)
  );
  return activePlayers.length === 2;
}

/**
 * Reset player statuses for a new betting round
 */
export function getStatusesForNewRound(
  players: TablePlayer[]
): Map<number, PlayerStatus> {
  const statusMap = new Map<number, PlayerStatus>();

  for (const player of players) {
    // These statuses persist across rounds
    if (['folded', 'all_in', 'sitting_out', 'eliminated'].includes(player.status)) {
      statusMap.set(player.seat_index, player.status);
    } else {
      // Active and acted players reset to waiting
      statusMap.set(player.seat_index, 'waiting');
    }
  }

  return statusMap;
}
