'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Seat as SeatType } from '@/lib/poker-engine-v2/types';
import type { Card } from '@/types/poker';
import { HoleCards } from '../cards/HoleCards';
import { ShowCardsOverlay } from '../cards/ShowCardsOverlay';
import { User, WifiOff } from 'lucide-react';
import { useCardPeek } from '@/hooks/useCardPeek';

interface WinnerInfo {
  handRank: string;
  description: string;
  amount: number;
  bestCards: Card[];
}

export type SeatVariant = 'compact' | 'standard' | 'hero';

interface SeatProps {
  seat: SeatType;
  isHero?: boolean;
  isActor?: boolean;
  isWinner?: boolean;
  winnerInfo?: WinnerInfo;
  variant?: SeatVariant;
  className?: string;
  // Cards voluntarily shown by this player after folding
  shownCards?: [Card | null, Card | null];
  // Table ID for show cards API (hero only)
  tableId?: string;
}

// Avatar with status ring
function SeatAvatar({
  isActor,
  isAllIn,
  isSittingOut,
  size = 'sm',
}: {
  isActor?: boolean;
  isAllIn?: boolean;
  isSittingOut?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center',
        'bg-surface-tertiary/60',
        sizeClasses[size],
        isActor && 'ring-1 ring-accent-goldMuted/60 shadow-sm shadow-accent-gold/10',
        isAllIn && !isActor && 'ring-1 ring-action-foldMuted/60',
        isSittingOut && 'opacity-50'
      )}
    >
      <User className={cn('text-text-muted/70', iconSizes[size])} />
      {isSittingOut && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-surface-primary flex items-center justify-center">
          <WifiOff className="w-2 h-2 text-text-muted/70" />
        </div>
      )}
    </div>
  );
}

// Position badge (D/SB/BB combined)
function PositionBadge({
  isDealer,
  isSmallBlind,
  isBigBlind,
}: {
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
}) {
  if (!isDealer && !isSmallBlind && !isBigBlind) return null;

  // Show priority: D > SB > BB
  let label = '';
  let style = '';

  if (isDealer) {
    label = 'D';
    style = 'bg-accent-goldMuted/80 text-accent-goldBright border-accent-gold/30';
  } else if (isSmallBlind) {
    label = 'SB';
    style = 'bg-action-checkMuted/60 text-blue-300 border-action-check/30';
  } else if (isBigBlind) {
    label = 'BB';
    style = 'bg-amber-900/50 text-amber-300 border-amber-700/30';
  }

  return (
    <span
      className={cn(
        'absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full',
        'text-[10px] font-semibold flex items-center justify-center',
        'border backdrop-blur-sm',
        style
      )}
    >
      {label}
    </span>
  );
}

// Bet chip display
function BetChip({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1.5 bg-surface-secondary/80 px-2 py-1 rounded-full border border-surface-tertiary/50"
    >
      <div className="w-2.5 h-2.5 rounded-full bg-accent-goldMuted/80" />
      <span className="text-xs font-mono text-text-secondary">
        {amount.toLocaleString()}
      </span>
    </motion.div>
  );
}

