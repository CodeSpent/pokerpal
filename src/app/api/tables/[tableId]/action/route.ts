import { NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { tableRepo } from '@/lib/db/repositories';
import { submitAction, getValidActions, type ActionType } from '@/lib/game/game-service';

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
 * POST /api/tables/[tableId]/action
 * Submit a player action
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

    // Verify table exists and player is seated
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

    const body = await request.json();
    const { action, amount, version } = body as {
      action: string;
      amount?: number;
      version?: number;
    };

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Map old action format to new
    const actionMap: Record<string, ActionType> = {
      fold: 'fold',
      check: 'check',
      call: 'call',
      bet: 'bet',
      raise: 'raise',
      'all-in': 'all_in',
      allIn: 'all_in',
    };

    const mappedAction = actionMap[action] || action as ActionType;

    // Submit action using new engine
    const result = await submitAction({
      tableId,
      playerId,
      action: mappedAction,
      amount,
      handVersion: version,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Action failed' },
        { status: 400 }
      );
    }

    const actionResult = result.data!;
    const { actionDetails } = actionResult;

    // Build events for Pusher (must match what table-store.ts applyEvent expects)
    // Each event gets a unique eventId for deduplication
    const handId = actionResult.hand.id;
    const handVersion = actionResult.hand.version;
    const events = [];

    events.push({
      type: 'ACTION',  // Must match client's listener
      eventId: `action-${handId}-${handVersion}`,
      record: {
        seatIndex: actionDetails.seatIndex,
        action: actionDetails.action,
        amount: actionDetails.actualAmount, // Use actual computed amount, not request amount
        timestamp: Date.now(),
      },
    });

    // Send pot update
    events.push({
      type: 'POT_UPDATED',
      eventId: `pot-${handId}-${handVersion}`,
      pot: actionResult.hand.pot,
      sidePots: [],
    });

    if (actionResult.phaseChanged && actionResult.newPhase) {
      // Get community cards for phase change
      const communityCards = actionResult.hand.communityCards
        ? JSON.parse(actionResult.hand.communityCards).map((c: string) => ({
            rank: c[0],
            suit: c[1],
          }))
        : [];

      events.push({
        type: 'STREET_DEALT',
        eventId: `street-${handId}-${actionResult.newPhase}`,
        street: actionResult.newPhase,
        cards: communityCards,
      });
    }

    if (actionResult.nextActorSeat !== null) {
      // Use action_deadline from hand (null = unlimited timer)
      const expiresAt = actionResult.hand.actionDeadline ?? null;
      const isUnlimited = expiresAt === null;
      console.log(`[action/route] hand=${handId} broadcasting TURN_STARTED for seat ${actionResult.nextActorSeat}`);

      // Compute validActions for the next actor
      const nextActorPlayer = actionResult.players.find(
        (p) => p.seatIndex === actionResult.nextActorSeat
      );
      const toCall = Math.max(0, actionResult.hand.currentBet - (nextActorPlayer?.currentBet || 0));
      const validActionsForNextActor = nextActorPlayer
        ? getValidActions({
            status: nextActorPlayer.status,
            currentBet: actionResult.hand.currentBet,
            playerBet: nextActorPlayer.currentBet,
            playerStack: nextActorPlayer.stack,
            minRaise: actionResult.hand.minRaise,
            bigBlind: table.bigBlind,
            canCheck: toCall === 0,
          })
        : null;

      events.push({
        type: 'TURN_STARTED',
        eventId: `turn-${handId}-${handVersion}-${actionResult.nextActorSeat}`,
        seatIndex: actionResult.nextActorSeat,
        expiresAt,
        isUnlimited,
        validActions: validActionsForNextActor,
      });
    }

    // Log when no TURN_STARTED is being broadcast for an active hand
    if (actionResult.nextActorSeat === null && !actionResult.isHandComplete) {
      console.warn(`[action/route] hand=${handId} phase=${actionResult.hand.phase} — NOT broadcasting TURN_STARTED (nextActorSeat=null, isHandComplete=${actionResult.isHandComplete}). DB currentActorSeat=${actionResult.hand.currentActorSeat}`);
    }

    // Note: HAND_COMPLETE is NOT broadcast here for showdowns
    // The showdown.ts handles the complete flow with proper 10s delay
    // HAND_COMPLETE will be broadcast from completeHand() after showdown display

    // Publish events via Pusher
    if (pusher) {
      for (const event of events) {
        await pusher.trigger(`table-${tableId}`, event.type, event);
      }
    }

    return NextResponse.json({
      success: true,
      events,
      hand: actionResult.hand,
      version: actionResult.hand.version,
    });
  } catch (error) {
    console.error('Error processing action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
