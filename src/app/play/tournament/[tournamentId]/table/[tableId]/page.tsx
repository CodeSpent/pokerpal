'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useTableStore } from '@/stores/table-store';
import { useTableChannel } from '@/hooks/useTableChannel';
import { useSyncManager } from '@/hooks/useSyncManager';
import { PokerTable, TurnTimer } from '@/components/play/table';
import { ActionButtons } from '@/components/play/controls';
import type { Action } from '@/types/poker';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function TablePage({
  params,
}: {
  params: Promise<{ tournamentId: string; tableId: string }>;
}) {
  const { tournamentId, tableId } = use(params);
  const router = useRouter();

  const {
    setTableState,
    phase,
    turnExpiresAt,
    turnIsUnlimited,
    heroSeatIndex,
    currentActorSeatIndex,
    smallBlind,
    bigBlind,
    handNumber,
    isLoading,
    error,
    setLoading,
    setError,
    applyOptimisticAction,
    confirmOptimisticAction,
    rollbackOptimisticAction,
  } = useTableStore();

  const { isConnected } = useTableChannel(tableId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { error: showError, toast } = useToast();

  // Consolidated sync manager - handles all polling and state sync
  const { refreshState } = useSyncManager({ tableId, isConnected });

  // Client-side timeout trigger - auto-fold when turn expires
  useEffect(() => {
    // Skip timeout for unlimited timer
    if (turnIsUnlimited) return;

    // Only trigger timeout if it's hero's turn and we have an expiry time
    if (heroSeatIndex === null || turnExpiresAt === null) return;

    const now = Date.now();
    const timeUntilExpiry = turnExpiresAt - now;

    // If already expired, trigger immediately
    if (timeUntilExpiry <= 0) {
      const triggerTimeout = async () => {
        try {
          const res = await fetch(`/api/tables/${tableId}/timeout`, {
            method: 'POST',
          });
          const data = await res.json();
          if (data.success && data.seatIndex === heroSeatIndex) {
            toast({ description: 'Turn expired - auto-folded', variant: 'default' });
          }
        } catch (err) {
          console.error('Failed to trigger timeout:', err);
        }
      };
      triggerTimeout();
      return;
    }

    // Set a timer to trigger timeout when turn expires
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tables/${tableId}/timeout`, {
          method: 'POST',
        });
        const data = await res.json();
        if (data.success && data.seatIndex === heroSeatIndex) {
          toast({ description: 'Turn expired - auto-folded', variant: 'default' });
        }
      } catch (err) {
        console.error('Failed to trigger timeout:', err);
      }
    }, timeUntilExpiry + 500); // Add 500ms buffer to ensure server agrees turn expired

    return () => clearTimeout(timer);
  }, [tableId, heroSeatIndex, turnExpiresAt, turnIsUnlimited, toast]);

  // Handle action submission with optimistic updates
  const handleAction = useCallback(
    async (action: Action, amount?: number) => {
      if (isSubmitting || heroSeatIndex === null) return;

      setIsSubmitting(true);

      // Apply optimistic update immediately for instant UI feedback
      const actionId = applyOptimisticAction(action, amount, heroSeatIndex);

      try {
        const res = await fetch(`/api/tables/${tableId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, amount }),
        });

        const data = await res.json();

        if (!data.success) {
          // Rollback optimistic update and show error
          rollbackOptimisticAction(actionId, data.error);
          showError(data.error || 'Action failed', 'Action Error');
        } else {
          // Confirm optimistic action
          confirmOptimisticAction(actionId);
          // Force refresh to get fresh validActions for next turn
          setTimeout(() => refreshState(), 100);
        }
      } catch (err) {
        // Network error - rollback optimistic update
        rollbackOptimisticAction(actionId, 'Network error');
        console.error('Failed to submit action:', err);
        showError('Network error - please try again', 'Connection Error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [tableId, isSubmitting, heroSeatIndex, applyOptimisticAction, confirmOptimisticAction, rollbackOptimisticAction, showError, refreshState]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-zinc-400">Loading table...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/play')}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className={cn('text-sm', isConnected ? 'text-emerald-400' : 'text-red-400')}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Blind info */}
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>
              Blinds: {smallBlind}/{bigBlind}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Hand number */}
          <span className="text-zinc-500 text-sm">
            Hand #{handNumber}
          </span>

          {/* Turn timer (when it's hero's turn) */}
          {heroSeatIndex !== null && (
            <TurnTimer expiresAt={turnExpiresAt} isUnlimited={turnIsUnlimited} />
          )}
        </div>
      </header>

      {/* Main table area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <PokerTable />
      </main>

      {/* Action controls */}
      <footer className="p-4 bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto">
          <ActionButtons
            onAction={handleAction}
            disabled={isSubmitting}
          />
        </div>
      </footer>

    </div>
  );
}
