/**
 * Pot Calculator
 *
 * Handles side pot creation for all-in scenarios.
 * Creates multiple pots with correct eligibility.
 */

import type { TablePlayer, Pot } from '../types';

export interface PotInfo {
  amount: number;
  eligiblePlayerIds: string[];
}

/**
 * Calculate pots including side pots for all-in situations
 */
export function calculatePots(
  players: TablePlayer[],
  currentPotAmount: number = 0
): PotInfo[] {
  // Get players who have contributed to the pot (not folded or sitting out)
  const contributingPlayers = players.filter(
    (p) => p.current_bet > 0 || !['folded', 'sitting_out', 'eliminated'].includes(p.status)
  );

  if (contributingPlayers.length === 0) {
    return currentPotAmount > 0
      ? [{ amount: currentPotAmount, eligiblePlayerIds: [] }]
      : [];
  }

  // Get unique bet levels, sorted ascending
  const betLevels = [...new Set(contributingPlayers.map((p) => p.current_bet))]
    .filter((b) => b > 0)
    .sort((a, b) => a - b);

  if (betLevels.length === 0) {
    // No bets, just return the existing pot
    return currentPotAmount > 0
      ? [{
          amount: currentPotAmount,
          eligiblePlayerIds: players
            .filter((p) => !['folded', 'sitting_out', 'eliminated'].includes(p.status))
            .map((p) => p.player_id),
        }]
      : [];
  }

  const pots: PotInfo[] = [];
  let previousLevel = 0;

  for (const level of betLevels) {
    const levelDiff = level - previousLevel;

    // Find players who contributed at least this much
    const eligiblePlayers = contributingPlayers.filter(
      (p) => p.current_bet >= level && !['folded', 'sitting_out', 'eliminated'].includes(p.status)
    );

    // Count how many players contributed to this level
    const contributorsAtLevel = contributingPlayers.filter(
      (p) => p.current_bet >= level
    );

    const potAmount = levelDiff * contributorsAtLevel.length;

    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayerIds: eligiblePlayers.map((p) => p.player_id),
      });
    }

    previousLevel = level;
  }

  // Add any existing pot amount to the first pot
  if (currentPotAmount > 0 && pots.length > 0) {
    pots[0].amount += currentPotAmount;
  } else if (currentPotAmount > 0) {
    pots.unshift({
      amount: currentPotAmount,
      eligiblePlayerIds: players
        .filter((p) => !['folded', 'sitting_out', 'eliminated'].includes(p.status))
        .map((p) => p.player_id),
    });
  }

  // Merge consecutive pots with the same eligible players
  return mergePots(pots);
}

/**
 * Merge consecutive pots with identical eligible players
 */
function mergePots(pots: PotInfo[]): PotInfo[] {
  if (pots.length <= 1) return pots;

  const merged: PotInfo[] = [pots[0]];

  for (let i = 1; i < pots.length; i++) {
    const current = pots[i];
    const previous = merged[merged.length - 1];

    // Check if eligible players are the same
    const sameEligible =
      current.eligiblePlayerIds.length === previous.eligiblePlayerIds.length &&
      current.eligiblePlayerIds.every((id) =>
        previous.eligiblePlayerIds.includes(id)
      );

    if (sameEligible) {
      // Merge into previous pot
      previous.amount += current.amount;
    } else {
      // Add as new pot
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Get total pot amount
 */
export function getTotalPot(pots: PotInfo[]): number {
  return pots.reduce((sum, pot) => sum + pot.amount, 0);
}

/**
 * Get main pot (first pot, typically the largest eligible set)
 */
export function getMainPot(pots: PotInfo[]): PotInfo | null {
  return pots.length > 0 ? pots[0] : null;
}

/**
 * Get side pots (all pots except the first)
 */
export function getSidePots(pots: PotInfo[]): PotInfo[] {
  return pots.slice(1);
}

/**
 * Check if player is eligible for a pot
 */
export function isPlayerEligible(pot: PotInfo, playerId: string): boolean {
  return pot.eligiblePlayerIds.includes(playerId);
}

/**
 * Get pots a player is eligible for
 */
export function getPlayerEligiblePots(
  pots: PotInfo[],
  playerId: string
): PotInfo[] {
  return pots.filter((pot) => isPlayerEligible(pot, playerId));
}

/**
 * Format pot for display
 */
export function formatPot(pot: PotInfo, index: number): string {
  if (index === 0) {
    return `Main Pot: ${pot.amount}`;
  }
  return `Side Pot ${index}: ${pot.amount}`;
}

/**
 * Get pot descriptions for display
 */
export function getPotDescriptions(pots: PotInfo[]): string[] {
  return pots.map((pot, i) => formatPot(pot, i));
}
