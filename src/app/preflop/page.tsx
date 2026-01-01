"use client";

import Link from "next/link";
import { useState } from "react";
import { POSITIONS_6MAX, POSITION_NAMES, Position } from "@/types/poker";
import { getRangesByPreset, PRESET_INFO, RangePreset } from "@/data/preflop-ranges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, BookOpen, Target } from "lucide-react";

export default function PreflopPage() {
  const [preset, setPreset] = useState<RangePreset>("standard");
  const ranges = getRangesByPreset(preset);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">PreFlop Strategy</h1>
        <p className="text-foreground-muted max-w-2xl">
          Master position-based opening ranges. Select a position to see the recommended
          opening range, or practice making decisions in real-time scenarios.
        </p>
      </div>

      {/* Preset Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground-muted">Playing Style</label>
        <Tabs value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
          <TabsList>
            {(Object.keys(PRESET_INFO) as RangePreset[]).map((p) => (
              <TabsTrigger key={p} value={p} className="capitalize">
                {PRESET_INFO[p].name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-sm text-foreground-muted">
          {PRESET_INFO[preset].description}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link href="/preflop/practice">
          <Button variant="primary" className="gap-2">
            <Target className="w-4 h-4" />
            Practice Mode
          </Button>
        </Link>
      </div>

      {/* Position Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Positions (6-Max)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {POSITIONS_6MAX.map((position) => {
            const range = ranges[position];
            const handCount = range.openRaise.length;
            const percentage = ((handCount / 169) * 100).toFixed(1);

            return (
              <Link key={position} href={`/preflop/${position.toLowerCase()}`}>
                <Card className="h-full hover:border-zinc-600 transition-colors cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg group-hover:text-accent-primary transition-colors">
                        {position}
                      </CardTitle>
                      <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-accent-primary transition-colors" />
                    </div>
                    <CardDescription>{POSITION_NAMES[position]}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground-muted">Open Range</span>
                        <span className="font-medium">
                          {position === "BB" ? "Defends" : `${handCount} hands`}
                        </span>
                      </div>
                      {position !== "BB" && (
                        <div className="space-y-1">
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-foreground-muted text-right">
                            {percentage}% of hands
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Learning Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            Key Concepts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-medium">Position Matters</h3>
              <p className="text-sm text-foreground-muted">
                Later positions (CO, BTN) can play more hands because they act last postflop,
                giving them more information and control.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Suited vs Offsuit</h3>
              <p className="text-sm text-foreground-muted">
                Suited hands are more valuable because they can make flushes.
                This is why you see hands like A5s but not A5o in early position.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Connectors</h3>
              <p className="text-sm text-foreground-muted">
                Connected cards (87, 98, T9) make straights and play well in multiway pots.
                They gain value in position.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Adjust to Your Game</h3>
              <p className="text-sm text-foreground-muted">
                These ranges are starting points. Tighten up vs tough opponents,
                widen vs weaker players. Use the preset selector above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
