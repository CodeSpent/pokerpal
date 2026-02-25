'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationPrompt() {
  const { permission, isSubscribed, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed || isSubscribed || permission === 'denied' || permission === 'unsupported') {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    await subscribe();
    setLoading(false);
  };

  return (
    <div className="mx-2 mt-2 flex items-center gap-3 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-sm">
      <Bell className="w-4 h-4 text-purple-400 shrink-0" />
      <span className="text-purple-200 flex-1">
        Enable notifications to get alerted when it&apos;s your turn.
      </span>
      <button
        onClick={handleEnable}
        disabled={loading}
        className="shrink-0 px-3 py-1 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'Enable'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-purple-400 hover:text-purple-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
