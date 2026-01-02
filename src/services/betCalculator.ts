/**
 * Bet Calculator Service
 *
 * Centralizes quick bet calculations for poker betting UI.
 */

export interface QuickBet {
  label: string;
  value: number;
}

/**
 * Calculate quick bet options based on current game state
 *
 * @param min - Minimum allowed bet/raise
 * @param max - Maximum allowed bet/raise (player's remaining stack)
 * @param pot - Current pot size
 * @param currentBetOffset - Offset for pot-relative calculations (typically value - min for raises)
 * @returns Array of quick bet options
 */
export function calculateQuickBets(
  min: number,
  max: number,
  pot: number,
  currentBetOffset: number = 0
): QuickBet[] {
  return [
    { label: 'Min', value: min },
    { label: '1/2 Pot', value: Math.min(max, Math.floor(pot / 2) + currentBetOffset) },
    { label: 'Pot', value: Math.min(max, pot + currentBetOffset) },
    { label: 'All In', value: max },
  ].filter(bet => bet.value >= min && bet.value <= max);
}

/**
 * Clamp a bet amount to valid range
 */
export function clampBetAmount(amount: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, amount));
}

/**
 * Parse and validate a bet amount from string input
 */
export function parseBetInput(input: string, min: number, max: number): number | null {
  const rawValue = input.replace(/[^0-9]/g, '');
  const numValue = parseInt(rawValue, 10);

  if (isNaN(numValue)) return null;

  return clampBetAmount(numValue, min, max);
}
