import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Position } from "@/types/poker";

export interface RangeData {
  id: string;
  name: string;
  description?: string;
  hands: string[];
  position?: Position;
  situation?: "open-raise" | "call-open" | "3bet" | "call-3bet" | "4bet" | "push" | "call-push";
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

interface RangeStore {
  ranges: RangeData[];
  activeRangeId: string | null;

  // Actions
  addRange: (range: Omit<RangeData, "id" | "createdAt" | "updatedAt">) => string;
  updateRange: (id: string, updates: Partial<RangeData>) => void;
  deleteRange: (id: string) => void;
  setActiveRange: (id: string | null) => void;
  duplicateRange: (id: string) => string | null;
  getRange: (id: string) => RangeData | undefined;
}

export const useRangeStore = create<RangeStore>()(
  persist(
    (set, get) => ({
      ranges: [],
      activeRangeId: null,

      addRange: (rangeData) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const range: RangeData = {
          ...rangeData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ ranges: [...state.ranges, range] }));
        return id;
      },

      updateRange: (id, updates) =>
        set((state) => ({
          ranges: state.ranges.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
          ),
        })),

      deleteRange: (id) =>
        set((state) => ({
          ranges: state.ranges.filter((r) => r.id !== id),
          activeRangeId: state.activeRangeId === id ? null : state.activeRangeId,
        })),

      setActiveRange: (id) => set({ activeRangeId: id }),

      duplicateRange: (id) => {
        const range = get().ranges.find((r) => r.id === id);
        if (!range) return null;

        const newId = crypto.randomUUID();
        const now = Date.now();
        const newRange: RangeData = {
          ...range,
          id: newId,
          name: `${range.name} (copy)`,
          createdAt: now,
          updatedAt: now,
          isDefault: false,
        };
        set((state) => ({ ranges: [...state.ranges, newRange] }));
        return newId;
      },

      getRange: (id) => get().ranges.find((r) => r.id === id),
    }),
    {
      name: "pokerpal-ranges",
    }
  )
);
