/**
 * Player Status State Machine
 *
 * States: waiting -> active -> acted | folded | all_in
 *
 * This tracks a player's status within a hand.
 */

import type { PlayerStatus, ActionType } from '../types';
import { InvalidStateTransitionError } from '../db/transaction';

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<PlayerStatus, PlayerStatus[]> = {
  waiting: ['active', 'sitting_out', 'eliminated'],
  active: ['acted', 'folded', 'all_in'],
  acted: ['active', 'folded', 'all_in', 'waiting'], // Can become active again if facing raise, waiting for new round
  folded: ['waiting', 'eliminated'], // Can return to waiting for next hand
  all_in: ['waiting', 'eliminated'], // Can return to waiting for next hand
  sitting_out: ['waiting', 'eliminated'],
  eliminated: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: PlayerStatus,
  to: PlayerStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate and throw if transition is invalid
 */
export function assertValidStatusTransition(
  from: PlayerStatus,
  to: PlayerStatus
): void {
  if (!isValidStatusTransition(from, to)) {
    throw new InvalidStateTransitionError('player_status', from, to);
  }
}

/**
 * Get the new player status after an action
 */
export function getStatusAfterAction(
  currentStatus: PlayerStatus,
  action: ActionType,
  isAllIn: boolean
): PlayerStatus {
  if (action === 'fold') {
    return 'folded';
  }

  if (isAllIn || action === 'all_in') {
    return 'all_in';
  }

  // Check, call, bet, raise all result in 'acted'
  if (['check', 'call', 'bet', 'raise', 'post_sb', 'post_bb', 'post_ante'].includes(action)) {
    return 'acted';
  }

  return currentStatus;
}

/**
 * Check if player can take an action
 */
export function canPlayerAct(status: PlayerStatus): boolean {
  return status === 'active';
}

/**
 * Check if player is still in the hand
 */
export function isPlayerInHand(status: PlayerStatus): boolean {
  return !['folded', 'sitting_out', 'eliminated'].includes(status);
}

/**
 * Check if player can still bet (not folded, not all-in, not sitting out)
 */
export function canPlayerBet(status: PlayerStatus): boolean {
  return ['waiting', 'active', 'acted'].includes(status);
}

/**
 * Get valid actions for a player in a given status and situation
 */
export interface ValidActionsParams {
  status: PlayerStatus;
  currentBet: number;
  playerBet: number;
  playerStack: number;
  minRaise: number;
  bigBlind: number;
  canCheck: boolean;
}

export interface ValidActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  minBet: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
}

export function getValidActions(params: ValidActionsParams): ValidActions {
  const {
    status,
    currentBet,
    playerBet,
    playerStack,
    minRaise,
    bigBlind,
  } = params;

  // Default: nothing allowed
  const result: ValidActions = {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canBet: false,
    minBet: 0,
    canRaise: false,
    minRaise: 0,
    maxRaise: 0,
  };

  // Must be active to act
  if (status !== 'active') {
    return result;
  }

  // Can always fold
  result.canFold = true;

  const toCall = currentBet - playerBet;

  if (toCall <= 0) {
    // No bet to call - can check
    result.canCheck = true;

    // Can bet if we have chips
    if (playerStack > 0) {
      result.canBet = true;
      result.minBet = Math.min(bigBlind, playerStack);
    }
  } else {
    // There's a bet to call
    result.canCall = true;
    result.callAmount = Math.min(toCall, playerStack);

    // Can raise if we have more than enough to call
    if (playerStack > toCall) {
      // Express as ABSOLUTE totals (what player's total bet would be)
      const minRaiseAbsolute = currentBet + minRaise;
      const maxRaiseAbsolute = playerBet + playerStack;

      // Only allow raise if min doesn't exceed max
      if (minRaiseAbsolute <= maxRaiseAbsolute) {
        result.canRaise = true;
        result.minRaise = minRaiseAbsolute;  // Absolute total bet
        result.maxRaise = maxRaiseAbsolute;  // Absolute total (all-in)
      }
    }
  }

  return result;
}

/**
 * Check if an action is valid
 */
export function isValidAction(
  action: ActionType,
  amount: number,
  validActions: ValidActions
): { valid: boolean; error?: string } {
  switch (action) {
    case 'fold':
      if (!validActions.canFold) {
        return { valid: false, error: 'Cannot fold' };
      }
      return { valid: true };

    case 'check':
      if (!validActions.canCheck) {
        return { valid: false, error: 'Cannot check - must call or fold' };
      }
      return { valid: true };

    case 'call':
      if (!validActions.canCall) {
        return { valid: false, error: 'Cannot call - nothing to call' };
      }
      return { valid: true };

    case 'bet':
      if (!validActions.canBet) {
        return { valid: false, error: 'Cannot bet' };
      }
      if (amount < validActions.minBet) {
        return { valid: false, error: `Bet must be at least ${validActions.minBet}` };
      }
      return { valid: true };

    case 'raise':
      if (!validActions.canRaise) {
        return { valid: false, error: 'Cannot raise' };
      }
      if (amount < validActions.minRaise) {
        return { valid: false, error: `Raise must be at least ${validActions.minRaise}` };
      }
      return { valid: true };

    case 'all_in':
      // Can always go all-in if you have chips
      return { valid: true };

    default:
      return { valid: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Get player status display name
 */
export function getStatusDisplay(status: PlayerStatus): string {
  const displays: Record<PlayerStatus, string> = {
    waiting: 'Waiting',
    active: 'To Act',
    acted: 'Acted',
    folded: 'Folded',
    all_in: 'All-In',
    sitting_out: 'Sitting Out',
    eliminated: 'Eliminated',
  };
  return displays[status];
}
