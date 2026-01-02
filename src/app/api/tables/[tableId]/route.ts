import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getTableWithPlayers,
  getDatabase,
} from '@/lib/poker-engine-v2';
import { parseCard } from '@/lib/card-utils';
import { getValidActions } from '@/lib/poker-engine-v2/state-machine/player-fsm';
import { advanceGameState } from '@/lib/poker-engine-v2/game/advance-game';

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
    const db = getDatabase();

    // Advance game state idempotently
    // This handles: cleanup, timeouts, actor recovery, showdown completion, new hand start
    // All operations are idempotent - safe to call from multiple concurrent pollers
    const advanceResult = advanceGameState(db, tableId);

    // Get fresh table and player state after any advances
    const { table, players } = getTableWithPlayers(tableId);

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Find player's seat
    const playerSeat = players.find((p) => p.player_id === playerId);

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

    const sanitizedSeats = players.map((player, index) => {
      // Only show hole cards for the requesting player
      // (or during showdown for all remaining players)
      const showCards =
        player.player_id === playerId ||
        (isShowdown && !['folded', 'sitting_out', 'eliminated'].includes(player.status));

      return {
        index: player.seat_index,
        player: {
          id: player.player_id,
          displayName: player.name,
          seatIndex: player.seat_index,
          stack: player.stack,
          status: player.status,
          currentBet: player.current_bet,
          hasActed: player.status === 'acted',
          isAllIn: player.status === 'all_in',
          isSittingOut: player.status === 'sitting_out',
          holeCards: showCards && player.hole_card_1 && player.hole_card_2
            ? [
                parseCard(player.hole_card_1),
                parseCard(player.hole_card_2),
              ]
            : undefined,
        },
      };
    });

    // Parse community cards
    const communityCards = hand?.community_cards
      ? JSON.parse(hand.community_cards).map(parseCard)
      : [];

    // Build table state matching old format
    const tableState = {
      id: table.id,
      tournamentId: table.tournament_id,
      tableNumber: table.table_number,
      maxSeats: table.max_seats,
      status: table.status,
      phase: hand?.phase || 'waiting',
      handNumber: hand?.hand_number || 0,
      dealerSeatIndex: table.dealer_seat,
      smallBlindSeatIndex: hand?.small_blind_seat ?? null,
      bigBlindSeatIndex: hand?.big_blind_seat ?? null,
      currentActorSeatIndex: hand?.current_actor_seat ?? null,
      smallBlind: table.small_blind,
      bigBlind: table.big_blind,
      ante: table.ante,
      pot: hand?.pot || 0,
      currentBet: hand?.current_bet || 0,
      minRaise: hand?.min_raise || table.big_blind,
      communityCards,
      seats: sanitizedSeats,
      sidePots: [], // TODO: Calculate side pots when all-in situations occur
      turnExpiresAt: hand?.action_deadline ?? null,
      turnIsUnlimited: hand?.action_deadline === null || hand?.action_deadline === undefined,
      version: table.version,
    };

    // Compute valid actions if it's the hero's turn
    let validActions = null;
    const isHeroTurn = hand?.current_actor_seat === playerSeat.seat_index;

    if (isHeroTurn && hand) {
      const toCall = Math.max(0, hand.current_bet - playerSeat.current_bet);

      // Log the inputs to validActions computation
      console.log('[GET /api/tables] validActions inputs:', {
        status: playerSeat.status,
        currentBet: hand.current_bet,
        playerBet: playerSeat.current_bet,
        playerStack: playerSeat.stack,
        minRaise: hand.min_raise,
        bigBlind: table.big_blind,
        toCall,
      });

      validActions = getValidActions({
        status: playerSeat.status,
        currentBet: hand.current_bet,
        playerBet: playerSeat.current_bet,
        playerStack: playerSeat.stack,
        minRaise: hand.min_raise,
        bigBlind: table.big_blind,
        canCheck: toCall === 0,
      });
    }

    console.log('[GET /api/tables] tableId:', tableId);
    console.log('[GET /api/tables] currentActorSeatIndex:', hand?.current_actor_seat);
    console.log('[GET /api/tables] phase:', hand?.phase);
    console.log('[GET /api/tables] playerSeat.status:', playerSeat.status);
    console.log('[GET /api/tables] playerSeat.stack:', playerSeat.stack);
    console.log('[GET /api/tables] playerSeat.current_bet:', playerSeat.current_bet);
    console.log('[GET /api/tables] hand.current_bet:', hand?.current_bet);
    console.log('[GET /api/tables] heroSeatIndex:', playerSeat.seat_index);
    console.log('[GET /api/tables] isHeroTurn:', isHeroTurn);
    console.log('[GET /api/tables] validActions:', validActions);

    return NextResponse.json({
      table: tableState,
      heroSeatIndex: playerSeat.seat_index,
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

