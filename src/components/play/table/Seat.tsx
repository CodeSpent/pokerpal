'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { Seat as SeatType } from '@/lib/poker-engine-v2/types';
import type { Card } from '@/types/poker';
import { HoleCards } from '../cards/HoleCards';
import { User, Wifi, WifiOff } from 'lucide-react';

interface WinnerInfo {
  handRank: string;
  description: string;
  amount: number;
  bestCards: Card[];
}

interface SeatProps {
  seat: SeatType;
  isHero?: boolean;
  isActor?: boolean;
  isWinner?: boolean;
  winnerInfo?: WinnerInfo;
  className?: string;
}

export function Seat({ seat, isHero = false, isActor = false, isWinner = false, winnerInfo, className }: SeatProps) {
  const { player, isDealer, isSmallBlind, isBigBlind, index } = seat;

  if (!player) {
    // Empty seat
    return (
      <div
        className={cn(
          'w-28 h-36 rounded-xl border-2 border-dashed border-zinc-700/50',
          'flex items-center justify-center',
          'text-zinc-600 text-sm',
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

  return (
    <motion.div
      layout
      className={cn(
        'relative w-28 rounded-xl p-2',
        'bg-zinc-800/90 border-2',
        isWinner
          ? 'border-yellow-400 shadow-lg shadow-yellow-400/40'
          : isActor
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/30'
          : 'border-zinc-700',
        isFolded && 'opacity-50',
        isSittingOut && 'opacity-40',
        isHero && !isWinner && 'ring-2 ring-blue-500/50',
        className
      )}
    >
      {/* Dealer/Blind indicators */}
      <div className="absolute -top-2 -right-2 flex gap-1">
        {isDealer && (
          <span className="w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center shadow-lg">
            D
          </span>
        )}
        {isSmallBlind && (
          <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
            SB
          </span>
        )}
        {isBigBlind && (
          <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
            BB
          </span>
        )}
      </div>

      {/* Player info */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
          <User className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {player.displayName}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-emerald-400 font-mono">
              {player.stack.toLocaleString()}
            </span>
            {isSittingOut && (
              <WifiOff className="w-3 h-3 text-zinc-500" />
            )}
          </div>
        </div>
      </div>

      {/* Winner badge */}
      {isWinner && winnerInfo && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute -top-10 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-3 py-1 rounded-lg shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wide">Winner</div>
            <div className="text-[10px] font-medium truncate max-w-24">{winnerInfo.description}</div>
          </div>
        </motion.div>
      )}

      {/* Hole cards */}
      <div className="flex justify-center">
        <HoleCards
          cards={isHero || player.holeCards ? player.holeCards : undefined}
          isHero={isHero}
          isFolded={isFolded}
          size="sm"
          highlightedCards={isWinner && winnerInfo ? winnerInfo.bestCards : undefined}
        />
      </div>

      {/* Current bet */}
      {player.currentBet > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="flex items-center gap-1 bg-zinc-900/90 px-2 py-1 rounded-full border border-zinc-700">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow" />
            <span className="text-xs font-mono text-white">
              {player.currentBet.toLocaleString()}
            </span>
          </div>
        </motion.div>
      )}

      {/* Status badges */}
      {isAllIn && !isFolded && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded uppercase tracking-wider">
            All In
          </span>
        </div>
      )}

      {/* Actor indicator (turn timer) */}
      {isActor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-xl"
          style={{
            boxShadow: '0 0 20px 5px rgba(16, 185, 129, 0.3)',
          }}
        />
      )}
    </motion.div>
  );
}
