import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SavedHand, ParsedHand } from "@/types/hand-history";

interface HandStore {
  hands: SavedHand[];
  activeHandId: string | null;

  // Actions
  saveHand: (hand: ParsedHand, tags?: string[], notes?: string) => string;
  deleteHand: (id: string) => void;
  updateHand: (id: string, updates: Partial<SavedHand>) => void;
  setActiveHand: (id: string | null) => void;
  getHand: (id: string) => SavedHand | undefined;
  markReviewed: (id: string) => void;
}

export const useHandStore = create<HandStore>()(
  persist(
    (set, get) => ({
      hands: [],
      activeHandId: null,

      saveHand: (hand, tags, notes) => {
        const savedHand: SavedHand = {
          ...hand,
          id: hand.id || crypto.randomUUID(),
          savedAt: Date.now(),
          tags,
          notes,
          reviewed: false,
        };
        set((state) => ({ hands: [savedHand, ...state.hands] }));
        return savedHand.id;
      },

      deleteHand: (id) =>
        set((state) => ({
          hands: state.hands.filter((h) => h.id !== id),
          activeHandId: state.activeHandId === id ? null : state.activeHandId,
        })),

      updateHand: (id, updates) =>
        set((state) => ({
          hands: state.hands.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        })),

      setActiveHand: (id) => set({ activeHandId: id }),

      getHand: (id) => get().hands.find((h) => h.id === id),

      markReviewed: (id) =>
        set((state) => ({
          hands: state.hands.map((h) =>
            h.id === id ? { ...h, reviewed: true } : h
          ),
        })),
    }),
    {
      name: "pokerpal-hands",
    }
  )
);
