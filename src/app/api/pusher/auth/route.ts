import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Pusher from 'pusher';
import { getTableWithPlayers } from '@/lib/poker-engine-v2';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

// Initialize Pusher server
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * POST /api/pusher/auth
 * Authenticate Pusher channel subscriptions
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.text();
    const params = new URLSearchParams(body);

    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    // Validate channel access
    // Private channels: private-{type}:{id}
    // Presence channels: presence-{type}:{id}

    if (channelName.startsWith('private-table:')) {
      // Private table channel for hole cards - verify player is seated
      const tableId = channelName.replace('private-table:', '');
      const { players } = getTableWithPlayers(tableId);
      const isSeated = players.some(p => p.player_id === playerId);

      if (!isSeated) {
        return NextResponse.json(
          { error: 'Not seated at this table' },
          { status: 403 }
        );
      }
    }

    if (channelName.startsWith('presence-')) {
      // Presence channel for lobby or tournament
      const presenceData = {
        user_id: playerId,
        user_info: {
          // TODO: Include display name from database/localStorage
        },
      };

      const authResponse = pusher.authorizeChannel(
        socketId,
        channelName,
        presenceData
      );

      return NextResponse.json(authResponse);
    }

    // Regular private channel
    const authResponse = pusher.authorizeChannel(socketId, channelName);

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
