'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export type ActionVariant = 'fold' | 'check' | 'raise';

interface ActionButtonProps {
  label: string;
  amount?: number;
  onClick: () => void;
  disabled?: boolean;
  variant: ActionVariant;
  shortcut?: string;
  className?: string;
}

const variantStyles: Record<ActionVariant, string> = {
  fold: 'bg-action-fold/20 border border-action-fold/50 hover:bg-action-fold/30 hover:border-action-fold/70 text-red-300',
  check: 'bg-action-check/20 border border-action-check/50 hover:bg-action-check/30 hover:border-action-check/70 text-blue-300',
  raise: 'bg-action-raise/20 border border-action-raise/50 hover:bg-action-raise/30 hover:border-action-raise/70 text-green-300',
};

export function ActionButton({
  label,
  amount,
  onClick,
  disabled = false,
  variant,
  shortcut,
  className,
}: ActionButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      className={cn(
        // Base styles - compact, modern
        'flex-1 min-h-[44px] rounded-lg',
        'flex flex-col items-center justify-center gap-0.5',
        'font-medium',
        'transition-all duration-150',
        // Subtle glow instead of heavy shadow
        'shadow-sm',
        // Disabled state
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:border-opacity-20',
        // Variant colors
        variantStyles[variant],
        className
      )}
    >
      <span className="text-sm font-medium tracking-wide">{label}</span>
      {amount !== undefined && (
        <span className="text-xs font-mono opacity-70">
          {amount.toLocaleString()}
        </span>
      )}
      {shortcut && !amount && (
        <span className="text-[10px] opacity-40">({shortcut})</span>
      )}
    </motion.button>
  );
}