export function Seat({
  seat,
  isHero = false,
  isActor = false,
  isWinner = false,
  winnerInfo,
  variant = 'standard',
  className,
  shownCards,
  tableId,
}: SeatProps) {
  const { player, isDealer, isSmallBlind, isBigBlind, index } = seat;

  // Peek state for hero cards (only used when variant === 'hero')
  const { isPeeking, togglePeek } = useCardPeek();

  // Empty seat
  if (!player) {
    const emptyStyles = {
      compact: 'w-20 h-24',
      standard: 'w-28 h-32',
      hero: 'w-full h-16',
    };

    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-surface-tertiary/30',
          'flex items-center justify-center',
          'text-text-muted/50 text-xs',
          emptyStyles[variant],
          className
        )}
      >
        <span>Seat {index + 1}</span>
      </div>
    );
  }

  const isFolded = player.status === 'folded';
  const isAllIn = player.isAllIn;
  const isSittingOut = player.isSittingOut;

  // Variant-specific styles
  if (variant === 'hero') {
    return (
      <motion.div
        layout
        className={cn(
          'relative w-full px-4 py-3 rounded-xl',
          'bg-surface-secondary/80 border',
          isWinner
            ? 'border-accent-gold/50 shadow-md shadow-accent-gold/10'
            : isActor
              ? 'border-accent-goldMuted/40 shadow-sm shadow-accent-gold/5'
              : 'border-surface-tertiary/50',
          isFolded && 'opacity-60',
          className
        )}
      >
        <div className="flex items-center gap-4">
          {/* Avatar with position badge */}
          <div className="relative">
            <SeatAvatar
              isActor={isActor}
              isAllIn={isAllIn}
              isSittingOut={isSittingOut}
              size="lg"
            />
            <PositionBadge isDealer={isDealer} isSmallBlind={isSmallBlind} isBigBlind={isBigBlind} />
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className="text-player-name text-text-primary">
              {player.displayName}
            </div>
            <div className="text-stack text-accent-gold">
              {player.stack.toLocaleString()}
            </div>
          </div>

          {/* Hole cards - larger for hero with peek functionality */}
          <div className="relative -ml-2 mr-2">
            <HoleCards
              cards={player.holeCards}
              isHero={true}
              isFolded={isFolded}
              size="lg"
              highlightedCards={isWinner && winnerInfo ? winnerInfo.bestCards : undefined}
              isPeeking={isPeeking}
              onPeekToggle={togglePeek}
              canPeek={!!player.holeCards && !isFolded && !isWinner}
            />
            {/* Show cards overlay (appears after folding) */}
            {isFolded && player.holeCards && tableId && (
              <ShowCardsOverlay
                cards={player.holeCards}
                tableId={tableId}
              />
            )}
          </div>

          {/* Current bet */}
          {player.currentBet > 0 && (
            <div className="shrink-0">
              <BetChip amount={player.currentBet} />
            </div>
          )}
        </div>

        {/* All-in badge */}
        {isAllIn && !isFolded && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 bg-action-foldMuted/60 text-red-300 text-[10px] font-semibold rounded border border-action-fold/30">
              All In
            </span>
          </div>
        )}

        {/* Winner info */}
        {isWinner && winnerInfo && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 pt-2 border-t border-surface-tertiary"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-accent-gold font-medium">{winnerInfo.description}</span>
              <span className="text-chip-value text-accent-goldBright">+{winnerInfo.amount.toLocaleString()}</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Compact and Standard variants
  const containerStyles = {
    compact: 'w-20 p-2',
    standard: 'w-28 p-2.5',
  };

  const avatarSize = variant === 'compact' ? 'sm' : 'md';
  const cardSize = variant === 'compact' ? 'sm' : 'sm';

  return (
    <motion.div
      layout
      className={cn(
        'relative rounded-xl',
        'bg-surface-secondary/80 border',
        isWinner
          ? 'border-accent-gold/50 shadow-md shadow-accent-gold/10'
          : isActor
            ? 'border-accent-goldMuted/40 shadow-sm shadow-accent-gold/5'
            : 'border-surface-tertiary/50',
        isFolded && 'opacity-50',
        isSittingOut && 'opacity-40',
        containerStyles[variant as 'compact' | 'standard'],
        className
      )}
    >
      {/* Position badge */}
      <PositionBadge isDealer={isDealer} isSmallBlind={isSmallBlind} isBigBlind={isBigBlind} />

      {/* Player info row */}
      <div className="flex items-center gap-2 mb-2">
        <SeatAvatar
          isActor={isActor}
          isAllIn={isAllIn}
          isSittingOut={isSittingOut}
          size={avatarSize}
        />
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-text-primary truncate',
            variant === 'compact' ? 'text-[11px]' : 'text-player-name'
          )}>
            {player.displayName}
          </div>
          <div className={cn(
            'text-accent-gold',
            variant === 'compact' ? 'text-[10px] font-mono' : 'text-stack'
          )}>
            {player.stack.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Winner badge */}
      {isWinner && winnerInfo && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="bg-accent-goldMuted/70 text-accent-goldBright px-2 py-0.5 rounded border border-accent-gold/40">
            <div className="text-[9px] font-semibold uppercase tracking-wide">Winner</div>
          </div>
        </motion.div>
      )}

      {/* Bet / All-in indicator — above cards so it's not obscured */}
      {(player.currentBet > 0 || (isAllIn && !isFolded)) && (
        <div className="flex justify-center mb-1">
          {isAllIn && !isFolded ? (
            <span className="px-1.5 py-0.5 bg-action-foldMuted/60 text-red-300 text-[9px] font-semibold rounded border border-action-fold/30">
              All In
            </span>
          ) : (
            <BetChip amount={player.currentBet} />
          )}
        </div>
      )}

      {/* Hole cards */}
      <div className="flex justify-center">
        <HoleCards
          cards={isHero || player.holeCards ? player.holeCards : undefined}
          isHero={isHero}
          isFolded={isFolded}
          size={cardSize}
          highlightedCards={isWinner && winnerInfo ? winnerInfo.bestCards : undefined}
          revealedCards={shownCards}
        />
      </div>

      {/* Actor glow */}
      {isActor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: '0 0 12px 1px rgba(201, 169, 98, 0.15)',
          }}
        />
      )}
    </motion.div>
  );
}
