interface Props {
  available: number | null;
  total: number | null;
  compact?: boolean;
  darkMode?: boolean;
}

function colorForPct(pct: number) {
  if (pct > 30) return 'bg-green-500';
  if (pct > 10) return 'bg-amber-500';
  return 'bg-red-500';
}

export function AvailabilityBar({ available, total, compact, darkMode }: Props) {
  if (available == null) {
    return <span className={`text-[10px] font-bold italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No Live Availability</span>;
  }

  if (!total) {
    return (
      <span className={`font-black whitespace-nowrap ${compact ? 'text-[10px]' : 'text-xs'} ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {available} lots
      </span>
    );
  }

  const pct = Math.min((available / total) * 100, 100);

  return (
    <div className={`flex items-center gap-2 ${compact ? 'w-full' : ''}`}>
      <div className={`flex-1 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2'} ${darkMode ? 'bg-neutral-700' : 'bg-gray-200'}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${colorForPct(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-black whitespace-nowrap ${compact ? 'text-[10px]' : 'text-xs'} ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {Math.min(available, total)}/{total}
      </span>
    </div>
  );
}
