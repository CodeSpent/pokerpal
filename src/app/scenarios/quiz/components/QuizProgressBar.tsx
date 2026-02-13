export function QuizProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const percent = Math.round((current / total) * 100);

  return (
    <div className="space-y-1">
      <div className="text-sm text-foreground-muted">
        Question {current} of {total}
      </div>
      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
