'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Record<string, unknown>).standalone === true)
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden until checks pass
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (isStandalone()) return;

    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) return;

    // iOS — show manual instructions
    if (isIOS()) {
      setShowIOSGuide(true);
      setDismissed(false);
      return;
    }

    // Android / Desktop Chrome — capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (dismissed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDismissed(true);
    }
    setDeferredPrompt(null);
    setInstalling(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  // iOS guide
  if (showIOSGuide) {
    return (
      <div className="mx-2 mt-2 flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm">
        <Share className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-green-200 flex-1">
          Install this app: tap{' '}
          <Share className="inline w-3.5 h-3.5 -mt-0.5" /> in Safari, then{' '}
          <strong>&quot;Add to Home Screen&quot;</strong>.
        </span>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-green-400 hover:text-green-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Android / Desktop
  if (deferredPrompt) {
    return (
      <div className="mx-2 mt-2 flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm">
        <Download className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-green-200 flex-1">
          Install LetsPlay Poker for quick access from your home screen.
        </span>
        <button
          onClick={handleInstall}
          disabled={installing}
          className="shrink-0 px-3 py-1 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {installing ? '...' : 'Install'}
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-green-400 hover:text-green-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
