"use client";

import { useState, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Scenario,
  QuizConfig,
  QuizSessionAnswer,
} from "@/types/scenarios";
import { getFilteredScenarios } from "@/data/quiz-scenarios";
import { useStatsStore } from "@/stores/stats-store";
import { useQuizSettingsStore } from "@/stores/quiz-settings-store";
import { useToast } from "@/components/ui/toast";
import { QuizSetup } from "./components/QuizSetup";
import { QuizQuestion } from "./components/QuizQuestion";
import { QuizResults } from "./components/QuizResults";

type QuizPhase = "setup" | "question" | "feedback" | "results";

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function QuizPage() {
  const [phase, setPhase] = useState<QuizPhase>("setup");
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [questionQueue, setQuestionQueue] = useState<Scenario[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState<QuizSessionAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);

  const { recordAnswer, currentStreak } = useStatsStore();
  const { toast } = useToast();
  const {
    defaultDifficulty,
    defaultCategories,
    defaultQuestionCount,
    defaultScoringMode,
    updatePreferences,
  } = useQuizSettingsStore();

  const buildQueue = useCallback((cfg: QuizConfig): Scenario[] => {
    const filtered = getFilteredScenarios({
      difficulty: cfg.difficulty,
      categories: cfg.categories,
    });
    const selected = filtered.filter((s) =>
      cfg.selectedScenarioIds.includes(s.id)
    );
    const shuffled = shuffleArray(selected);
    return cfg.questionCount === "all"
      ? shuffled
      : shuffled.slice(0, cfg.questionCount);
  }, []);

  const handleStart = useCallback(
    (cfg: QuizConfig) => {
      // Save preferences
      updatePreferences({
        defaultDifficulty: cfg.difficulty,
        defaultCategories: cfg.categories,
        defaultQuestionCount: cfg.questionCount,
        defaultScoringMode: cfg.scoringMode,
      });

      const queue = buildQueue(cfg);
      setConfig(cfg);
      setQuestionQueue(queue);
      setCurrentIndex(0);
      setSessionAnswers([]);
      setSelectedOption(null);
      startTimeRef.current = Date.now();
      setPhase("question");
    },
    [buildQueue, updatePreferences]
  );

  const advanceToNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questionQueue.length) {
      setPhase("results");
    } else {
      setCurrentIndex(nextIndex);
      setSelectedOption(null);
      startTimeRef.current = Date.now();
      setPhase("question");
    }
  }, [currentIndex, questionQueue.length]);

  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!config || !questionQueue[currentIndex]) return;

      const scenario = questionQueue[currentIndex];
      const elapsed = Date.now() - startTimeRef.current;
      const isCorrect = optionId === scenario.correctOptionId;

      setSelectedOption(optionId);

      // Record to session
      setSessionAnswers((prev) => [
        ...prev,
        {
          scenarioId: scenario.id,
          selectedOptionId: optionId,
          timeSpent: elapsed,
        },
      ]);

      // Record to stats store
      recordAnswer({
        scenarioId: scenario.id,
        selectedOptionId: optionId,
        isCorrect,
        timeSpent: elapsed,
      });

      // Transition based on scoring mode
      if (config.scoringMode === "after-each") {
        setPhase("feedback");
      } else {
        const label = scenario.options.find((o) => o.id === optionId)?.label;
        toast({ description: `Answer recorded: ${label}` });
        // Advance immediately — use inline logic since advanceToNext
        // captures stale currentIndex in this callback
        const nextIndex = currentIndex + 1;
        if (nextIndex >= questionQueue.length) {
          setPhase("results");
        } else {
          setCurrentIndex(nextIndex);
          setSelectedOption(null);
          startTimeRef.current = Date.now();
          setPhase("question");
        }
      }
    },
    [config, questionQueue, currentIndex, recordAnswer, toast]
  );

  const handleNext = advanceToNext;

  const handleRestart = useCallback(() => {
    if (!config) return;
    const queue = buildQueue(config);
    setQuestionQueue(queue);
    setCurrentIndex(0);
    setSessionAnswers([]);
    setSelectedOption(null);
    startTimeRef.current = Date.now();
    setPhase("question");
  }, [config, buildQueue]);

  const handleBackToSetup = useCallback(() => {
    setPhase("setup");
  }, []);

  const currentScenario = questionQueue[currentIndex] ?? null;

  return (
    <AnimatePresence mode="wait">
      {phase === "setup" && (
        <QuizSetup
          key="setup"
          defaults={{
            difficulty: defaultDifficulty,
            categories: defaultCategories,
            questionCount: defaultQuestionCount,
            scoringMode: defaultScoringMode,
          }}
          onStart={handleStart}
        />
      )}

      {phase === "question" && currentScenario && (
        <QuizQuestion
          key={`question-${currentScenario.id}`}
          scenario={currentScenario}
          questionNumber={currentIndex + 1}
          totalQuestions={questionQueue.length}
          selectedOption={null}
          showFeedback={false}
          currentStreak={currentStreak}
          onAnswer={handleAnswer}
          onNext={handleNext}
        />
      )}

      {phase === "feedback" && currentScenario && (
        <QuizQuestion
          key={`feedback-${currentScenario.id}`}
          scenario={currentScenario}
          questionNumber={currentIndex + 1}
          totalQuestions={questionQueue.length}
          selectedOption={selectedOption}
          showFeedback={true}
          currentStreak={currentStreak}
          onAnswer={handleAnswer}
          onNext={handleNext}
        />
      )}

      {phase === "results" && config && (
        <QuizResults
          key="results"
          scenarios={questionQueue}
          answers={sessionAnswers}
          scoringMode={config.scoringMode}
          onRestart={handleRestart}
          onBackToSetup={handleBackToSetup}
        />
      )}
    </AnimatePresence>
  );
}
