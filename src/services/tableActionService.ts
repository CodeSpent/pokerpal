/**
 * Table Action Service
 *
 * Centralizes all table-related API calls.
 * Components should use this service instead of making direct fetch calls.
 */

import type { Action } from '@/types/poker';

export interface ActionResult {
  success: boolean;
  error?: string;
  events?: unknown[];
  hand?: unknown;
  version?: number;
}

export interface TimeoutResult {
  success: boolean;
  message?: string;
  seatIndex?: number;
  error?: string;
}

/**
 * Submit a player action (fold, check, call, bet, raise)
 */
export async function submitAction(
  tableId: string,
  action: Action,
  amount?: number
): Promise<ActionResult> {
  const res = await fetch(`/api/tables/${tableId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, amount }),
  });
  return res.json();
}

/**
 * Trigger a timeout for the current actor
 * Called when turn timer expires
 */
export async function triggerTimeout(tableId: string): Promise<TimeoutResult> {
  const res = await fetch(`/api/tables/${tableId}/timeout`, {
    method: 'POST',
  });
  return res.json();
}

/**
 * Fetch current table state
 */
export async function fetchTableState(tableId: string): Promise<{
  table?: unknown;
  heroSeatIndex?: number;
  validActions?: unknown;
  error?: string;
}> {
  const res = await fetch(`/api/tables/${tableId}`);
  return res.json();
}
