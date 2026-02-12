import { create } from 'zustand';

interface PlayerState {
  chipBalance: number;
  updateChipBalance: (amount: number) => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  chipBalance: 10000,

  updateChipBalance: (amount) =>
    set((state) => ({
      chipBalance: state.chipBalance + amount,
    })),
}));
