'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ACTION_COLORS, ACTION_BG_COLORS, formatActionLabel } from '@/lib/action-utils';
import type { EnrichedActionRecord } from '@/stores/table-store';
import type { SeatVariant } from './Seat';

interface ActionIndicatorProps {
  isFolded: boolean;
  isAllIn: boolean;
  seatAction?: EnrichedActionRecord | null;
  variant: SeatVariant;
}

export function ActionIndicator({ isFolded, isAllIn, seatAction, variant }: ActionIndicatorProps) {
  // Priority: Folded > All In > last action > nothing
  let action: string | null = null;
  let label: string | null = null;

  if (isFolded) {
    action = 'fold';
    label = 'Fold';
  } else if (isAllIn) {
    action = 'all_in';
    label = 'All In';
  } else if (seatAction) {
    action = seatAction.action;
    label = formatActionLabel(seatAction.action, seatAction.amount);
  }

  if (!action || !label) return null;

  const textColor = ACTION_COLORS[action] ?? 'text-text-secondary';
  const bgColor = ACTION_BG_COLORS[action] ?? 'bg-surface-tertiary/60 border-surface-tertiary/50';

  const sizeClasses = variant === 'hero'
    ? 'text-[11px] px-2.5 py-0.5'
    : variant === 'compact'
      ? 'text-[8px] px-1.5 py-px'
      : 'text-[9px] px-2 py-0.5';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex justify-center', variant === 'hero' ? 'mb-1' : 'mb-1')}
    >
      <span
        className={cn(
          'font-semibold rounded border inline-block',
          textColor,
          bgColor,
          sizeClasses
        )}
      >
        {label}
      </span>
    </motion.div>
  );
}
