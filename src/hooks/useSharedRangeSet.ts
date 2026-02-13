'use client';

import { useState, useEffect, useCallback } from 'react';
import { type RangeSetData } from './useRangeSets';

export function useSharedRangeSet(shareCode: string) {
  const [rangeSet, setRangeSet] = useState<RangeSetData | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch_() {
      try {
        setError(null);
        const res = await fetch(`/api/range-sets/shared/${shareCode}`);
        if (!res.ok) {
          if (res.status === 404) {
            setRangeSet(null);
            return;
          }
          throw new Error('Failed to fetch shared range set');
        }
        const data = await res.json();
        setRangeSet(data.rangeSet);
        setCreatorName(data.creatorName);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    fetch_();
  }, [shareCode]);

  const adoptRangeSet = useCallback(async (): Promise<string | null> => {
    if (!rangeSet) return null;

    try {
      const res = await fetch(`/api/range-sets/${rangeSet.id}/adopt`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to adopt range set');
      const data = await res.json();
      return data.rangeSet.id;
    } catch {
      return null;
    }
  }, [rangeSet]);

  return {
    rangeSet,
    creatorName,
    isLoading,
    error,
    adoptRangeSet,
  };
}
