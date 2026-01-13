/**
 * Turn Timeout Handler
 *
 * Handles auto-folding players who time out on their turn
 */

import { getDatabase } from '../db/connection';
import { submitAction } from './submit-action';
import type { Hand, TablePlayer, ApiResult } from '../types';

export interface TimeoutResult {
  success: boolean;
  playerId?: string;
  seatIndex?: number;
  error?: string;
}

/**
 * Handle a turn timeout for a table
 * Force-folds the current actor if their turn has expired
 */
export function handleTurnTimeout(tableId: string): ApiResult<TimeoutResult> {
  const db = getDatabase();

  try {
    // Get current hand
    const hand = db.prepare(`
      SELECT * FROM hands
      WHERE table_id = ? AND phase NOT IN ('complete', 'awarding')
      ORDER BY hand_number DESC
      LIMIT 1
    `).get(tableId) as Hand | undefined;

    if (!hand) {
      return { success: false, error: 'No active hand', code: 'NO_ACTIVE_HAND' };
    }

    // Check if there's a current actor
    if (hand.current_actor_seat === null || hand.current_actor_seat === undefined) {
      return { success: false, error: 'No current actor', code: 'NO_ACTOR' };
    }

    // Check for unlimited timer (action_deadline is null)
    if (hand.action_deadline === null || hand.action_deadline === undefined) {
      return { success: false, error: 'Unlimited timer - no timeout', code: 'UNLIMITED_TIMER' };
    }

    // Check if the turn has actually expired
    const now = Date.now();
    if (now < hand.action_deadline) {
      return { success: false, error: 'Turn has not expired yet', code: 'NOT_EXPIRED' };
    }

    // Get the current actor
    const player = db.prepare(`
      SELECT tp.*, p.name
      FROM table_players tp
      JOIN players p ON tp.player_id = p.id
      WHERE tp.table_id = ? AND tp.seat_index = ?
    `).get(tableId, hand.current_actor_seat) as TablePlayer | undefined;

    if (!player) {
      return { success: false, error: 'Current actor not found', code: 'ACTOR_NOT_FOUND' };
    }

    // Force-fold the player (bypass expiry since this IS the timeout handler)
    const result = submitAction({
      tableId,
      playerId: player.player_id,
      action: 'fold',
      amount: 0,
      bypassExpiry: true,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to auto-fold player' };
    }

    return {
      success: true,
      data: {
        success: true,
        playerId: player.player_id,
        seatIndex: player.seat_index,
      },
    };
  } catch (error) {
    console.error('[handleTurnTimeout] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Timeout handling failed',
    };
  }
}

/**
 * Check for any expired turns across all active tables
 * Returns the table IDs that had timeouts processed
 */
export function checkAllTablesForTimeouts(): string[] {
  const db = getDatabase();
  const now = Date.now();
  const processedTables: string[] = [];

  try {
    // Find all hands with expired turns
    const expiredHands = db.prepare(`
      SELECT h.*, t.id as table_id
      FROM hands h
      JOIN tables t ON h.table_id = t.id
      WHERE h.phase NOT IN ('complete', 'awarding', 'showdown')
        AND h.action_deadline IS NOT NULL
        AND h.action_deadline < ?
        AND h.current_actor_seat IS NOT NULL
    `).all(now) as (Hand & { table_id: string })[];

    for (const hand of expiredHands) {
      const result = handleTurnTimeout(hand.table_id);
      if (result.success) {
        processedTables.push(hand.table_id);
        console.log(`[checkAllTablesForTimeouts] Auto-folded player at table ${hand.table_id}`);
      }
    }

    return processedTables;
  } catch (error) {
    console.error('[checkAllTablesForTimeouts] Error:', error);
    return processedTables;
  }
}
