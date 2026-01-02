'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTableStore } from '@/stores/table-store';

interface SyncManagerOptions {
  tableId: string;
  isConnected: boolean;
}

// Polling intervals
const POLL_CONNECTED = 2000;     // 2s when Pusher working (check for validActions)
const POLL_DISCONNECTED = 500;   // 500ms when Pusher down (fast sync)

/**
 * Consolidated sync manager for table state
 * Replaces fragmented polling with smart sync logic:
 * - Polls frequently when Pusher disconnected
 * - Polls regularly when connected to get fresh validActions
 * - Full state refresh on sync
 */
export function useSyncManager({ tableId, isConnected }: SyncManagerOptions) {
  const {
    setTableState,
    phase,
    setLoading,
    setError,
  } = useTableStore();

  const lastFetchRef = useRef<number>(0);

  // Full state refresh
  const refreshState = useCallback(async () => {
    const now = Date.now();
    // Don't spam the server - minimum 300ms between fetches
    if (now - lastFetchRef.current < 300) return;
    lastFetchRef.current = now;

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
      // Ignore errors - will retry on next poll
    }
  }, [tableId, setTableState]);

  // Main polling effect - simple interval-based polling
  useEffect(() => {
    const interval = isConnected ? POLL_CONNECTED : POLL_DISCONNECTED;

    const pollTimer = setInterval(() => {
      refreshState();
    }, interval);

    return () => clearInterval(pollTimer);
  }, [isConnected, refreshState]);

  // Subscribe to showdown lock state
  const newHandLockedUntil = useTableStore((s) => s.newHandLockedUntil);

  // Track when showdown lock expires to trigger fast polling
  const [lockExpired, setLockExpired] = useState(false);

  // Set timer to mark lock as expired
  useEffect(() => {
    if (!newHandLockedUntil) {
      setLockExpired(false);
      return;
    }

    const now = Date.now();
    const timeUntilExpiry = newHandLockedUntil - now;

    if (timeUntilExpiry <= 0) {
      setLockExpired(true);
      return;
    }

    const timer = setTimeout(() => {
      setLockExpired(true);
    }, timeUntilExpiry);

    return () => clearTimeout(timer);
  }, [newHandLockedUntil]);

  // Poll more frequently during showdown/hand-complete to catch new hand
  // BUT respect the showdown lock period - don't fast-poll while displaying showdown
  useEffect(() => {
    if (phase !== 'showdown' && phase !== 'hand-complete' && phase !== 'awarding') {
      return;
    }

    // During showdown lock, don't fast-poll to avoid overwriting showdown display
    if (newHandLockedUntil && !lockExpired) {
      return;
    }

    // After lock expires (or for hand-complete/awarding), poll frequently to catch new hand
    const fastPoll = setInterval(() => {
      refreshState();
    }, 1000);

    return () => clearInterval(fastPoll);
  }, [phase, refreshState, newHandLockedUntil, lockExpired]);

  // Initial fetch on mount with loading state
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

  return { refreshState };
}
