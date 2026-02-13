'use client';

import { useState, useEffect, useCallback } from 'react';
import { type RangeSetData } from './useRangeSets';

export function useRangeSet(id: string) {
  const [rangeSet, setRangeSet] = useState<RangeSetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRangeSet = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/range-sets/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setRangeSet(null);
          return;
        }
        throw new Error('Failed to fetch range set');
      }
      const data = await res.json();
      setRangeSet(data.rangeSet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRangeSet();
  }, [fetchRangeSet]);

  const updateRangeSet = useCallback(
    async (updates: { name?: string; description?: string; positions?: Record<string, { hands: string[] }> }) => {
      try {
        const res = await fetch(`/api/range-sets/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('Failed to update');
        // Optimistically update local state
        setRangeSet((prev) => (prev ? { ...prev, ...updates, updatedAt: Date.now() } : prev));
        return true;
      } catch {
        return false;
      }
    },
    [id]
  );

  const deleteRangeSet = useCallback(async () => {
    try {
      const res = await fetch(`/api/range-sets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return true;
    } catch {
      return false;
    }
  }, [id]);

  const toggleShare = useCallback(async (): Promise<string | null> => {
    if (!rangeSet) return null;

    const newShared = !rangeSet.isShared;
    try {
      const res = await fetch(`/api/range-sets/${id}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isShared: newShared }),
      });
      if (!res.ok) throw new Error('Failed to toggle share');
      const data = await res.json();
      setRangeSet((prev) =>
        prev ? { ...prev, isShared: data.isShared, shareCode: data.shareCode } : prev
      );
      return data.shareCode;
    } catch {
      return null;
    }
  }, [id, rangeSet]);

  return {
    rangeSet,
    isLoading,
    error,
    updateRangeSet,
    deleteRangeSet,
    toggleShare,
  };
}
