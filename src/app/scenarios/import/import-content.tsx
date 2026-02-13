"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Upload,
  FileText,
  Check,
  X,
  Trash2,
  Play,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ParsedHand } from "@/types/hand-history";
import { parseHandHistoryFile, detectSource, getSourceName } from "@/lib/poker/parsers";
import { useHandStore } from "@/stores/hand-store";

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { saveHand, hands: savedHands } = useHandStore();

  const [parsedHands, setParsedHands] = useState<ParsedHand[]>([]);
  const [selectedHands, setSelectedHands] = useState<Set<string>>(new Set());
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"file" | "paste">("file");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const content = await file.text();
      const hands = parseHandHistoryFile(content);

      if (hands.length === 0) {
        setError("No valid hands found in file. Make sure it's a PokerStars or GGPoker hand history file.");
        return;
      }

      setParsedHands(hands);
      setSelectedHands(new Set(hands.map((h) => h.id)));
    } catch (err) {
      setError("Failed to read file. Please try again.");
      console.error(err);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) {
      setError("Please paste hand history content.");
      return;
    }

    setError(null);

    const hands = parseHandHistoryFile(pasteText);

    if (hands.length === 0) {
      setError("No valid hands found. Make sure you pasted a complete PokerStars or GGPoker hand history.");
      return;
    }

    setParsedHands(hands);
    setSelectedHands(new Set(hands.map((h) => h.id)));
    setPasteText("");
  };

  const toggleHandSelection = (id: string) => {
    const newSelected = new Set(selectedHands);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedHands(newSelected);
  };

  const selectAll = () => {
    setSelectedHands(new Set(parsedHands.map((h) => h.id)));
  };

  const deselectAll = () => {
    setSelectedHands(new Set());
  };

  const importSelected = () => {
    const handsToImport = parsedHands.filter((h) => selectedHands.has(h.id));

    for (const hand of handsToImport) {
      saveHand(hand);
    }

    // Navigate to replayer
    router.push("/scenarios/replayer");
  };

  const clearParsed = () => {
    setParsedHands([]);
    setSelectedHands(new Set());
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/scenarios"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scenarios
        </Link>
        <h1 className="text-3xl font-bold">Import Hand History</h1>
        <p className="text-foreground-muted">
          Import hands from PokerStars or GGPoker to review and analyze.
        </p>
      </div>

      {/* Import Methods */}
      {parsedHands.length === 0 && (
        <>
          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              variant={importMode === "file" ? "primary" : "ghost"}
              onClick={() => setImportMode("file")}
            >
              Upload File
            </Button>
            <Button
              variant={importMode === "paste" ? "primary" : "ghost"}
              onClick={() => setImportMode("paste")}
            >
              Paste Text
            </Button>
          </div>

          {/* Error */}
          {error && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-400">{error}</span>
              </CardContent>
            </Card>
          )}

          {/* File Upload */}
          {importMode === "file" && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <Upload className="w-12 h-12 text-foreground-muted mb-4" />
                  <h3 className="text-lg font-medium mb-2">Upload Hand History File</h3>
                  <p className="text-foreground-muted mb-6 max-w-md">
                    Select a .txt file exported from PokerStars or GGPoker. Multiple hands per file are supported.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.log"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Choose File
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paste Text */}
          {importMode === "paste" && (
            <Card>
              <CardHeader>
                <CardTitle>Paste Hand History</CardTitle>
                <CardDescription>
                  Copy and paste hand history text directly from PokerStars or GGPoker.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste hand history here..."
                  className="w-full h-64 p-4 rounded-lg bg-background-tertiary border border-zinc-700 focus:border-emerald-500 focus:outline-none resize-none font-mono text-sm"
                />
                <Button
                  variant="primary"
                  onClick={handlePaste}
                  disabled={!pasteText.trim()}
                >
                  Parse Hands
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Supported Formats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supported Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <div className="font-medium">PokerStars</div>
                    <div className="text-sm text-foreground-muted">
                      Cash games, tournaments, and Zoom hands
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <div className="font-medium">GGPoker</div>
                    <div className="text-sm text-foreground-muted">
                      All game types supported
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Parsed Hands */}
      {parsedHands.length > 0 && (
        <>
          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-foreground-muted">
                {parsedHands.length} hand{parsedHands.length !== 1 ? "s" : ""} found
              </span>
              <span className="text-foreground-muted">•</span>
              <span className="text-emerald-500">{selectedHands.size} selected</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearParsed} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Hand List */}
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-700 max-h-[400px] overflow-y-auto">
                {parsedHands.map((hand) => {
                  const source = detectSource(hand.id);
                  const isSelected = selectedHands.has(hand.id);
                  const heroPlayer = hand.players.find((p) => p.isHero);

                  return (
                    <div
                      key={hand.id}
                      onClick={() => toggleHandSelection(hand.id)}
                      className={cn(
                        "p-4 cursor-pointer transition-colors",
                        isSelected ? "bg-emerald-500/10" : "hover:bg-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center",
                              isSelected
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-zinc-600"
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {hand.tableName || "Hand"}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-zinc-700">
                                {getSourceName(hand.source)}
                              </span>
                            </div>
                            <div className="text-sm text-foreground-muted flex items-center gap-2">
                              <span>{hand.stakes}</span>
                              <span>•</span>
                              <span>{hand.gameType}</span>
                              {heroPlayer?.cards && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {heroPlayer.cards[0]} {heroPlayer.cards[1]}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            {hand.winners.length > 0 && (
                              <span
                                className={cn(
                                  hand.winners.some((w) => w.player === hand.heroName)
                                    ? "text-emerald-500"
                                    : "text-red-400"
                                )}
                              >
                                {hand.winners.some((w) => w.player === hand.heroName)
                                  ? `+${hand.winners.find((w) => w.player === hand.heroName)?.amount.toFixed(1)} BB`
                                  : "Lost"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-foreground-muted">
                            {hand.board.length > 0 ? hand.board.join(" ") : "No showdown"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Import Button */}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={clearParsed}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={importSelected}
              disabled={selectedHands.size === 0}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Import {selectedHands.size} Hand{selectedHands.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </>
      )}

      {/* Saved Hands Count */}
      {savedHands.length > 0 && parsedHands.length === 0 && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <span className="text-foreground-muted">
              You have {savedHands.length} saved hand{savedHands.length !== 1 ? "s" : ""}
            </span>
            <Link href="/scenarios/replayer">
              <Button variant="ghost" className="gap-2">
                <Play className="w-4 h-4" />
                Open Replayer
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
