interface Props {
  available: number | null;
  total: number | null;
  compact?: boolean;
}

function colorForPct(pct: number) {
  if (pct > 30) return 'bg-green-500';
  if (pct > 10) return 'bg-amber-500';
  return 'bg-red-500';
}

export function AvailabilityBar({ available, total, compact }: Props) {
  if (available == null || !total) {
    return <span className="text-[10px] text-gray-400 font-bold">N/A</span>;
  }

  const pct = Math.min((available / total) * 100, 100);

  return (
    <div className={`flex items-center gap-2 ${compact ? 'w-full' : ''}`}>
      <div className={`flex-1 bg-gray-200 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2'}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${colorForPct(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-black whitespace-nowrap ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {available}/{total}
      </span>
    </div>
  );
}
