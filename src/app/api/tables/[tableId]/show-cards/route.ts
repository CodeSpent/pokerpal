import { NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { tableRepo, handRepo } from '@/lib/db/repositories';

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
 * POST /api/tables/[tableId]/show-cards
 * Voluntarily show cards to opponents (after folding)
 *
 * Body: { cardIndices: number[] }
 *   - cardIndices: Array of 0 and/or 1 to indicate which cards to show
 *   - e.g., [0] shows first card, [1] shows second, [0, 1] shows both
 */
export async function POST(
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

    // Get table and player info
    const { table, players } = await tableRepo.getTableWithPlayers(tableId);

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    const playerSeat = players.find((p) => p.playerId === playerId);

    if (!playerSeat) {
      return NextResponse.json(
        { error: 'You are not seated at this table' },
        { status: 403 }
      );
    }

    // Verify player is folded
    if (playerSeat.status !== 'folded') {
      return NextResponse.json(
        { error: 'You can only show cards after folding' },
        { status: 400 }
      );
    }

    // Verify player has hole cards
    if (!playerSeat.holeCard1 || !playerSeat.holeCard2) {
      return NextResponse.json(
        { error: 'No cards to show' },
        { status: 400 }
      );
    }

    // Get current hand to include hand number in event
    const currentHand = await handRepo.getCurrentHand(tableId);
    if (!currentHand) {
      return NextResponse.json(
        { error: 'No active hand' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { cardIndices } = body as { cardIndices: number[] };

    if (!cardIndices || !Array.isArray(cardIndices) || cardIndices.length === 0) {
      return NextResponse.json(
        { error: 'cardIndices is required (array of 0 and/or 1)' },
        { status: 400 }
      );
    }

    // Validate card indices
    const validIndices = cardIndices.filter((i) => i === 0 || i === 1);
    if (validIndices.length === 0) {
      return NextResponse.json(
        { error: 'Invalid card indices. Use 0 for first card, 1 for second card' },
        { status: 400 }
      );
    }

    // Build the cards array [card1 | null, card2 | null]
    const shownCards: [string | null, string | null] = [
      validIndices.includes(0) ? playerSeat.holeCard1 : null,
      validIndices.includes(1) ? playerSeat.holeCard2 : null,
    ];

    // Build CARDS_SHOWN event
    const event = {
      type: 'CARDS_SHOWN',
      eventId: `cards-shown-${currentHand.handNumber}-${playerSeat.seatIndex}-${Date.now()}`,
      seatIndex: playerSeat.seatIndex,
      cards: shownCards,
      handNumber: currentHand.handNumber,
    };

    // Broadcast via Pusher
    if (pusher) {
      await pusher.trigger(`table-${tableId}`, 'CARDS_SHOWN', event);
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Error showing cards:', error);
    return NextResponse.json(
      { error: 'Failed to show cards' },
      { status: 500 }
    );
  }
}
