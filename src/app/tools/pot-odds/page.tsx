"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info } from "lucide-react";
import { cn } from "@/lib/cn";

// Common draw outs for reference
const COMMON_DRAWS = [
  { name: "Flush Draw", outs: 9, description: "9 cards to complete flush" },
  { name: "Open-Ended Straight", outs: 8, description: "8 cards to complete straight" },
  { name: "Gutshot Straight", outs: 4, description: "4 cards to complete straight" },
  { name: "Two Overcards", outs: 6, description: "6 cards to pair up" },
  { name: "Flush + Gutshot", outs: 12, description: "Combo draw" },
  { name: "Flush + OESD", outs: 15, description: "Monster draw" },
  { name: "Set to Full House", outs: 7, description: "Improve set on paired board" },
  { name: "One Overcard", outs: 3, description: "3 cards to pair up" },
];

export default function PotOddsPage() {
  const [potSize, setPotSize] = useState<string>("100");
  const [betToCall, setBetToCall] = useState<string>("50");
  const [outs, setOuts] = useState<string>("");
  const [street, setStreet] = useState<"flop" | "turn">("flop");

  const calculations = useMemo(() => {
    const pot = parseFloat(potSize) || 0;
    const bet = parseFloat(betToCall) || 0;
    const outsNum = parseInt(outs) || 0;

    if (pot <= 0 || bet <= 0) {
      return null;
    }

    // Pot odds calculation
    const totalPot = pot + bet; // Pot after opponent's bet
    const potOddsRatio = totalPot / bet;
    const potOddsPercent = (bet / (totalPot + bet)) * 100;
    const requiredEquity = potOddsPercent;

    // Implied odds - assume we can win 2x the bet if we hit
    const impliedPot = totalPot + bet * 2;
    const impliedOddsPercent = (bet / (impliedPot + bet)) * 100;

    // Calculate equity from outs using rule of 2 and 4
    let equityFromOuts = 0;
    if (outsNum > 0) {
      if (street === "flop") {
        // Two cards to come - use rule of 4 (slightly adjusted for accuracy)
        equityFromOuts = Math.min(outsNum * 4, 100);
      } else {
        // One card to come - use rule of 2
        equityFromOuts = Math.min(outsNum * 2, 100);
      }
    }

    const isProfitableCall = outsNum > 0 ? equityFromOuts >= requiredEquity : null;

    return {
      potOddsRatio: potOddsRatio.toFixed(1),
      potOddsPercent: potOddsPercent.toFixed(1),
      requiredEquity: requiredEquity.toFixed(1),
      impliedOddsPercent: impliedOddsPercent.toFixed(1),
      equityFromOuts: equityFromOuts.toFixed(1),
      isProfitableCall,
      breakEvenOuts: Math.ceil(requiredEquity / (street === "flop" ? 4 : 2)),
    };
  }, [potSize, betToCall, outs, street]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/tools"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>
        <h1 className="text-3xl font-bold">Pot Odds Calculator</h1>
        <p className="text-foreground-muted">
          Calculate if a call is profitable based on pot odds and your equity.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        {/* Calculator */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pot Size */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Pot Size</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">$</span>
                  <input
                    type="number"
                    value={potSize}
                    onChange={(e) => setPotSize(e.target.value)}
                    className="w-full h-12 pl-8 pr-4 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none text-lg"
                    placeholder="100"
                    min="0"
                  />
                </div>
              </div>

              {/* Bet to Call */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Bet to Call</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">$</span>
                  <input
                    type="number"
                    value={betToCall}
                    onChange={(e) => setBetToCall(e.target.value)}
                    className="w-full h-12 pl-8 pr-4 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none text-lg"
                    placeholder="50"
                    min="0"
                  />
                </div>
              </div>

              {/* Street Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Street</label>
                <div className="flex gap-2">
                  <Button
                    variant={street === "flop" ? "secondary" : "ghost"}
                    onClick={() => setStreet("flop")}
                    className="flex-1"
                  >
                    Flop (2 cards to come)
                  </Button>
                  <Button
                    variant={street === "turn" ? "secondary" : "ghost"}
                    onClick={() => setStreet("turn")}
                    className="flex-1"
                  >
                    Turn (1 card to come)
                  </Button>
                </div>
              </div>

              {/* Outs */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Outs (optional)</label>
                <input
                  type="number"
                  value={outs}
                  onChange={(e) => setOuts(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none text-lg"
                  placeholder="Enter number of outs"
                  min="0"
                  max="47"
                />
                <p className="text-xs text-foreground-muted">
                  Enter your outs to see if calling is profitable
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {calculations && (
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background-tertiary">
                    <div className="text-sm text-foreground-muted">Pot Odds</div>
                    <div className="text-2xl font-bold">{calculations.potOddsRatio}:1</div>
                    <div className="text-sm text-foreground-muted">{calculations.potOddsPercent}%</div>
                  </div>
                  <div className="p-4 rounded-lg bg-background-tertiary">
                    <div className="text-sm text-foreground-muted">Equity Needed</div>
                    <div className="text-2xl font-bold text-amber-500">{calculations.requiredEquity}%</div>
                    <div className="text-sm text-foreground-muted">to break even</div>
                  </div>
                </div>

                {parseInt(outs) > 0 && (
                  <>
                    <div className="border-t border-zinc-700 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-background-tertiary">
                          <div className="text-sm text-foreground-muted">Your Equity</div>
                          <div className="text-2xl font-bold">{calculations.equityFromOuts}%</div>
                          <div className="text-sm text-foreground-muted">
                            {outs} outs × {street === "flop" ? "4" : "2"}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "p-4 rounded-lg",
                            calculations.isProfitableCall
                              ? "bg-emerald-500/10 border border-emerald-500/30"
                              : "bg-red-500/10 border border-red-500/30"
                          )}
                        >
                          <div className="text-sm text-foreground-muted">Verdict</div>
                          <div
                            className={cn(
                              "text-2xl font-bold",
                              calculations.isProfitableCall ? "text-emerald-500" : "text-red-500"
                            )}
                          >
                            {calculations.isProfitableCall ? "CALL" : "FOLD"}
                          </div>
                          <div className="text-sm text-foreground-muted">
                            {calculations.isProfitableCall ? "Profitable call" : "Not enough equity"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                        <div className="text-sm">
                          <span className="font-medium">Implied Odds:</span>{" "}
                          <span className="text-foreground-muted">
                            If you expect to win more when you hit, you only need{" "}
                            <span className="text-blue-400">{calculations.impliedOddsPercent}%</span> equity
                            (assuming you win 2x the bet when you hit).
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!outs && (
                  <div className="p-4 rounded-lg bg-zinc-800 text-sm text-foreground-muted">
                    <p>
                      You need at least <span className="font-bold text-foreground">{calculations.breakEvenOuts} outs</span> to
                      profitably call this bet on the {street}.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Reference */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Common Draw Outs</CardTitle>
              <CardDescription>Click to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {COMMON_DRAWS.map((draw) => (
                <button
                  key={draw.name}
                  onClick={() => setOuts(draw.outs.toString())}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-colors",
                    "bg-background-tertiary hover:bg-zinc-700",
                    outs === draw.outs.toString() && "ring-1 ring-emerald-500"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{draw.name}</span>
                    <span className="text-emerald-500 font-bold">{draw.outs}</span>
                  </div>
                  <div className="text-xs text-foreground-muted">{draw.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">2:1 pot odds</span>
                  <span>33% equity needed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">3:1 pot odds</span>
                  <span>25% equity needed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">4:1 pot odds</span>
                  <span>20% equity needed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">5:1 pot odds</span>
                  <span>17% equity needed</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
