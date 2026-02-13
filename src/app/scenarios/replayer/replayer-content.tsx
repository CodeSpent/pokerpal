"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Users,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ParsedHand, HandHistoryAction } from "@/types/hand-history";
import { SAMPLE_HANDS } from "@/data/sample-hands";
import { useHandStore } from "@/stores/hand-store";

const ACTION_COLORS: Record<string, string> = {
  fold: "text-red-400",
  check: "text-zinc-400",
  call: "text-blue-400",
  raise: "text-emerald-400",
  "all-in": "text-amber-400",
  bet: "text-emerald-400",
};

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

export default function ReplayerPage() {
  const { hands: savedHands } = useHandStore();
  const allHands = useMemo(() => [...SAMPLE_HANDS, ...savedHands], [savedHands]);

  const [selectedHandId, setSelectedHandId] = useState<string | null>(
    allHands[0]?.id || null
  );
  const [streetIndex, setStreetIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(-1); // -1 means no actions yet
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);

  const hand = allHands.find((h) => h.id === selectedHandId);

  // Calculate current state
  const currentState = useMemo(() => {
    if (!hand) return null;

    let pot = hand.blinds.sb + hand.blinds.bb;
    if (hand.blinds.ante) {
      pot += hand.blinds.ante * hand.players.length;
    }

    const playerStacks = new Map<string, number>();
    const playerBets = new Map<string, number>();
    const foldedPlayers = new Set<string>();

    // Initialize stacks
    hand.players.forEach((p) => {
      playerStacks.set(p.name, p.stack);
      playerBets.set(p.name, 0);
    });

    // Subtract blinds
    const sbPlayer = hand.players.find((p) => p.position === "SB");
    const bbPlayer = hand.players.find((p) => p.position === "BB");
    if (sbPlayer) {
      playerStacks.set(sbPlayer.name, sbPlayer.stack - hand.blinds.sb);
      playerBets.set(sbPlayer.name, hand.blinds.sb);
    }
    if (bbPlayer) {
      playerStacks.set(bbPlayer.name, bbPlayer.stack - hand.blinds.bb);
      playerBets.set(bbPlayer.name, hand.blinds.bb);
    }

    // Board cards shown
    const boardCards: string[] = [];

    // Process actions up to current point
    for (let si = 0; si <= streetIndex && si < hand.streets.length; si++) {
      const street = hand.streets[si];

      // Add board cards at start of street
      if (street.cards) {
        boardCards.push(...street.cards);
      }

      // Reset bets for new street (except preflop)
      if (si > 0) {
        playerBets.forEach((_, key) => playerBets.set(key, 0));
      }

      const maxActionIndex = si < streetIndex ? street.actions.length - 1 : actionIndex;

      for (let ai = 0; ai <= maxActionIndex && ai < street.actions.length; ai++) {
        const action = street.actions[ai];

        if (action.action === "fold") {
          foldedPlayers.add(action.player);
        } else if (action.amount) {
          const currentBet = playerBets.get(action.player) || 0;
          const amountToAdd = action.action === "call" || action.action === "raise" || action.action === "all-in"
            ? action.amount - currentBet
            : action.amount;

          pot += amountToAdd;
          playerStacks.set(
            action.player,
            (playerStacks.get(action.player) || 0) - amountToAdd
          );
          playerBets.set(action.player, action.amount);
        }
      }
    }

    return {
      pot,
      playerStacks,
      playerBets,
      foldedPlayers,
      boardCards,
      currentStreet: hand.streets[streetIndex],
      currentAction: actionIndex >= 0 ? hand.streets[streetIndex]?.actions[actionIndex] : null,
    };
  }, [hand, streetIndex, actionIndex]);

  // Get total actions for progress
  const totalActions = useMemo(() => {
    if (!hand) return 0;
    return hand.streets.reduce((sum, s) => sum + s.actions.length, 0);
  }, [hand]);

  const currentActionNumber = useMemo(() => {
    if (!hand) return 0;
    let count = 0;
    for (let i = 0; i < streetIndex; i++) {
      count += hand.streets[i].actions.length;
    }
    return count + actionIndex + 1;
  }, [hand, streetIndex, actionIndex]);

  // Navigation
  const goToStart = useCallback(() => {
    setStreetIndex(0);
    setActionIndex(-1);
    setIsPlaying(false);
  }, []);

  const goToEnd = useCallback(() => {
    if (!hand) return;
    const lastStreet = hand.streets.length - 1;
    setStreetIndex(lastStreet);
    setActionIndex(hand.streets[lastStreet].actions.length - 1);
    setIsPlaying(false);
  }, [hand]);

  const goNext = useCallback(() => {
    if (!hand) return;

    const currentStreet = hand.streets[streetIndex];
    if (actionIndex < currentStreet.actions.length - 1) {
      setActionIndex(actionIndex + 1);
    } else if (streetIndex < hand.streets.length - 1) {
      setStreetIndex(streetIndex + 1);
      setActionIndex(-1);
    } else {
      setIsPlaying(false);
    }
  }, [hand, streetIndex, actionIndex]);

  const goPrev = useCallback(() => {
    if (!hand) return;

    if (actionIndex > -1) {
      setActionIndex(actionIndex - 1);
    } else if (streetIndex > 0) {
      const prevStreet = hand.streets[streetIndex - 1];
      setStreetIndex(streetIndex - 1);
      setActionIndex(prevStreet.actions.length - 1);
    }
  }, [hand, streetIndex, actionIndex]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || !hand) return;

    const timer = setTimeout(() => {
      goNext();
    }, playbackSpeed);

    return () => clearTimeout(timer);
  }, [isPlaying, goNext, playbackSpeed, hand]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  if (!hand || !currentState) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Link
          href="/scenarios"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scenarios
        </Link>
        <Card className="py-12 text-center">
          <CardContent>
            <p className="text-foreground-muted">No hands available. Import some hands to get started.</p>
            <Link href="/scenarios/import">
              <Button variant="primary" className="mt-4">
                Import Hands
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/scenarios"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scenarios
        </Link>

        {/* Hand Selector */}
        <select
          value={selectedHandId || ""}
          onChange={(e) => {
            setSelectedHandId(e.target.value);
            setStreetIndex(0);
            setActionIndex(-1);
            setIsPlaying(false);
          }}
          className="h-9 px-3 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none"
        >
          {allHands.map((h) => (
            <option key={h.id} value={h.id}>
              {h.tableName || h.id} - {h.stakes}
            </option>
          ))}
        </select>
      </div>

      {/* Main Replayer */}
      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Table View */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {hand.tableName || "Hand Replayer"}
              </CardTitle>
              <div className="text-sm text-foreground-muted">
                {hand.gameType === "tournament" ? "Tournament" : "Cash"} • {hand.stakes}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Board */}
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span className="text-2xl font-bold">{currentState.pot.toFixed(1)} BB</span>
              </div>

              <div className="flex gap-2 min-h-[60px]">
                {currentState.boardCards.length > 0 ? (
                  currentState.boardCards.map((card, i) => (
                    <CardDisplay key={i} card={card} size="lg" />
                  ))
                ) : (
                  <div className="text-foreground-muted text-sm">No cards dealt yet</div>
                )}
              </div>

              <div className="text-sm font-medium text-foreground-muted">
                {hand.streets[streetIndex]?.name.toUpperCase()}
              </div>
            </div>

            {/* Players */}
            <div className="grid grid-cols-3 gap-3">
              {hand.players.map((player) => {
                const isFolded = currentState.foldedPlayers.has(player.name);
                const currentBet = currentState.playerBets.get(player.name) || 0;
                const stack = currentState.playerStacks.get(player.name) || player.stack;
                const isActing = currentState.currentAction?.player === player.name;

                return (
                  <div
                    key={player.name}
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      isFolded
                        ? "opacity-40 bg-zinc-800/50 border-zinc-700"
                        : isActing
                        ? "bg-emerald-500/10 border-emerald-500"
                        : "bg-background-tertiary border-zinc-700"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold text-white",
                          POSITION_COLORS[player.position] || "bg-zinc-500"
                        )}
                      >
                        {player.position}
                      </div>
                      <span className={cn("text-sm font-medium truncate", player.isHero && "text-emerald-400")}>
                        {player.name}
                      </span>
                    </div>

                    {/* Hole Cards */}
                    {player.cards && !isFolded && (
                      <div className="flex gap-1 mb-2">
                        <CardDisplay card={player.cards[0]} size="sm" />
                        <CardDisplay card={player.cards[1]} size="sm" />
                      </div>
                    )}

                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-muted">Stack</span>
                      <span>{stack.toFixed(1)} BB</span>
                    </div>
                    {currentBet > 0 && (
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-foreground-muted">Bet</span>
                        <span className="text-amber-400">{currentBet.toFixed(1)} BB</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action History & Controls */}
        <div className="space-y-4">
          {/* Current Action */}
          {currentState.currentAction && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="py-4">
                <div className="text-sm text-foreground-muted mb-1">Current Action</div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{currentState.currentAction.player}</span>
                  <span className={cn("font-bold", ACTION_COLORS[currentState.currentAction.action])}>
                    {currentState.currentAction.action.toUpperCase()}
                    {currentState.currentAction.amount && ` ${currentState.currentAction.amount} BB`}
                    {currentState.currentAction.isAllIn && " (ALL-IN)"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={goToStart}>
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goPrev}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="primary"
                  size="icon"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={goNext}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goToEnd}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-foreground-muted">
                  <span>Progress</span>
                  <span>{currentActionNumber} / {totalActions}</span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${totalActions > 0 ? (currentActionNumber / totalActions) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Speed */}
              <div className="mt-4">
                <label className="text-xs text-foreground-muted">Speed</label>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="w-full mt-1 h-8 px-2 text-sm rounded bg-background-tertiary border border-zinc-700"
                >
                  <option value={2000}>Slow (2s)</option>
                  <option value={1000}>Normal (1s)</option>
                  <option value={500}>Fast (0.5s)</option>
                  <option value={250}>Very Fast (0.25s)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Action Log */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Action History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {hand.streets.map((street, si) => (
                  <div key={si}>
                    <div className="text-xs font-bold text-foreground-muted uppercase mt-2 mb-1">
                      {street.name}
                      {street.cards && ` [${street.cards.join(" ")}]`}
                    </div>
                    {street.actions.map((action, ai) => {
                      const isPast = si < streetIndex || (si === streetIndex && ai <= actionIndex);
                      const isCurrent = si === streetIndex && ai === actionIndex;

                      return (
                        <div
                          key={ai}
                          className={cn(
                            "text-sm py-0.5 px-2 rounded",
                            isCurrent && "bg-emerald-500/20",
                            !isPast && "opacity-40"
                          )}
                        >
                          <span className="text-foreground-muted">{action.position}</span>{" "}
                          <span className={ACTION_COLORS[action.action]}>
                            {action.action}
                            {action.amount && ` ${action.amount}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {hand.winners.length > 0 && currentActionNumber === totalActions && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Result</CardTitle>
              </CardHeader>
              <CardContent>
                {hand.winners.map((w, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{w.player}</span>
                    <span className="font-bold text-emerald-500">+{w.amount} BB</span>
                  </div>
                ))}
                {hand.showdown && <div className="text-xs text-foreground-muted mt-2">Showdown</div>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardContent className="py-3">
          <div className="flex justify-center gap-6 text-xs text-foreground-muted">
            <span><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded">←</kbd> Previous</span>
            <span><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded">→</kbd> Next</span>
            <span><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded">Space</kbd> Play/Pause</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Card display component
function CardDisplay({ card, size = "md" }: { card: string; size?: "sm" | "md" | "lg" }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);

  const suitSymbols: Record<string, string> = {
    h: "♥",
    d: "♦",
    c: "♣",
    s: "♠",
  };

  const suitColors: Record<string, string> = {
    h: "text-red-500",
    d: "text-blue-500",
    c: "text-emerald-500",
    s: "text-zinc-300",
  };

  const sizes = {
    sm: "w-7 h-10 text-xs",
    md: "w-10 h-14 text-sm",
    lg: "w-12 h-16 text-base",
  };

  return (
    <div
      className={cn(
        "rounded bg-white flex flex-col items-center justify-center text-zinc-900 font-bold shadow-md",
        sizes[size]
      )}
    >
      <span>{rank}</span>
      <span className={cn("-mt-1", suitColors[suit])}>{suitSymbols[suit]}</span>
    </div>
  );
}
