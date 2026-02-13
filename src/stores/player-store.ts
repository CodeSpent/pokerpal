import { create } from 'zustand';

interface PlayerState {
  chipBalance: number;
  updateChipBalance: (amount: number) => void;
  setChipBalance: (balance: number) => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  chipBalance: 20000,

  updateChipBalance: (amount) =>
    set((state) => ({
      chipBalance: state.chipBalance + amount,
    })),

  setChipBalance: (balance) =>
    set({ chipBalance: balance }),
}));
