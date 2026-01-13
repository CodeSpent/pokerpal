'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import type { Channel, PresenceChannel } from 'pusher-js';

// Singleton Pusher instance
let pusherInstance: Pusher | null = null;

function getPusherClient(): Pusher | null {
  if (typeof window === 'undefined') return null;

  if (!pusherInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.warn('Pusher credentials not configured');
      return null;
    }

    pusherInstance = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
    });
  }

  return pusherInstance;
}

/**
 * Hook to get the Pusher client instance
 */
export function usePusher() {
  const [isConnected, setIsConnected] = useState(false);
  const pusher = getPusherClient();

  useEffect(() => {
    if (!pusher) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    pusher.connection.bind('connected', handleConnect);
    pusher.connection.bind('disconnected', handleDisconnect);
    pusher.connection.bind('error', handleDisconnect);

    // Check current state
    setIsConnected(pusher.connection.state === 'connected');

    return () => {
      pusher.connection.unbind('connected', handleConnect);
      pusher.connection.unbind('disconnected', handleDisconnect);
      pusher.connection.unbind('error', handleDisconnect);
    };
  }, [pusher]);

  return { pusher, isConnected };
}

/**
 * Hook to subscribe to a channel
 */
export function useChannel(channelName: string | null) {
  const { pusher } = usePusher();
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!pusher || !channelName) return;

    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    return () => {
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [pusher, channelName]);

  return channelRef.current;
}

/**
 * Hook to subscribe to channel events
 */
export function useChannelEvent<T = unknown>(
  channel: Channel | null,
  eventName: string,
  callback: (data: T) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!channel) return;

    const handler = (data: T) => {
      callbackRef.current(data);
    };

    channel.bind(eventName, handler);

    return () => {
      channel.unbind(eventName, handler);
    };
  }, [channel, eventName]);
}

/**
 * Hook to subscribe to a presence channel
 */
export function usePresenceChannel(channelName: string | null) {
  const { pusher } = usePusher();
  const [members, setMembers] = useState<Map<string, unknown>>(new Map());
  const channelRef = useRef<PresenceChannel | null>(null);

  useEffect(() => {
    if (!pusher || !channelName) return;

    const channel = pusher.subscribe(channelName) as PresenceChannel;
    channelRef.current = channel;

    channel.bind('pusher:subscription_succeeded', () => {
      const memberMap = new Map<string, unknown>();
      channel.members.each((member: { id: string; info: unknown }) => {
        memberMap.set(member.id, member.info);
      });
      setMembers(memberMap);
    });

    channel.bind('pusher:member_added', (member: { id: string; info: unknown }) => {
      setMembers((prev) => new Map(prev).set(member.id, member.info));
    });

    channel.bind('pusher:member_removed', (member: { id: string }) => {
      setMembers((prev) => {
        const next = new Map(prev);
        next.delete(member.id);
        return next;
      });
    });

    return () => {
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [pusher, channelName]);

  return { channel: channelRef.current, members };
}
