'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Card } from '@/types/poker';
import { isCardHighlighted } from '@/lib/card-utils';
import { PlayingCard } from './PlayingCard';
import { CardBack } from './CardBack';
import { Eye, EyeOff } from 'lucide-react';

// Fixed container sizes: width = (card width * 2) - overlap, height = card height
// Overlap is 16px (-ml-4)
const CONTAINER_SIZES = {
  sm: { width: 64, height: 56 },   // (40 * 2) - 16
  md: { width: 88, height: 73 },   // (52 * 2) - 16
  lg: { width: 112, height: 90 },  // (64 * 2) - 16
};

interface HoleCardsProps {
  cards?: [Card, Card];
  isHero?: boolean;
  isFolded?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isDealing?: boolean;
  highlightedCards?: Card[]; // Cards that should be highlighted (part of winning hand)
  className?: string;
  // Peek functionality (for hero only)
  isPeeking?: boolean;
  onPeekToggle?: () => void;
  canPeek?: boolean;
  // Revealed to opponents (for non-hero display)
  revealedCards?: [Card | null, Card | null];
}

export function HoleCards({
  cards,
  isHero = false,
  isFolded = false,
  size = 'md',
  isDealing = false,
  highlightedCards,
  className,
  isPeeking = false,
  onPeekToggle,
  canPeek = false,
  revealedCards,
}: HoleCardsProps) {
  const containerSize = CONTAINER_SIZES[size];

  // Determine what cards to show for each position
  // For hero: show cards when peeking, otherwise backs
  // For opponent: show revealedCards if provided, otherwise backs (unless they have cards in showdown)
  const getCardDisplay = (index: 0 | 1): { showFace: boolean; card: Card | null } => {
    // Check if this card was revealed to opponents
    if (revealedCards && revealedCards[index]) {
      return { showFace: true, card: revealedCards[index] };
    }

    // Hero sees their cards when peeking or in certain states
    if (isHero && cards && cards[index]) {
      // Show face when peeking (local view) or when cards should be revealed (showdown etc)
      const showFace = isPeeking || (!canPeek && !isFolded);
      return { showFace, card: cards[index] };
    }

    // Non-hero with actual card data (e.g., showdown reveal)
    if (!isHero && cards && cards[index]) {
      return { showFace: true, card: cards[index] };
    }

    return { showFace: false, card: null };
  };

  const card0Display = getCardDisplay(0);
  const card1Display = getCardDisplay(1);

  // Wrapper for fixed sizing
  return (
    <motion.div
      animate={isFolded ? { opacity: 0.4, scale: 0.9 } : { opacity: 1, scale: 1 }}
      className={cn('relative', className)}
      style={{
        width: containerSize.width,
        height: containerSize.height,
      }}
    >
      {/* Card container with absolute positioning */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* First card */}
        <div className="relative" style={{ zIndex: 1 }}>
          <CardWithFlip
            showFace={card0Display.showFace}
            card={card0Display.card}
            size={size}
            isDealing={isDealing}
            dealDelay={0}
            highlighted={card0Display.card ? isCardHighlighted(card0Display.card, highlightedCards) : false}
          />
        </div>

        {/* Second card (overlapped) */}
        <div className="relative -ml-4" style={{ zIndex: 2 }}>
          <CardWithFlip
            showFace={card1Display.showFace}
            card={card1Display.card}
            size={size}
            isDealing={isDealing}
            dealDelay={0.1}
            highlighted={card1Display.card ? isCardHighlighted(card1Display.card, highlightedCards) : false}
          />
        </div>
      </div>

      {/* Peek toggle button for hero */}
      {canPeek && onPeekToggle && !isFolded && (
        <button
          onClick={onPeekToggle}
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center',
            'transition-opacity duration-200',
            isPeeking ? 'opacity-0 hover:opacity-100' : 'opacity-100'
          )}
        >
          <div
            className={cn(
              'p-1.5 rounded-full',
              'bg-surface-primary/80 backdrop-blur-sm',
              'border border-surface-tertiary/50',
              'shadow-sm'
            )}
          >
            {isPeeking ? (
              <EyeOff className="w-4 h-4 text-text-muted" />
            ) : (
              <Eye className="w-4 h-4 text-text-secondary" />
            )}
          </div>
        </button>
      )}
    </motion.div>
  );
}

// Helper component for card flip animation
function CardWithFlip({
  showFace,
  card,
  size,
  isDealing,
  dealDelay,
  highlighted,
}: {
  showFace: boolean;
  card: Card | null;
  size: 'sm' | 'md' | 'lg';
  isDealing?: boolean;
  dealDelay?: number;
  highlighted?: boolean;
}) {
  return (
    <div className="relative" style={{ perspective: 1000 }}>
      <motion.div
        animate={{ rotateY: showFace ? 0 : 180 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front face (actual card) */}
        <div style={{ backfaceVisibility: 'hidden' }}>
          {showFace && card ? (
            <PlayingCard
              card={card}
              size={size}
              isDealing={isDealing}
              dealDelay={dealDelay}
              highlighted={highlighted}
            />
          ) : (
            <CardBack size={size} />
          )}
        </div>

        {/* Back face (card back) - rotated 180deg */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {!showFace ? (
            <CardBack size={size} />
          ) : card ? (
            <PlayingCard card={card} size={size} highlighted={highlighted} />
          ) : (
            <CardBack size={size} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
