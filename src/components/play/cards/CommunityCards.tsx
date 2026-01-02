'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Card } from '@/types/poker';
import { isCardHighlighted } from '@/lib/card-utils';
import { PlayingCard } from './PlayingCard';

interface CommunityCardsProps {
  cards: Card[];
  highlightedCards?: Card[];
  className?: string;
}

export function CommunityCards({ cards, highlightedCards, className }: CommunityCardsProps) {
  // Always show 5 card slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] || null);

  return (
    <div className={cn('flex gap-2 justify-center', className)}>
      <AnimatePresence mode="popLayout">
        {slots.map((card, index) => (
          <motion.div
            key={index}
            initial={false}
            layout
          >
            {card ? (
              <PlayingCard
                card={card}
                size="lg"
                isDealing={true}
                dealDelay={
                  // Stagger flop cards, instant for turn/river
                  index < 3 ? index * 0.15 : 0
                }
                highlighted={isCardHighlighted(card, highlightedCards)}
              />
            ) : (
              <div className="w-16 h-22 rounded-lg border-2 border-dashed border-zinc-700 opacity-30" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
