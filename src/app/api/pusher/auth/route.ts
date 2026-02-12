import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import Pusher from 'pusher';
import { tableRepo } from '@/lib/db/repositories';

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
    const authPlayer = await getAuthenticatedPlayer();

    if (!authPlayer) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { playerId } = authPlayer;

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
    if (channelName.startsWith('private-table:')) {
      const tableId = channelName.replace('private-table:', '');
      const { players } = await tableRepo.getTableWithPlayers(tableId);
      const isSeated = players.some(p => p.playerId === playerId);

      if (!isSeated) {
        return NextResponse.json(
          { error: 'Not seated at this table' },
          { status: 403 }
        );
      }
    }

    if (channelName.startsWith('presence-')) {
      const presenceData = {
        user_id: playerId,
        user_info: {},
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
