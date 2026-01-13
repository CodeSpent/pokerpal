'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-11',
  md: 'w-12 h-16',
  lg: 'w-16 h-22',
};

export function CardBack({ size = 'md', className }: CardBackProps) {
  return (
    <motion.div
      className={cn(
        sizeClasses[size],
        'relative rounded-lg select-none overflow-hidden',
        'bg-gradient-to-br from-surface-tertiary via-surface-secondary to-surface-primary',
        'border border-surface-quaternary/50',
        'shadow-md',
        className
      )}
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
