"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRangeSet } from "@/hooks/useRangeSet";
import { type PositionRangeData } from "@/hooks/useRangeSets";
import { POSITIONS_6MAX, Position, POSITION_SHORT, generateAllHands } from "@/types/poker";
import { HandMatrix } from "@/components/poker/hand-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Trash2, RotateCcw, Grid3X3, Share2, Link as LinkIcon, Loader2, Check } from "lucide-react";
import { useResponsiveMatrixSize } from "@/hooks/useResponsiveMatrixSize";

interface PageProps {
  params: Promise<{ rangeId: string }>;
}

const ALL_HANDS = generateAllHands();

const QUICK_SELECTS = {
  "All Pairs": ALL_HANDS.filter(h => h.length === 2),
  "All Suited": ALL_HANDS.filter(h => h.endsWith('s')),
  "All Offsuit": ALL_HANDS.filter(h => h.endsWith('o')),
  "Premium Pairs": ["AA", "KK", "QQ", "JJ", "TT"],
  "Broadway": ["AKs", "AQs", "AJs", "ATs", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "AKo", "AQo", "AJo", "ATo", "KQo", "KJo", "KTo", "QJo", "QTo", "JTo"],
  "Suited Aces": ALL_HANDS.filter(h => h.startsWith('A') && h.endsWith('s')),
  "Suited Connectors": ["AKs", "KQs", "QJs", "JTs", "T9s", "98s", "87s", "76s", "65s", "54s", "43s", "32s"],
};

export default function RangeSetEditorPage({ params }: PageProps) {
  const { rangeId } = use(params);
  const router = useRouter();
  const { rangeSet, isLoading, updateRangeSet, deleteRangeSet, toggleShare } = useRangeSet(rangeId);

  const [name, setName] = useState("");
  const [positions, setPositions] = useState<Partial<Record<Position, PositionRangeData>>>({});
  const [activePosition, setActivePosition] = useState<Position>("UTG");
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const matrixSize = useResponsiveMatrixSize();

  const currentHands = new Set(positions[activePosition]?.hands ?? []);

  // Sync from fetched data
  useEffect(() => {
    if (rangeSet) {
      setName(rangeSet.name);
      setPositions(rangeSet.positions);
    }
  }, [rangeSet]);

  // Track changes
  useEffect(() => {
    if (!rangeSet) return;
    const nameChanged = name !== rangeSet.name;
    const positionsChanged = JSON.stringify(positions) !== JSON.stringify(rangeSet.positions);
    setHasChanges(nameChanged || positionsChanged);
  }, [name, positions, rangeSet]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (!rangeSet) {
    return (
      <Card className="p-12 text-center max-w-md mx-auto mt-12">
        <div className="space-y-4">
          <Grid3X3 className="w-12 h-12 mx-auto text-foreground-muted" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Range set not found</h2>
            <p className="text-foreground-muted">
              This range set may have been deleted or doesn&apos;t exist.
            </p>
          </div>
          <Link href="/ranges">
            <Button variant="primary" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Range Sets
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const handleHandsChange = (hands: Set<string>) => {
    setPositions(prev => ({
      ...prev,
      [activePosition]: { hands: Array.from(hands) },
    }));
  };

  const handleSave = async () => {
    const success = await updateRangeSet({ name, positions });
    if (success) setHasChanges(false);
  };

  const handleDelete = async () => {
    if (rangeSet.isDefault) return;
    if (confirm("Delete this range set?")) {
      const success = await deleteRangeSet();
      if (success) router.push("/ranges");
    }
  };

  const handleClear = () => {
    setPositions(prev => ({
      ...prev,
      [activePosition]: { hands: [] },
    }));
  };

  const handleQuickSelect = (key: keyof typeof QUICK_SELECTS, mode: "add" | "remove") => {
    const hands = QUICK_SELECTS[key];
    const current = new Set(positions[activePosition]?.hands ?? []);
    if (mode === "add") {
      hands.forEach(h => current.add(h));
    } else {
      hands.forEach(h => current.delete(h));
    }
    setPositions(prev => ({
      ...prev,
      [activePosition]: { hands: Array.from(current) },
    }));
  };

  const handleShare = async () => {
    const shareCode = await toggleShare();
    if (shareCode) {
      const url = `${window.location.origin}/ranges/shared/${shareCode}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyShareLink = async () => {
    if (!rangeSet.shareCode) return;
    const url = `${window.location.origin}/ranges/shared/${rangeSet.shareCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const percentage = ((currentHands.size / 169) * 100).toFixed(1);

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
          {rangeSet.isShared && rangeSet.shareCode && (
            <Button variant="ghost" onClick={handleCopyShareLink} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
          )}
          <Button
            variant={rangeSet.isShared ? "secondary" : "ghost"}
            onClick={handleShare}
            className="gap-2"
          >
            <Share2 className="w-4 h-4" />
            {rangeSet.isShared ? "Unshare" : "Share"}
          </Button>
          {!rangeSet.isDefault && (
            <Button variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} disabled={!hasChanges} className="gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Position Tabs */}
      <div className="flex gap-2 flex-wrap">
        {POSITIONS_6MAX.map(pos => {
          const handCount = positions[pos]?.hands.length ?? 0;
          return (
            <Button
              key={pos}
              variant={activePosition === pos ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActivePosition(pos)}
              className="gap-1.5"
            >
              {POSITION_SHORT[pos]}
              <span className="text-xs text-foreground-muted bg-zinc-800 px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center">
                {handCount}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Matrix */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {POSITION_SHORT[activePosition]} Hand Selection
              </CardTitle>
              <div className="text-sm text-foreground-muted">
                <span className="font-medium text-foreground">{currentHands.size}</span> hands ({percentage}%)
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <HandMatrix
              selectedHands={currentHands}
              onHandsChange={handleHandsChange}
              size={matrixSize}
              showLabels={true}
            />
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
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
                <span>{Array.from(currentHands).filter(h => h.length === 2).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Suited Hands</span>
                <span>{Array.from(currentHands).filter(h => h.endsWith('s')).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Offsuit Hands</span>
                <span>{Array.from(currentHands).filter(h => h.endsWith('o')).length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
