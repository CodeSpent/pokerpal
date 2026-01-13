'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { Eye, Check, X } from 'lucide-react';
import type { Card } from '@/types/poker';

interface ShowCardsOverlayProps {
  cards: [Card, Card];
  tableId: string;
  onShowComplete?: () => void;
  className?: string;
}

export function ShowCardsOverlay({
  cards,
  tableId,
  onShowComplete,
  className,
}: ShowCardsOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Don't render if already shown cards
  if (hasShown) return null;

  const toggleCardSelection = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleShowCards = async () => {
    if (selectedIndices.size === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/tables/${tableId}/show-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIndices: Array.from(selectedIndices) }),
      });

      if (response.ok) {
        setHasShown(true);
        setIsExpanded(false);
        onShowComplete?.();
      }
    } catch (error) {
      console.error('Failed to show cards:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowAll = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/tables/${tableId}/show-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIndices: [0, 1] }),
      });

      if (response.ok) {
        setHasShown(true);
        setIsExpanded(false);
        onShowComplete?.();
      }
    } catch (error) {
      console.error('Failed to show cards:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('absolute inset-0 z-20', className)}>
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // Collapsed state - just show the "Show" button
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-surface-primary/60 backdrop-blur-sm rounded-lg',
              'transition-colors hover:bg-surface-primary/80'
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full',
                'bg-surface-secondary/90 border border-surface-tertiary/50',
                'text-xs font-medium text-text-secondary'
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show</span>
            </div>
          </motion.button>
        ) : (
          // Expanded state - card selection UI
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-2',
              'bg-surface-primary/80 backdrop-blur-sm rounded-lg p-2'
            )}
          >
            {/* Card selection */}
            <div className="flex gap-2">
              {cards.map((card, index) => (
                <button
                  key={index}
                  onClick={() => toggleCardSelection(index)}
                  disabled={isSubmitting}
                  className={cn(
                    'relative w-8 h-11 rounded border-2 transition-all',
                    'bg-surface-secondary/80',
                    selectedIndices.has(index)
                      ? 'border-accent-gold shadow-sm shadow-accent-gold/20'
                      : 'border-surface-tertiary/50 hover:border-surface-tertiary'
                  )}
                >
                  {/* Card representation */}
                  <span className="text-[10px] font-bold text-text-primary">
                    {card.rank}
                  </span>
                  {/* Checkmark overlay when selected */}
                  {selectedIndices.has(index) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-gold flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-surface-primary" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setIsExpanded(false)}
                disabled={isSubmitting}
                className={cn(
                  'p-1.5 rounded-full',
                  'bg-surface-tertiary/50 hover:bg-surface-tertiary/80',
                  'text-text-muted transition-colors'
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleShowCards}
                disabled={selectedIndices.size === 0 || isSubmitting}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-medium',
                  'bg-accent-goldMuted/60 text-accent-goldBright',
                  'border border-accent-gold/30',
                  'hover:bg-accent-goldMuted/80 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isSubmitting ? '...' : 'Show'}
              </button>

              <button
                onClick={handleShowAll}
                disabled={isSubmitting}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-medium',
                  'bg-action-checkMuted/60 text-blue-300',
                  'border border-action-check/30',
                  'hover:bg-action-checkMuted/80 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isSubmitting ? '...' : 'All'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
