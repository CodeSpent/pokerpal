"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRangeSets, type RangeSetData } from "@/hooks/useRangeSets";
import { POSITION_SHORT } from "@/types/poker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Grid3X3, Trash2, Copy, Shield, Share2, Loader2 } from "lucide-react";

export default function RangesPage() {
  const { rangeSets, isLoading, createRangeSet, deleteRangeSet, duplicateRangeSet, migrateFromLocalStorage } = useRangeSets();
  const router = useRouter();

  // One-time localStorage migration
  useEffect(() => {
    if (!isLoading) {
      migrateFromLocalStorage();
    }
  }, [isLoading, migrateFromLocalStorage]);

  const handleCreateNew = async () => {
    const id = await createRangeSet("New Range Set");
    if (id) router.push(`/ranges/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Range Sets</h1>
          <p className="text-foreground-muted">
            Build and manage per-position opening ranges.
          </p>
        </div>
        <Button variant="primary" className="gap-2" onClick={handleCreateNew}>
          <Plus className="w-4 h-4" />
          New Range Set
        </Button>
      </div>

      {/* Range Sets Grid */}
      {rangeSets.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <Grid3X3 className="w-12 h-12 mx-auto text-foreground-muted" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No range sets yet</h2>
              <p className="text-foreground-muted">
                Create your first range set to get started.
              </p>
            </div>
            <Button variant="primary" className="gap-2" onClick={handleCreateNew}>
              <Plus className="w-4 h-4" />
              Create Range Set
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rangeSets.map((rangeSet) => (
            <RangeSetCard
              key={rangeSet.id}
              rangeSet={rangeSet}
              onDelete={() => deleteRangeSet(rangeSet.id)}
              onDuplicate={(e) => {
                e.preventDefault();
                e.stopPropagation();
                duplicateRangeSet(rangeSet.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RangeSetCard({
  rangeSet,
  onDelete,
  onDuplicate,
}: {
  rangeSet: RangeSetData;
  onDelete: () => void;
  onDuplicate: (e: React.MouseEvent) => void;
}) {
  const positionEntries = Object.entries(rangeSet.positions);
  const positionCount = positionEntries.length;
  const totalHands = positionEntries.reduce((sum, [, data]) => sum + (data?.hands.length ?? 0), 0);
  const avgPercentage = positionCount > 0
    ? ((totalHands / positionCount / 169) * 100).toFixed(1)
    : "0.0";

  return (
    <Link href={`/ranges/${rangeSet.id}`}>
      <Card className="group hover:border-zinc-600 transition-colors relative h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg truncate">{rangeSet.name}</CardTitle>
                {rangeSet.isDefault && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-600/20 text-emerald-400 shrink-0">
                    <Shield className="w-3 h-3" />
                    Default
                  </span>
                )}
                {rangeSet.isShared && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 shrink-0">
                    <Share2 className="w-3 h-3" />
                    Shared
                  </span>
                )}
              </div>
              {rangeSet.description && (
                <CardDescription>{rangeSet.description}</CardDescription>
              )}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onDuplicate}
              >
                <Copy className="w-4 h-4" />
              </Button>
              {!rangeSet.isDefault && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-400"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Positions</span>
              <span className="font-medium">
                {positionEntries.map(([pos]) => POSITION_SHORT[pos as keyof typeof POSITION_SHORT]).join(", ") || "None"}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{ width: `${avgPercentage}%` }}
                />
              </div>
              <p className="text-xs text-foreground-muted text-right">Avg {avgPercentage}% of hands</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
