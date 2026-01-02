import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Pusher from 'pusher';
import {
  getTableWithPlayers,
  getCurrentHand,
  getPlayerAtTable,
  getDatabase,
  recoverInvalidActorState,
  cleanupBrokenHands,
} from '@/lib/poker-engine-v2';
import { getValidActions } from '@/lib/poker-engine-v2/state-machine/player-fsm';
import { handleTurnTimeout } from '@/lib/poker-engine-v2/hand/timeout';
import { startNewHand } from '@/lib/poker-engine-v2/hand/start';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

// Initialize Pusher server (only if credentials exist)
let pusher: Pusher | null = null;
if (process.env.PUSHER_APP_ID) {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });
}

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

    // Cleanup any broken 'dealing' phase hands first
    cleanupBrokenHands(tableId);

    // Check for expired turns before fetching state
    // This handles disconnected players when any client polls
    handleTurnTimeout(tableId);

    // Recover from invalid actor state (e.g., current actor is all-in)
    recoverInvalidActorState(tableId);

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

    // Get current hand
    let hand = getCurrentHand(tableId);

    // If no active hand, check if we should start a new one
    if (!hand) {
      const db = getDatabase();

      // Check if there are enough active players
      const activePlayers = players.filter(p =>
        !['eliminated', 'sitting_out'].includes(p.status)
      );

      if (activePlayers.length >= 2) {
        // Get the last completed hand number
        const lastHand = db.prepare(`
          SELECT hand_number FROM hands
          WHERE table_id = ?
          ORDER BY hand_number DESC
          LIMIT 1
        `).get(tableId) as { hand_number: number } | undefined;

        const nextHandNumber = (lastHand?.hand_number || 0) + 1;

        try {
          console.log(`[GET /api/tables] Starting new hand #${nextHandNumber}`);
          hand = startNewHand(db, tableId, nextHandNumber);

          // Broadcast Pusher events so all clients get notified
          if (pusher && hand) {
            // Broadcast HAND_STARTED event
            await pusher.trigger(`table-${tableId}`, 'HAND_STARTED', {
              handNumber: hand.hand_number,
              dealerSeatIndex: hand.dealer_seat,
              smallBlindSeatIndex: hand.small_blind_seat,
              bigBlindSeatIndex: hand.big_blind_seat,
              firstActorSeat: hand.current_actor_seat,
              blinds: {
                sb: table.small_blind,
                bb: table.big_blind,
              },
            });

            // Broadcast TURN_STARTED event
            await pusher.trigger(`table-${tableId}`, 'TURN_STARTED', {
              seatIndex: hand.current_actor_seat,
              expiresAt: hand.action_deadline ?? null,
              isUnlimited: hand.action_deadline === null,
            });
          }
        } catch (err) {
          console.error('[GET /api/tables] Failed to start new hand:', err);
        }
      }
    }

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

/**
 * Parse card string (e.g., "Ah") to Card object
 */
function parseCard(cardStr: string): { rank: string; suit: string } {
  const rank = cardStr[0];
  const suit = cardStr[1]; // Keep as short form: 'h', 'd', 'c', 's'

  return {
    rank,
    suit,
  };
}
