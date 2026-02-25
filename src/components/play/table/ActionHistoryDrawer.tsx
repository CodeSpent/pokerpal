'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useTableStore, type EnrichedActionRecord } from '@/stores/table-store';
import { ACTION_COLORS, ACTION_BG_COLORS, formatActionLabel } from '@/lib/action-utils';
import { X } from 'lucide-react';

interface ActionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];
const STREET_LABELS: Record<string, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

function groupByStreet(actions: EnrichedActionRecord[]): Record<string, EnrichedActionRecord[]> {
  const groups: Record<string, EnrichedActionRecord[]> = {};
  for (const action of actions) {
    const street = action.street;
    if (!groups[street]) groups[street] = [];
    groups[street].push(action);
  }
  return groups;
}

export function ActionHistoryDrawer({ isOpen, onClose }: ActionHistoryDrawerProps) {
  const actionHistory = useTableStore((s) => s.actionHistory);
  const seats = useTableStore((s) => s.seats);

  const grouped = groupByStreet(actionHistory);
  const lastAction = actionHistory.length > 0 ? actionHistory[actionHistory.length - 1] : null;

  function getPlayerName(seatIndex: number): string {
    const seat = seats.find((s) => s.index === seatIndex);
    return seat?.player?.displayName ?? `Seat ${seatIndex + 1}`;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[60vh] bg-surface-primary border-t border-surface-tertiary/50 rounded-t-2xl overflow-hidden"
          >
            {/* Handle + header */}
            <div className="sticky top-0 bg-surface-primary z-10 px-4 pt-3 pb-2">
              <div className="w-10 h-1 bg-surface-tertiary/60 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Action History</h3>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-tertiary/40 text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action list */}
            <div className="px-4 pb-6 overflow-y-auto max-h-[calc(60vh-72px)]">
              {actionHistory.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-6">No actions yet this hand.</p>
              ) : (
                STREET_ORDER
                  .filter((street) => grouped[street]?.length)
                  .map((street) => (
                    <div key={street} className="mb-3">
                      <div className="text-[10px] font-semibold text-text-muted/70 uppercase tracking-widest mb-1.5">
                        {STREET_LABELS[street] ?? street}
                      </div>
                      <div className="space-y-1">
                        {grouped[street].map((record, i) => {
                          const isLatest =
                            lastAction &&
                            record.seatIndex === lastAction.seatIndex &&
                            record.timestamp === lastAction.timestamp;

                          return (
                            <div
                              key={`${street}-${i}`}
                              className={cn(
                                'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                                isLatest
                                  ? 'bg-surface-secondary/80 border border-surface-tertiary/40'
                                  : 'bg-transparent'
                              )}
                            >
                              <span className="text-xs text-text-secondary flex-1 min-w-0 truncate">
                                {getPlayerName(record.seatIndex)}
                              </span>
                              <span
                                className={cn(
                                  'text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0',
                                  ACTION_COLORS[record.action] ?? 'text-text-secondary',
                                  ACTION_BG_COLORS[record.action] ?? 'bg-surface-tertiary/60 border-surface-tertiary/50'
                                )}
                              >
                                {formatActionLabel(record.action, record.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
