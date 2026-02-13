"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { RANKS, getHandAtPosition } from "@/types/poker";
import { HandCell } from "./hand-cell";
import { cn } from "@/lib/cn";

interface HandMatrixProps {
  selectedHands: Set<string>;
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
  onHandsChange,
  colorMode = "binary",
  handActions,
  disabled = false,
  size = "md",
  showLabels = true,
  className,
}: HandMatrixProps) {
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const isMouseDownRef = useRef(false);
  const didDragRef = useRef(false);
  const mouseDownHandRef = useRef<string | null>(null);
  const selectedHandsRef = useRef(selectedHands);
  selectedHandsRef.current = selectedHands;

  const handleCellMouseDown = useCallback(
    (hand: string) => {
      if (disabled) return;
      isMouseDownRef.current = true;
      didDragRef.current = false;
      mouseDownHandRef.current = hand;
    },
    [disabled]
  );

  const handleCellMouseEnter = useCallback(
    (hand: string) => {
      setHoveredHand(hand);

      if (isMouseDownRef.current && !disabled && onHandsChange) {
        didDragRef.current = true;
        const newHands = new Set(selectedHandsRef.current);

        // Select the start cell if it hasn't been selected yet by drag
        const startHand = mouseDownHandRef.current;
        if (startHand && !newHands.has(startHand)) {
          newHands.add(startHand);
        }

        // Select entered cell
        if (!newHands.has(hand)) {
          newHands.add(hand);
        }

        onHandsChange(newHands);
      }
    },
    [disabled, onHandsChange]
  );

  // Global mouseup: if no drag occurred, toggle the cell (single click)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current && !didDragRef.current && mouseDownHandRef.current && onHandsChange) {
        const hand = mouseDownHandRef.current;
        const newHands = new Set(selectedHandsRef.current);
        if (newHands.has(hand)) {
          newHands.delete(hand);
        } else {
          newHands.add(hand);
        }
        onHandsChange(newHands);
      }
      isMouseDownRef.current = false;
      didDragRef.current = false;
      mouseDownHandRef.current = null;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [onHandsChange]);

  const handleMouseLeave = useCallback(() => {
    setHoveredHand(null);
  }, []);

  const gapClass = size === "xs" ? "gap-px" : size === "sm" ? "gap-0.5" : size === "md" ? "gap-1" : "gap-1.5";

  return (
    <div
      className={cn("select-none", className)}
      onMouseLeave={handleMouseLeave}
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
                  onMouseDown={() => handleCellMouseDown(hand)}
                  onMouseEnter={() => handleCellMouseEnter(hand)}
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
