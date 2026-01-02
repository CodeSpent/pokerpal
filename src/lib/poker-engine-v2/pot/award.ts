/**
 * Pot Award Logic
 *
 * Handles awarding pots to winners, including:
 * - Multiple pots (side pots)
 * - Split pots (ties)
 * - Remainder to closest-to-button
 */

import type Database from 'better-sqlite3';
import type { TablePlayer, Hand } from '../types';
import { calculatePots, type PotInfo } from './calculator';
import { generateId, now } from '../db/transaction';

// @ts-expect-error - pokersolver doesn't have proper types
import { Hand as PokersolverHand } from 'pokersolver';

export interface AwardResult {
  playerId: string;
  seatIndex: number;
  amount: number;
  potIndex: number;
  handDescription: string;
}

/**
 * Award all pots to winners
 */
export function awardPots(
  db: Database.Database,
  handId: string,
  tableId: string,
  players: TablePlayer[],
  communityCards: string[],
  dealerSeat: number
): AwardResult[] {
  const hand = db.prepare('SELECT * FROM hands WHERE id = ?').get(handId) as Hand;
  const awards: AwardResult[] = [];

  // Calculate pots
  const pots = calculatePots(players, 0);

  // Add the accumulated pot to the first pot
  if (pots.length > 0) {
    pots[0].amount += hand.pot;
  } else if (hand.pot > 0) {
    // Create a pot for the existing amount
    const eligiblePlayerIds = players
      .filter((p) => !['folded', 'sitting_out', 'eliminated'].includes(p.status))
      .map((p) => p.player_id);

    pots.push({
      amount: hand.pot,
      eligiblePlayerIds,
    });
  }

  // Award each pot
  for (let potIndex = 0; potIndex < pots.length; potIndex++) {
    const pot = pots[potIndex];
    const potAwards = awardSinglePot(
      db,
      handId,
      tableId,
      pot,
      potIndex,
      players,
      communityCards,
      dealerSeat
    );
    awards.push(...potAwards);
  }

  return awards;
}

/**
 * Award a single pot to its winner(s)
 */
