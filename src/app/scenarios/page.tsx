"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dices,
  PlayCircle,
  Upload,
  BarChart3,
  Trophy,
  Target,
  Zap,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useStatsStore } from "@/stores/stats-store";
import {
  CATEGORY_NAMES,
  DIFFICULTY_INFO,
  ScenarioCategory,
  Difficulty,
} from "@/types/scenarios";
import { QUIZ_SCENARIOS } from "@/data/quiz-scenarios";

const features = [
  {
    title: "Quiz Mode",
    description: "Test your decision-making with randomized poker scenarios",
    href: "/scenarios/quiz",
    icon: Dices,
    available: true,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Hand Replayer",
    description: "Step through hands with decision points and explanations",
    href: "/scenarios/replayer",
    icon: PlayCircle,
    available: true,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Import Hands",
    description: "Import hand histories from PokerStars or GGPoker",
    href: "/scenarios/import",
    icon: Upload,
    available: true,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
];

export default function ScenariosPage() {
  const {
    totalAttempted,
    totalCorrect,
    currentStreak,
    bestStreak,
    categoryStats,
    difficultyStats,
    recentAnswers,
  } = useStatsStore();

  const accuracyRate = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
  const hasStats = totalAttempted > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Scenarios</h1>
        <p className="text-foreground-muted max-w-2xl">
          Practice poker decisions with quiz-style scenarios, replay hands, and track your improvement.
        </p>
      </div>

      {/* Quick Stats */}
      {hasStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Target className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{accuracyRate.toFixed(0)}%</div>
                  <div className="text-sm text-foreground-muted">Accuracy</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalAttempted}</div>
                  <div className="text-sm text-foreground-muted">Attempted</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{currentStreak}</div>
                  <div className="text-sm text-foreground-muted">Current Streak</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Trophy className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{bestStreak}</div>
                  <div className="text-sm text-foreground-muted">Best Streak</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card
              key={feature.title}
              className={cn(
                "group transition-colors",
                feature.available ? "hover:border-zinc-600" : "opacity-60"
              )}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", feature.bgColor)}>
                    <Icon className={cn("w-5 h-5", feature.color)} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {feature.title}
                      {feature.available && (
                        <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
                      )}
                    </CardTitle>
                  </div>
                </div>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {feature.available ? (
                  <Link href={feature.href}>
                    <Button variant="primary" className="w-full">
                      Start Training
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    Coming Soon
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stats Details */}
      {hasStats && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Category Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Performance by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.keys(CATEGORY_NAMES) as ScenarioCategory[]).map((category) => {
                const stats = categoryStats[category];
                const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
                const scenarioCount = QUIZ_SCENARIOS.filter(s => s.category === category).length;

                return (
                  <div key={category} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{CATEGORY_NAMES[category]}</span>
                      <span className="text-foreground-muted">
                        {stats.total > 0 ? `${accuracy.toFixed(0)}%` : "—"} ({stats.total}/{scenarioCount})
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          accuracy >= 70 ? "bg-emerald-500" : accuracy >= 40 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(accuracy, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Difficulty Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                Performance by Difficulty
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((difficulty) => {
                const stats = difficultyStats[difficulty];
                const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
                const info = DIFFICULTY_INFO[difficulty];
                const scenarioCount = QUIZ_SCENARIOS.filter(s => s.difficulty === difficulty).length;

                return (
                  <div key={difficulty} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={info.color}>{info.name}</span>
                      <span className="text-foreground-muted">
                        {stats.total > 0 ? `${accuracy.toFixed(0)}%` : "—"} ({stats.total}/{scenarioCount})
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          accuracy >= 70 ? "bg-emerald-500" : accuracy >= 40 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(accuracy, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      {recentAnswers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 flex-wrap">
              {recentAnswers.slice(0, 20).map((answer, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-sm",
                    answer.isCorrect ? "bg-emerald-500" : "bg-red-500"
                  )}
                  title={`${answer.isCorrect ? "Correct" : "Incorrect"} - ${new Date(answer.timestamp).toLocaleDateString()}`}
                />
              ))}
            </div>
            <p className="text-sm text-foreground-muted mt-3">
              Last 20 answers • Green = correct, Red = incorrect
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!hasStats && (
        <Card>
          <CardContent className="py-12 text-center">
            <Dices className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
            <h3 className="text-lg font-medium mb-2">Ready to test your skills?</h3>
            <p className="text-foreground-muted mb-6 max-w-md mx-auto">
              Start the Quiz Mode to practice poker decisions. Your statistics and progress will be tracked here.
            </p>
            <Link href="/scenarios/quiz">
              <Button variant="primary" className="gap-2">
                <Dices className="w-4 h-4" />
                Start Quiz
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Scenario Count */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Available scenarios</span>
            <span className="font-medium">{QUIZ_SCENARIOS.length} scenarios across {Object.keys(CATEGORY_NAMES).length} categories</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
