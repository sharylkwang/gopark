interface Props {
  percentage: number;
  size?: number;
  stroke?: number;
  label?: string;
}

function colorForPct(pct: number) {
  if (pct > 30) return '#22c55e';
  if (pct > 10) return '#f59e0b';
  return '#ef4444';
}

export function CircularProgress({ percentage, size = 80, stroke = 8, label }: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percentage, 100) / 100);
  const color = colorForPct(percentage);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-black" style={{ color }}>{Math.round(percentage)}%</span>
      </div>
      {label && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>}
    </div>
  );
}
