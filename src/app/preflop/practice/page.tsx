"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { POSITIONS_6MAX, Position, RANKS, getHandAtPosition } from "@/types/poker";
import { getRangesByPreset, RangePreset, PRESET_INFO } from "@/data/preflop-ranges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RotateCcw, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Scenario {
  position: Position;
  hand: string;
  correctAction: "raise" | "fold";
}

interface Stats {
  total: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

function generateRandomHand(): string {
  const row = Math.floor(Math.random() * 13);
  const col = Math.floor(Math.random() * 13);
  return getHandAtPosition(row, col);
}

function generateScenario(preset: RangePreset): Scenario {
  const ranges = getRangesByPreset(preset);
  // Exclude BB since it doesn't open
  const positions = POSITIONS_6MAX.filter(p => p !== "BB");
  const position = positions[Math.floor(Math.random() * positions.length)];
  const hand = generateRandomHand();
  const range = ranges[position];
  const correctAction = range.openRaise.includes(hand) ? "raise" : "fold";

  return { position, hand, correctAction };
}

export default function PracticePage() {
  const [preset, setPreset] = useState<RangePreset>("standard");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [selectedAction, setSelectedAction] = useState<"raise" | "fold" | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
  });

  const newScenario = useCallback(() => {
    setScenario(generateScenario(preset));
    setSelectedAction(null);
    setShowResult(false);
  }, [preset]);

  useEffect(() => {
    newScenario();
  }, [newScenario]);

  const handleAction = (action: "raise" | "fold") => {
    if (!scenario || showResult) return;

    setSelectedAction(action);
    setShowResult(true);

    const isCorrect = action === scenario.correctAction;
    setStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      streak: isCorrect ? prev.streak + 1 : 0,
      bestStreak: isCorrect ? Math.max(prev.bestStreak, prev.streak + 1) : prev.bestStreak,
    }));
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showResult) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        newScenario();
      }
    } else if (scenario) {
      if (e.key === "r" || e.key === "R" || e.key === "1") {
        handleAction("raise");
      } else if (e.key === "f" || e.key === "F" || e.key === "2") {
        handleAction("fold");
      }
    }
  }, [showResult, scenario, newScenario]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const resetStats = () => {
    setStats({ total: 0, correct: 0, streak: 0, bestStreak: 0 });
    newScenario();
  };

  const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : "0";

  if (!scenario) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-foreground-muted">Loading...</div>
      </div>
    );
  }

  const isCorrect = selectedAction === scenario.correctAction;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/preflop"
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PreFlop
          </Link>
          <h1 className="text-2xl font-bold">Practice Mode</h1>
        </div>
        <Button variant="ghost" onClick={resetStats} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Preset Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground-muted">Playing Style</label>
        <Tabs
          value={preset}
          onValueChange={(v) => {
            setPreset(v as RangePreset);
            newScenario();
          }}
        >
          <TabsList>
            {(Object.keys(PRESET_INFO) as RangePreset[]).map((p) => (
              <TabsTrigger key={p} value={p} className="capitalize">
                {PRESET_INFO[p].name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-foreground-muted">Total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-500">{accuracy}%</div>
          <div className="text-xs text-foreground-muted">Accuracy</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.streak}</div>
          <div className="text-xs text-foreground-muted">Streak</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{stats.bestStreak}</div>
          <div className="text-xs text-foreground-muted">Best</div>
        </Card>
      </div>

      {/* Scenario Card */}
      <Card className="overflow-hidden">
        <CardHeader className="text-center bg-background-tertiary">
          <CardTitle>
            You&apos;re in <span className="text-emerald-500">{scenario.position}</span>
          </CardTitle>
          <p className="text-sm text-foreground-muted">
            Everyone folds to you. What do you do?
          </p>
        </CardHeader>
        <CardContent className="pt-8 pb-6">
          {/* Hand Display */}
          <div className="flex justify-center mb-8">
            <div className="text-6xl font-bold tracking-wider">{scenario.hand}</div>
          </div>

          {/* Action Buttons */}
          {!showResult ? (
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                variant="primary"
                className="w-32 h-14 text-lg"
                onClick={() => handleAction("raise")}
              >
                Raise
                <span className="ml-2 text-xs opacity-70">(R)</span>
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="w-32 h-14 text-lg"
                onClick={() => handleAction("fold")}
              >
                Fold
                <span className="ml-2 text-xs opacity-70">(F)</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Result */}
              <div
                className={cn(
                  "flex items-center justify-center gap-3 py-4 rounded-lg",
                  isCorrect ? "bg-emerald-500/10" : "bg-red-500/10"
                )}
              >
                {isCorrect ? (
                  <Check className="w-6 h-6 text-emerald-500" />
                ) : (
                  <X className="w-6 h-6 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-lg font-semibold",
                    isCorrect ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {isCorrect ? "Correct!" : "Incorrect"}
                </span>
              </div>

              {/* Explanation */}
              <div className="text-center text-sm text-foreground-muted">
                <span className="font-medium text-foreground">{scenario.hand}</span> from{" "}
                <span className="font-medium text-foreground">{scenario.position}</span> is a{" "}
                <span
                  className={cn(
                    "font-medium",
                    scenario.correctAction === "raise" ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {scenario.correctAction.toUpperCase()}
                </span>{" "}
                in the {PRESET_INFO[preset].name.toLowerCase()} range.
              </div>

              {/* Next Button */}
              <div className="flex justify-center">
                <Button size="lg" onClick={newScenario} className="gap-2">
                  Next Hand
                  <span className="text-xs opacity-70">(Enter)</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyboard Hints */}
      <div className="text-center text-sm text-foreground-muted">
        Keyboard: <kbd className="px-2 py-1 bg-zinc-800 rounded">R</kbd> Raise,{" "}
        <kbd className="px-2 py-1 bg-zinc-800 rounded">F</kbd> Fold,{" "}
        <kbd className="px-2 py-1 bg-zinc-800 rounded">Enter</kbd> Next
      </div>
    </div>
  );
}
