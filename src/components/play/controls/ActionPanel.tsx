'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useTableStore, useIsHeroTurn, useHeroSeat } from '@/stores/table-store';
import { useActionKeyboardShortcuts } from '@/hooks/useActionKeyboardShortcuts';
import { ActionButton } from './ActionButton';
import { BetControls } from './BetControls';
import { HoleCards } from '../cards/HoleCards';
import type { Action } from '@/types/poker';

interface ActionPanelProps {
  onAction: (action: Action, amount?: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

type BetMode = 'buttons' | 'raise' | 'bet';

// Phases where no actions should be possible
const NO_ACTION_PHASES = ['showdown', 'awarding', 'hand-complete', 'waiting', 'tournament-complete'];

export function ActionPanel({
  onAction,
  disabled = false,
  className,
}: ActionPanelProps) {
  const isHeroTurn = useIsHeroTurn();
  const heroSeat = useHeroSeat();
  const { bigBlind, pot, validActions, phase } = useTableStore();

  // Never show actions during terminal phases
  const isTerminalPhase = NO_ACTION_PHASES.includes(phase);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [betMode, setBetMode] = useState<BetMode>('buttons');
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(0);

  const heroStack = heroSeat?.player?.stack || 0;

  // Valid actions from server
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

  // Reset amounts when turn changes
  useEffect(() => {
    if (validActions?.minRaise) {
      setRaiseAmount(validActions.minRaise);
    }
    if (validActions?.minBet) {
      setBetAmount(validActions.minBet);
    }
    setBetMode('buttons');
  }, [isHeroTurn, validActions?.minRaise, validActions?.minBet]);

  const handleAction = useCallback(
    async (action: Action, amount?: number) => {
      if (isSubmitting || disabled || !isHeroTurn) return;

      setIsSubmitting(true);
      try {
        await onAction(action, amount);
      } finally {
        setIsSubmitting(false);
        setBetMode('buttons');
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
  useActionKeyboardShortcuts({
    isEnabled: isHeroTurn && !disabled && betMode === 'buttons',
    onFold: handleFold,
    onCheck: handleCheck,
    onCall: handleCall,
    onShowBet: () => setBetMode('bet'),
    onShowRaise: () => setBetMode('raise'),
    onCancel: () => setBetMode('buttons'),
    canCheck,
    canCall,
    canBet,
    canRaise,
  });

  const heroCards = heroSeat?.player?.holeCards;

  // Terminal phase - show phase-specific message
  if (isTerminalPhase) {
    const phaseMessages: Record<string, string> = {
      showdown: 'Showdown',
      awarding: 'Awarding pot',
      'hand-complete': 'Next hand...',
      waiting: 'Waiting...',
      'tournament-complete': 'Complete!',
    };
    const phaseMessage = phaseMessages[phase] || 'Please wait...';

    return (
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'glass border-t border-surface-tertiary/50',
          'pb-safe',
          className
        )}
      >
        <div className="flex items-stretch">
          <div className="w-[72px] shrink-0 flex items-center justify-center py-2 border-r border-surface-tertiary/30">
            {heroCards ? (
              <HoleCards cards={heroCards} isHero={true} size="sm" />
            ) : (
              <div className="w-[56px] h-[56px] rounded bg-surface-tertiary/30" />
            )}
          </div>
          <div className="flex-1 flex items-center justify-center py-4">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-text-muted text-sm"
            >
              {phaseMessage}
            </motion.span>
          </div>
        </div>
      </div>
    );
  }

  // Waiting state - not hero's turn
  if (!isHeroTurn) {
    return (
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'glass border-t border-surface-tertiary/50',
          'pb-safe',
          className
        )}
      >
        <div className="flex items-stretch">
          <div className="w-[72px] shrink-0 flex items-center justify-center py-2 border-r border-surface-tertiary/30">
            {heroCards ? (
              <HoleCards cards={heroCards} isHero={true} size="sm" />
            ) : (
              <div className="w-[56px] h-[56px] rounded bg-surface-tertiary/30" />
            )}
          </div>
          <div className="flex-1 flex items-center justify-center py-4">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-text-muted text-sm"
            >
              Waiting for your turn...
            </motion.span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'glass border-t border-surface-tertiary/50',
        'pb-safe',
        className
      )}
    >
      {/* Main layout: Cards | Controls */}
      <div className="flex items-stretch">
        {/* Hole cards - fixed width left section */}
        <div className="w-[72px] shrink-0 flex items-center justify-center py-2 border-r border-surface-tertiary/30">
          {heroCards ? (
            <HoleCards
              cards={heroCards}
              isHero={true}
              size="sm"
            />
          ) : (
            <div className="w-[56px] h-[56px] rounded bg-surface-tertiary/30" />
          )}
        </div>

        {/* Controls section */}
        <div className="flex-1 min-w-0">
          {/* Bet/Raise slider - inline when active */}
          <AnimatePresence mode="wait">
            {betMode === 'raise' && canRaise ? (
              <BetControls
                key="raise"
                value={raiseAmount}
                onChange={setRaiseAmount}
                min={minRaiseTotal}
                max={maxRaiseTotal}
                pot={pot}
                bigBlind={bigBlind}
                onConfirm={handleRaise}
                onCancel={() => setBetMode('buttons')}
                actionLabel="Raise"
              />
            ) : betMode === 'bet' && canBet && !canRaise ? (
              <BetControls
                key="bet"
                value={betAmount}
                onChange={setBetAmount}
                min={minBetTotal}
                max={maxBetTotal}
                pot={pot}
                bigBlind={bigBlind}
                onConfirm={handleBet}
                onCancel={() => setBetMode('buttons')}
                actionLabel="Bet"
              />
            ) : (
              /* Main action buttons */
              <motion.div
                key="buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 py-2 flex gap-2"
              >
                {/* Fold */}
                <ActionButton
                  label="Fold"
                  onClick={handleFold}
                  disabled={isSubmitting || disabled || !canFold}
                  variant="fold"
                  shortcut="F"
                />

                {/* Check or Call */}
                {canCheck ? (
                  <ActionButton
                    label="Check"
                    onClick={handleCheck}
                    disabled={isSubmitting || disabled}
                    variant="check"
                    shortcut="C"
                  />
                ) : canCall ? (
                  <ActionButton
                    label="Call"
                    amount={callAmount}
                    onClick={handleCall}
                    disabled={isSubmitting || disabled}
                    variant="check"
                  />
                ) : (
                  <div className="flex-1" />
                )}

                {/* Raise/Bet/All-in */}
                {canRaise ? (
                  <ActionButton
                    label="Raise"
                    onClick={() => setBetMode('raise')}
                    disabled={isSubmitting || disabled}
                    variant="raise"
                    shortcut="R"
                  />
                ) : canBet ? (
                  <ActionButton
                    label="Bet"
                    onClick={() => setBetMode('bet')}
                    disabled={isSubmitting || disabled}
                    variant="raise"
                    shortcut="B"
                  />
                ) : (
                  <ActionButton
                    label="All In"
                    amount={heroStack}
                    onClick={handleAllIn}
                    disabled={isSubmitting || disabled}
                    variant="raise"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
