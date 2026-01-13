'use client';

import { cn } from '@/lib/cn';
import { useTableStore } from '@/stores/table-store';
import { Seat } from './Seat';
import { CommunityCards } from '../cards/CommunityCards';
import { motion, AnimatePresence } from 'framer-motion';

interface PokerTableProps {
  className?: string;
}

// Pot display with animated chip stack
function PotDisplay({ amount, sidePots }: { amount: number; sidePots?: { amount: number; eligiblePlayerIds?: string[] }[] }) {
  if (amount <= 0) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="flex flex-col items-center gap-2"
    >
      {/* Main pot */}
      <div className="flex items-center gap-2 bg-surface-secondary/60 px-3 py-1.5 rounded-full border border-surface-tertiary/40">
        <div className="flex -space-x-1">
          <div className="w-3 h-3 rounded-full bg-accent-goldMuted/70" />
          <div className="w-3 h-3 rounded-full bg-action-foldMuted/70" />
          <div className="w-3 h-3 rounded-full bg-action-checkMuted/70" />
        </div>
        <span className="text-sm font-mono font-semibold text-text-secondary">
          {amount.toLocaleString()}
        </span>
      </div>

      {/* Side pots */}
      {sidePots && sidePots.length > 1 && (
        <div className="flex gap-1.5 text-xs">
          {sidePots.map((sp, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-surface-tertiary/50 rounded text-text-muted text-[11px]"
            >
              Side {i + 1}: {sp.amount.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function PokerTable({ className }: PokerTableProps) {
  const {
    seats,
    heroSeatIndex,
    communityCards,
    pot,
    sidePots,
    currentActorSeatIndex,
    phase,
    showdownResult,
  } = useTableStore();

  // Check if we're in a showdown/winner display phase
  const isShowdownPhase = phase === 'showdown' || phase === 'hand-complete' || phase === 'awarding';

  // Get all best cards for community card highlighting
  const allBestCards = showdownResult?.winners.flatMap((w) => w.bestCards) || [];

  // Rotate seats so hero is always at bottom
  const rotatedSeats = heroSeatIndex !== null
    ? [...seats.slice(heroSeatIndex), ...seats.slice(0, heroSeatIndex)]
    : seats;

  // Separate hero from opponents
  const heroSeat = rotatedSeats[0];
  const opponentSeats = rotatedSeats.slice(1);

  return (
    <div className={cn('w-full max-w-2xl mx-auto flex flex-col justify-between py-4', className)}>
      {/* Opponents row - horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <div className="flex gap-3 justify-center min-w-min">
          {opponentSeats.map((seat) => {
            const isActor = seat.index === currentActorSeatIndex;
            const winnerData = isShowdownPhase && showdownResult
              ? showdownResult.winners.find((w) => w.seatIndex === seat.index)
              : undefined;
            const isWinner = !!winnerData;

            return (
              <Seat
                key={seat.index}
                seat={seat}
                isHero={false}
                isActor={isActor}
                isWinner={isWinner}
                variant="standard"
                winnerInfo={winnerData ? {
                  handRank: winnerData.handRank,
                  description: winnerData.description,
                  amount: winnerData.amount,
                  bestCards: winnerData.bestCards,
                } : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Board area - pot + community cards */}
      <div className="relative flex flex-col items-center gap-2 py-2">
        {/* Pot display */}
        <AnimatePresence>
          <PotDisplay amount={pot} sidePots={sidePots} />
        </AnimatePresence>

        {/* Community cards */}
        <CommunityCards
          cards={communityCards}
          highlightedCards={isShowdownPhase ? allBestCards : undefined}
          size="md"
        />

        {/* Phase indicator */}
        {phase !== 'waiting' && phase !== 'hand-complete' && (
          <div className="text-[10px] text-text-muted/60 uppercase tracking-widest">
            {phase}
          </div>
        )}

        {/* Preparing next hand overlay */}
        <AnimatePresence>
          {phase === 'hand-complete' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-surface-primary/40 rounded-xl"
            >
              <div className="flex items-center gap-2 bg-surface-secondary/80 px-4 py-2 rounded-full border border-surface-tertiary/40">
                <div className="w-3 h-3 border border-accent-goldMuted/60 border-t-transparent rounded-full animate-spin" />
                <span className="text-text-muted text-sm">Next hand...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hero seat - prominent at bottom */}
      {heroSeat && (
        <div className="px-2">
          <Seat
            seat={heroSeat}
            isHero={true}
            isActor={heroSeat.index === currentActorSeatIndex}
            isWinner={
              isShowdownPhase && showdownResult
                ? showdownResult.winners.some((w) => w.seatIndex === heroSeat.index)
                : false
            }
            variant="hero"
            winnerInfo={
              isShowdownPhase && showdownResult
                ? (() => {
                    const wd = showdownResult.winners.find((w) => w.seatIndex === heroSeat.index);
                    return wd ? {
                      handRank: wd.handRank,
                      description: wd.description,
                      amount: wd.amount,
                      bestCards: wd.bestCards,
                    } : undefined;
                  })()
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
