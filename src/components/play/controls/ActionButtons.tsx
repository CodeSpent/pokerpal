'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useTableStore, useIsHeroTurn, useHeroSeat } from '@/stores/table-store';
import { BetSlider } from './BetSlider';
import type { Action } from '@/types/poker';

interface ActionButtonsProps {
  onAction: (action: Action, amount?: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function ActionButtons({
  onAction,
  disabled = false,
  className,
}: ActionButtonsProps) {
  const isHeroTurn = useIsHeroTurn();
  const heroSeat = useHeroSeat();
  const { bigBlind, pot, validActions } = useTableStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(0);

  const heroStack = heroSeat?.player?.stack || 0;

  // Use server-derived valid actions
  // Note: isHeroTurn requires validActions !== null, so these fallbacks are defensive only
  const canFold = validActions?.canFold ?? false;
  const canCheck = validActions?.canCheck ?? false;
  const canCall = validActions?.canCall ?? false;
  const callAmount = validActions?.callAmount ?? 0;
  const canBet = validActions?.canBet ?? false;
  const minBetTotal = validActions?.minBet ?? bigBlind;
  const maxBetTotal = heroStack;
  const canRaise = validActions?.canRaise ?? false;
  const minRaiseTotal = validActions?.minRaise ?? bigBlind;
  const maxRaiseTotal = validActions?.maxRaise ?? heroStack;

  // Reset raise/bet amount when turn changes or validActions update
  useEffect(() => {
    if (validActions?.minRaise) {
      setRaiseAmount(validActions.minRaise);
    }
    if (validActions?.minBet) {
      setBetAmount(validActions.minBet);
    }
    setShowRaiseSlider(false);
    setShowBetSlider(false);
  }, [isHeroTurn, validActions?.minRaise, validActions?.minBet]);

  const handleAction = useCallback(
    async (action: Action, amount?: number) => {
      if (isSubmitting || disabled || !isHeroTurn) return;

      setIsSubmitting(true);
      try {
        await onAction(action, amount);
      } finally {
        setIsSubmitting(false);
        setShowRaiseSlider(false);
      }
    },
    [isSubmitting, disabled, isHeroTurn, onAction]
  );

  const handleFold = () => handleAction('fold');
  const handleCheck = () => handleAction('check');
  const handleCall = () => handleAction('call');
  const handleBet = () => handleAction('bet', betAmount);
  const handleRaise = () => handleAction('raise', raiseAmount);
  const handleAllIn = () => handleAction('all-in');

  // Keyboard shortcuts
  useEffect(() => {
    if (!isHeroTurn || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case 'f':
          handleFold();
          break;
        case 'c':
          canCheck ? handleCheck() : canCall ? handleCall() : null;
          break;
        case 'b':
          if (canBet && !canRaise) {
            setShowBetSlider(true);
          }
          break;
        case 'r':
          if (canRaise) {
            setShowRaiseSlider(true);
          } else if (canBet) {
            setShowBetSlider(true);
          }
          break;
        case 'escape':
          setShowRaiseSlider(false);
          setShowBetSlider(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHeroTurn, disabled, canCheck, canCall, canBet, canRaise]);

  // Debug output
  const { currentActorSeatIndex, heroSeatIndex: storeHeroSeatIndex } = useTableStore();

  if (!isHeroTurn) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-20 gap-1', className)}>
        <span className="text-zinc-500">Waiting for your turn...</span>
        <span className="text-xs text-zinc-600">
          (Hero: {storeHeroSeatIndex ?? 'null'}, Actor: {currentActorSeatIndex ?? 'null'})
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn('flex flex-col gap-3', className)}
    >
      {/* Raise slider */}
      {showRaiseSlider && canRaise && (
        <BetSlider
          value={raiseAmount}
          onChange={setRaiseAmount}
          min={minRaiseTotal}
          max={maxRaiseTotal}
          pot={pot}
          bigBlind={bigBlind}
          onConfirm={handleRaise}
          onCancel={() => setShowRaiseSlider(false)}
        />
      )}

      {/* Bet slider (for post-flop when no one has bet) */}
      {showBetSlider && canBet && !canRaise && (
        <BetSlider
          value={betAmount}
          onChange={setBetAmount}
          min={minBetTotal}
          max={maxBetTotal}
          pot={pot}
          bigBlind={bigBlind}
          onConfirm={handleBet}
          onCancel={() => setShowBetSlider(false)}
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-2 justify-center">
        {/* Fold */}
        <button
          onClick={handleFold}
          disabled={isSubmitting || disabled || !canFold}
          className={cn(
            'px-6 py-3 rounded-lg font-bold text-white transition-all',
            'bg-red-600 hover:bg-red-700 active:bg-red-800',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'shadow-lg hover:shadow-xl'
          )}
        >
          <span className="flex flex-col items-center">
            <span>Fold</span>
            <span className="text-xs opacity-60">(F)</span>
          </span>
        </button>

        {/* Check / Call */}
        {canCheck ? (
          <button
            onClick={handleCheck}
            disabled={isSubmitting || disabled}
            className={cn(
              'px-6 py-3 rounded-lg font-bold text-white transition-all',
              'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'shadow-lg hover:shadow-xl'
            )}
          >
            <span className="flex flex-col items-center">
              <span>Check</span>
              <span className="text-xs opacity-60">(C)</span>
            </span>
          </button>
        ) : canCall ? (
          <button
            onClick={handleCall}
            disabled={isSubmitting || disabled}
            className={cn(
              'px-6 py-3 rounded-lg font-bold text-white transition-all',
              'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'shadow-lg hover:shadow-xl'
            )}
          >
            <span className="flex flex-col items-center">
              <span>Call {callAmount.toLocaleString()}</span>
              <span className="text-xs opacity-60">(C)</span>
            </span>
          </button>
        ) : null}

        {/* Raise / Bet / All-in */}
        {canRaise ? (
          showRaiseSlider ? null : (
            <button
              onClick={() => setShowRaiseSlider(true)}
              disabled={isSubmitting || disabled}
              className={cn(
                'px-6 py-3 rounded-lg font-bold text-white transition-all',
                'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-lg hover:shadow-xl'
              )}
            >
              <span className="flex flex-col items-center">
                <span>Raise</span>
                <span className="text-xs opacity-60">(R)</span>
              </span>
            </button>
          )
        ) : canBet ? (
          showBetSlider ? null : (
            <button
              onClick={() => setShowBetSlider(true)}
              disabled={isSubmitting || disabled}
              className={cn(
                'px-6 py-3 rounded-lg font-bold text-white transition-all',
                'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-lg hover:shadow-xl'
              )}
            >
              <span className="flex flex-col items-center">
                <span>Bet</span>
                <span className="text-xs opacity-60">(B)</span>
              </span>
            </button>
          )
        ) : (
          <button
            onClick={handleAllIn}
            disabled={isSubmitting || disabled}
            className={cn(
              'px-6 py-3 rounded-lg font-bold text-white transition-all',
              'bg-gradient-to-r from-amber-600 to-red-600',
              'hover:from-amber-700 hover:to-red-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'shadow-lg hover:shadow-xl'
            )}
          >
            <span className="flex flex-col items-center">
              <span>All In</span>
              <span className="text-xs opacity-60">{heroStack.toLocaleString()}</span>
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
