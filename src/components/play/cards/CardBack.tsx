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
        'relative rounded-lg bg-gradient-to-br from-blue-900 to-blue-950 shadow-lg select-none',
        'border-2 border-blue-800',
        'flex items-center justify-center',
        className
      )}
    >
      {/* Diamond pattern */}
      <div className="absolute inset-1 rounded opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(45deg, transparent 40%, #fff 40%, #fff 60%, transparent 60%),
              linear-gradient(-45deg, transparent 40%, #fff 40%, #fff 60%, transparent 60%)
            `,
            backgroundSize: '8px 8px',
          }}
        />
      </div>

      {/* Center emblem */}
      <div className="relative w-6 h-6 flex items-center justify-center">
        <div className="absolute w-full h-full bg-blue-700 rounded-full opacity-50" />
        <span className="relative text-blue-300 font-bold text-xs">PP</span>
      </div>
    </motion.div>
  );
}
