/**
 * Audit Verification Helpers
 *
 * Pure functions to validate poker game action integrity.
 */

export interface AuditAction {
  sequence: number;
  actionType: string;
  amount: number;
  stackBefore: number | null;
  stackAfter: number | null;
  potBefore: number | null;
  potAfter: number | null;
}

export interface AuditHand {
  handNumber: number;
  finalPot: number;
  smallBlind: number;
  bigBlind: number;
  actions: AuditAction[];
  showdown: { winnings: number }[];
}

export interface VerificationResult {
  valid: boolean;
  message: string;
}

/**
 * Verify potAfter === potBefore + amount for each action
 */
export function verifyPotMath(actions: AuditAction[]): VerificationResult[] {
  return actions
    .filter((a) => a.potBefore !== null && a.potAfter !== null)
    .map((a) => {
      const expected = a.potBefore! + a.amount;
      const valid = a.potAfter === expected;
      return {
        valid,
        message: valid
          ? `Seq ${a.sequence}: pot ${a.potBefore} + ${a.amount} = ${a.potAfter}`
          : `Seq ${a.sequence}: pot ${a.potBefore} + ${a.amount} should be ${expected}, got ${a.potAfter}`,
      };
    });
}

/**
 * Verify stackAfter === stackBefore - amount for bets/calls/blinds
 */
export function verifyStackMath(actions: AuditAction[]): VerificationResult[] {
  const deductionActions = ['call', 'bet', 'raise', 'all_in', 'post_sb', 'post_bb'];
  return actions
    .filter((a) => a.stackBefore !== null && a.stackAfter !== null && deductionActions.includes(a.actionType))
    .map((a) => {
      const expected = a.stackBefore! - a.amount;
      const valid = a.stackAfter === expected;
      return {
        valid,
        message: valid
          ? `Seq ${a.sequence}: stack ${a.stackBefore} - ${a.amount} = ${a.stackAfter}`
          : `Seq ${a.sequence}: stack ${a.stackBefore} - ${a.amount} should be ${expected}, got ${a.stackAfter}`,
      };
    });
}

/**
 * Verify SB and BB posting amounts match table config
 */
export function verifyBlindPosting(
  hand: AuditHand,
  actions: AuditAction[]
): VerificationResult[] {
  const results: VerificationResult[] = [];

  const sbAction = actions.find((a) => a.actionType === 'post_sb');
  if (sbAction) {
    // SB should be smallBlind or player's remaining stack (all-in)
    const validSB = sbAction.amount === hand.smallBlind ||
      (sbAction.stackAfter === 0 && sbAction.amount <= hand.smallBlind);
    results.push({
      valid: validSB,
      message: validSB
        ? `SB posted ${sbAction.amount} (expected ${hand.smallBlind})`
        : `SB posted ${sbAction.amount}, expected ${hand.smallBlind}`,
    });
  }

  const bbAction = actions.find((a) => a.actionType === 'post_bb');
  if (bbAction) {
    const validBB = bbAction.amount === hand.bigBlind ||
      (bbAction.stackAfter === 0 && bbAction.amount <= hand.bigBlind);
    results.push({
      valid: validBB,
      message: validBB
        ? `BB posted ${bbAction.amount} (expected ${hand.bigBlind})`
        : `BB posted ${bbAction.amount}, expected ${hand.bigBlind}`,
    });
  }

  return results;
}

/**
 * Verify total winnings === final pot
 */
export function verifyWinnerPayout(hand: AuditHand): VerificationResult {
  const totalWinnings = hand.showdown.reduce((sum, s) => sum + s.winnings, 0);
  const valid = totalWinnings === hand.finalPot;
  return {
    valid,
    message: valid
      ? `Total winnings ${totalWinnings} matches pot ${hand.finalPot}`
      : `Total winnings ${totalWinnings} does not match pot ${hand.finalPot}`,
  };
}

/**
 * Verify total chips in play remains constant across a hand
 */
export function verifyChipConservation(actions: AuditAction[]): VerificationResult {
  const withSnapshots = actions.filter(
    (a) => a.stackBefore !== null && a.stackAfter !== null && a.potBefore !== null && a.potAfter !== null
  );

  if (withSnapshots.length === 0) {
    return { valid: true, message: 'No snapshot data to verify' };
  }

  // For each action, the total change in stack should equal the total change in pot
  const errors: string[] = [];
  for (const a of withSnapshots) {
    const stackDelta = a.stackBefore! - a.stackAfter!;
    const potDelta = a.potAfter! - a.potBefore!;
    if (stackDelta !== potDelta) {
      errors.push(
        `Seq ${a.sequence}: stack lost ${stackDelta} but pot gained ${potDelta}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    message: errors.length === 0
      ? 'Chip conservation verified for all actions'
      : errors.join('; '),
  };
}
