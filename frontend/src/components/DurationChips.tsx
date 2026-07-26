import { Clock } from 'lucide-react';
import { formatClockTime } from '../utils/format';

export function DurationChips({ arrivalTime, parkUntil, setParkUntil, dm, small }: {
  arrivalTime: Date; parkUntil: string; setParkUntil: (v: string) => void; dm: boolean; small?: boolean;
}) {
  const round = small ? 'rounded-lg' : 'rounded-xl', txt = small ? 'text-[10px]' : 'text-[11px]';
  const idle = dm
    ? `${small ? 'bg-neutral-700/60' : 'bg-neutral-800/60'} border-neutral-600/50 text-gray-400`
    : 'bg-white/50 border-gray-200/50 text-gray-500';

  return (
    <div className="flex gap-1.5">
      {[0.5, 1, 2, 3, 4, 6].map(h => {
        const val = formatClockTime(new Date(arrivalTime.getTime() + h * 3600000));
        const active = parkUntil === val;
        return (
          <button key={h} type="button" onClick={() => setParkUntil(val)}
            className={`flex-1 py-1.5 ${round} border ${txt} font-black transition ${
              active
                ? dm ? 'bg-blue-600/80 border-blue-500 text-white' : 'bg-gray-900 border-gray-900 text-white'
                : `${idle} hover:border-gray-400`
            }`}>
            {h < 1 ? '30m' : `${h}h`}
          </button>
        );
      })}
      <div className={`flex-1 relative ${round} border ${txt} font-black ${idle}`}>
        <span className="flex items-center justify-center h-full pointer-events-none">
          <Clock size={small ? 10 : 11} className="mr-0.5" />Set
        </span>
        <input type="time" value={parkUntil} onChange={e => setParkUntil(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}
