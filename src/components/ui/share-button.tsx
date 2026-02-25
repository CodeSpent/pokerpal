'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { Share2, Check, Copy } from 'lucide-react';

interface ShareButtonProps {
  url: string;
  title: string;
  text: string;
  className?: string;
  variant?: 'default' | 'compact';
}

export function ShareButton({ url, title, text, className, variant = 'default' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or not supported, fall through to clipboard
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Final fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [url, title, text]);

  if (variant === 'compact') {
    return (
      <button
        onClick={handleShare}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          copied
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
          className
        )}
      >
        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        {copied ? 'Copied!' : 'Invite'}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={cn(
        'flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium transition-colors',
        copied
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
          : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700',
        className
      )}
    >
      {copied ? (
        <>
          <Check className="w-5 h-5" />
          Link Copied!
        </>
      ) : (
        <>
          <Copy className="w-5 h-5" />
          Copy Invite Link
        </>
      )}
    </button>
  );
}
