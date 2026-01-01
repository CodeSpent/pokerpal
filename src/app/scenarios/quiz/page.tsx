"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Clock,
  Zap,
  Filter,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Scenario,
  DecisionOption,
  Difficulty,
  ScenarioCategory,
  CATEGORY_NAMES,
  DIFFICULTY_INFO,
} from "@/types/scenarios";
import { getRandomScenario, QUIZ_SCENARIOS } from "@/data/quiz-scenarios";
import { useStatsStore } from "@/stores/stats-store";

type QuizState = "question" | "feedback" | "complete";

const POSITION_COLORS: Record<string, string> = {
  UTG: "bg-red-500",
  "UTG+1": "bg-red-400",
  "UTG+2": "bg-orange-500",
  LJ: "bg-orange-400",
  HJ: "bg-amber-500",
  CO: "bg-yellow-500",
  BTN: "bg-emerald-500",
  SB: "bg-blue-500",
  BB: "bg-purple-500",
};

export default function QuizPage() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [quizState, setQuizState] = useState<QuizState>("question");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ScenarioCategory | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const { recordAnswer, currentStreak, bestStreak } = useStatsStore();

  const loadNewScenario = useCallback(() => {
    const newScenario = getRandomScenario({
      difficulty: difficultyFilter === "all" ? undefined : difficultyFilter,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      excludeIds: completedIds.length < QUIZ_SCENARIOS.length ? completedIds : [],
    });

    if (newScenario) {
      setScenario(newScenario);
      setQuizState("question");
      setSelectedOption(null);
      setStartTime(Date.now());
      setTimeSpent(0);
    } else {
      setQuizState("complete");
    }
  }, [difficultyFilter, categoryFilter, completedIds]);

  useEffect(() => {
    loadNewScenario();
  }, [loadNewScenario]);

  // Timer
  useEffect(() => {
    if (quizState !== "question" || !startTime) return;

    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [quizState, startTime]);

  const handleAnswer = (optionId: string) => {
    if (quizState !== "question" || !scenario) return;

    const isCorrect = optionId === scenario.correctOptionId;
    const elapsed = Date.now() - startTime;

    setSelectedOption(optionId);
    setQuizState("feedback");
    setSessionTotal((prev) => prev + 1);

    if (isCorrect) {
      setSessionCorrect((prev) => prev + 1);
    }

    // Record to stats
    recordAnswer({
      scenarioId: scenario.id,
      selectedOptionId: optionId,
      isCorrect,
      timeSpent: elapsed,
    });

    setCompletedIds((prev) => [...prev, scenario.id]);
  };

  const handleNext = () => {
    loadNewScenario();
  };

  const handleRestart = () => {
    setCompletedIds([]);
    setSessionCorrect(0);
    setSessionTotal(0);
    loadNewScenario();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
  };

  if (quizState === "complete") {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="space-y-1">
          <Link
            href="/scenarios"
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Scenarios
          </Link>
        </div>

        <Card className="text-center py-8">
          <CardContent className="space-y-6">
            <div className="text-6xl">
              {sessionCorrect === sessionTotal ? "🏆" : sessionCorrect > sessionTotal / 2 ? "👍" : "📚"}
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
              <p className="text-foreground-muted">
                You answered {sessionCorrect} out of {sessionTotal} correctly
              </p>
            </div>
            <div className="text-4xl font-bold text-emerald-500">
              {sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0}%
            </div>
            <Button variant="primary" onClick={handleRestart} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Start New Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-foreground-muted">Loading scenario...</div>
      </div>
    );
  }

  const isCorrect = selectedOption === scenario.correctOptionId;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/scenarios"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scenarios
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty</label>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | "all")}
                  className="h-9 px-3 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Difficulties</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as ScenarioCategory | "all")}
                  className="h-9 px-3 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-foreground-muted" />
            <span>{formatTime(timeSpent)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Streak: {currentStreak}</span>
          </div>
        </div>
        <div className="text-foreground-muted">
          Session: {sessionCorrect}/{sessionTotal}
        </div>
      </div>

      {/* Scenario Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", DIFFICULTY_INFO[scenario.difficulty].color)}>
                {DIFFICULTY_INFO[scenario.difficulty].name}
              </span>
              <span className="text-foreground-muted">•</span>
              <span className="text-sm text-foreground-muted">
                {CATEGORY_NAMES[scenario.category]}
              </span>
            </div>
          </div>
          <CardTitle>{scenario.title}</CardTitle>
          <p className="text-foreground-muted">{scenario.description}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Game State */}
          <div className="p-4 rounded-lg bg-background-tertiary space-y-4">
            {/* Hero Info */}
            <div className="flex items-center gap-4">
              <div className={cn("px-3 py-1 rounded-full text-sm font-bold text-white", POSITION_COLORS[scenario.setup.heroPosition] || "bg-zinc-500")}>
                {scenario.setup.heroPosition}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">Stack:</span>
                <span className="font-medium">{scenario.setup.heroStack} BB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">Pot:</span>
                <span className="font-medium">{scenario.setup.pot} BB</span>
              </div>
              {scenario.setup.toCall && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-muted">To Call:</span>
                  <span className="font-medium text-red-400">{scenario.setup.toCall} BB</span>
                </div>
              )}
            </div>

            {/* Hero Cards */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground-muted">Your hand:</span>
              <div className="flex gap-1">
                <CardDisplay card={scenario.setup.heroCards.card1} />
                <CardDisplay card={scenario.setup.heroCards.card2} />
              </div>
            </div>

            {/* Board */}
            {scenario.setup.board && scenario.setup.board.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">Board:</span>
                <div className="flex gap-1">
                  {scenario.setup.board.map((card, i) => (
                    <CardDisplay key={i} card={card} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Question */}
          <div className="text-lg font-medium">{scenario.question}</div>

          {/* Options */}
          <div className="grid gap-3">
            {scenario.options.map((option) => (
              <OptionButton
                key={option.id}
                option={option}
                isSelected={selectedOption === option.id}
                isCorrect={option.id === scenario.correctOptionId}
                showResult={quizState === "feedback"}
                onClick={() => handleAnswer(option.id)}
                disabled={quizState === "feedback"}
              />
            ))}
          </div>

          {/* Feedback */}
          {quizState === "feedback" && (
            <div className={cn(
              "p-4 rounded-lg border",
              isCorrect
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {isCorrect ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
                <span className={cn("font-bold", isCorrect ? "text-emerald-500" : "text-red-500")}>
                  {isCorrect ? "Correct!" : "Incorrect"}
                </span>
              </div>
              <p className="text-sm mb-3">{scenario.explanation}</p>
              <div className="p-3 rounded bg-background-tertiary">
                <span className="text-sm font-medium text-emerald-400">Key Takeaway: </span>
                <span className="text-sm">{scenario.keyTakeaway}</span>
              </div>
            </div>
          )}

          {/* Next Button */}
          {quizState === "feedback" && (
            <div className="flex justify-end">
              <Button variant="primary" onClick={handleNext} className="gap-2">
                Next Scenario
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Card display component
function CardDisplay({ card }: { card: string }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);

  const suitSymbols: Record<string, string> = {
    h: "♥",
    d: "♦",
    c: "♣",
    s: "♠",
  };

  const suitColors: Record<string, string> = {
    h: "text-red-500",
    d: "text-blue-500",
    c: "text-emerald-500",
    s: "text-zinc-300",
  };

  return (
    <div className="w-10 h-14 rounded bg-white flex flex-col items-center justify-center text-zinc-900 font-bold shadow-md">
      <span className="text-sm">{rank}</span>
      <span className={cn("text-lg -mt-1", suitColors[suit])}>{suitSymbols[suit]}</span>
    </div>
  );
}

// Option button component
function OptionButton({
  option,
  isSelected,
  isCorrect,
  showResult,
  onClick,
  disabled,
}: {
  option: DecisionOption;
  isSelected: boolean;
  isCorrect: boolean;
  showResult: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  let bgColor = "bg-background-tertiary hover:bg-zinc-700";
  let borderColor = "border-zinc-700";

  if (showResult) {
    if (isCorrect) {
      bgColor = "bg-emerald-500/20";
      borderColor = "border-emerald-500";
    } else if (isSelected && !isCorrect) {
      bgColor = "bg-red-500/20";
      borderColor = "border-red-500";
    }
  } else if (isSelected) {
    bgColor = "bg-zinc-700";
    borderColor = "border-zinc-500";
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full p-4 rounded-lg border text-left transition-colors flex items-center justify-between",
        bgColor,
        borderColor,
        disabled && "cursor-default"
      )}
    >
      <span className="font-medium">{option.label}</span>
      {showResult && isCorrect && <Check className="w-5 h-5 text-emerald-500" />}
      {showResult && isSelected && !isCorrect && <X className="w-5 h-5 text-red-500" />}
    </button>
  );
}
