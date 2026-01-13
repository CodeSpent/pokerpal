/**
 * Shared Pusher Server Instance
 *
 * Singleton Pusher instance for server-side event broadcasting.
 * Import this instead of creating new Pusher instances in each file.
 */

import Pusher from 'pusher';

let pusher: Pusher | null = null;

export function getPusher(): Pusher | null {
  if (pusher) return pusher;

  if (!process.env.PUSHER_APP_ID) {
    console.warn('Pusher credentials not configured');
    return null;
  }

  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });

  return pusher;
}

// Channel name helpers
export const channels = {
  tournaments: 'tournaments',
  tournament: (id: string) => `tournament-${id}`,
  table: (id: string) => `table-${id}`,
  privatePlayer: (id: string) => `private-player-${id}`,
};

// Event types for tournaments
export const tournamentEvents = {
  TOURNAMENT_CREATED: 'TOURNAMENT_CREATED',
  PLAYER_REGISTERED: 'PLAYER_REGISTERED',
  PLAYER_UNREGISTERED: 'PLAYER_UNREGISTERED',
  COUNTDOWN_STARTED: 'COUNTDOWN_STARTED',
  PLAYER_READY: 'PLAYER_READY',
  COUNTDOWN_CANCELLED: 'COUNTDOWN_CANCELLED',
  GAME_STARTING: 'GAME_STARTING',
} as const;
