export default function Sparkline({
  points,
  width = 280,
  height = 48,
  stroke = "#dc2626",
}: {
  points: { ts: number; value: number }[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (points.length < 2) {
    return <p className="text-xs text-zinc-500">Not enough history yet — scores accrue as you re-run research.</p>;
  }
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? 0 : (i / (points.length - 1)) * width;
    const y = height - ((p.value - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="max-w-[280px]">
      <polyline points={coords.join(" ")} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => {
        const [x, y] = c.split(",");
        return <circle key={i} cx={x} cy={y} r="2" fill={stroke} />;
      })}
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={stroke} opacity="0.08" />
    </svg>
  );
}
