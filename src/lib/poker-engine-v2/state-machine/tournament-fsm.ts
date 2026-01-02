/**
 * Tournament State Machine
 *
 * States: registering -> starting -> running -> final_table -> heads_up -> complete
 *
 * This FSM defines valid state transitions and guards for tournament lifecycle.
 */

import type { TournamentStatus, Tournament, TournamentRegistration } from '../types';
import { InvalidStateTransitionError } from '../db/transaction';

/**
 * Valid state transitions for tournaments
 */
const VALID_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  registering: ['starting', 'cancelled'],
  starting: ['running', 'cancelled'],
  running: ['final_table', 'heads_up', 'complete', 'cancelled'],
  final_table: ['heads_up', 'complete'],
  heads_up: ['complete'],
  complete: [],
  cancelled: [],
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: TournamentStatus,
  to: TournamentStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate and throw if transition is invalid
 */
export function assertValidTransition(
  from: TournamentStatus,
  to: TournamentStatus
): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidStateTransitionError('tournament', from, to);
  }
}

/**
 * Guard: Can tournament start?
 */
export interface StartGuardResult {
  canStart: boolean;
  reason?: string;
}

export function canTournamentStart(
  tournament: Tournament,
  registrations: TournamentRegistration[]
): StartGuardResult {
  // Must be in registering state
  if (tournament.status !== 'registering') {
    return {
      canStart: false,
      reason: `Tournament is in ${tournament.status} state, not registering`,
    };
  }

  // Must have at least 2 players
  const playerCount = registrations.length;
  if (playerCount < 2) {
    return {
      canStart: false,
      reason: `Need at least 2 players to start (have ${playerCount})`,
    };
  }

  return { canStart: true };
}

/**
 * Guard: Can player register?
 */
export interface RegistrationGuardResult {
  canRegister: boolean;
  reason?: string;
}

export function canPlayerRegister(
  tournament: Tournament,
  registrations: TournamentRegistration[],
  playerId: string
): RegistrationGuardResult {
  // Must be in registering state
  if (tournament.status !== 'registering') {
    return {
      canRegister: false,
      reason: 'Tournament is not open for registration',
    };
  }

  // Must not be full
  if (registrations.length >= tournament.max_players) {
    return {
      canRegister: false,
      reason: 'Tournament is full',
    };
  }

  // Must not be already registered
  if (registrations.some((r) => r.player_id === playerId)) {
    return {
      canRegister: false,
      reason: 'Already registered for this tournament',
    };
  }

  return { canRegister: true };
}

/**
 * Guard: Can player unregister?
 */
export interface UnregistrationGuardResult {
  canUnregister: boolean;
  reason?: string;
}

export function canPlayerUnregister(
  tournament: Tournament,
  registrations: TournamentRegistration[],
  playerId: string
): UnregistrationGuardResult {
  // Must be in registering state
  if (tournament.status !== 'registering') {
    return {
      canUnregister: false,
      reason: 'Cannot unregister after tournament starts',
    };
  }

  // Must be registered
  if (!registrations.some((r) => r.player_id === playerId)) {
    return {
      canUnregister: false,
      reason: 'Not registered for this tournament',
    };
  }

  return { canUnregister: true };
}

/**
 * Determine the next tournament status based on player count
 */
export function getNextTournamentStatus(
  currentStatus: TournamentStatus,
  playersRemaining: number,
  tableSize: number
): TournamentStatus {
  if (playersRemaining <= 0) {
    return 'complete';
  }

  if (playersRemaining === 1) {
    return 'complete';
  }

  if (playersRemaining === 2) {
    return 'heads_up';
  }

  if (playersRemaining <= tableSize) {
    return 'final_table';
  }

  return currentStatus;
}

/**
 * Check if tournament should auto-start
 */
export function shouldAutoStart(
  tournament: Tournament,
  registrations: TournamentRegistration[]
): boolean {
  // Auto-start when full
  return registrations.length >= tournament.max_players;
}

/**
 * Get tournament status display name
 */
export function getTournamentStatusDisplay(status: TournamentStatus): string {
  const displays: Record<TournamentStatus, string> = {
    registering: 'Registering',
    starting: 'Starting...',
    running: 'In Progress',
    final_table: 'Final Table',
    heads_up: 'Heads Up',
    complete: 'Complete',
    cancelled: 'Cancelled',
  };
  return displays[status];
}
