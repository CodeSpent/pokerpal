'use client';

import { useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useChannel, useChannelEvent, usePusher } from './usePusher';
import { useTableStore } from '@/stores/table-store';
import type { TableEvent } from '@/lib/poker-engine-v2/types';

/**
 * Hook to subscribe to table updates via Pusher
 */
export function useTableChannel(tableId: string | null) {
  const { isConnected } = usePusher();
  const { applyEvent, setConnected, setHeroHoleCards } = useTableStore();
  const { data: session } = useSession();

  // Subscribe to public table channel
  const channelName = tableId ? `table-${tableId}` : null;
  const channel = useChannel(channelName);

  // Subscribe to private player channel for hole cards
  const playerId = session?.user?.playerId ?? null;

  const privateChannelName = playerId ? `private-player-${playerId}` : null;
  const privateChannel = useChannel(privateChannelName);

  // Update connection state
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected, setConnected]);

  // Create event handler that wraps payload with event type
  // Note: applyEvent handles deduplication internally and updates sync timestamp only for non-duplicates
  const createEventHandler = useCallback(
    (eventType: string) => (payload: Record<string, unknown>) => {
      applyEvent({ type: eventType, ...payload } as TableEvent);
    },
    [applyEvent]
  );

  // Bind to all table event types
  useChannelEvent(channel, 'PLAYER_SEATED', createEventHandler('PLAYER_SEATED'));
  useChannelEvent(channel, 'PLAYER_LEFT', createEventHandler('PLAYER_LEFT'));
  useChannelEvent(channel, 'HAND_STARTED', createEventHandler('HAND_STARTED'));
  useChannelEvent(channel, 'ACTION', createEventHandler('ACTION'));
  useChannelEvent(channel, 'STREET_DEALT', createEventHandler('STREET_DEALT'));
  useChannelEvent(channel, 'POT_UPDATED', createEventHandler('POT_UPDATED'));
  useChannelEvent(channel, 'TURN_STARTED', createEventHandler('TURN_STARTED'));
  useChannelEvent(channel, 'PLAYER_TIMEOUT', createEventHandler('PLAYER_TIMEOUT'));
  useChannelEvent(channel, 'SHOWDOWN', createEventHandler('SHOWDOWN'));
  useChannelEvent(channel, 'WINNER', createEventHandler('WINNER'));
  useChannelEvent(channel, 'HAND_COMPLETE', createEventHandler('HAND_COMPLETE'));
  useChannelEvent(channel, 'TOURNAMENT_COMPLETE', createEventHandler('TOURNAMENT_COMPLETE'));

  // Handle private hole cards event
  useChannelEvent(privateChannel, 'HOLE_CARDS_DEALT', (data: { cards: [unknown, unknown] }) => {
    setHeroHoleCards(data.cards as [unknown, unknown] as never);
  });

  return { channel, isConnected };
}
