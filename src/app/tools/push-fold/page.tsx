"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { POSITIONS_6MAX, Position, POSITION_SHORT, POSITION_NAMES } from "@/types/poker";
import { PUSH_RANGES, STACK_SIZES, getPushRange } from "@/data/push-fold-ranges";
import { HandMatrix } from "@/components/poker/hand-matrix";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { useResponsiveMatrixSize } from "@/hooks/useResponsiveMatrixSize";

export default function PushFoldPage() {
  const [stackSize, setStackSize] = useState<number>(10);
  const [position, setPosition] = useState<Position>("BTN");
  const matrixSize = useResponsiveMatrixSize();

  const pushRange = useMemo(() => {
    return new Set(getPushRange(stackSize, position));
  }, [stackSize, position]);

  const rangePercent = ((pushRange.size / 169) * 100).toFixed(1);

  // Find positions that still have players to act
  const remainingPositions = POSITIONS_6MAX.slice(POSITIONS_6MAX.indexOf(position) + 1);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/tools"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>
        <h1 className="text-3xl font-bold">Push/Fold Charts</h1>
        <p className="text-foreground-muted">
          Optimal shoving ranges for short stack tournament play. Based on Nash equilibrium.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Stack Size & Position</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stack Size Slider */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Effective Stack</label>
                  <span className="text-2xl font-bold text-emerald-500">{stackSize} BB</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  value={stackSize}
                  onChange={(e) => setStackSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-foreground-muted">
                  <span>3 BB</span>
                  <span>15 BB</span>
                </div>
              </div>

              {/* Position Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Position</label>
                <div className="flex flex-wrap gap-2">
                  {POSITIONS_6MAX.filter(p => p !== "BB").map((pos) => (
                    <Button
                      key={pos}
                      variant={position === pos ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => setPosition(pos)}
                      className="min-w-[60px]"
                    >
                      {POSITION_SHORT[pos]}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-foreground-muted">
                  {POSITION_NAMES[position]} - {remainingPositions.length > 0
                    ? `${remainingPositions.map(p => POSITION_SHORT[p]).join(", ")} still to act`
                    : "First to act"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Hand Matrix */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Push Range</CardTitle>
                  <CardDescription>
                    All-in shove range from {position} with {stackSize} BB
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{pushRange.size}</div>
                  <div className="text-sm text-foreground-muted">{rangePercent}% of hands</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <HandMatrix
                selectedHands={pushRange}
                disabled={true}
                size={matrixSize}
                showLabels={true}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Stack Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Select</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {STACK_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setStackSize(size)}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-colors flex justify-between items-center",
                    stackSize === size
                      ? "bg-emerald-500/20 border border-emerald-500/30"
                      : "bg-background-tertiary hover:bg-zinc-700"
                  )}
                >
                  <span className="font-medium">{size} BB</span>
                  <span className="text-foreground-muted text-sm">
                    {getPushRange(size, position).length} hands
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Strategy Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4" />
                Strategy Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-background-tertiary">
                <div className="font-medium text-amber-500">Under 10 BB</div>
                <p className="text-foreground-muted mt-1">
                  Push or fold only. No min-raising or limping.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-tertiary">
                <div className="font-medium text-blue-500">Position Matters</div>
                <p className="text-foreground-muted mt-1">
                  Later positions can push wider because fewer players remain.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-tertiary">
                <div className="font-medium text-emerald-500">ICM Considerations</div>
                <p className="text-foreground-muted mt-1">
                  Near the bubble or final table, tighten these ranges.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Range by Position Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Range by Position ({stackSize} BB)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {POSITIONS_6MAX.filter(p => p !== "BB").map((pos) => {
                const range = getPushRange(stackSize, pos);
                const percent = ((range.length / 169) * 100).toFixed(0);
                return (
                  <div
                    key={pos}
                    className={cn(
                      "flex justify-between items-center p-2 rounded",
                      position === pos && "bg-background-tertiary"
                    )}
                  >
                    <span className={cn(
                      "font-medium",
                      position === pos && "text-emerald-500"
                    )}>
                      {POSITION_SHORT[pos]}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-sm text-foreground-muted w-10 text-right">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
