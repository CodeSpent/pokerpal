'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Card } from '@/types/poker';
import { SUIT_SYMBOLS } from '@/types/poker';

interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  isDealing?: boolean;
  dealDelay?: number;
  highlighted?: boolean; // Adds golden glow for winning cards
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-11 text-xs',
  md: 'w-12 h-16 text-sm',
  lg: 'w-16 h-22 text-base',
};

const suitColors: Record<string, string> = {
  h: 'text-red-500',
  d: 'text-blue-500',
  c: 'text-emerald-500',
  s: 'text-zinc-400',
};

export function PlayingCard({
  card,
  size = 'md',
  isDealing = false,
  dealDelay = 0,
  highlighted = false,
  className,
}: PlayingCardProps) {
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  return (
    <motion.div
      initial={isDealing ? { x: 200, y: -100, rotateY: 180, opacity: 0 } : false}
      animate={{
        x: 0,
        y: 0,
        rotateY: 0,
        opacity: 1,
        scale: highlighted ? 1.05 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        delay: dealDelay,
      }}
      className={cn(
        sizeClasses[size],
        'relative rounded-lg bg-white shadow-lg flex flex-col items-center justify-center font-bold select-none',
        'border border-zinc-200',
        highlighted && 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)]',
        className
      )}
      style={{ perspective: 1000 }}
    >
      {/* Rank at top-left */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className={cn('font-bold', suitColors[card.suit])}>{card.rank}</span>
        <span className={cn('text-[0.7em]', suitColors[card.suit])}>{suitSymbol}</span>
      </div>

      {/* Center suit */}
      <span className={cn('text-2xl', suitColors[card.suit])}>{suitSymbol}</span>

      {/* Rank at bottom-right (inverted) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span className={cn('font-bold', suitColors[card.suit])}>{card.rank}</span>
        <span className={cn('text-[0.7em]', suitColors[card.suit])}>{suitSymbol}</span>
      </div>
    </motion.div>
  );
}
