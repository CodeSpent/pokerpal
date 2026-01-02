'use client';

import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  /** Whether shortcuts are enabled (e.g., it's hero's turn) */
  isEnabled: boolean;
  /** Handler for fold action (F key) */
  onFold: () => void;
  /** Handler for check action (C key when check available) */
  onCheck: () => void;
  /** Handler for call action (C key when call available) */
  onCall: () => void;
  /** Handler for showing bet slider (B key) */
  onShowBet: () => void;
  /** Handler for showing raise slider (R key) */
  onShowRaise: () => void;
  /** Handler for canceling slider (Escape key) */
  onCancel: () => void;
  /** Whether check is available */
  canCheck: boolean;
  /** Whether call is available */
  canCall: boolean;
  /** Whether bet is available */
  canBet: boolean;
  /** Whether raise is available */
  canRaise: boolean;
}

/**
 * Hook for handling keyboard shortcuts in poker action controls
 *
 * Keyboard shortcuts:
 * - F: Fold
 * - C: Check (if available) or Call (if available)
 * - B: Show bet slider (if bet is available)
 * - R: Show raise slider (if raise is available) or bet slider (if bet is available)
 * - Escape: Cancel/close slider
 */
export function useActionKeyboardShortcuts({
  isEnabled,
  onFold,
  onCheck,
  onCall,
  onShowBet,
  onShowRaise,
  onCancel,
  canCheck,
  canCall,
  canBet,
  canRaise,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case 'f':
          onFold();
          break;
        case 'c':
          if (canCheck) {
            onCheck();
          } else if (canCall) {
            onCall();
          }
          break;
        case 'b':
          if (canBet && !canRaise) {
            onShowBet();
          }
          break;
        case 'r':
          if (canRaise) {
            onShowRaise();
          } else if (canBet) {
            onShowBet();
          }
          break;
        case 'escape':
          onCancel();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isEnabled,
    onFold,
    onCheck,
    onCall,
    onShowBet,
    onShowRaise,
    onCancel,
    canCheck,
    canCall,
    canBet,
    canRaise,
  ]);
}
