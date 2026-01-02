'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Card } from '@/types/poker';
import type { Seat } from '@/lib/poker-engine-v2/types';
import { PlayingCard } from '../cards/PlayingCard';
import { HoleCards } from '../cards/HoleCards';
import { User, Trophy } from 'lucide-react';

interface Winner {
  playerId: string;
  seatIndex: number;
  holeCards: [Card, Card];
  handRank: string;
  description: string;
  bestCards: Card[];
  amount: number;
}

interface ShowdownOverlayProps {
  winners: Winner[];
  pot: number;
  communityCards: Card[];
  seats: Seat[];
}

// Helper to check if a card is part of the winning hand
function isCardInBestHand(card: Card, bestCards: Card[]): boolean {
  return bestCards.some(
    (bc) => bc.rank === card.rank && bc.suit === card.suit
  );
}

export function ShowdownOverlay({
  winners,
  pot,
  communityCards,
  seats,
}: ShowdownOverlayProps) {
  if (winners.length === 0) return null;

  // Get all best cards from all winners (for community card highlighting)
  const allBestCards = winners.flatMap((w) => w.bestCards);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-6 border border-zinc-700 shadow-2xl max-w-lg w-full mx-4"
      >
        {/* Trophy header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <h2 className="text-3xl font-bold text-white uppercase tracking-wider">
            {winners.length > 1 ? 'Split Pot!' : 'Winner!'}
          </h2>
          <Trophy className="w-8 h-8 text-yellow-400" />
        </div>

        {/* Winners */}
        <div className={cn('space-y-4', winners.length > 1 && 'max-h-60 overflow-y-auto')}>
          {winners.map((winner, idx) => {
            // Find player info from seats
            const seat = seats.find((s) => s.index === winner.seatIndex);
            const playerName = seat?.player?.displayName || `Player ${winner.seatIndex + 1}`;

            return (
              <motion.div
                key={winner.playerId}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
                    <User className="w-6 h-6 text-yellow-900" />
                  </div>

                  {/* Player info */}
                  <div className="flex-1">
                    <div className="text-lg font-bold text-white">{playerName}</div>
                    <div className="text-sm text-yellow-400 font-medium">
                      {winner.description}
                    </div>
                    <div className="text-emerald-400 font-mono text-lg">
                      +{winner.amount.toLocaleString()}
                    </div>
                  </div>

                  {/* Winner's hole cards with glow */}
                  <div className="flex-shrink-0">
                    <HoleCards
                      cards={winner.holeCards}
                      isHero={true}
                      size="sm"
                      highlightedCards={winner.bestCards}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Community cards */}
        {communityCards.length > 0 && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 pt-4 border-t border-zinc-700"
          >
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3 text-center">
              Community Cards
            </div>
            <div className="flex justify-center gap-2">
              {communityCards.map((card, idx) => (
                <PlayingCard
                  key={`${card.rank}${card.suit}`}
                  card={card}
                  size="sm"
                  highlighted={isCardInBestHand(card, allBestCards)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Total pot info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-center text-zinc-500 text-sm"
        >
          Pot: {pot.toLocaleString()}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
