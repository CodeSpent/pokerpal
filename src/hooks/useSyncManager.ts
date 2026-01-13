'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTableStore } from '@/stores/table-store';

interface SyncManagerOptions {
  tableId: string;
  isConnected: boolean;
}

/**
 * Event-driven sync manager
 *
 * Fetches state:
 * 1. On initial mount
 * 2. On Pusher reconnection (to catch up on missed events)
 *
 * All other state updates come via Pusher events.
 * validActions now comes via TURN_STARTED events, not from HTTP fetch.
 */
export function useSyncManager({ tableId, isConnected }: SyncManagerOptions) {
  const { setTableState, setLoading, setError } = useTableStore();
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
      }
    } catch (err) {
      console.error('[useSyncManager] Fetch error:', err);
    }
  }, [tableId, setTableState]);

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
  }, [tableId, setTableState, setLoading, setError]);

  // Fetch on reconnection (when isConnected goes false -> true)
  useEffect(() => {
    if (previouslyConnected.current === false && isConnected === true) {
      console.log('[useSyncManager] Reconnected, fetching state');
      refreshState();
    }
    previouslyConnected.current = isConnected;
  }, [isConnected, refreshState]);

  return { refreshState };
}
