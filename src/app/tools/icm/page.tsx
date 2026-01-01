"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Users, Trophy, DollarSign } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  calculateICM,
  PAYOUT_STRUCTURES,
  scalePayouts,
  ICMResult,
} from "@/lib/poker/icm";

interface Player {
  id: string;
  name: string;
  chips: number;
}

const DEFAULT_PLAYERS: Player[] = [
  { id: "1", name: "Player 1", chips: 5000 },
  { id: "2", name: "Player 2", chips: 3000 },
  { id: "3", name: "Player 3", chips: 2000 },
];

export default function ICMPage() {
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS);
  const [prizePool, setPrizePool] = useState<number>(1000);
  const [selectedStructure, setSelectedStructure] = useState<string>("top-3-50-30-20");
  const [customPayouts, setCustomPayouts] = useState<string>("");

  const payouts = useMemo(() => {
    if (customPayouts.trim()) {
      const parsed = customPayouts.split(",").map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
      if (parsed.length > 0) {
        return scalePayouts(parsed, prizePool);
      }
    }
    const structure = PAYOUT_STRUCTURES[selectedStructure];
    return structure ? scalePayouts(structure.payouts, prizePool) : [];
  }, [selectedStructure, prizePool, customPayouts]);

  const results = useMemo(() => {
    const stacks = players.map(p => p.chips);
    return calculateICM(stacks, payouts);
  }, [players, payouts]);

  const totalChips = players.reduce((sum, p) => sum + p.chips, 0);

  const addPlayer = () => {
    const newId = (Math.max(...players.map(p => parseInt(p.id))) + 1).toString();
    setPlayers([...players, { id: newId, name: `Player ${newId}`, chips: 1000 }]);
  };

  const removePlayer = (id: string) => {
    if (players.length > 2) {
      setPlayers(players.filter(p => p.id !== id));
    }
  };

  const updatePlayer = (id: string, field: "name" | "chips", value: string | number) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, [field]: field === "chips" ? Number(value) || 0 : value } : p
    ));
  };

  const getEquityBarColor = (index: number): string => {
    const colors = [
      "bg-emerald-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-amber-500",
      "bg-pink-500",
      "bg-cyan-500",
    ];
    return colors[index % colors.length];
  };

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
        <h1 className="text-3xl font-bold">ICM Calculator</h1>
        <p className="text-foreground-muted">
          Calculate Independent Chip Model equity for tournament decisions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Prize Pool & Structure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Prize Pool
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total Prize Pool</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">$</span>
                    <input
                      type="number"
                      value={prizePool}
                      onChange={(e) => setPrizePool(Number(e.target.value) || 0)}
                      className="w-full h-10 pl-8 pr-4 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                      min="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payout Structure</label>
                  <select
                    value={selectedStructure}
                    onChange={(e) => {
                      setSelectedStructure(e.target.value);
                      setCustomPayouts("");
                    }}
                    className="w-full h-10 px-3 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                  >
                    {Object.entries(PAYOUT_STRUCTURES).map(([key, structure]) => (
                      <option key={key} value={key}>{structure.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Payouts (optional)</label>
                <input
                  type="text"
                  value={customPayouts}
                  onChange={(e) => setCustomPayouts(e.target.value)}
                  placeholder="e.g., 50, 30, 20 (percentages)"
                  className="w-full h-10 px-4 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-xs text-foreground-muted">
                  Enter comma-separated percentages to override the structure
                </p>
              </div>

              {/* Payout Display */}
              <div className="p-3 rounded-lg bg-background-tertiary">
                <div className="text-sm font-medium mb-2">Payouts</div>
                <div className="flex flex-wrap gap-2">
                  {payouts.map((payout, i) => (
                    <div key={i} className="px-3 py-1.5 rounded bg-zinc-700 text-sm">
                      <span className="text-foreground-muted">{i + 1}st:</span>{" "}
                      <span className="font-medium">${payout.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Players */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Players ({players.length})
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={addPlayer} className="gap-1">
                  <Plus className="w-4 h-4" />
                  Add Player
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {players.map((player, index) => (
                <div key={player.id} className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white",
                    getEquityBarColor(index)
                  )}>
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={player.name}
                    onChange={(e) => updatePlayer(player.id, "name", e.target.value)}
                    className="flex-1 h-10 px-3 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={player.chips}
                      onChange={(e) => updatePlayer(player.id, "chips", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                      min="0"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePlayer(player.id)}
                    disabled={players.length <= 2}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-between text-sm text-foreground-muted pt-2 border-t border-zinc-700">
                <span>Total Chips</span>
                <span className="font-medium text-foreground">{totalChips.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                ICM Equity
              </CardTitle>
              <CardDescription>
                Tournament value based on chip stacks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                        getEquityBarColor(index)
                      )}>
                        {index + 1}
                      </div>
                      <span className="font-medium">{players[index]?.name}</span>
                    </div>
                    <span className="font-bold text-emerald-500">
                      ${result.dollarValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-foreground-muted">
                      <span>Chips: {result.chipPercentage.toFixed(1)}%</span>
                      <span>Equity: {result.icmPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="relative h-2 bg-zinc-700 rounded-full overflow-hidden">
                      {/* Chip percentage bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-zinc-500 opacity-50"
                        style={{ width: `${result.chipPercentage}%` }}
                      />
                      {/* ICM equity bar */}
                      <div
                        className={cn("absolute inset-y-0 left-0", getEquityBarColor(index))}
                        style={{ width: `${result.icmPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ICM Pressure Indicator */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ICM Pressure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.map((result, index) => {
                const chipEV = (result.chipPercentage / 100) * prizePool;
                const icmDiff = result.dollarValue - chipEV;
                const pressure = icmDiff < 0 ? "High" : icmDiff > 50 ? "Low" : "Medium";
                const pressureColor = pressure === "High" ? "text-red-500" : pressure === "Low" ? "text-emerald-500" : "text-amber-500";

                return (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{players[index]?.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", icmDiff >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {icmDiff >= 0 ? "+" : ""}{icmDiff.toFixed(0)}
                      </span>
                      <span className={cn("text-xs", pressureColor)}>({pressure})</span>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-foreground-muted pt-2 border-t border-zinc-700">
                Difference between ICM equity and chip-proportional share.
                Negative = more pressure to avoid risks.
              </p>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ICM Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground-muted">
              <p>
                <span className="font-medium text-foreground">Chip leaders:</span>{" "}
                ICM equity is less than chip proportion. Be more conservative.
              </p>
              <p>
                <span className="font-medium text-foreground">Short stacks:</span>{" "}
                ICM equity is higher than chip proportion. Can take more risks.
              </p>
              <p>
                <span className="font-medium text-foreground">Bubble:</span>{" "}
                ICM pressure is highest when close to the money.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
