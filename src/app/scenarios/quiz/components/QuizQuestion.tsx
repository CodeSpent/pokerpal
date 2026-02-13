"use client";

import { useEffect, useState } from "react";
import { Check, X, Clock, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Scenario, DIFFICULTY_INFO, CATEGORY_NAMES } from "@/types/scenarios";
import { CardDisplay } from "./CardDisplay";
import { OptionButton } from "./OptionButton";
import { QuizProgressBar } from "./QuizProgressBar";

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

export function QuizQuestion({
  scenario,
  questionNumber,
  totalQuestions,
  selectedOption,
  showFeedback,
  currentStreak,
  onAnswer,
  onNext,
}: {
  scenario: Scenario;
  questionNumber: number;
  totalQuestions: number;
  selectedOption: string | null;
  showFeedback: boolean;
  currentStreak: number;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
}) {
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime] = useState(Date.now());

  const isCorrect = selectedOption === scenario.correctOptionId;
  const answered = selectedOption !== null;

  useEffect(() => {
    if (answered) return;

    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [answered, startTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, "0")}`
      : `${secs}s`;
  };

  return (
    <motion.div
      key={scenario.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      {/* Progress Bar */}
      <QuizProgressBar current={questionNumber} total={totalQuestions} />

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
          {questionNumber}/{totalQuestions}
        </div>
      </div>

      {/* Scenario Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  DIFFICULTY_INFO[scenario.difficulty].color
                )}
              >
                {DIFFICULTY_INFO[scenario.difficulty].name}
              </span>
              <span className="text-foreground-muted">&bull;</span>
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
            <div className="flex items-center gap-4 flex-wrap">
              <div
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-bold text-white",
                  POSITION_COLORS[scenario.setup.heroPosition] || "bg-zinc-500"
                )}
              >
                {scenario.setup.heroPosition}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">Stack:</span>
                <span className="font-medium">
                  {scenario.setup.heroStack} BB
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">Pot:</span>
                <span className="font-medium">{scenario.setup.pot} BB</span>
              </div>
              {scenario.setup.toCall && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-muted">
                    To Call:
                  </span>
                  <span className="font-medium text-red-400">
                    {scenario.setup.toCall} BB
                  </span>
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
                showResult={showFeedback}
                onClick={() => onAnswer(option.id)}
                disabled={answered}
              />
            ))}
          </div>

          {/* Feedback */}
          {showFeedback && (
            <div
              className={cn(
                "p-4 rounded-lg border",
                isCorrect
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {isCorrect ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
                <span
                  className={cn(
                    "font-bold",
                    isCorrect ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {isCorrect ? "Correct!" : "Incorrect"}
                </span>
              </div>
              <p className="text-sm mb-3">{scenario.explanation}</p>
              <div className="p-3 rounded bg-background-tertiary">
                <span className="text-sm font-medium text-emerald-400">
                  Key Takeaway:{" "}
                </span>
                <span className="text-sm">{scenario.keyTakeaway}</span>
              </div>
            </div>
          )}

          {/* Next Button */}
          {showFeedback && (
            <div className="flex justify-end">
              <Button variant="primary" onClick={onNext} className="gap-2">
                Next Scenario
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
