'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useTableStore } from '@/stores/table-store';
import { useTableChannel } from '@/hooks/useTableChannel';
import { useSyncManager } from '@/hooks/useSyncManager';
import { PokerTable, TurnTimer } from '@/components/play/table';
import { ActionPanel } from '@/components/play/controls';
import { submitAction, triggerTimeout } from '@/services/tableActionService';
import type { Action } from '@/types/poker';
import { Wifi, WifiOff, LogOut, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useChannel, useChannelEvent } from '@/hooks/usePusher';

export default function CashTableContent({
  params,
}: {
  params: Promise<{ cashGameId: string; tableId: string }>;
}) {
  const { cashGameId, tableId } = use(params);
  const router = useRouter();

  const {
    phase,
    turnExpiresAt,
    turnIsUnlimited,
    heroSeatIndex,
    smallBlind,
    bigBlind,
    handNumber,
    isLoading,
    error,
    applyOptimisticAction,
    confirmOptimisticAction,
    rollbackOptimisticAction,
  } = useTableStore();

  const { isConnected } = useTableChannel(tableId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isRebuying, setIsRebuying] = useState(false);
  const [showRebuyModal, setShowRebuyModal] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState(0);
  const [gameInfo, setGameInfo] = useState<{ minBuyIn: number; maxBuyIn: number; status: string } | null>(null);
  const [gameClosed, setGameClosed] = useState(false);
  const { error: showError, toast } = useToast();

  const { refreshState } = useSyncManager({ tableId, isConnected });

  // Subscribe to cash game channel for close events
  const cashGameChannel = useChannel(`cash-game-${cashGameId}`);

  const handleGameClosed = useCallback(() => {
    setGameClosed(true);
  }, []);

  useChannelEvent(cashGameChannel, 'CASH_GAME_CLOSED', handleGameClosed);

  // Fetch game info for rebuy limits
  useEffect(() => {
    fetch(`/api/cash-games/${cashGameId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.cashGame) {
          setGameInfo({
            minBuyIn: data.cashGame.minBuyIn,
            maxBuyIn: data.cashGame.maxBuyIn,
            status: data.cashGame.status,
          });
          setRebuyAmount(data.cashGame.maxBuyIn);
          if (data.cashGame.status === 'closed') {
            setGameClosed(true);
          }
        }
      })
      .catch(() => {});
  }, [cashGameId]);

  // Client-side timeout trigger
  useEffect(() => {
    if (turnIsUnlimited) return;
    if (heroSeatIndex === null || turnExpiresAt === null) return;

    const now = Date.now();
    const timeUntilExpiry = turnExpiresAt - now;

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

    const timer = setTimeout(async () => {
      try {
        const data = await triggerTimeout(tableId);
        if (data.success && data.seatIndex === heroSeatIndex) {
          toast({ description: 'Turn expired - auto-folded', variant: 'default' });
        }
      } catch (err) {
        console.error('Failed to trigger timeout:', err);
      }
    }, timeUntilExpiry + 500);

    return () => clearTimeout(timer);
  }, [tableId, heroSeatIndex, turnExpiresAt, turnIsUnlimited, toast]);

  const handleAction = useCallback(
    async (action: Action, amount?: number) => {
      if (isSubmitting || heroSeatIndex === null) return;

      setIsSubmitting(true);
      const actionId = applyOptimisticAction(action, amount, heroSeatIndex);

      try {
        const data = await submitAction(tableId, action, amount);

        if (!data.success) {
          rollbackOptimisticAction(actionId, data.error);
          showError(data.error || 'Action failed', 'Action Error');
        } else {
          confirmOptimisticAction(actionId);
          setTimeout(() => refreshState(), 100);
        }
      } catch (err) {
        rollbackOptimisticAction(actionId, 'Network error');
        console.error('Failed to submit action:', err);
        showError('Network error - please try again', 'Connection Error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [tableId, isSubmitting, heroSeatIndex, applyOptimisticAction, confirmOptimisticAction, rollbackOptimisticAction, showError, refreshState]
  );

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      const res = await fetch(`/api/cash-games/${cashGameId}/leave`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast({ description: `Cashed out ${data.cashedOut.toLocaleString()} chips`, variant: 'default' });
        router.push('/play?tab=cash');
      } else {
        showError(data.error || 'Failed to leave', 'Error');
      }
    } catch {
      showError('Failed to leave table', 'Error');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleRebuy = async () => {
    setIsRebuying(true);
    try {
      const res = await fetch(`/api/cash-games/${cashGameId}/rebuy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: rebuyAmount }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ description: `Rebuy: +${rebuyAmount.toLocaleString()} chips`, variant: 'default' });
        setShowRebuyModal(false);
        setTimeout(() => refreshState(), 200);
      } else {
        showError(data.error || 'Failed to rebuy', 'Error');
      }
    } catch {
      showError('Failed to rebuy', 'Error');
    } finally {
      setIsRebuying(false);
    }
  };

  // Check if hero can rebuy (stack is 0 or between hands)
  const heroStack = useTableStore((s) => {
    if (s.heroSeatIndex === null) return null;
    const seat = s.seats.find((seat) => seat.index === s.heroSeatIndex);
    return seat?.player?.stack ?? null;
  });
  const canRebuy = heroStack !== null && heroStack === 0 && !gameClosed;
  const isBetweenHands = phase === 'waiting' || phase === 'hand-complete';

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
            onClick={() => router.push('/play?tab=cash')}
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

          <div className="w-px h-4 bg-surface-tertiary" />

          {/* Blind info */}
          <div className="flex items-center gap-1.5 text-text-secondary text-xs">
            <span className="text-text-muted">Blinds</span>
            <span className="text-text-primary font-mono">{smallBlind}/{bigBlind}</span>
          </div>

          <div className="w-px h-4 bg-surface-tertiary" />

          <span className="text-xs text-emerald-400 font-medium">Cash Game</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Hand number */}
          <span className="text-text-muted text-xs">
            #{handNumber}
          </span>

          {/* Turn timer */}
          {heroSeatIndex !== null && (
            <TurnTimer expiresAt={turnExpiresAt} isUnlimited={turnIsUnlimited} />
          )}

          {/* Rebuy button */}
          {(canRebuy || (isBetweenHands && heroStack !== null && heroStack < (gameInfo?.maxBuyIn ?? 0))) && !gameClosed && (
            <button
              onClick={() => setShowRebuyModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Rebuy
            </button>
          )}

          {/* Leave button */}
          <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-3 h-3" />
            {isLeaving ? '...' : 'Leave'}
          </button>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 min-h-0 overflow-hidden p-2">
        <PokerTable className="h-full" />
      </main>

      {/* Action panel */}
      <ActionPanel
        onAction={handleAction}
        disabled={isSubmitting}
      />

      {/* Game Closed Overlay */}
      {gameClosed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-700 text-center max-w-sm mx-4">
            <h2 className="text-2xl font-bold text-white mb-2">Game Closed</h2>
            <p className="text-zinc-400 mb-6">
              The host has closed this cash game. Your chips have been returned to your balance.
            </p>
            <button
              onClick={() => router.push('/play?tab=cash')}
              className="w-full py-3 rounded-lg font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Rebuy Modal */}
      {showRebuyModal && gameInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700 max-w-sm mx-4 w-full">
            <h2 className="text-xl font-bold text-white mb-4">Rebuy Chips</h2>

            <input
              type="range"
              min={gameInfo.minBuyIn}
              max={gameInfo.maxBuyIn - (heroStack ?? 0)}
              step={bigBlind}
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(Number(e.target.value))}
              className="w-full mb-2 accent-emerald-500"
            />
            <div className="flex justify-between text-sm text-zinc-400 mb-6">
              <span>{gameInfo.minBuyIn.toLocaleString()}</span>
              <span className="text-white font-mono font-bold text-lg">
                {rebuyAmount.toLocaleString()}
              </span>
              <span>{(gameInfo.maxBuyIn - (heroStack ?? 0)).toLocaleString()}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRebuyModal(false)}
                className="flex-1 py-2 rounded-lg font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRebuy}
                disabled={isRebuying}
                className="flex-1 py-2 rounded-lg font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isRebuying ? 'Buying...' : `Buy ${rebuyAmount.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
