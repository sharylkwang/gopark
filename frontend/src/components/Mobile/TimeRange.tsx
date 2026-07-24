import { Clock, ChevronRight } from 'lucide-react';
import { formatTime12, parseClockTime } from '../../utils/format';
import { cockpit } from './theme';

interface Props {
  c: ReturnType<typeof cockpit>;
  darkMode: boolean;
  arrivalTime: Date;
  parkUntil: string;
  setParkUntil: (v: string) => void;
}

export function TimeRange({ c, darkMode, arrivalTime, parkUntil, setParkUntil }: Props) {
  return (
    <div className="flex items-stretch gap-2">
      <div className={`flex-1 rounded-xl px-3 py-2 ${darkMode ? 'bg-white/5' : 'bg-black/4'}`}>
        <span className={`text-[9px] font-black uppercase tracking-widest ${c.muted}`}>Arrive</span>
        <p className={`text-[15px] font-black mt-0.5 ${c.text}`}>{formatTime12(arrivalTime)}</p>
      </div>

      <div className="shrink-0 grid place-items-center">
        <ChevronRight size={16} className={c.muted} />
      </div>

      <label className={`flex-1 rounded-xl px-3 py-2 cursor-pointer relative border ${c.raised} border-yellow-400/50`}>
        <span className={`text-[9px] font-black uppercase tracking-widest ${c.muted}`}>Leave</span>
        <p className={`flex items-center gap-1.5 text-[15px] font-black mt-0.5 ${c.text}`}>
          {formatTime12(parseClockTime(parkUntil))}
          <Clock size={13} className="text-yellow-500" />
        </p>
        <input type="time" value={parkUntil} onChange={e => setParkUntil(e.target.value)}
          aria-label="Leave time"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </label>
    </div>
  );
}
