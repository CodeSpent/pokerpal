'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { X, Trophy, ChevronDown, ChevronRight } from 'lucide-react';
import { ACTION_COLORS, formatActionLabel } from '@/lib/action-utils';
import { SUIT_SYMBOLS } from '@/types/poker';

interface TimelineAction {
  playerName: string;
  action: string;
  amount: number;
  phase: string;
}

interface TimelineWinner {
  playerName: string;
  handRank: string;
  handDescription: string;
  winnings: number;
}

interface TimelineCard {
  rank: string;
  suit: string;
}

interface TimelineHand {
  handNumber: number;
  phase: string;
  pot: number;
  startedAt: number;
  actions: TimelineAction[];
  winners: TimelineWinner[];
  foldWinner: { playerName: string; winnings: number } | null;
  communityCards: TimelineCard[];
}

interface GameTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
}

const PHASE_LABELS: Record<string, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

const SUIT_COLORS: Record<string, string> = {
  h: 'text-red-500',
  d: 'text-blue-400',
  c: 'text-emerald-400',
  s: 'text-text-primary',
};

function MiniCard({ card }: { card: TimelineCard }) {
  const symbol = SUIT_SYMBOLS[card.suit as keyof typeof SUIT_SYMBOLS] ?? card.suit;
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-6 h-8 rounded bg-white/90 text-[10px] font-bold leading-none border border-surface-tertiary/40',
      SUIT_COLORS[card.suit] ?? 'text-text-primary'
    )}>
      <span className="flex flex-col items-center gap-px">
        <span>{card.rank}</span>
        <span className="text-[8px]">{symbol}</span>
      </span>
    </span>
  );
}

function CommunityCardsRow({ cards, phase }: { cards: TimelineCard[]; phase: string }) {
  if (cards.length === 0) return null;

  // Show separator labels between flop/turn/river
  const flop = cards.slice(0, 3);
  const turn = cards.length > 3 ? cards[3] : null;
  const river = cards.length > 4 ? cards[4] : null;

  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {flop.map((c, i) => (
        <MiniCard key={`f${i}`} card={c} />
      ))}
      {turn && (
        <>
          <span className="w-px h-5 bg-surface-tertiary/50 mx-0.5" />
          <MiniCard card={turn} />
        </>
      )}
      {river && (
        <>
          <span className="w-px h-5 bg-surface-tertiary/50 mx-0.5" />
          <MiniCard card={river} />
        </>
      )}
      {phase !== 'complete' && phase !== 'preflop' && (
        <span className="text-[9px] text-text-muted ml-1">({phase})</span>
      )}
    </div>
  );
}

function groupActionsByPhase(actions: TimelineAction[]): Record<string, TimelineAction[]> {
  const groups: Record<string, TimelineAction[]> = {};
  for (const action of actions) {
    if (!groups[action.phase]) groups[action.phase] = [];
    groups[action.phase].push(action);
  }
  return groups;
}

function HandEntry({ hand, isLatest }: { hand: TimelineHand; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);
  const isComplete = hand.phase === 'complete';
  const hasWinner = hand.winners.length > 0 || hand.foldWinner !== null;
  const grouped = groupActionsByPhase(hand.actions);
  const phases = ['preflop', 'flop', 'turn', 'river'].filter((p) => grouped[p]?.length);

  return (
    <div className={cn(
      'border-b border-surface-tertiary/30 last:border-b-0',
      isLatest && 'bg-surface-secondary/30'
    )}>
      {/* Hand header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary/40 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
        )}

        <span className="text-xs font-semibold text-text-primary">
          Hand #{hand.handNumber}
        </span>

        {!isComplete && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/30">
            Live
          </span>
        )}

        <span className="flex-1" />

        {/* Winner summary */}
        {hasWinner && (
          <span className="text-[11px] text-text-muted truncate max-w-[140px]">
            {hand.winners.length > 0
              ? `${hand.winners[0].playerName} won ${hand.winners[0].winnings.toLocaleString()}`
              : hand.foldWinner
                ? `${hand.foldWinner.playerName} won ${hand.foldWinner.winnings.toLocaleString()}`
                : ''
            }
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-2">
          {/* Community cards */}
          {hand.communityCards.length > 0 && (
            <div className="mb-1.5">
              <CommunityCardsRow cards={hand.communityCards} phase={hand.phase} />
            </div>
          )}

          {/* Actions by phase */}
          {phases.map((phase) => (
            <div key={phase} className="mb-1.5">
              <div className="text-[9px] font-semibold text-text-muted/60 uppercase tracking-widest mb-0.5 pl-1">
                {PHASE_LABELS[phase] ?? phase}
              </div>
              <div className="space-y-0.5">
                {grouped[phase].map((action, i) => (
                  <div key={i} className="flex items-center gap-1.5 pl-1">
                    <span className="text-[11px] text-text-secondary truncate max-w-[100px]">
                      {action.playerName}
                    </span>
                    <span className={cn(
                      'text-[10px] font-semibold',
                      ACTION_COLORS[action.action] ?? 'text-text-secondary'
                    )}>
                      {formatActionLabel(action.action, action.amount || undefined)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {hand.actions.length === 0 && !hasWinner && (
            <p className="text-[11px] text-text-muted pl-1">In progress...</p>
          )}

          {/* Winner display */}
          {hand.winners.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 mt-1 pl-1">
              <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-400 font-medium truncate">
                {w.playerName}
              </span>
              <span className="text-[10px] text-text-muted">
                {w.handDescription}
              </span>
              <span className="text-[11px] text-amber-400 font-mono ml-auto shrink-0">
                +{w.winnings.toLocaleString()}
              </span>
            </div>
          ))}
          {hand.foldWinner && (
            <div className="flex items-center gap-1.5 mt-1 pl-1">
              <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-400 font-medium truncate">
                {hand.foldWinner.playerName}
              </span>
              <span className="text-[10px] text-text-muted">
                Uncalled
              </span>
              <span className="text-[11px] text-amber-400 font-mono ml-auto shrink-0">
                +{hand.foldWinner.winnings.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GameTimeline({ isOpen, onClose, tableId }: GameTimelineProps) {
  const [hands, setHands] = useState<TimelineHand[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tables/${tableId}/timeline`);
      const data = await res.json();
      if (data.timeline) {
        setHands(data.timeline);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchTimeline();
    }
  }, [isOpen, fetchTimeline]);

  // Auto-refresh every 5s while open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(fetchTimeline, 5000);
    return () => clearInterval(interval);
  }, [isOpen, fetchTimeline]);

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
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] bg-surface-primary border-t border-surface-tertiary/50 rounded-t-2xl overflow-hidden"
          >
            {/* Handle + header */}
            <div className="sticky top-0 bg-surface-primary z-10 px-4 pt-3 pb-2">
              <div className="w-10 h-1 bg-surface-tertiary/60 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Game Timeline</h3>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-tertiary/40 text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Timeline content */}
            <div className="overflow-y-auto max-h-[calc(70vh-72px)]">
              {loading && hands.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
                </div>
              ) : hands.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">No hands played yet.</p>
              ) : (
                // Show newest first
                [...hands].reverse().map((hand, i) => (
                  <HandEntry
                    key={hand.handNumber}
                    hand={hand}
                    isLatest={i === 0}
                  />
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
