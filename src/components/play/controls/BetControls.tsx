'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import * as Slider from '@radix-ui/react-slider';

interface BetControlsProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  pot: number;
  bigBlind: number;
  onConfirm: () => void;
  onCancel: () => void;
  actionLabel?: string;
  className?: string;
}

interface QuickBet {
  label: string;
  value: number;
}

export function BetControls({
  value,
  onChange,
  min,
  max,
  pot,
  bigBlind,
  onConfirm,
  onCancel,
  actionLabel = 'Raise',
  className,
}: BetControlsProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleSliderChange = useCallback(
    (values: number[]) => {
      const newValue = values[0];
      onChange(newValue);
      setInputValue(newValue.toString());
    },
    [onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    setInputValue(rawValue);

    const parsed = parseInt(rawValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(Math.max(parsed, min), max);
      onChange(clamped);
    }
  };

  const handleInputBlur = () => {
    setInputValue(value.toString());
  };

  const handleQuickBetClick = (betValue: number) => {
    onChange(betValue);
    setInputValue(betValue.toString());
  };

  // Quick bet options
  const quickBets = useMemo<QuickBet[]>(() => {
    const bets: QuickBet[] = [];

    // Min bet
    if (min <= max) {
      bets.push({ label: 'Min', value: min });
    }

    // Half pot
    const halfPot = Math.floor(pot / 2);
    if (halfPot > min && halfPot < max) {
      bets.push({ label: '1/2', value: halfPot });
    }

    // 3/4 pot
    const threeFourthsPot = Math.floor(pot * 0.75);
    if (threeFourthsPot > min && threeFourthsPot < max) {
      bets.push({ label: '3/4', value: threeFourthsPot });
    }

    // Full pot
    if (pot > min && pot <= max) {
      bets.push({ label: 'Pot', value: pot });
    }

    // All-in
    if (max > min) {
      bets.push({ label: 'All', value: max });
    }

    return bets;
  }, [min, max, pot]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={cn('overflow-hidden', className)}
    >
      <div className="px-3 py-3 space-y-2 border-b border-surface-tertiary/50">
        {/* Row 1: Quick bets + slider + amount */}
        <div className="flex items-center gap-2">
          {/* Quick bet pills - compact */}
          <div className="flex gap-1.5 overflow-x-auto shrink-0 scrollbar-hide">
            {quickBets.map((bet) => (
              <button
                key={bet.label}
                onClick={() => handleQuickBetClick(bet.value)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium',
                  'transition-all duration-150',
                  value === bet.value
                    ? 'bg-accent-gold/90 text-surface-primary'
                    : 'bg-surface-tertiary/80 text-text-secondary hover:bg-surface-quaternary'
                )}
              >
                {bet.label}
              </button>
            ))}
          </div>

          {/* Slider - compact */}
          <Slider.Root
            className="relative flex items-center select-none touch-none flex-1 h-8 min-w-[80px]"
            value={[value]}
            onValueChange={handleSliderChange}
            min={min}
            max={max}
            step={bigBlind}
          >
            <Slider.Track className="bg-surface-tertiary relative grow rounded-full h-2">
              <Slider.Range className="absolute bg-action-raise/80 rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb
              className={cn(
                'block w-5 h-5 bg-white rounded-full shadow-md',
                'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-action-raise/50',
                'transition-transform cursor-grab active:cursor-grabbing'
              )}
            />
          </Slider.Root>

          {/* Amount input - compact */}
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className={cn(
              'w-16 px-2 py-1 rounded-md shrink-0',
              'bg-surface-tertiary/80 border border-surface-quaternary/50',
              'text-right text-sm font-mono text-accent-gold',
              'focus:outline-none focus:ring-1 focus:ring-accent-gold/40'
            )}
          />
        </div>

        {/* Row 2: Cancel + Confirm */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm',
              'bg-surface-tertiary/60 text-text-secondary font-medium',
              'hover:bg-surface-quaternary transition-colors'
            )}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm',
              'bg-action-raise/80 hover:bg-action-raise',
              'text-white font-semibold',
              'transition-colors'
            )}
          >
            {actionLabel} {value.toLocaleString()}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