function awardSinglePot(
  db: Database.Database,
  handId: string,
  tableId: string,
  pot: PotInfo,
  potIndex: number,
  allPlayers: TablePlayer[],
  communityCards: string[],
  dealerSeat: number
): AwardResult[] {
  const awards: AwardResult[] = [];

  // Get eligible players
  const eligiblePlayers = allPlayers.filter((p) =>
    pot.eligiblePlayerIds.includes(p.player_id) &&
    p.hole_card_1 &&
    p.hole_card_2
  );

  if (eligiblePlayers.length === 0) {
    console.error(`[awardSinglePot] No eligible players for pot ${potIndex}`);
    // Return pot to players proportionally? For now, log and skip
    return [];
  }

  if (eligiblePlayers.length === 1) {
    // Single winner
    const winner = eligiblePlayers[0];
    updatePlayerStack(db, tableId, winner.seat_index, pot.amount);

    awards.push({
      playerId: winner.player_id,
      seatIndex: winner.seat_index,
      amount: pot.amount,
      potIndex,
      handDescription: 'Uncontested',
    });

    return awards;
  }

  // Evaluate hands
  const evaluatedHands: Array<{
    player: TablePlayer;
    solved: unknown;
    description: string;
  }> = [];

  for (const player of eligiblePlayers) {
    const allCards = [
      player.hole_card_1!,
      player.hole_card_2!,
      ...communityCards,
    ];

    try {
      const solved = PokersolverHand.solve(allCards);
      evaluatedHands.push({
        player,
        solved,
        description: solved.descr,
      });
    } catch (err) {
      console.error(`[awardSinglePot] Failed to evaluate hand for ${player.player_id}:`, err);
    }
  }

  if (evaluatedHands.length === 0) {
    // Fallback: give to first eligible player
    const fallbackWinner = eligiblePlayers[0];
    updatePlayerStack(db, tableId, fallbackWinner.seat_index, pot.amount);

    awards.push({
      playerId: fallbackWinner.player_id,
      seatIndex: fallbackWinner.seat_index,
      amount: pot.amount,
      potIndex,
      handDescription: 'Default (evaluation failed)',
    });

    return awards;
  }

  // Find winner(s)
  const solvedHands = evaluatedHands.map((e) => e.solved);
  const winnerSolved = PokersolverHand.winners(solvedHands);

  // Map winners back to players
  const winners = evaluatedHands.filter((e) =>
    winnerSolved.some(
      (w: { descr: string; name: string }) =>
        w.descr === (e.solved as { descr: string }).descr &&
        w.name === (e.solved as { name: string }).name
    )
  );

  if (winners.length === 0) {
    // Shouldn't happen, but fallback
    const fallbackWinner = evaluatedHands[0];
    updatePlayerStack(db, tableId, fallbackWinner.player.seat_index, pot.amount);

    awards.push({
      playerId: fallbackWinner.player.player_id,
      seatIndex: fallbackWinner.player.seat_index,
      amount: pot.amount,
      potIndex,
      handDescription: fallbackWinner.description,
    });

    return awards;
  }

  // Split pot among winners
  const share = Math.floor(pot.amount / winners.length);
  const remainder = pot.amount % winners.length;

  // Sort winners by position relative to dealer (for remainder)
  const sortedWinners = [...winners].sort((a, b) => {
    const aDistance = getClockwiseDistance(dealerSeat, a.player.seat_index, 9);
    const bDistance = getClockwiseDistance(dealerSeat, b.player.seat_index, 9);
    return aDistance - bDistance;
  });

  for (let i = 0; i < sortedWinners.length; i++) {
    const { player, description } = sortedWinners[i];
    // First winner (closest to button) gets remainder
    const amount = share + (i === 0 ? remainder : 0);

    updatePlayerStack(db, tableId, player.seat_index, amount);

    awards.push({
      playerId: player.player_id,
      seatIndex: player.seat_index,
      amount,
      potIndex,
      handDescription: description,
    });
  }

  return awards;
}

/**
 * Update player's stack
 */
function updatePlayerStack(
  db: Database.Database,
  tableId: string,
  seatIndex: number,
  amount: number
): void {
  db.prepare(`
    UPDATE table_players
    SET stack = stack + ?
    WHERE table_id = ? AND seat_index = ?
  `).run(amount, tableId, seatIndex);
}

/**
 * Get clockwise distance from dealer to a seat
 */
function getClockwiseDistance(
  dealerSeat: number,
  targetSeat: number,
  maxSeats: number
): number {
  if (targetSeat >= dealerSeat) {
    return targetSeat - dealerSeat;
  }
  return maxSeats - dealerSeat + targetSeat;
}

/**
 * Save pots to database
 */
export function savePots(
  db: Database.Database,
  handId: string,
  pots: PotInfo[]
): void {
  // Clear existing pots
  db.prepare('DELETE FROM pots WHERE hand_id = ?').run(handId);

  // Insert new pots
  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i];
    db.prepare(`
      INSERT INTO pots (id, hand_id, amount, eligible_players, pot_index)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      generateId(),
      handId,
      pot.amount,
      JSON.stringify(pot.eligiblePlayerIds),
      i
    );
  }
}

/**
 * Load pots from database
 */
export function loadPots(db: Database.Database, handId: string): PotInfo[] {
  const rows = db.prepare(`
    SELECT * FROM pots WHERE hand_id = ? ORDER BY pot_index
  `).all(handId) as Array<{
    amount: number;
    eligible_players: string;
    pot_index: number;
  }>;

  return rows.map((row) => ({
    amount: row.amount,
    eligiblePlayerIds: JSON.parse(row.eligible_players),
  }));
}
