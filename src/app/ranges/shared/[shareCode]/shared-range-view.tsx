"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSharedRangeSet } from "@/hooks/useSharedRangeSet";
import { POSITIONS_6MAX, Position, POSITION_SHORT } from "@/types/poker";
import { HandMatrix } from "@/components/poker/hand-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Grid3X3, Download, User, Loader2 } from "lucide-react";
import { useResponsiveMatrixSize } from "@/hooks/useResponsiveMatrixSize";

export function SharedRangeView({ shareCode }: { shareCode: string }) {
  const router = useRouter();
  const { rangeSet, creatorName, isLoading, adoptRangeSet } = useSharedRangeSet(shareCode);

  const [activePosition, setActivePosition] = useState<Position>("UTG");
  const [adopting, setAdopting] = useState(false);
  const matrixSize = useResponsiveMatrixSize();

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
              This shared range set may no longer be available.
            </p>
          </div>
          <Link href="/ranges">
            <Button variant="primary" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              My Range Sets
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const currentHands = new Set(rangeSet.positions[activePosition]?.hands ?? []);
  const percentage = ((currentHands.size / 169) * 100).toFixed(1);

  const handleAdopt = async () => {
    setAdopting(true);
    const newId = await adoptRangeSet();
    if (newId) {
      router.push(`/ranges/${newId}`);
    } else {
      router.push("/auth/signin");
    }
    setAdopting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/ranges">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{rangeSet.name}</h1>
          </div>
          <div className="flex items-center gap-2 text-foreground-muted ml-12">
            <User className="w-4 h-4" />
            <span>Shared by {creatorName}</span>
          </div>
        </div>
        <Button variant="primary" className="gap-2" onClick={handleAdopt} disabled={adopting}>
          <Download className="w-4 h-4" />
          {adopting ? "Adopting..." : "Adopt Range Set"}
        </Button>
      </div>

      {rangeSet.description && (
        <p className="text-foreground-muted">{rangeSet.description}</p>
      )}

      {/* Position Tabs */}
      <div className="flex gap-2 flex-wrap">
        {POSITIONS_6MAX.map(pos => {
          const handCount = rangeSet.positions[pos]?.hands.length ?? 0;
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
        {/* Matrix (read-only) */}
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
              size={matrixSize}
              showLabels={true}
              disabled={true}
            />
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="space-y-4">
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
