'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Home, Crown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTableStore } from '@/stores/table-store';

interface TournamentCompleteOverlayProps {
  tournamentId: string;
}

export function TournamentCompleteOverlay({ tournamentId }: TournamentCompleteOverlayProps) {
  const router = useRouter();
  const { tournamentWinner, heroSeatIndex, phase } = useTableStore();
  const [showConfetti, setShowConfetti] = useState(false);

  const isWinner = tournamentWinner?.seatIndex === heroSeatIndex;
  const isVisible = phase === 'tournament-complete' && tournamentWinner !== null;

  // Trigger confetti for winner
  useEffect(() => {
    if (isVisible && isWinner) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isWinner]);

  const handleGoToLobby = () => {
    router.push('/play');
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Confetti effect for winner */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: -20,
                  rotate: 0,
                  scale: Math.random() * 0.5 + 0.5,
                }}
                animate={{
                  y: window.innerHeight + 20,
                  rotate: Math.random() * 720 - 360,
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  delay: Math.random() * 2,
                  ease: 'linear',
                }}
                className={cn(
                  'absolute w-3 h-3 rounded-sm',
                  i % 5 === 0 && 'bg-accent-gold',
                  i % 5 === 1 && 'bg-accent-goldBright',
                  i % 5 === 2 && 'bg-amber-400',
                  i % 5 === 3 && 'bg-yellow-300',
                  i % 5 === 4 && 'bg-orange-400'
                )}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.2 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <div className="bg-surface-secondary rounded-2xl border border-accent-gold/30 overflow-hidden shadow-2xl">
            {/* Header with trophy */}
            <div className="relative bg-gradient-to-b from-accent-gold/20 to-transparent pt-8 pb-6 text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.4 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent-gold/20 border-2 border-accent-gold mb-4"
              >
                <Trophy className="w-10 h-10 text-accent-gold" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-2xl font-bold text-white"
              >
                Tournament Complete!
              </motion.h2>
            </div>

            {/* Winner info */}
            <div className="px-6 py-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-center mb-6"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-accent-gold" />
                  <span className="text-text-muted text-sm uppercase tracking-wide">Winner</span>
                  <Crown className="w-5 h-5 text-accent-gold" />
                </div>
                <p className={cn(
                  'text-3xl font-bold',
                  isWinner ? 'text-accent-gold' : 'text-white'
                )}>
                  {tournamentWinner?.name}
                </p>
                {isWinner && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-accent-goldBright mt-2"
                  >
                    Congratulations! You won!
                  </motion.p>
                )}
              </motion.div>

              {/* Final chip count */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-surface-tertiary rounded-xl p-4 mb-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Final Chips</span>
                  <span className="text-xl font-mono font-bold text-accent-gold">
                    {tournamentWinner?.stack.toLocaleString()}
                  </span>
                </div>
              </motion.div>

              {/* Action button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                onClick={handleGoToLobby}
                className={cn(
                  'w-full py-4 rounded-xl font-bold text-lg transition-all',
                  'bg-accent-gold text-surface-primary',
                  'hover:bg-accent-goldBright',
                  'active:scale-[0.98]'
                )}
              >
                <Home className="inline-block w-5 h-5 mr-2" />
                Back to Lobby
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
