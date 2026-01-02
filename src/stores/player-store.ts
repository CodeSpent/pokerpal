import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player } from '@/lib/poker-engine-v2/types';

interface PlayerState {
  // Player identity
  playerId: string | null;
  displayName: string;
  chipBalance: number;
  isRegistered: boolean;

  // Actions
  setPlayer: (player: Player) => void;
  setDisplayName: (name: string) => void;
  updateChipBalance: (amount: number) => void;
  clearPlayer: () => void;
}

const INITIAL_STATE = {
  playerId: null,
  displayName: '',
  chipBalance: 10000, // Default starting chips
  isRegistered: false,
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setPlayer: (player) =>
        set({
          playerId: player.id,
          displayName: player.displayName || player.name,
          chipBalance: player.chipBalance ?? 10000,
          isRegistered: true,
        }),

      setDisplayName: (name) =>
        set({ displayName: name }),

      updateChipBalance: (amount) =>
        set((state) => ({
          chipBalance: state.chipBalance + amount,
        })),

      clearPlayer: () =>
        set(INITIAL_STATE),
    }),
    {
      name: 'pokerpal-player',
    }
  )
);

/**
 * Check if player needs to register (has no display name)
 */
export function useNeedsRegistration() {
  const { displayName, isRegistered } = usePlayerStore();
  return !isRegistered || !displayName;
}
