import { cn } from "@/lib/cn";

const suitSymbols: Record<string, string> = {
  h: "\u2665",
  d: "\u2666",
  c: "\u2663",
  s: "\u2660",
};

const suitColors: Record<string, string> = {
  h: "text-red-500",
  d: "text-blue-500",
  c: "text-emerald-500",
  s: "text-zinc-300",
};

export function CardDisplay({ card }: { card: string }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);

  return (
    <div className="w-10 h-14 rounded bg-white flex flex-col items-center justify-center text-zinc-900 font-bold shadow-md">
      <span className="text-sm">{rank}</span>
      <span className={cn("text-lg -mt-1", suitColors[suit])}>
        {suitSymbols[suit]}
      </span>
    </div>
  );
}
