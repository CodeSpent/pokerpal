"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  X,
  RotateCcw,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  Scenario,
  ScoringMode,
  QuizSessionAnswer,
  CATEGORY_NAMES,
  DIFFICULTY_INFO,
} from "@/types/scenarios";

function getEmoji(pct: number): string {
  if (pct === 100) return "\uD83C\uDFC6";
  if (pct >= 80) return "\uD83C\uDF1F";
  if (pct >= 50) return "\uD83D\uDC4D";
  return "\uD83D\uDCDA";
}

export function QuizResults({
  scenarios,
  answers,
  scoringMode,
  onRestart,
  onBackToSetup,
}: {
  scenarios: Scenario[];
  answers: QuizSessionAnswer[];
  scoringMode: ScoringMode;
  onRestart: () => void;
  onBackToSetup: () => void;
}) {
  const total = answers.length;
  const correct = answers.filter((a) => {
    const s = scenarios.find((sc) => sc.id === a.scenarioId);
    return s && a.selectedOptionId === s.correctOptionId;
  }).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTime =
    total > 0
      ? Math.round(answers.reduce((sum, a) => sum + a.timeSpent, 0) / total)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-2xl mx-auto"
    >
      {/* Score Header */}
      <Card className="text-center py-8">
        <CardContent className="space-y-4">
          <div className="text-5xl">{getEmoji(pct)}</div>
          <div>
            <h2 className="text-2xl font-bold mb-1">Quiz Complete!</h2>
            <p className="text-foreground-muted">
              You scored {correct} out of {total} ({pct}%)
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-500">{pct}%</div>

          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-background-tertiary">
              <div className="text-lg font-bold text-emerald-500">
                {correct}
              </div>
              <div className="text-xs text-foreground-muted">Correct</div>
            </div>
            <div className="p-3 rounded-lg bg-background-tertiary">
              <div className="text-lg font-bold text-red-500">
                {total - correct}
              </div>
              <div className="text-xs text-foreground-muted">Incorrect</div>
            </div>
            <div className="p-3 rounded-lg bg-background-tertiary">
              <div className="text-lg font-bold">{formatMs(avgTime)}</div>
              <div className="text-xs text-foreground-muted">Avg Time</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-question breakdown (at-end mode) */}
      {scoringMode === "at-end" && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">Question Breakdown</h3>
          {answers.map((answer, i) => {
            const scenario = scenarios.find((s) => s.id === answer.scenarioId);
            if (!scenario) return null;
            return (
              <QuestionBreakdownItem
                key={answer.scenarioId}
                index={i + 1}
                scenario={scenario}
                answer={answer}
              />
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="primary" onClick={onRestart} className="flex-1 gap-2">
          <RotateCcw className="w-4 h-4" />
          Restart Same Settings
        </Button>
        <Button
          variant="outline"
          onClick={onBackToSetup}
          className="flex-1 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Setup
        </Button>
      </div>
    </motion.div>
  );
}

function QuestionBreakdownItem({
  index,
  scenario,
  answer,
}: {
  index: number;
  scenario: Scenario;
  answer: QuizSessionAnswer;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCorrect = answer.selectedOptionId === scenario.correctOptionId;
  const selectedOption = scenario.options.find(
    (o) => o.id === answer.selectedOptionId
  );
  const correctOption = scenario.options.find(
    (o) => o.id === scenario.correctOptionId
  );

  return (
    <Card>
      <CardContent className="py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 text-left"
        >
          <span className="text-sm text-foreground-muted">{index}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{scenario.title}</span>
              {isCorrect ? (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-red-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground-muted">
              <span className={DIFFICULTY_INFO[scenario.difficulty].color}>
                {DIFFICULTY_INFO[scenario.difficulty].name}
              </span>
              <span>&bull;</span>
              <span>{CATEGORY_NAMES[scenario.category]}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatMs(answer.timeSpent)}
              </span>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-zinc-700 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-foreground-muted">Your answer:</span>
                <span
                  className={cn(
                    "font-medium",
                    isCorrect ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {selectedOption?.label}
                </span>
              </div>
              {!isCorrect && (
                <div className="flex items-center gap-2">
                  <span className="text-foreground-muted">Correct answer:</span>
                  <span className="font-medium text-emerald-500">
                    {correctOption?.label}
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm">{scenario.explanation}</p>
            <div className="p-3 rounded bg-background-tertiary">
              <span className="text-sm font-medium text-emerald-400">
                Key Takeaway:{" "}
              </span>
              <span className="text-sm">{scenario.keyTakeaway}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatMs(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0
    ? `${mins}:${secs.toString().padStart(2, "0")}`
    : `${secs}s`;
}
