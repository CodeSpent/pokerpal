"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import {
  Difficulty,
  ScenarioCategory,
  QuizConfig,
  ScoringMode,
  CATEGORY_NAMES,
  DIFFICULTY_INFO,
} from "@/types/scenarios";
import { getFilteredScenarios } from "@/data/quiz-scenarios";

const DIFFICULTIES: Array<Difficulty | "all"> = [
  "all",
  "beginner",
  "intermediate",
  "advanced",
];

const QUESTION_PRESETS = [5, 10] as const;

export function QuizSetup({
  defaults,
  onStart,
}: {
  defaults: {
    difficulty: Difficulty | "all";
    categories: ScenarioCategory[];
    questionCount: number | "all";
    scoringMode: ScoringMode;
  };
  onStart: (config: QuizConfig) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty | "all">(
    defaults.difficulty
  );
  const [categories, setCategories] = useState<ScenarioCategory[]>(
    defaults.categories
  );
  const [questionCount, setQuestionCount] = useState<number | "all">(
    defaults.questionCount
  );
  const [customCount, setCustomCount] = useState("");
  const [scoringMode, setScoringMode] = useState<ScoringMode>(
    defaults.scoringMode
  );
  const [showScenarios, setShowScenarios] = useState(false);

  const filteredScenarios = useMemo(
    () => getFilteredScenarios({ difficulty, categories }),
    [difficulty, categories]
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(filteredScenarios.map((s) => s.id))
  );

  // Re-sync selected IDs when filters change
  const effectiveSelected = useMemo(() => {
    const filteredIds = new Set(filteredScenarios.map((s) => s.id));
    // Keep only IDs that are still in the filtered set
    const kept = new Set(
      [...selectedIds].filter((id) => filteredIds.has(id))
    );
    // If nothing was kept (filters changed entirely), select all
    return kept.size > 0 ? kept : filteredIds;
  }, [filteredScenarios, selectedIds]);

  const availableCount = effectiveSelected.size;
  const effectiveQuestionCount =
    questionCount === "all" ? availableCount : Math.min(questionCount, availableCount);

  const toggleCategory = (cat: ScenarioCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredScenarios.map((s) => s.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleStart = () => {
    if (effectiveQuestionCount === 0) return;
    onStart({
      difficulty,
      categories,
      questionCount,
      scoringMode,
      selectedScenarioIds: [...effectiveSelected],
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/scenarios"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scenarios
        </Link>
        <h1 className="text-2xl font-bold">Quiz Setup</h1>
      </div>

      {/* Difficulty */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <label className="text-sm font-medium">Difficulty</label>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                  difficulty === d
                    ? "bg-emerald-600 text-white"
                    : "bg-background-tertiary text-foreground-muted hover:text-foreground"
                )}
              >
                {d === "all" ? "All" : DIFFICULTY_INFO[d].name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <label className="text-sm font-medium">
            Categories{" "}
            <span className="text-foreground-muted font-normal">
              {categories.length === 0
                ? "(all included)"
                : `(${categories.length} selected)`}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_NAMES) as ScenarioCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  categories.includes(cat)
                    ? "bg-emerald-600 text-white"
                    : "bg-background-tertiary text-foreground-muted hover:text-foreground"
                )}
              >
                {CATEGORY_NAMES[cat]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Question Count */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <label className="text-sm font-medium">
            Question Count{" "}
            <span className="text-foreground-muted font-normal">
              ({availableCount} available)
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {QUESTION_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setQuestionCount(n);
                  setCustomCount("");
                }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                  questionCount === n
                    ? "bg-emerald-600 text-white"
                    : "bg-background-tertiary text-foreground-muted hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => {
                setQuestionCount("all");
                setCustomCount("");
              }}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                questionCount === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-background-tertiary text-foreground-muted hover:text-foreground"
              )}
            >
              All
            </button>
            <input
              type="number"
              min={1}
              max={availableCount}
              placeholder="Custom"
              value={customCount}
              onChange={(e) => {
                const val = e.target.value;
                setCustomCount(val);
                const n = parseInt(val, 10);
                if (!isNaN(n) && n > 0) {
                  setQuestionCount(n);
                }
              }}
              className="w-20 h-9 px-3 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Scoring Mode */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <label className="text-sm font-medium">Scoring Mode</label>
          <Tabs
            value={scoringMode}
            onValueChange={(v) => setScoringMode(v as ScoringMode)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="after-each" className="flex-1">
                Score as you go
              </TabsTrigger>
              <TabsTrigger value="at-end" className="flex-1">
                Score at end
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-sm text-foreground-muted">
            {scoringMode === "after-each"
              ? "See if you got it right after each question with explanations."
              : "Answer all questions first, then review your results at the end."}
          </p>
        </CardContent>
      </Card>

      {/* Scenario List */}
      <Card>
        <CardContent className="py-4">
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            className="flex items-center justify-between w-full text-sm font-medium"
          >
            <span>
              View {filteredScenarios.length} matching scenario
              {filteredScenarios.length !== 1 ? "s" : ""}
            </span>
            {showScenarios ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showScenarios && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-3 text-sm">
                <button
                  onClick={selectAll}
                  className="text-emerald-500 hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-foreground-muted hover:underline"
                >
                  Deselect All
                </button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredScenarios.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-background-tertiary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={effectiveSelected.has(s.id)}
                      onChange={() => toggleScenario(s.id)}
                      className="rounded border-zinc-600 accent-emerald-500"
                    />
                    <span className="flex-1 text-sm">{s.title}</span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        DIFFICULTY_INFO[s.difficulty].color
                      )}
                    >
                      {DIFFICULTY_INFO[s.difficulty].name}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {CATEGORY_NAMES[s.category]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Button */}
      <Button
        variant="primary"
        size="lg"
        onClick={handleStart}
        disabled={effectiveQuestionCount === 0}
        className="w-full"
      >
        Start Quiz ({effectiveQuestionCount} question
        {effectiveQuestionCount !== 1 ? "s" : ""})
      </Button>
    </div>
  );
}
