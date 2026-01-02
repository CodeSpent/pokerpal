'use client';

import { cn } from '@/lib/cn';
import { useTableStore } from '@/stores/table-store';
import { Seat } from './Seat';
import { CommunityCards } from '../cards/CommunityCards';
import { motion, AnimatePresence } from 'framer-motion';

interface PokerTableProps {
  className?: string;
}

/**
 * 6-max table seat positions (clockwise from bottom-center)
 * Layout:
 *      [2]   [3]
 *   [1]         [4]
 *      [0]   [5]
 *
 * Seat 0 is always hero position (bottom center-left)
 */
const SEAT_POSITIONS_6MAX = [
  { left: '25%', bottom: '0' },      // 0: Bottom left
  { left: '0', top: '35%' },         // 1: Left
  { left: '15%', top: '0' },         // 2: Top left
  { right: '15%', top: '0' },        // 3: Top right
  { right: '0', top: '35%' },        // 4: Right
  { right: '25%', bottom: '0' },     // 5: Bottom right
];

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

  return (
    <div className={cn('relative w-full max-w-4xl mx-auto', className)}>
      {/* Table surface */}
      <div className="relative aspect-[2/1] min-h-[400px]">
        {/* Felt */}
        <div
          className={cn(
            'absolute inset-0 rounded-[50%]',
            'bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950',
            'border-8 border-zinc-800',
            'shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]'
          )}
        >
          {/* Table rail */}
          <div
            className={cn(
              'absolute inset-[-8px] rounded-[50%]',
              'border-4 border-amber-900/50',
              'pointer-events-none'
            )}
          />
        </div>

        {/* Center area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {/* Pot */}
          <AnimatePresence>
            {pot > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-2 bg-zinc-900/80 px-4 py-2 rounded-full"
              >
                <div className="flex -space-x-1">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow border border-yellow-500" />
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow border border-red-500" />
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow border border-blue-500" />
                </div>
                <span className="text-lg font-bold text-white font-mono">
                  {pot.toLocaleString()}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Side pots */}
          {sidePots && sidePots.length > 1 && (
            <div className="flex gap-2 text-xs">
              {sidePots.map((sp, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-zinc-800/80 rounded text-zinc-300"
                >
                  Side pot {i + 1}: {sp.amount.toLocaleString()}
                </span>
              ))}
            </div>
          )}

          {/* Community cards */}
          <CommunityCards
            cards={communityCards}
            highlightedCards={isShowdownPhase ? allBestCards : undefined}
          />

          {/* Phase indicator */}
          {phase !== 'waiting' && phase !== 'hand-complete' && (
            <div className="text-xs text-zinc-400 uppercase tracking-wider">
              {phase}
            </div>
          )}

          {/* Preparing next hand overlay - shows during hand-complete phase */}
          <AnimatePresence>
            {phase === 'hand-complete' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[50%]"
              >
                <div className="flex items-center gap-3 bg-zinc-900/90 px-6 py-3 rounded-full">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-zinc-200 font-medium">Preparing next hand...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Seats */}
        {rotatedSeats.map((seat, displayIndex) => {
          const position = SEAT_POSITIONS_6MAX[displayIndex];
          if (!position) return null;

          const isHero = seat.index === heroSeatIndex;
          const isActor = seat.index === currentActorSeatIndex;

          // Check if this seat is a winner
          const winnerData = isShowdownPhase && showdownResult
            ? showdownResult.winners.find((w) => w.seatIndex === seat.index)
            : undefined;
          const isWinner = !!winnerData;

          return (
            <div
              key={seat.index}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                ...position,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Seat
                seat={seat}
                isHero={isHero}
                isActor={isActor}
                isWinner={isWinner}
                winnerInfo={winnerData ? {
                  handRank: winnerData.handRank,
                  description: winnerData.description,
                  amount: winnerData.amount,
                  bestCards: winnerData.bestCards,
                } : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
