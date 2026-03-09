'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, RefreshCw, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import {
  verifyPotMath,
  verifyStackMath,
  verifyBlindPosting,
  verifyWinnerPayout,
  verifyChipConservation,
  type AuditAction,
  type AuditHand,
} from '@/lib/audit/verify';

interface AuditData {
  table: {
    id: string;
    smallBlind: number;
    bigBlind: number;
    gameType: string;
  };
  hands: Array<{
    handNumber: number;
    dealerSeat: number;
    sbSeat: number;
    bbSeat: number;
    communityCards: string;
    finalPot: number;
    phase: string;
    startedAt: number;
    endedAt: number | null;
    actions: Array<{
      sequence: number;
      playerName: string;
      seatIndex: number;
      actionType: string;
      amount: number;
      stackBefore: number | null;
      stackAfter: number | null;
      potBefore: number | null;
      potAfter: number | null;
      phase: string;
      createdAt: number;
    }>;
    showdown: Array<{
      playerName: string;
      seatIndex: number;
      handRank: string;
      handDescription: string;
      winnings: number;
    }>;
  }>;
}

function Badge({ valid }: { valid: boolean }) {
  return valid ? (
    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline-block" />
  ) : (
    <XCircle className="w-3.5 h-3.5 text-red-400 inline-block" />
  );
}

