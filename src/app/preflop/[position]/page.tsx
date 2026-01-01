"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POSITIONS_6MAX, POSITIONS_9MAX, POSITION_NAMES, Position } from "@/types/poker";
import { getRangesByPreset, PRESET_INFO, RangePreset } from "@/data/preflop-ranges";
import { HandMatrix } from "@/components/poker/hand-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, Target } from "lucide-react";

interface PageProps {
  params: Promise<{ position: string }>;
}

const POSITION_CONTENT: Record<Position, { tips: string[]; common_mistakes: string[] }> = {
  UTG: {
    tips: [
      "Play only premium hands - you have the worst position",
      "Your range should be strong enough to withstand 3-bets",
      "Avoid suited connectors unless they're premium (JTs+)",
      "Pocket pairs below 77 are marginal opens",
    ],
    common_mistakes: [
      "Opening too wide and facing tough spots postflop",
      "Playing suited gappers that don't flop well OOP",
      "Overvaluing Ax offsuit hands",
    ],
  },
  UTG1: {
    tips: [
      "Slightly wider than UTG but still conservative",
      "Can add some suited aces for balance",
      "Medium pairs become more playable",
      "Position over 3+ players is still concerning",
    ],
    common_mistakes: [
      "Treating this position as middle position",
      "Opening hands you can't continue with vs 3-bet",
    ],
  },
  UTG2: {
    tips: [
      "True middle position in 9-max",
      "Suited connectors start becoming viable",
      "All pairs can be opened in loose games",
      "Balance your range with some suited Ax",
    ],
    common_mistakes: [
      "Opening too many offsuit broadways",
      "Not adjusting to table dynamics",
    ],
  },
  LJ: {
    tips: [
      "Lojack is the start of late position thinking",
      "Open all suited aces",
      "Small pairs are +EV opens",
      "Suited one-gappers become playable",
    ],
    common_mistakes: [
      "Still playing too tight for this position",
      "Not attacking tight players in the blinds",
    ],
  },
  HJ: {
    tips: [
      "Hijack is a powerful stealing position",
      "Open all pocket pairs",
      "Suited connectors down to 54s are profitable",
      "Some suited kings become opens",
    ],
    common_mistakes: [
      "Not widening enough vs tight CO/BTN",
      "Folding too much to 3-bets",
    ],
  },
  CO: {
    tips: [
      "Cutoff is one of the most profitable positions",
      "Open very wide - only BTN and blinds behind",
      "Suited trash can be profitable opens",
      "Attack tight blinds relentlessly",
    ],
    common_mistakes: [
      "Playing too tight and missing value",
      "Not adjusting to active button players",
    ],
  },
  BTN: {
    tips: [
      "Button is the best position - exploit it",
      "Open extremely wide against tight blinds",
      "Any two suited cards have value",
      "You have position for the entire hand",
    ],
    common_mistakes: [
      "Being too conservative on the button",
      "Not stealing enough from passive blinds",
      "Overfolding to 3-bets from the blinds",
    ],
  },
  SB: {
    tips: [
      "SB vs BB is a unique dynamic",
      "Use a raise-or-fold strategy",
      "Wide range but be prepared to play OOP",
      "3-bet or fold vs button opens",
    ],
    common_mistakes: [
      "Limping instead of raising",
      "Calling 3-bets too wide",
      "Not defending enough vs button steals",
    ],
  },
  BB: {
    tips: [
      "You're getting good odds to defend",
      "Defend wider against late position opens",
      "3-bet for value and as bluffs",
      "Close the action with favorable odds",
    ],
    common_mistakes: [
      "Over-defending vs early position raises",
      "Not 3-betting enough for value",
      "Playing too passively postflop",
    ],
  },
};

export default function PositionPage({ params }: PageProps) {
  const { position: positionParam } = use(params);
  const position = positionParam.toUpperCase() as Position;

  // Validate position
  if (!POSITIONS_9MAX.includes(position)) {
    notFound();
  }

  const [preset, setPreset] = useState<RangePreset>("standard");
  const ranges = getRangesByPreset(preset);
  const range = ranges[position];
  const content = POSITION_CONTENT[position];

  const selectedHands = new Set(range.openRaise);
  const handCount = range.openRaise.length;
  const percentage = ((handCount / 169) * 100).toFixed(1);

  // Navigation
  const positions = POSITIONS_6MAX;
  const currentIndex = positions.indexOf(position);
  const prevPosition = currentIndex > 0 ? positions[currentIndex - 1] : null;
  const nextPosition = currentIndex < positions.length - 1 ? positions[currentIndex + 1] : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Link href="/preflop" className="hover:text-foreground">
              PreFlop
            </Link>
            <span>/</span>
            <span>{position}</span>
          </div>
          <h1 className="text-3xl font-bold">{POSITION_NAMES[position]}</h1>
          <p className="text-foreground-muted">{range.description}</p>
        </div>
        <Link href="/preflop/practice">
          <Button variant="primary" className="gap-2">
            <Target className="w-4 h-4" />
            Practice
          </Button>
        </Link>
      </div>

      {/* Preset Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground-muted">Style</label>
        <Tabs value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
          <TabsList>
            {(Object.keys(PRESET_INFO) as RangePreset[]).map((p) => (
              <TabsTrigger key={p} value={p} className="capitalize">
                {PRESET_INFO[p].name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
        {/* Hand Matrix */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Opening Range</CardTitle>
              <div className="text-sm text-foreground-muted">
                {position === "BB" ? (
                  "Defends vs raises"
                ) : (
                  <>
                    <span className="font-medium text-foreground">{handCount}</span> hands ({percentage}%)
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {position === "BB" ? (
              <div className="text-center py-12 text-foreground-muted">
                <p className="mb-2">Big Blind doesn&apos;t have an opening range.</p>
                <p className="text-sm">BB defends vs raises from other positions.</p>
              </div>
            ) : (
              <HandMatrix
                selectedHands={selectedHands}
                disabled={true}
                size="md"
                showLabels={true}
              />
            )}
          </CardContent>
        </Card>

        {/* Tips & Content */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {content.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span className="text-foreground-muted">{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-action-fold">Common Mistakes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {content.common_mistakes.map((mistake, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-action-fold mt-0.5">•</span>
                    <span className="text-foreground-muted">{mistake}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Stats */}
          {position !== "BB" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Range Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Pocket Pairs</span>
                  <span>{range.openRaise.filter(h => h.length === 2).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Suited Hands</span>
                  <span>{range.openRaise.filter(h => h.endsWith('s')).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Offsuit Hands</span>
                  <span>{range.openRaise.filter(h => h.endsWith('o')).length}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Position Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        {prevPosition ? (
          <Link href={`/preflop/${prevPosition.toLowerCase()}`}>
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {prevPosition}
            </Button>
          </Link>
        ) : (
          <div />
        )}
        {nextPosition ? (
          <Link href={`/preflop/${nextPosition.toLowerCase()}`}>
            <Button variant="ghost" className="gap-2">
              {nextPosition}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
