'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTableStore } from '@/stores/table-store';

interface SyncManagerOptions {
  tableId: string;
  isConnected: boolean;
}

// Terminal phases where we need to poll for new hand start
// (serverless setTimeout may not execute, so we poll to trigger advanceGameState)
// Note: 'tournament-complete' is NOT included - no need to poll when tournament is over
const TERMINAL_PHASES = ['hand-complete', 'awarding', 'showdown', 'waiting'];

/**
 * Event-driven sync manager
 *
 * Fetches state:
 * 1. On initial mount
 * 2. On Pusher reconnection (to catch up on missed events)
 * 3. When in terminal phase (to trigger new hand via advanceGameState)
 *
 * All other state updates come via Pusher events.
 * validActions now comes via TURN_STARTED events, not from HTTP fetch.
 */
export function useSyncManager({ tableId, isConnected }: SyncManagerOptions) {
  const { setTableState, setLoading, setError, setTournamentWinner, phase, tournamentWinner } = useTableStore();
  const previouslyConnected = useRef<boolean | null>(null);

  // Fetch current state from server
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${tableId}`);
      const data = await res.json();
      if (data.table) {
        setTableState(
          data.table,
          data.heroSeatIndex,
          data.table.version,
          undefined,
          data.validActions
        );
        // Set tournament winner from HTTP response (important for page refresh after tournament ends)
        if (data.tournamentWinner) {
          setTournamentWinner(data.tournamentWinner);
        }
      }
    } catch (err) {
      console.error('[useSyncManager] Fetch error:', err);
    }
  }, [tableId, setTableState, setTournamentWinner]);

  // Initial fetch on mount
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    const initialFetch = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tables/${tableId}`);
        const data = await res.json();
        if (data.table) {
          setTableState(
            data.table,
            data.heroSeatIndex,
            data.table.version,
            undefined,
            data.validActions
          );
          // Set tournament winner from HTTP response (important for page refresh after tournament ends)
          if (data.tournamentWinner) {
            setTournamentWinner(data.tournamentWinner);
          }
        } else {
          setError(data.error || 'Failed to load table');
        }
      } catch (err) {
        setError('Failed to load table');
      } finally {
        setLoading(false);
      }
    };

    initialFetch();
  }, [tableId, setTableState, setTournamentWinner, setLoading, setError]);

  // Fetch on reconnection (when isConnected goes false -> true)
  useEffect(() => {
    if (previouslyConnected.current === false && isConnected === true) {
      console.log('[useSyncManager] Reconnected, fetching state');
      refreshState();
    }
    previouslyConnected.current = isConnected;
  }, [isConnected, refreshState]);

  // Poll when in terminal phase to trigger new hand via server's advanceGameState
  // This handles cases where serverless setTimeout doesn't execute
  useEffect(() => {
    // Don't poll if tournament is complete
    if (tournamentWinner || phase === 'tournament-complete') {
      console.log('[useSyncManager] Tournament complete, stopping poll');
      return;
    }

    if (!TERMINAL_PHASES.includes(phase)) return;

    console.log(`[useSyncManager] In terminal phase "${phase}", starting poll for new hand`);

    // Poll every 2 seconds while in terminal phase
    const pollInterval = setInterval(() => {
      console.log(`[useSyncManager] Polling to trigger new hand (phase: ${phase})`);
      refreshState();
    }, 2000);

    // Also do an immediate fetch after a short delay
    const initialPoll = setTimeout(() => {
      refreshState();
    }, 500);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(initialPoll);
    };
  }, [phase, refreshState, tournamentWinner]);

  return { refreshState };
}
