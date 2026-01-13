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
  dealOrigin?: { x: number; y: number };
  highlighted?: boolean;
  className?: string;
}

// Improved sizes for better touch and visibility
const cardSizes = {
  sm: { width: 40, height: 56, rankSize: 'text-xs', suitSize: 'text-lg' },
  md: { width: 52, height: 73, rankSize: 'text-sm', suitSize: 'text-2xl' },
  lg: { width: 64, height: 90, rankSize: 'text-base', suitSize: 'text-3xl' },
};

// Using the design system card colors
const suitColors: Record<string, string> = {
  h: 'text-card-hearts',
  d: 'text-card-diamonds',
  c: 'text-card-clubs',
  s: 'text-card-spades',
};

export function PlayingCard({
  card,
  size = 'md',
  isDealing = false,
  dealDelay = 0,
  dealOrigin,
  highlighted = false,
  className,
}: PlayingCardProps) {
  // Guard against invalid cards - show placeholder if rank/suit missing
  if (!card?.rank || !card?.suit) {
    const cardSize = cardSizes[size];
    return (
      <div
        className={cn(
          'relative rounded-lg shadow-sm flex items-center justify-center',
          'bg-surface-tertiary/60',
          'border border-surface-quaternary/50',
          className
        )}
        style={{
          width: cardSize.width,
          height: cardSize.height,
        }}
      >
        <span className="text-text-muted/40 text-xs">?</span>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const cardSize = cardSizes[size];

  // Calculate initial position for dealing animation
  const initialX = dealOrigin?.x ?? 150;
  const initialY = dealOrigin?.y ?? -200;

  return (
    <motion.div
      initial={isDealing ? {
        x: initialX,
        y: initialY,
        rotateY: 180,
        rotateZ: Math.random() * 6 - 3, // Slight random tilt
        scale: 0.5,
        opacity: 0,
      } : false}
      animate={{
        x: 0,
        y: 0,
        rotateY: 0,
        rotateZ: 0,
        scale: highlighted ? 1.05 : 1,
        opacity: 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 25,
        delay: dealDelay,
        rotateY: { duration: 0.4, delay: dealDelay },
      }}
      className={cn(
        'relative rounded-lg shadow-md flex flex-col items-center justify-center font-bold select-none',
        // Clean white background
        'bg-gradient-to-br from-white to-zinc-50',
        'border border-zinc-200/80',
        // Highlighted state (winning cards)
        highlighted && 'ring-1 ring-accent-gold/60 shadow-[0_0_8px_rgba(201,169,98,0.3)]',
        className
      )}
      style={{
        width: cardSize.width,
        height: cardSize.height,
        perspective: 1000,
      }}
    >
      {/* Rank at top-left */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className={cn('font-bold', cardSize.rankSize, suitColors[card.suit])}>
          {card.rank}
        </span>
        <span className={cn('text-[0.6em]', suitColors[card.suit])}>
          {suitSymbol}
        </span>
      </div>

      {/* Center suit - larger and more prominent */}
      <span className={cn(cardSize.suitSize, suitColors[card.suit])}>
        {suitSymbol}
      </span>

      {/* Rank at bottom-right (inverted) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span className={cn('font-bold', cardSize.rankSize, suitColors[card.suit])}>
          {card.rank}
        </span>
        <span className={cn('text-[0.6em]', suitColors[card.suit])}>
          {suitSymbol}
        </span>
      </div>

      {/* Subtle inner shadow for depth */}
      <div className="absolute inset-0 rounded-lg shadow-inner pointer-events-none" />
    </motion.div>
  );
}
