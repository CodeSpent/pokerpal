import { Position, Card, Action, Street } from "./poker";

// Scenario difficulty levels
export type Difficulty = "beginner" | "intermediate" | "advanced";

// Scenario categories
export type ScenarioCategory =
  | "preflop"
  | "postflop-value"
  | "postflop-bluff"
  | "drawing"
  | "position"
  | "pot-odds"
  | "tournament";

// Player type for villains
export type PlayerType = "tight" | "loose" | "aggressive" | "passive" | "unknown";

// A villain in the scenario
export interface Villain {
  position: Position;
  stack: number; // in BB
  playerType?: PlayerType;
  cards?: [Card, Card]; // revealed cards (for replays)
}

// An action that occurred in the hand
export interface HandAction {
  position: Position;
  action: Action;
  amount?: number; // in BB
}

// The setup for a scenario
export interface ScenarioSetup {
  // Table info
  tableSize: 6 | 9;
  blinds: { sb: number; bb: number };
  ante?: number;

  // Hero info
  heroPosition: Position;
  heroStack: number; // in BB
  heroCards: { card1: string; card2: string }; // e.g., "Ah", "Kd"

  // Villains
  villains: Villain[];

  // Current game state
  street: Street;
  pot: number; // in BB
  board?: string[]; // e.g., ["Ah", "Kd", "7c"]

  // Action history leading to decision point
  actionHistory: HandAction[];

  // What's facing hero
  toCall?: number; // in BB
  minRaise?: number; // in BB
}

// A decision option for the player
export interface DecisionOption {
  id: string;
  action: Action;
  amount?: number; // for raises
  label: string;
}

// The scenario question
export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: ScenarioCategory;
  setup: ScenarioSetup;
  question: string;
  options: DecisionOption[];
  correctOptionId: string;
  explanation: string;
  keyTakeaway: string;
  tags: string[];
}

// User's answer to a scenario
export interface ScenarioAnswer {
  scenarioId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timeSpent: number; // ms
  timestamp: number;
}

// Statistics for a category
export interface CategoryStats {
  total: number;
  correct: number;
  averageTime: number; // ms
}

// Overall user statistics
export interface UserStats {
  totalAttempted: number;
  totalCorrect: number;
  currentStreak: number;
  bestStreak: number;
  categoryStats: Record<ScenarioCategory, CategoryStats>;
  difficultyStats: Record<Difficulty, CategoryStats>;
  recentAnswers: ScenarioAnswer[];
  lastSessionDate: number;
}

// Initial empty stats
export const INITIAL_STATS: UserStats = {
  totalAttempted: 0,
  totalCorrect: 0,
  currentStreak: 0,
  bestStreak: 0,
  categoryStats: {
    preflop: { total: 0, correct: 0, averageTime: 0 },
    "postflop-value": { total: 0, correct: 0, averageTime: 0 },
    "postflop-bluff": { total: 0, correct: 0, averageTime: 0 },
    drawing: { total: 0, correct: 0, averageTime: 0 },
    position: { total: 0, correct: 0, averageTime: 0 },
    "pot-odds": { total: 0, correct: 0, averageTime: 0 },
    tournament: { total: 0, correct: 0, averageTime: 0 },
  },
  difficultyStats: {
    beginner: { total: 0, correct: 0, averageTime: 0 },
    intermediate: { total: 0, correct: 0, averageTime: 0 },
    advanced: { total: 0, correct: 0, averageTime: 0 },
  },
  recentAnswers: [],
  lastSessionDate: 0,
};

// Quiz scoring modes
export type ScoringMode = "after-each" | "at-end";

// Quiz session configuration
export interface QuizConfig {
  difficulty: Difficulty | "all";
  categories: ScenarioCategory[];
  questionCount: number | "all";
  scoringMode: ScoringMode;
  selectedScenarioIds: string[];
}

// Persisted quiz preferences
export interface QuizPreferences {
  defaultDifficulty: Difficulty | "all";
  defaultCategories: ScenarioCategory[];
  defaultQuestionCount: number | "all";
  defaultScoringMode: ScoringMode;
}

// A single answer in a quiz session
export interface QuizSessionAnswer {
  scenarioId: string;
  selectedOptionId: string;
  timeSpent: number;
}

// Category display names
export const CATEGORY_NAMES: Record<ScenarioCategory, string> = {
  preflop: "Preflop",
  "postflop-value": "Value Betting",
  "postflop-bluff": "Bluffing",
  drawing: "Drawing Hands",
  position: "Positional Play",
  "pot-odds": "Pot Odds",
  tournament: "Tournament",
};

// Difficulty display info
export const DIFFICULTY_INFO: Record<Difficulty, { name: string; color: string }> = {
  beginner: { name: "Beginner", color: "text-emerald-500" },
  intermediate: { name: "Intermediate", color: "text-amber-500" },
  advanced: { name: "Advanced", color: "text-red-500" },
};
