'use client';

import { useState, useEffect, useCallback } from 'react';
import { type Position } from '@/types/poker';

export interface PositionRangeData {
  hands: string[];
}

export interface RangeSetData {
  id: string;
  name: string;
  description: string | null;
  positions: Partial<Record<Position, PositionRangeData>>;
  isDefault: boolean;
  isShared: boolean;
  shareCode: string | null;
  createdAt: number;
  updatedAt: number;
}

export function useRangeSets() {
  const [rangeSets, setRangeSets] = useState<RangeSetData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRangeSets = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/range-sets');
      if (!res.ok) throw new Error('Failed to fetch range sets');
      const data = await res.json();
      setRangeSets(data.rangeSets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRangeSets();
  }, [fetchRangeSets]);

  const createRangeSet = useCallback(async (name: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/range-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create range set');
      const data = await res.json();
      await fetchRangeSets();
      return data.rangeSet.id;
    } catch {
      return null;
    }
  }, [fetchRangeSets]);

  const deleteRangeSet = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/range-sets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchRangeSets();
    } catch {
      // silently fail, user sees no change
    }
  }, [fetchRangeSets]);

  const duplicateRangeSet = useCallback(async (id: string): Promise<string | null> => {
    const source = rangeSets.find((rs) => rs.id === id);
    if (!source) return null;

    try {
      const res = await fetch('/api/range-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${source.name} (copy)`,
          description: source.description,
          positions: source.positions,
        }),
      });
      if (!res.ok) throw new Error('Failed to duplicate');
      const data = await res.json();
      await fetchRangeSets();
      return data.rangeSet.id;
    } catch {
      return null;
    }
  }, [rangeSets, fetchRangeSets]);

  const migrateFromLocalStorage = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem('pokerpal-range-sets');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const localSets = parsed?.state?.rangeSets;
      if (!Array.isArray(localSets) || localSets.length === 0) return;

      // Only migrate if user has no server-side data (beyond the auto-seeded default)
      if (rangeSets.length > 1) return;

      // If the only server-side set is the auto-seeded default, check if localStorage
      // has meaningful different data
      for (const ls of localSets) {
        // Skip if it looks like the same auto-seeded default
        if (ls.isDefault && ls.name === 'Standard Opening Ranges') continue;

        await fetch('/api/range-sets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: ls.name,
            description: ls.description,
            positions: ls.positions,
          }),
        });
      }

      localStorage.removeItem('pokerpal-range-sets');
      await fetchRangeSets();
    } catch {
      // migration is best-effort
    }
  }, [rangeSets.length, fetchRangeSets]);

  return {
    rangeSets,
    isLoading,
    error,
    createRangeSet,
    deleteRangeSet,
    duplicateRangeSet,
    migrateFromLocalStorage,
  };
}
