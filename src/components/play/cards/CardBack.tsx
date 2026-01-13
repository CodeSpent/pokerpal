'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Match PlayingCard pixel dimensions exactly
const cardSizes = {
  sm: { width: 40, height: 56 },
  md: { width: 52, height: 73 },
  lg: { width: 64, height: 90 },
};

export function CardBack({ size = 'md', className }: CardBackProps) {
  const dimensions = cardSizes[size];

  return (
    <motion.div
      className={cn(
        'relative rounded-lg select-none overflow-hidden',
        'bg-gradient-to-br from-surface-tertiary via-surface-secondary to-surface-primary',
        'border border-surface-quaternary/50',
        'shadow-md',
        className
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
      }}
    >
      {/* Subtle geometric pattern */}
      <div className="absolute inset-0 opacity-[0.07]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 4px,
                currentColor 4px,
                currentColor 5px
              )
            `,
          }}
        />
      </div>

      {/* Inner border accent */}
      <div className="absolute inset-[3px] rounded-md border border-surface-tertiary/30" />

      {/* Subtle center gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
    </motion.div>
  );
}
