/**
 * ICM (Independent Chip Model) Calculator
 *
 * Calculates tournament equity based on chip stacks and prize pool distribution.
 * Uses the Malmuth-Harville method for multi-way calculations.
 */

export interface ICMResult {
  playerIndex: number;
  chips: number;
  chipPercentage: number;
  icmEquity: number;
  icmPercentage: number;
  dollarValue: number;
}

/**
 * Calculate ICM equity for all players
 *
 * @param stacks - Array of chip stacks for each player
 * @param payouts - Array of prize payouts (1st place, 2nd place, etc.)
 * @returns Array of ICM results for each player
 */
export function calculateICM(stacks: number[], payouts: number[]): ICMResult[] {
  const totalChips = stacks.reduce((sum, s) => sum + s, 0);
  const totalPrizePool = payouts.reduce((sum, p) => sum + p, 0);

  if (totalChips === 0) {
    return stacks.map((chips, i) => ({
      playerIndex: i,
      chips,
      chipPercentage: 0,
      icmEquity: 0,
      icmPercentage: 0,
      dollarValue: 0,
    }));
  }

  // Calculate probability of each player finishing in each position
  const numPlayers = stacks.length;
  const numPayouts = Math.min(payouts.length, numPlayers);

  // For each player, calculate their expected value
  const icmEquities = stacks.map((_, playerIndex) => {
    return calculatePlayerEquity(stacks, payouts, playerIndex, numPayouts);
  });

  const totalEquity = icmEquities.reduce((sum, eq) => sum + eq, 0);

  return stacks.map((chips, i) => ({
    playerIndex: i,
    chips,
    chipPercentage: (chips / totalChips) * 100,
    icmEquity: icmEquities[i],
    icmPercentage: totalEquity > 0 ? (icmEquities[i] / totalEquity) * 100 : 0,
    dollarValue: icmEquities[i],
  }));
}

/**
 * Calculate a single player's ICM equity using Malmuth-Harville method
 */
function calculatePlayerEquity(
  stacks: number[],
  payouts: number[],
  playerIndex: number,
  numPayouts: number
): number {
  const totalChips = stacks.reduce((sum, s) => sum + s, 0);

  if (totalChips === 0 || stacks[playerIndex] === 0) {
    return 0;
  }

  // Use recursive probability calculation
  return calculateEquityRecursive(
    stacks,
    payouts,
    playerIndex,
    0, // starting position (1st place)
    numPayouts,
    totalChips
  );
}

/**
 * Recursive helper for ICM calculation
 * Calculates expected value for a player across all finishing positions
 */
function calculateEquityRecursive(
  stacks: number[],
  payouts: number[],
  targetPlayer: number,
  position: number,
  numPayouts: number,
  totalChips: number
): number {
  if (position >= numPayouts || position >= payouts.length) {
    return 0;
  }

  let equity = 0;
  const activePlayers = stacks.filter(s => s > 0);

  if (activePlayers.length === 0) {
    return 0;
  }

  // For each possible winner of current position
  for (let i = 0; i < stacks.length; i++) {
    if (stacks[i] === 0) continue;

    // Probability of player i finishing in current position
    const probWin = stacks[i] / totalChips;

    if (i === targetPlayer) {
      // Target player wins this position
      equity += probWin * payouts[position];
    } else {
      // Someone else wins, target player competes for remaining positions
      const remainingStacks = [...stacks];
      remainingStacks[i] = 0;
      const remainingTotal = totalChips - stacks[i];

      if (remainingTotal > 0 && remainingStacks[targetPlayer] > 0) {
        equity += probWin * calculateEquityRecursive(
          remainingStacks,
          payouts,
          targetPlayer,
          position + 1,
          numPayouts,
          remainingTotal
        );
      }
    }
  }

  return equity;
}

/**
 * Calculate the EV difference between calling and folding in an ICM spot
 *
 * @param stacks - Current chip stacks
 * @param payouts - Prize payouts
 * @param heroIndex - Index of the hero (decision maker)
 * @param villainIndex - Index of the all-in player
 * @param potSize - Total pot including blinds/antes
 * @param callAmount - Amount hero needs to call
 * @param winProbability - Hero's probability of winning if called (0-1)
 */
export function calculateICMCallEV(
  stacks: number[],
  payouts: number[],
  heroIndex: number,
  villainIndex: number,
  potSize: number,
  callAmount: number,
  winProbability: number
): {
  foldEV: number;
  callEV: number;
  evDifference: number;
  decision: 'call' | 'fold';
} {
  // Calculate fold EV (hero loses call amount from effective stack consideration)
  const foldStacks = [...stacks];
  // In fold scenario, hero keeps their stack, pot goes to villain
  foldStacks[villainIndex] += potSize;
  const foldResults = calculateICM(foldStacks, payouts);
  const foldEV = foldResults[heroIndex].dollarValue;

  // Calculate call EV
  // Win scenario: hero wins the pot + call amount
  const winStacks = [...stacks];
  winStacks[heroIndex] += potSize + callAmount;
  winStacks[villainIndex] -= callAmount; // villain loses if hero wins
  if (winStacks[villainIndex] < 0) winStacks[villainIndex] = 0;
  const winResults = calculateICM(winStacks, payouts);
  const winEV = winResults[heroIndex].dollarValue;

  // Lose scenario: hero loses call amount
  const loseStacks = [...stacks];
  loseStacks[heroIndex] -= callAmount;
  loseStacks[villainIndex] += potSize + callAmount;
  if (loseStacks[heroIndex] < 0) loseStacks[heroIndex] = 0;
  const loseResults = calculateICM(loseStacks, payouts);
  const loseEV = loseResults[heroIndex].dollarValue;

  // Expected value of calling
  const callEV = (winProbability * winEV) + ((1 - winProbability) * loseEV);

  return {
    foldEV,
    callEV,
    evDifference: callEV - foldEV,
    decision: callEV >= foldEV ? 'call' : 'fold',
  };
}

/**
 * Common tournament payout structures
 */
export const PAYOUT_STRUCTURES: Record<string, { name: string; payouts: number[] }> = {
  'winner-take-all': {
    name: 'Winner Take All',
    payouts: [100],
  },
  'top-2-65-35': {
    name: 'Top 2 (65/35)',
    payouts: [65, 35],
  },
  'top-3-50-30-20': {
    name: 'Top 3 (50/30/20)',
    payouts: [50, 30, 20],
  },
  'top-3-60-25-15': {
    name: 'Top 3 (60/25/15)',
    payouts: [60, 25, 15],
  },
  'top-5-standard': {
    name: 'Top 5 Standard',
    payouts: [40, 25, 15, 12, 8],
  },
  'top-6-standard': {
    name: 'Top 6 Standard',
    payouts: [35, 22, 15, 12, 9, 7],
  },
  'satellite-top-3': {
    name: 'Satellite (Top 3 equal)',
    payouts: [33.33, 33.33, 33.34],
  },
};

/**
 * Scale payouts to a specific prize pool
 */
export function scalePayouts(percentages: number[], prizePool: number): number[] {
  return percentages.map(p => (p / 100) * prizePool);
}
