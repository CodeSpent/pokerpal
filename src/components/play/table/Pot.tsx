'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { SidePot } from '@/lib/poker-engine-v2/types';

interface PotProps {
  mainPot: number;
  sidePots?: SidePot[];
  className?: string;
}

const CHIP_COLORS = [
  'from-yellow-400 to-yellow-600 border-yellow-500',
  'from-red-400 to-red-600 border-red-500',
  'from-blue-400 to-blue-600 border-blue-500',
  'from-green-400 to-green-600 border-green-500',
  'from-purple-400 to-purple-600 border-purple-500',
];

function ChipStack({ amount }: { amount: number }) {
  // Determine stack height based on amount
  const chipCount = Math.min(Math.ceil(amount / 500), 8);

  return (
    <div className="flex flex-col-reverse items-center">
      {Array.from({ length: chipCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-5 h-1.5 rounded-full bg-gradient-to-br shadow border',
            CHIP_COLORS[i % CHIP_COLORS.length],
            i > 0 && '-mt-1'
          )}
          style={{
            transform: `translateY(${i * 0.5}px)`,
          }}
        />
      ))}
    </div>
  );
}

export function Pot({ mainPot, sidePots = [], className }: PotProps) {
  const totalPot = mainPot + sidePots.reduce((sum, sp) => sum + sp.amount, 0);

  if (totalPot === 0) return null;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={totalPot}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="flex items-center gap-3 bg-zinc-900/90 px-4 py-2 rounded-full border border-zinc-700"
        >
          <ChipStack amount={totalPot} />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white font-mono">
              {totalPot.toLocaleString()}
            </span>
            {sidePots.length > 0 && (
              <span className="text-xs text-zinc-400">
                Main: {mainPot.toLocaleString()}
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Side pots */}
      {sidePots.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {sidePots.map((sp, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 bg-zinc-800/80 px-2 py-1 rounded text-sm"
            >
              <div className={cn('w-3 h-3 rounded-full bg-gradient-to-br', CHIP_COLORS[i % CHIP_COLORS.length])} />
              <span className="text-zinc-300 font-mono">
                {sp.amount.toLocaleString()}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