function VerificationSection({ hand, tableSmallBlind, tableBigBlind }: {
  hand: AuditData['hands'][0];
  tableSmallBlind: number;
  tableBigBlind: number;
}) {
  const auditActions: AuditAction[] = hand.actions;
  const auditHand: AuditHand = {
    handNumber: hand.handNumber,
    finalPot: hand.finalPot,
    smallBlind: tableSmallBlind,
    bigBlind: tableBigBlind,
    actions: auditActions,
    showdown: hand.showdown,
  };

  const potResults = verifyPotMath(auditActions);
  const stackResults = verifyStackMath(auditActions);
  const blindResults = verifyBlindPosting(auditHand, auditActions);
  const payoutResult = hand.showdown.length > 0 ? verifyWinnerPayout(auditHand) : null;
  const conservationResult = verifyChipConservation(auditActions);

  const allResults = [
    ...potResults,
    ...stackResults,
    ...blindResults,
    ...(payoutResult ? [payoutResult] : []),
    conservationResult,
  ];

  const allValid = allResults.every((r) => r.valid);
  const failedResults = allResults.filter((r) => !r.valid);

  return (
    <div className="mt-2 px-3 py-2 rounded bg-surface-tertiary/50 text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <Badge valid={allValid} />
        <span className={allValid ? 'text-emerald-400' : 'text-red-400'}>
          {allValid ? 'All checks passed' : `${failedResults.length} check(s) failed`}
        </span>
      </div>
      {failedResults.length > 0 && (
        <ul className="space-y-0.5 text-red-300 mt-1">
          {failedResults.map((r, i) => (
            <li key={i}>- {r.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AuditLogContent({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = use(params);
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedHands, setExpandedHands] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${tableId}/audit`);
      if (!res.ok) throw new Error('Failed to fetch audit log');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAudit, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAudit]);

  const toggleHand = (handNumber: number) => {
    setExpandedHands((prev) => {
      const next = new Set(prev);
      if (next.has(handNumber)) next.delete(handNumber);
      else next.add(handNumber);
      return next;
    });
  };

  const expandAll = () => {
    if (data) {
      setExpandedHands(new Set(data.hands.map((h) => h.handNumber)));
    }
  };

  const collapseAll = () => setExpandedHands(new Set());

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center">
        <div className="text-text-muted">Loading audit log...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center">
        <div className="text-red-400">{error || 'No data'}</div>
      </div>
    );
  }

  // Group actions by phase
  const groupByPhase = (actions: AuditData['hands'][0]['actions']) => {
    const phases: Record<string, typeof actions> = {};
    for (const a of actions) {
      if (!phases[a.phase]) phases[a.phase] = [];
      phases[a.phase].push(a);
    }
    return phases;
  };

  const parseCommunityCards = (cc: string) => {
    try {
      const cards = JSON.parse(cc);
      return cards.length > 0 ? cards.join(' ') : 'none';
    } catch {
      return cc || 'none';
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary text-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-secondary border-b border-surface-tertiary px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-text-muted hover:text-text-primary">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-sm font-semibold">
              Audit Log - {data.table.gameType.toUpperCase()} Table
            </h1>
            <span className="text-xs text-text-muted font-mono">
              {data.table.smallBlind}/{data.table.bigBlind}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1"
            >
              Collapse All
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                autoRefresh ? 'text-emerald-400 bg-emerald-400/10' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto
            </button>
            <button
              onClick={fetchAudit}
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-2">
        {data.hands.length === 0 && (
          <div className="text-center text-text-muted py-8">No hands played yet</div>
        )}

        {data.hands.map((hand) => {
          const isExpanded = expandedHands.has(hand.handNumber);
          const phases = groupByPhase(hand.actions);

          return (
            <div
              key={hand.handNumber}
              className="bg-surface-secondary rounded-lg border border-surface-tertiary overflow-hidden"
            >
              {/* Hand header */}
              <button
                onClick={() => toggleHand(hand.handNumber)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-tertiary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                  <span className="text-sm font-medium">Hand #{hand.handNumber}</span>
                  <span className="text-xs text-text-muted">
                    Dealer: S{hand.dealerSeat} | SB: S{hand.sbSeat} | BB: S{hand.bbSeat}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-accent-gold">
                    Pot: {hand.finalPot}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    hand.phase === 'complete' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'
                  }`}>
                    {hand.phase}
                  </span>
                </div>
              </button>

              {/* Hand details */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-3 border-t border-surface-tertiary">
                  {/* Verification */}
                  <VerificationSection
                    hand={hand}
                    tableSmallBlind={data.table.smallBlind}
                    tableBigBlind={data.table.bigBlind}
                  />

                  {/* Actions by phase */}
                  {Object.entries(phases).map(([phase, phaseActions]) => (
                    <div key={phase}>
                      <div className="flex items-center gap-2 mt-2 mb-1">
                        <span className="text-xs font-semibold text-text-secondary uppercase">
                          {phase}
                        </span>
                        {phase !== 'preflop' && (
                          <span className="text-xs text-text-muted font-mono">
                            {parseCommunityCards(hand.communityCards)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {phaseActions.map((action) => (
                          <div
                            key={action.sequence}
                            className="flex items-center gap-2 text-xs font-mono py-0.5 px-2 rounded hover:bg-surface-tertiary/30"
                          >
                            <span className="text-text-muted w-6 text-right">
                              {action.sequence}.
                            </span>
                            <span className="text-text-primary w-24 truncate">
                              {action.playerName}
                            </span>
                            <span className="text-text-muted">
                              (S{action.seatIndex})
                            </span>
                            <span className={`font-semibold ${
                              action.actionType === 'fold' ? 'text-action-fold' :
                              action.actionType === 'check' ? 'text-action-check' :
                              action.actionType === 'call' ? 'text-action-call' :
                              ['bet', 'raise', 'all_in'].includes(action.actionType) ? 'text-action-raise' :
                              'text-text-secondary'
                            }`}>
                              {action.actionType}
                              {action.amount > 0 ? ` ${action.amount}` : ''}
                            </span>
                            {action.stackBefore !== null && action.stackAfter !== null && (
                              <span className="text-text-muted ml-auto">
                                Stack: {action.stackBefore} → {action.stackAfter}
                                {action.potBefore !== null && action.potAfter !== null && (
                                  <> | Pot: {action.potBefore} → {action.potAfter}</>
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Showdown */}
                  {hand.showdown.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase">
                        Showdown
                      </span>
                      <div className="space-y-0.5 mt-1">
                        {hand.showdown.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs font-mono py-0.5 px-2 rounded hover:bg-surface-tertiary/30"
                          >
                            <span className="text-text-primary w-24 truncate">
                              {s.playerName}
                            </span>
                            <span className="text-text-muted">
                              (S{s.seatIndex})
                            </span>
                            <span className="text-text-secondary">
                              {s.handDescription}
                            </span>
                            {s.winnings > 0 && (
                              <span className="text-accent-gold ml-auto font-semibold">
                                +{s.winnings}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
