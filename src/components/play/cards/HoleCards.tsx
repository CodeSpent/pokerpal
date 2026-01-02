'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Card } from '@/types/poker';
import { isCardHighlighted } from '@/lib/card-utils';
import { PlayingCard } from './PlayingCard';
import { CardBack } from './CardBack';

interface HoleCardsProps {
  cards?: [Card, Card];
  isHero?: boolean;
  isFolded?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isDealing?: boolean;
  highlightedCards?: Card[]; // Cards that should be highlighted (part of winning hand)
  className?: string;
}

export function HoleCards({
  cards,
  isHero = false,
  isFolded = false,
  size = 'md',
  isDealing = false,
  highlightedCards,
  className,
}: HoleCardsProps) {
  if (isFolded) {
    return (
      <motion.div
        animate={{ opacity: 0.4, scale: 0.9 }}
        className={cn('flex gap-0.5', className)}
      >
        <CardBack size={size} />
        <CardBack size={size} className="-ml-4" />
      </motion.div>
    );
  }

  // Show card backs if no cards or not hero
  if (!cards || (!isHero && !cards)) {
    return (
      <div className={cn('flex', className)}>
        <CardBack size={size} />
        <CardBack size={size} className="-ml-4" />
      </div>
    );
  }

  // Show actual cards
  return (
    <div className={cn('flex', className)}>
      <PlayingCard
        card={cards[0]}
        size={size}
        isDealing={isDealing}
        dealDelay={0}
        highlighted={isCardHighlighted(cards[0], highlightedCards)}
      />
      <PlayingCard
        card={cards[1]}
        size={size}
        isDealing={isDealing}
        dealDelay={0.1}
        highlighted={isCardHighlighted(cards[1], highlightedCards)}
        className="-ml-4"
      />
    </div>
  );
}
