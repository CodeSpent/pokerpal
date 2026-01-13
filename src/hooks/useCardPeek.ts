'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTableStore } from '@/stores/table-store';

/**
 * Hook for managing local card peek state for the hero player.
 * Cards start hidden and hero must tap to peek at them.
 * State resets automatically when a new hand starts.
 */
export function useCardPeek() {
  const [isPeeking, setIsPeeking] = useState(false);
  const handNumber = useTableStore((s) => s.handNumber);

  // Reset peek state when hand changes
  useEffect(() => {
    setIsPeeking(false);
  }, [handNumber]);

  const togglePeek = useCallback(() => {
    setIsPeeking((prev) => !prev);
  }, []);

  const hidePeek = useCallback(() => {
    setIsPeeking(false);
  }, []);

  const showPeek = useCallback(() => {
    setIsPeeking(true);
  }, []);

  return {
    isPeeking,
    togglePeek,
    hidePeek,
    showPeek,
  };
}
