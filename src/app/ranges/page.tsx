"use client";

import { useState } from "react";
import Link from "next/link";
import { useRangeStore, RangeData } from "@/stores/range-store";
import { POSITIONS_6MAX, Position, POSITION_SHORT } from "@/types/poker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Grid3X3, Trash2, Copy, Edit } from "lucide-react";

export default function RangesPage() {
  const { ranges, addRange, deleteRange, duplicateRange } = useRangeStore();
  const [filter, setFilter] = useState<Position | "all">("all");

  const handleCreateNew = () => {
    const id = addRange({
      name: "New Range",
      hands: [],
    });
    window.location.href = `/ranges/${id}`;
  };

  const filteredRanges = filter === "all"
    ? ranges
    : ranges.filter((r) => r.position === filter);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Range Finder</h1>
          <p className="text-foreground-muted">
            Build, customize, and save hand ranges for any situation.
          </p>
        </div>
        <Button variant="primary" className="gap-2" onClick={handleCreateNew}>
          <Plus className="w-4 h-4" />
          New Range
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        {POSITIONS_6MAX.map((pos) => (
          <Button
            key={pos}
            variant={filter === pos ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(pos)}
          >
            {POSITION_SHORT[pos]}
          </Button>
        ))}
      </div>

      {/* Ranges Grid */}
      {filteredRanges.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <Grid3X3 className="w-12 h-12 mx-auto text-foreground-muted" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No ranges yet</h2>
              <p className="text-foreground-muted">
                Create your first custom range to get started.
              </p>
            </div>
            <Button variant="primary" className="gap-2" onClick={handleCreateNew}>
              <Plus className="w-4 h-4" />
              Create Range
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRanges.map((range) => (
            <RangeCard
              key={range.id}
              range={range}
              onDelete={() => deleteRange(range.id)}
              onDuplicate={() => duplicateRange(range.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RangeCard({
  range,
  onDelete,
  onDuplicate,
}: {
  range: RangeData;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const handCount = range.hands.length;
  const percentage = ((handCount / 169) * 100).toFixed(1);

  return (
    <Card className="group hover:border-zinc-600 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{range.name}</CardTitle>
            {range.position && (
              <CardDescription>
                {POSITION_SHORT[range.position]}
                {range.situation && ` - ${range.situation}`}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link href={`/ranges/${range.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-400"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">Hands</span>
            <span className="font-medium">{handCount}</span>
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-xs text-foreground-muted text-right">{percentage}% of hands</p>
          </div>
        </div>
        <Link href={`/ranges/${range.id}`} className="block mt-4">
          <Button variant="outline" size="sm" className="w-full">
            Edit Range
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
