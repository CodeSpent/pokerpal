import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  UserStats,
  ScenarioAnswer,
  CategoryStats,
  ScenarioCategory,
  Difficulty,
  INITIAL_STATS,
} from "@/types/scenarios";
import { getScenarioById } from "@/data/quiz-scenarios";

interface StatsStore extends UserStats {
  // Actions
  recordAnswer: (answer: Omit<ScenarioAnswer, "timestamp">) => void;
  resetStats: () => void;
  getAccuracyRate: () => number;
  getCategoryAccuracy: (category: ScenarioCategory) => number;
  getDifficultyAccuracy: (difficulty: Difficulty) => number;
}

function updateCategoryStats(
  current: CategoryStats,
  isCorrect: boolean,
  timeSpent: number
): CategoryStats {
  const newTotal = current.total + 1;
  const newCorrect = current.correct + (isCorrect ? 1 : 0);
  // Rolling average for time
  const newAverageTime =
    (current.averageTime * current.total + timeSpent) / newTotal;

  return {
    total: newTotal,
    correct: newCorrect,
    averageTime: newAverageTime,
  };
}

export const useStatsStore = create<StatsStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATS,

      recordAnswer: (answer) => {
        const fullAnswer: ScenarioAnswer = {
          ...answer,
          timestamp: Date.now(),
        };

        set((state) => {
          // Get the scenario to find its category and difficulty
          // We'll need to look this up from the answer
          const scenario = getScenarioById(answer.scenarioId);
          if (!scenario) return state;

          const newStreak = answer.isCorrect ? state.currentStreak + 1 : 0;

          return {
            totalAttempted: state.totalAttempted + 1,
            totalCorrect: state.totalCorrect + (answer.isCorrect ? 1 : 0),
            currentStreak: newStreak,
            bestStreak: Math.max(state.bestStreak, newStreak),
            categoryStats: {
              ...state.categoryStats,
              [scenario.category]: updateCategoryStats(
                state.categoryStats[scenario.category],
                answer.isCorrect,
                answer.timeSpent
              ),
            },
            difficultyStats: {
              ...state.difficultyStats,
              [scenario.difficulty]: updateCategoryStats(
                state.difficultyStats[scenario.difficulty],
                answer.isCorrect,
                answer.timeSpent
              ),
            },
            recentAnswers: [fullAnswer, ...state.recentAnswers].slice(0, 50),
            lastSessionDate: Date.now(),
          };
        });
      },

      resetStats: () => set(INITIAL_STATS),

      getAccuracyRate: () => {
        const { totalAttempted, totalCorrect } = get();
        return totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
      },

      getCategoryAccuracy: (category) => {
        const stats = get().categoryStats[category];
        return stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      },

      getDifficultyAccuracy: (difficulty) => {
        const stats = get().difficultyStats[difficulty];
        return stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      },
    }),
    {
      name: "pokerpal-stats",
    }
  )
);

