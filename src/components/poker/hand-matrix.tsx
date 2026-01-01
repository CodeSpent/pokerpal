"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { RANKS, getHandAtPosition } from "@/types/poker";
import { HandCell } from "./hand-cell";
import { cn } from "@/lib/cn";

interface HandMatrixProps {
  selectedHands: Set<string>;
  onHandToggle?: (hand: string) => void;
  onHandsChange?: (hands: Set<string>) => void;
  colorMode?: "binary" | "action";
  handActions?: Record<string, "fold" | "call" | "raise">;
  disabled?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
}

export function HandMatrix({
  selectedHands,
  onHandToggle,
  onHandsChange,
  colorMode = "binary",
  handActions,
  disabled = false,
  size = "md",
  showLabels = true,
  className,
}: HandMatrixProps) {
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select");

  const handleMouseDown = useCallback(
    (hand: string) => {
      if (disabled) return;
      setIsDragging(true);
      const isCurrentlySelected = selectedHands.has(hand);
      setDragMode(isCurrentlySelected ? "deselect" : "select");

      if (onHandToggle) {
        onHandToggle(hand);
      } else if (onHandsChange) {
        const newHands = new Set(selectedHands);
        if (isCurrentlySelected) {
          newHands.delete(hand);
        } else {
          newHands.add(hand);
        }
        onHandsChange(newHands);
      }
    },
    [disabled, selectedHands, onHandToggle, onHandsChange]
  );

  const handleMouseEnter = useCallback(
    (hand: string) => {
      setHoveredHand(hand);

      if (isDragging && !disabled) {
        const isSelected = selectedHands.has(hand);
        const shouldToggle =
          (dragMode === "select" && !isSelected) ||
          (dragMode === "deselect" && isSelected);

        if (shouldToggle) {
          if (onHandToggle) {
            onHandToggle(hand);
          } else if (onHandsChange) {
            const newHands = new Set(selectedHands);
            if (dragMode === "select") {
              newHands.add(hand);
            } else {
              newHands.delete(hand);
            }
            onHandsChange(newHands);
          }
        }
      }
    },
    [isDragging, disabled, selectedHands, dragMode, onHandToggle, onHandsChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredHand(null);
  }, []);

  // Add global mouseup listener for drag end
  React.useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const gapClass = size === "xs" ? "gap-px" : size === "sm" ? "gap-0.5" : size === "md" ? "gap-1" : "gap-1.5";

  return (
    <div
      className={cn("select-none", className)}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseLeave();
        setIsDragging(false);
      }}
    >
      {/* Column labels */}
      {showLabels && (
        <div className={cn("flex mb-1", gapClass)}>
          <div className={cn(size === "xs" ? "w-5" : size === "sm" ? "w-6" : size === "md" ? "w-8" : "w-10")} />
          {RANKS.map((rank) => (
            <div
              key={rank}
              className={cn(
                "flex items-center justify-center text-xs text-foreground-muted font-medium",
                size === "xs" ? "w-5" : size === "sm" ? "w-6" : size === "md" ? "w-8" : "w-10"
              )}
            >
              {rank}
            </div>
          ))}
        </div>
      )}

      {/* Matrix rows */}
      <div className={cn("flex flex-col", gapClass)}>
        {RANKS.map((rowRank, rowIndex) => (
          <div key={rowRank} className={cn("flex", gapClass)}>
            {/* Row label */}
            {showLabels && (
              <div
                className={cn(
                  "flex items-center justify-center text-xs text-foreground-muted font-medium",
                  size === "xs" ? "w-5" : size === "sm" ? "w-6" : size === "md" ? "w-8" : "w-10"
                )}
              >
                {rowRank}
              </div>
            )}

            {/* Cells */}
            {RANKS.map((colRank, colIndex) => {
              const hand = getHandAtPosition(rowIndex, colIndex);
              return (
                <HandCell
                  key={hand}
                  hand={hand}
                  isSelected={selectedHands.has(hand)}
                  isHovered={hoveredHand === hand}
                  onClick={() => !isDragging && handleMouseDown(hand)}
                  onMouseEnter={() => handleMouseEnter(hand)}
                  onMouseLeave={handleMouseLeave}
                  disabled={disabled}
                  colorMode={colorMode}
                  action={handActions?.[hand]}
                  size={size}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-foreground-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-zinc-800 font-bold" />
          <span>Pairs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-zinc-800 text-blue-400" />
          <span>Suited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-zinc-800" />
          <span>Offsuit</span>
        </div>
      </div>
    </div>
  );
}
