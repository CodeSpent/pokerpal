import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { DecisionOption } from "@/types/scenarios";

export function OptionButton({
  option,
  isSelected,
  isCorrect,
  showResult,
  onClick,
  disabled,
}: {
  option: DecisionOption;
  isSelected: boolean;
  isCorrect: boolean;
  showResult: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  let bgColor = "bg-background-tertiary hover:bg-zinc-700";
  let borderColor = "border-zinc-700";

  if (showResult) {
    if (isCorrect) {
      bgColor = "bg-emerald-500/20";
      borderColor = "border-emerald-500";
    } else if (isSelected && !isCorrect) {
      bgColor = "bg-red-500/20";
      borderColor = "border-red-500";
    }
  } else if (isSelected) {
    bgColor = "bg-zinc-700";
    borderColor = "border-zinc-500";
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full p-4 rounded-lg border text-left transition-colors flex items-center justify-between",
        bgColor,
        borderColor,
        disabled && "cursor-default"
      )}
    >
      <span className="font-medium">{option.label}</span>
      {showResult && isCorrect && <Check className="w-5 h-5 text-emerald-500" />}
      {showResult && isSelected && !isCorrect && (
        <X className="w-5 h-5 text-red-500" />
      )}
    </button>
  );
}
