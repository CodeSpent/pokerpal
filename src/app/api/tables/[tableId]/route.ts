import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { tableRepo } from '@/lib/db/repositories';
import { advanceGameState, getValidActions } from '@/lib/game/game-service';
import { parseCard } from '@/lib/card-utils';

/**
 * GET /api/tables/[tableId]
 * Get table state
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    const { playerId } = authPlayer;

    const { tableId } = await params;

    // Advance game state idempotently
    // This handles: cleanup, timeouts, actor recovery, showdown completion, new hand start
    // All operations are idempotent - safe to call from multiple concurrent pollers
    const advanceResult = await advanceGameState(tableId);

    // Get fresh table and player state after any advances
    const { table, players } = await tableRepo.getTableWithPlayers(tableId);

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Find player's seat
    const playerSeat = players.find((p) => p.playerId === playerId);

    if (!playerSeat) {
      return NextResponse.json(
        { error: 'You are not seated at this table' },
        { status: 403 }
      );
    }

    // Get current hand from advance result (or null if no active hand)
    const hand = advanceResult.hand;

    // Build response with hidden hole cards for opponents
    const isShowdown = hand?.phase === 'showdown';

    const sanitizedSeats = players.map((player) => {
      // Only show hole cards for the requesting player
      // (or during showdown for all remaining players)
      const showCards =
        player.playerId === playerId ||
        (isShowdown && !['folded', 'sitting_out', 'eliminated'].includes(player.status));

      return {
        index: player.seatIndex,
        player: {
          id: player.playerId,
          displayName: player.name,
          seatIndex: player.seatIndex,
          stack: player.stack,
          status: player.status,
          currentBet: player.currentBet,
          hasActed: player.status === 'acted',
          isAllIn: player.status === 'all_in',
          isSittingOut: player.status === 'sitting_out',
          holeCards: showCards && player.holeCard1 && player.holeCard2
            ? [
                parseCard(player.holeCard1),
                parseCard(player.holeCard2),
              ]
            : undefined,
        },
      };
    });

    // Parse community cards
    const communityCards = hand?.communityCards
      ? JSON.parse(hand.communityCards).map(parseCard)
      : [];

    // Determine phase - check for tournament complete first
    const phase = table.status === 'complete'
      ? 'tournament-complete'
      : (hand?.phase || 'waiting');

    // Build table state matching old format
    const tableState = {
      id: table.id,
      tournamentId: table.tournamentId,
      tableNumber: table.tableNumber,
      maxSeats: table.maxSeats,
      status: table.status,
      phase,
      handNumber: hand?.handNumber || 0,
      dealerSeatIndex: table.dealerSeat,
      smallBlindSeatIndex: hand?.smallBlindSeat ?? null,
      bigBlindSeatIndex: hand?.bigBlindSeat ?? null,
      currentActorSeatIndex: hand?.currentActorSeat ?? null,
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      ante: table.ante,
      pot: hand?.pot || 0,
      currentBet: hand?.currentBet || 0,
      minRaise: hand?.minRaise || table.bigBlind,
      communityCards,
      seats: sanitizedSeats,
      sidePots: [],
      turnExpiresAt: hand?.actionDeadline ?? null,
      turnIsUnlimited: hand?.actionDeadline === null || hand?.actionDeadline === undefined,
      version: table.version,
    };

    // Compute valid actions if it's the hero's turn
    let validActions = null;
    const isHeroTurn = hand?.currentActorSeat === playerSeat.seatIndex;

    if (isHeroTurn && hand) {
      const toCall = Math.max(0, hand.currentBet - playerSeat.currentBet);

      console.log('[GET /api/tables] validActions inputs:', {
        status: playerSeat.status,
        currentBet: hand.currentBet,
        playerBet: playerSeat.currentBet,
        playerStack: playerSeat.stack,
        minRaise: hand.minRaise,
        bigBlind: table.bigBlind,
        toCall,
      });

      validActions = getValidActions({
        status: playerSeat.status,
        currentBet: hand.currentBet,
        playerBet: playerSeat.currentBet,
        playerStack: playerSeat.stack,
        minRaise: hand.minRaise,
        bigBlind: table.bigBlind,
        canCheck: toCall === 0,
      });
    }

    // Get tournament winner info if tournament is complete
    let tournamentWinner = null;
    if (table.status === 'complete' && players.length > 0) {
      // Find the player with the most chips (the winner)
      const winner = players.reduce((prev, current) =>
        (prev.stack > current.stack) ? prev : current
      );
      tournamentWinner = {
        playerId: winner.playerId,
        name: winner.name,
        seatIndex: winner.seatIndex,
        stack: winner.stack,
      };
    }

    // Telemetry: detect "no one's turn" state during active hand
    if (hand && !['complete', 'showdown', 'awarding', 'hand-complete', 'dealing'].includes(hand.phase) && hand.currentActorSeat === null) {
      console.warn(`[GET /api/tables] NO_ACTOR_BUG: hand=${hand.id} phase=${hand.phase} currentActorSeat=null during betting phase. Players:`, players.map(p => `s${p.seatIndex}:${p.status}:bet${p.currentBet}:stack${p.stack}`).join(', '));
    }

    return NextResponse.json({
      table: tableState,
      heroSeatIndex: playerSeat.seatIndex,
      validActions,
      tournamentWinner,
    });
  } catch (error) {
    console.error('Error getting table:', error);
    return NextResponse.json(
      { error: 'Failed to get table' },
      { status: 500 }
    );
  }
}
