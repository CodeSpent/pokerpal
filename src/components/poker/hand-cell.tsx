"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { isPair, isSuited } from "@/types/poker";

interface HandCellProps {
  hand: string;
  isSelected: boolean;
  isHovered: boolean;
  onMouseDown?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
  colorMode?: "binary" | "action";
  action?: "fold" | "call" | "raise";
  size?: "xs" | "sm" | "md" | "lg";
}

const actionColors = {
  fold: "bg-action-fold/80 hover:bg-action-fold",
  call: "bg-action-call/80 hover:bg-action-call",
  raise: "bg-action-raise/80 hover:bg-action-raise",
};

const sizeClasses = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

export const HandCell = React.memo(function HandCell({
  hand,
  isSelected,
  isHovered,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  disabled = false,
  colorMode = "binary",
  action,
  size = "md",
}: HandCellProps) {
  const pair = isPair(hand);
  const suited = isSuited(hand);

  // Determine cell color
  let bgColor = "bg-zinc-800/50";
  if (isSelected) {
    if (colorMode === "action" && action) {
      bgColor = actionColors[action];
    } else {
      bgColor = "bg-emerald-600/80 hover:bg-emerald-600";
    }
  }

  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      className={cn(
        sizeClasses[size],
        "flex items-center justify-center rounded transition-colors font-medium",
        bgColor,
        isHovered && !isSelected && "bg-zinc-700",
        pair && "font-bold",
        suited && !isSelected && "text-blue-400",
        !suited && !pair && !isSelected && "text-zinc-400",
        isSelected && "text-white",
        disabled && "cursor-default",
        !disabled && "cursor-pointer hover:ring-1 hover:ring-zinc-600"
      )}
    >
      {hand}
    </button>
  );
});
