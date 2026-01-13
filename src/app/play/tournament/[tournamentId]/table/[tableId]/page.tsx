'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useTableStore } from '@/stores/table-store';
import { useTableChannel } from '@/hooks/useTableChannel';
import { useSyncManager } from '@/hooks/useSyncManager';
import { PokerTable, TurnTimer } from '@/components/play/table';
import { ActionPanel } from '@/components/play/controls';
import { TournamentCompleteOverlay } from '@/components/play/overlays';
import { submitAction, triggerTimeout } from '@/services/tableActionService';
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
      const handleTimeout = async () => {
        try {
          const data = await triggerTimeout(tableId);
          if (data.success && data.seatIndex === heroSeatIndex) {
            toast({ description: 'Turn expired - auto-folded', variant: 'default' });
          }
        } catch (err) {
          console.error('Failed to trigger timeout:', err);
        }
      };
      handleTimeout();
      return;
    }

    // Set a timer to trigger timeout when turn expires
    const timer = setTimeout(async () => {
      try {
        const data = await triggerTimeout(tableId);
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
        const data = await submitAction(tableId, action, amount);

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
      <div className="h-[calc(100dvh-11.5rem)] flex items-center justify-center bg-surface-primary">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-text-muted">Loading table...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100dvh-11.5rem)] flex items-center justify-center bg-surface-primary">
        <div className="text-center">
          <p className="text-xl text-action-fold mb-4">{error}</p>
          <button
            onClick={() => router.push('/play')}
            className="text-accent-gold hover:text-accent-goldBright transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-11.5rem)] flex flex-col bg-surface-primary overflow-hidden">
      {/* Compact Header */}
      <header className="h-12 shrink-0 flex items-center justify-between px-4 bg-surface-secondary border-b border-surface-tertiary">
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-accent-gold" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-action-fold" />
            )}
            <span className={cn('text-xs', isConnected ? 'text-accent-gold' : 'text-action-fold')}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-surface-tertiary" />

          {/* Blind info */}
          <div className="flex items-center gap-1.5 text-text-secondary text-xs">
            <span className="text-text-muted">Blinds</span>
            <span className="text-text-primary font-mono">{smallBlind}/{bigBlind}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Hand number */}
          <span className="text-text-muted text-xs">
            #{handNumber}
          </span>

          {/* Turn timer (when it's hero's turn) */}
          {heroSeatIndex !== null && (
            <TurnTimer expiresAt={turnExpiresAt} isUnlimited={turnIsUnlimited} />
          )}
        </div>
      </header>

      {/* Main game area - takes remaining space above action panel */}
      <main className="flex-1 min-h-0 overflow-hidden p-2">
        <PokerTable className="h-full" />
      </main>

      {/* Fixed bottom action panel */}
      <ActionPanel
        onAction={handleAction}
        disabled={isSubmitting}
      />

      {/* Tournament complete overlay */}
      <TournamentCompleteOverlay tournamentId={tournamentId} />
    </div>
  );
}
