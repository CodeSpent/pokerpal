'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import * as Slider from '@radix-ui/react-slider';

interface BetSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  pot: number;
  bigBlind: number;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function BetSlider({
  value,
  onChange,
  min,
  max,
  pot,
  bigBlind,
  onConfirm,
  onCancel,
  className,
}: BetSliderProps) {
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

    const numValue = parseInt(rawValue, 10);
    if (!isNaN(numValue)) {
      const clamped = Math.max(min, Math.min(max, numValue));
      onChange(clamped);
    }
  };

  const handleInputBlur = () => {
    setInputValue(value.toString());
  };

  // Quick bet buttons
  const quickBets = [
    { label: 'Min', value: min },
    { label: '1/2 Pot', value: Math.min(max, Math.floor(pot / 2) + (value - min)) },
    { label: 'Pot', value: Math.min(max, pot + (value - min)) },
    { label: 'All In', value: max },
  ];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={cn(
        'bg-zinc-800/95 rounded-lg p-4 border border-zinc-700',
        className
      )}
    >
      {/* Quick bet buttons */}
      <div className="flex gap-2 mb-4">
        {quickBets.map((bet) => (
          <button
            key={bet.label}
            onClick={() => {
              onChange(bet.value);
              setInputValue(bet.value.toString());
            }}
            className={cn(
              'flex-1 px-2 py-1.5 rounded text-sm font-medium transition-all',
              value === bet.value
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            )}
          >
            {bet.label}
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="flex items-center gap-4 mb-4">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[value]}
          onValueChange={handleSliderChange}
          min={min}
          max={max}
          step={bigBlind}
        >
          <Slider.Track className="bg-zinc-700 relative grow rounded-full h-2">
            <Slider.Range className="absolute bg-emerald-600 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb
            className={cn(
              'block w-5 h-5 bg-white rounded-full shadow-lg',
              'hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500',
              'transition-colors cursor-grab active:cursor-grabbing'
            )}
          />
        </Slider.Root>

        {/* Input field */}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className={cn(
            'w-24 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700',
            'text-right font-mono text-white',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500'
          )}
        />
      </div>

      {/* Confirm / Cancel */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className={cn(
            'flex-1 px-4 py-2 rounded font-medium transition-all',
            'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          )}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            'flex-1 px-4 py-2 rounded font-bold transition-all',
            'bg-emerald-600 text-white hover:bg-emerald-700'
          )}
        >
          Raise to {value.toLocaleString()}
        </button>
      </div>
    </motion.div>
  );
}
