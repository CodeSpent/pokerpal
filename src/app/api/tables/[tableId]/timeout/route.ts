import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Pusher from 'pusher';
import { handleTurnTimeout } from '@/lib/poker-engine-v2/hand/timeout';
import { getTableWithPlayers, getCurrentHand } from '@/lib/poker-engine-v2';

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
 * POST /api/tables/[tableId]/timeout
 * Handle a turn timeout - auto-folds the current actor
 */
export async function POST(
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

    // Handle the timeout
    const result = handleTurnTimeout(tableId);

    if (!result.success) {
      // If the turn hasn't expired, no actor, or unlimited timer - just return
      if (result.code === 'NOT_EXPIRED' || result.code === 'NO_ACTOR' || result.code === 'UNLIMITED_TIMER') {
        return NextResponse.json({
          success: true,
          message: 'No timeout to process',
        });
      }

      return NextResponse.json(
        { error: result.error || 'Timeout handling failed' },
        { status: 400 }
      );
    }

    const timeoutData = result.data!;

    // Broadcast timeout event via Pusher
    if (pusher) {
      await pusher.trigger(`table-${tableId}`, 'PLAYER_TIMEOUT', {
        type: 'PLAYER_TIMEOUT',
        seatIndex: timeoutData.seatIndex,
      });

      // Also send the action event for the fold
      await pusher.trigger(`table-${tableId}`, 'ACTION', {
        type: 'ACTION',
        record: {
          seatIndex: timeoutData.seatIndex,
          action: 'fold',
          amount: 0,
          timestamp: Date.now(),
        },
      });

      // Get updated hand state and send turn/phase updates
      const hand = getCurrentHand(tableId);
      if (hand) {
        if (hand.current_actor_seat !== null) {
          // Use action_deadline from hand (null = unlimited timer)
          const expiresAt = hand.action_deadline ?? null;
          const isUnlimited = expiresAt === null;

          await pusher.trigger(`table-${tableId}`, 'TURN_STARTED', {
            type: 'TURN_STARTED',
            seatIndex: hand.current_actor_seat,
            expiresAt,
            isUnlimited,
          });
        }

        await pusher.trigger(`table-${tableId}`, 'POT_UPDATED', {
          type: 'POT_UPDATED',
          pot: hand.pot,
          sidePots: [],
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Player at seat ${timeoutData.seatIndex} auto-folded due to timeout`,
      seatIndex: timeoutData.seatIndex,
    });
  } catch (error) {
    console.error('Error handling timeout:', error);
    return NextResponse.json(
      { error: 'Failed to handle timeout' },
      { status: 500 }
    );
  }
}
