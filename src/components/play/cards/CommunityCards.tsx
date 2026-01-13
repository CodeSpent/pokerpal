'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Card } from '@/types/poker';
import { isCardHighlighted } from '@/lib/card-utils';
import { PlayingCard } from './PlayingCard';

interface CommunityCardsProps {
  cards: Card[];
  highlightedCards?: Card[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Empty slot sizes to match card sizes
const emptySlotSizes = {
  sm: 'w-10 h-14',
  md: 'w-[52px] h-[73px]',
  lg: 'w-16 h-[90px]',
};

export function CommunityCards({
  cards,
  highlightedCards,
  size = 'md',
  className,
}: CommunityCardsProps) {
  // Always show 5 card slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] || null);

  // Calculate deal delay based on card position
  const getDealDelay = (index: number): number => {
    // Flop cards (0-2): stagger them
    if (index < 3 && cards.length >= 3) {
      return index * 0.15;
    }
    // Turn (index 3) and River (index 4): instant
    return 0;
  };

  return (
    <div className={cn('flex gap-2 justify-center items-center', className)}>
      <AnimatePresence mode="popLayout">
        {slots.map((card, index) => (
          <motion.div
            key={card ? `${card.rank}${card.suit}` : `empty-${index}`}
            initial={false}
            layout
          >
            {card ? (
              <PlayingCard
                card={card}
                size={size}
                isDealing={true}
                dealDelay={getDealDelay(index)}
                highlighted={isCardHighlighted(card, highlightedCards)}
              />
            ) : (
              <div
                className={cn(
                  'rounded-lg border border-dashed border-surface-tertiary/20',
                  emptySlotSizes[size]
                )}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
