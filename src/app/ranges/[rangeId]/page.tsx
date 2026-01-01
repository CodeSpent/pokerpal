"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRangeStore } from "@/stores/range-store";
import { POSITIONS_6MAX, Position, POSITION_SHORT, generateAllHands } from "@/types/poker";
import { HandMatrix } from "@/components/poker/hand-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Trash2, RotateCcw } from "lucide-react";
import { useResponsiveMatrixSize } from "@/hooks/useResponsiveMatrixSize";

interface PageProps {
  params: Promise<{ rangeId: string }>;
}

const ALL_HANDS = generateAllHands();

// Quick select presets
const QUICK_SELECTS = {
  "All Pairs": ALL_HANDS.filter(h => h.length === 2),
  "All Suited": ALL_HANDS.filter(h => h.endsWith('s')),
  "All Offsuit": ALL_HANDS.filter(h => h.endsWith('o')),
  "Premium Pairs": ["AA", "KK", "QQ", "JJ", "TT"],
  "Broadway": ["AKs", "AQs", "AJs", "ATs", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "AKo", "AQo", "AJo", "ATo", "KQo", "KJo", "KTo", "QJo", "QTo", "JTo"],
  "Suited Aces": ALL_HANDS.filter(h => h.startsWith('A') && h.endsWith('s')),
  "Suited Connectors": ["AKs", "KQs", "QJs", "JTs", "T9s", "98s", "87s", "76s", "65s", "54s", "43s", "32s"],
};

export default function RangeEditorPage({ params }: PageProps) {
  const { rangeId } = use(params);
  const router = useRouter();
  const { ranges, updateRange, deleteRange } = useRangeStore();

  const range = ranges.find(r => r.id === rangeId);

  const [name, setName] = useState(range?.name || "New Range");
  const [selectedHands, setSelectedHands] = useState<Set<string>>(
    new Set(range?.hands || [])
  );
  const [position, setPosition] = useState<Position | undefined>(range?.position);
  const [hasChanges, setHasChanges] = useState(false);
  const matrixSize = useResponsiveMatrixSize();

  // Sync with store when range changes
  useEffect(() => {
    if (range) {
      setName(range.name);
      setSelectedHands(new Set(range.hands));
      setPosition(range.position);
    }
  }, [range]);

  // Track changes
  useEffect(() => {
    if (!range) return;
    const handsChanged =
      range.hands.length !== selectedHands.size ||
      !range.hands.every(h => selectedHands.has(h));
    setHasChanges(
      name !== range.name ||
      position !== range.position ||
      handsChanged
    );
  }, [name, position, selectedHands, range]);

  if (!range) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Range not found</h1>
        <Link href="/ranges">
          <Button>Back to Ranges</Button>
        </Link>
      </div>
    );
  }

  const handleSave = () => {
    updateRange(rangeId, {
      name,
      hands: Array.from(selectedHands),
      position,
    });
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (confirm("Delete this range?")) {
      deleteRange(rangeId);
      router.push("/ranges");
    }
  };

  const handleClear = () => {
    setSelectedHands(new Set());
  };

  const handleQuickSelect = (key: keyof typeof QUICK_SELECTS, mode: "add" | "remove" | "set") => {
    const hands = QUICK_SELECTS[key];
    setSelectedHands(prev => {
      const next = new Set(prev);
      if (mode === "set") {
        return new Set(hands);
      } else if (mode === "add") {
        hands.forEach(h => next.add(h));
      } else {
        hands.forEach(h => next.delete(h));
      }
      return next;
    });
  };

  const percentage = ((selectedHands.size / 169) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ranges">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 focus:outline-none px-1"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!hasChanges} className="gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Matrix */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Hand Selection</CardTitle>
              <div className="text-sm text-foreground-muted">
                <span className="font-medium text-foreground">{selectedHands.size}</span> hands ({percentage}%)
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <HandMatrix
              selectedHands={selectedHands}
              onHandsChange={setSelectedHands}
              size={matrixSize}
              showLabels={true}
            />
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Position */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!position ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPosition(undefined)}
                >
                  None
                </Button>
                {POSITIONS_6MAX.map(pos => (
                  <Button
                    key={pos}
                    variant={position === pos ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setPosition(pos)}
                  >
                    {POSITION_SHORT[pos]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Select */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Quick Select</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1 h-7">
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(QUICK_SELECTS) as (keyof typeof QUICK_SELECTS)[]).map(key => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{key}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => handleQuickSelect(key, "add")}
                  >
                    +
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => handleQuickSelect(key, "remove")}
                  >
                    -
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Range Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">Pocket Pairs</span>
                <span>{Array.from(selectedHands).filter(h => h.length === 2).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Suited Hands</span>
                <span>{Array.from(selectedHands).filter(h => h.endsWith('s')).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Offsuit Hands</span>
                <span>{Array.from(selectedHands).filter(h => h.endsWith('o')).length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
