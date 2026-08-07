export function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-lime-500";
  if (score >= 40) return "bg-yellow-400";
  if (score >= 20) return "bg-orange-500";
  return "bg-red-500";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  if (score >= 20) return "Low";
  return "Very Low";
}

export function competitionColor(label: string): string {
  switch (label) {
    case "High":
      return "bg-red-500";
    case "Medium":
      return "bg-yellow-400 text-black";
    default:
      return "bg-green-500";
  }
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : size === "lg" ? "px-3 py-1.5 text-base" : "px-2 py-1 text-sm";
  return (
    <span
      title={scoreLabel(score)}
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold text-white ${padding}`}
    >
      <span className={`size-2 rounded-full ${scoreColor(score)}`} />
      {score}
    </span>
  );
}

export function CompetitionBadge({ label }: { label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white ${competitionColor(label)}`}>
      {label}
    </span>
  );
}
