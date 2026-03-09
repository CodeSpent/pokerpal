import { NextResponse } from 'next/server';
import { tableRepo, handRepo } from '@/lib/db/repositories';

/**
 * GET /api/tables/[tableId]/audit
 * Get complete audit log for a table
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;

    const { table, players: tablePlayers } = await tableRepo.getTableWithPlayers(tableId);

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Build player name lookup from tablePlayers (already includes name from join)
    const playerNameMap = new Map<string, string>();
    for (const tp of tablePlayers) {
      playerNameMap.set(tp.playerId, tp.name);
    }

    // Get all hands for this table
    const allHands = await handRepo.getHandsByTable(tableId);

    // Build audit data for each hand
    const handsData = await Promise.all(
      allHands.map(async (hand) => {
        const actions = await handRepo.getHandActions(hand.id);
        const showdownResults = await handRepo.getShowdownResults(hand.id);

        return {
          handNumber: hand.handNumber,
          dealerSeat: hand.dealerSeat,
          sbSeat: hand.smallBlindSeat,
          bbSeat: hand.bigBlindSeat,
          communityCards: hand.communityCards,
          finalPot: hand.pot,
          phase: hand.phase,
          startedAt: hand.startedAt,
          endedAt: hand.endedAt,
          actions: actions.map((a) => ({
            sequence: a.sequence,
            playerName: playerNameMap.get(a.playerId) ?? 'Unknown',
            seatIndex: a.seatIndex,
            actionType: a.actionType,
            amount: a.amount,
            stackBefore: a.stackBefore ?? null,
            stackAfter: a.stackAfter ?? null,
            potBefore: a.potBefore ?? null,
            potAfter: a.potAfter ?? null,
            phase: a.phase,
            createdAt: a.createdAt,
          })),
          showdown: showdownResults.map((s) => ({
            playerName: playerNameMap.get(s.playerId) ?? 'Unknown',
            seatIndex: s.seatIndex,
            handRank: s.handRank,
            handDescription: s.handDescription,
            winnings: s.winnings,
          })),
        };
      })
    );

    return NextResponse.json({
      table: {
        id: table.id,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        gameType: table.tournamentId ? 'tournament' : table.cashGameId ? 'cash' : 'flex',
      },
      hands: handsData,
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    return NextResponse.json({ error: 'Failed to get audit log' }, { status: 500 });
  }
}
