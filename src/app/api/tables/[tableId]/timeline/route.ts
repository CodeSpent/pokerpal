import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { tableRepo, handRepo } from '@/lib/db/repositories';

/**
 * GET /api/tables/[tableId]/timeline
 * Player-facing game timeline: recent hands with actions and results.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tableId } = await params;

    const { table, players: tablePlayers } = await tableRepo.getTableWithPlayers(tableId);
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Player name lookup
    const nameMap = new Map<string, string>();
    for (const tp of tablePlayers) {
      nameMap.set(tp.playerId, tp.name);
    }

    // Get recent hands (last 10)
    const allHands = await handRepo.getHandsByTable(tableId);
    const recentHands = allHands.slice(-10);

    const timeline = await Promise.all(
      recentHands.map(async (hand) => {
        const actions = await handRepo.getHandActions(hand.id);
        const showdownResults = await handRepo.getShowdownResults(hand.id);

        // Filter to voluntary actions only (skip blind posts for cleaner timeline)
        const VOLUNTARY = new Set(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);

        const timelineActions = actions
          .filter((a) => VOLUNTARY.has(a.actionType))
          .map((a) => ({
            playerName: nameMap.get(a.playerId) ?? 'Unknown',
            action: a.actionType,
            amount: a.amount,
            phase: a.phase,
          }));

        const winners = showdownResults
          .filter((s) => s.winnings > 0)
          .map((s) => ({
            playerName: nameMap.get(s.playerId) ?? 'Unknown',
            handRank: s.handRank,
            handDescription: s.handDescription,
            winnings: s.winnings,
          }));

        // For non-showdown wins (fold-out), find the winner from actions
        // If hand is complete but no showdown results, the last remaining player won
        let foldWinner: { playerName: string; winnings: number } | null = null;
        if (hand.phase === 'complete' && winners.length === 0 && hand.pot > 0) {
          // Find players who didn't fold
          const foldedIds = new Set(
            actions.filter((a) => a.actionType === 'fold').map((a) => a.playerId)
          );
          const allPlayerIds = new Set(actions.map((a) => a.playerId));
          const nonFolded = [...allPlayerIds].filter((id) => !foldedIds.has(id));
          if (nonFolded.length === 1) {
            foldWinner = {
              playerName: nameMap.get(nonFolded[0]) ?? 'Unknown',
              winnings: hand.pot,
            };
          }
        }

        // Parse community cards
        let communityCards: { rank: string; suit: string }[] = [];
        try {
          communityCards = JSON.parse(hand.communityCards);
        } catch {
          // ignore parse errors
        }

        return {
          handNumber: hand.handNumber,
          phase: hand.phase,
          pot: hand.pot,
          startedAt: hand.startedAt,
          actions: timelineActions,
          winners,
          foldWinner,
          communityCards,
        };
      })
    );

    // Deduplicate by handNumber (keep latest entry if duplicates exist)
    const seen = new Set<number>();
    const deduped: typeof timeline = [];
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (!seen.has(timeline[i].handNumber)) {
        seen.add(timeline[i].handNumber);
        deduped.push(timeline[i]);
      }
    }
    deduped.reverse();

    return NextResponse.json({ timeline: deduped });
  } catch (error) {
    console.error('Error getting timeline:', error);
    return NextResponse.json({ error: 'Failed to get timeline' }, { status: 500 });
  }
}
