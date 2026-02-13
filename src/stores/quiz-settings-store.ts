import { create } from "zustand";
import { persist } from "zustand/middleware";
import { QuizPreferences } from "@/types/scenarios";

interface QuizSettingsStore extends QuizPreferences {
  updatePreferences: (partial: Partial<QuizPreferences>) => void;
}

export const useQuizSettingsStore = create<QuizSettingsStore>()(
  persist(
    (set) => ({
      defaultDifficulty: "all",
      defaultCategories: [],
      defaultQuestionCount: 10,
      defaultScoringMode: "after-each",

      updatePreferences: (partial) => set(partial),
    }),
    {
      name: "pokerpal-quiz-settings",
    }
  )
);
