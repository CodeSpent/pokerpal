import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { tableRepo } from '@/lib/db/repositories';
import { advanceGameState, getValidActions } from '@/lib/game/game-service';
import { parseCard } from '@/lib/card-utils';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

/**
 * GET /api/tables/[tableId]
 * Get table state
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

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

    // Build table state matching old format
    const tableState = {
      id: table.id,
      tournamentId: table.tournamentId,
      tableNumber: table.tableNumber,
      maxSeats: table.maxSeats,
      status: table.status,
      phase: hand?.phase || 'waiting',
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

    console.log('[GET /api/tables] tableId:', tableId);
    console.log('[GET /api/tables] currentActorSeatIndex:', hand?.currentActorSeat);
    console.log('[GET /api/tables] phase:', hand?.phase);
    console.log('[GET /api/tables] playerSeat.status:', playerSeat.status);
    console.log('[GET /api/tables] playerSeat.stack:', playerSeat.stack);
    console.log('[GET /api/tables] playerSeat.currentBet:', playerSeat.currentBet);
    console.log('[GET /api/tables] hand.currentBet:', hand?.currentBet);
    console.log('[GET /api/tables] heroSeatIndex:', playerSeat.seatIndex);
    console.log('[GET /api/tables] isHeroTurn:', isHeroTurn);
    console.log('[GET /api/tables] validActions:', validActions);

    return NextResponse.json({
      table: tableState,
      heroSeatIndex: playerSeat.seatIndex,
      validActions,
    });
  } catch (error) {
    console.error('Error getting table:', error);
    return NextResponse.json(
      { error: 'Failed to get table' },
      { status: 500 }
    );
  }
}
