'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface TurnTimerProps {
  expiresAt: number | null;
  totalDuration?: number; // in ms
  isUnlimited?: boolean;  // When true, show infinity symbol
  onTimeout?: () => void;
  className?: string;
}

const TURN_DURATION = 30000; // 30 seconds default

export function TurnTimer({
  expiresAt,
  totalDuration = TURN_DURATION,
  isUnlimited = false,
  onTimeout,
  className,
}: TurnTimerProps) {
  const [remaining, setRemaining] = useState<number>(totalDuration);

  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Skip countdown for unlimited timer
    if (isUnlimited) return;

    if (!expiresAt) {
      setRemaining(totalDuration);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = Math.max(0, expiresAt - now);
      setRemaining(timeLeft);

      if (timeLeft === 0 && onTimeout) {
        onTimeout();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [expiresAt, totalDuration, isUnlimited, onTimeout]);

  // Show unlimited timer with infinity symbol
  if (isUnlimited) {
    return (
      <div className={cn('relative', className)}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Full circle in emerald */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#10b981"
            strokeWidth={strokeWidth}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono font-bold text-lg text-emerald-400">
            ∞
          </span>
        </div>
      </div>
    );
  }

  if (!expiresAt) return null;

  const progress = remaining / totalDuration;
  const seconds = Math.ceil(remaining / 1000);

  // Color based on time remaining
  const getColor = () => {
    if (progress > 0.5) return 'text-emerald-400';
    if (progress > 0.25) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStrokeColor = () => {
    if (progress > 0.5) return '#10b981';
    if (progress > 0.25) return '#fbbf24';
    return '#ef4444';
  };

  const offset = circumference * (1 - progress);

  return (
    <div className={cn('relative', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#27272a"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.1 }}
        />
      </svg>

      {/* Timer text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className={cn('font-mono font-bold text-lg', getColor())}
          key={seconds}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {seconds}
        </motion.span>
      </div>

      {/* Pulse effect when low */}
      {progress <= 0.25 && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-red-500"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
          }}
        />
      )}
    </div>
  );
}
