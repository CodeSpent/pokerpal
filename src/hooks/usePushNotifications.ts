'use client';

import { useState, useEffect, useCallback } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [permission, setPermission] = useState<Permission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as Permission);

    navigator.serviceWorker.ready.then(async (registration) => {
      const sub = await registration.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
      if (result !== 'granted') return false;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('[Push] No VAPID public key configured');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const subJson = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });

      if (!res.ok) {
        console.error('[Push] Server subscribe failed:', await res.text());
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) return true;

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      return false;
    }
  }, []);

  return { permission, isSubscribed, subscribe, unsubscribe };
}
