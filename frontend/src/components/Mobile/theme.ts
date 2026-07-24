export const cockpit = (dm: boolean) => ({
  surface: dm ? 'bg-[#0d1013]' : 'bg-white',
  panel: dm ? 'bg-[#161b21]' : 'bg-[#f4f6f8]',
  raised: dm ? 'bg-[#1e242c]' : 'bg-white',
  text: dm ? 'text-white' : 'text-[#0d1013]',
  muted: dm ? 'text-[#8b95a3]' : 'text-[#6b7280]',
  line: dm ? 'border-white/8' : 'border-black/8',
  divide: dm ? 'divide-white/8' : 'divide-black/8',
});

export const availabilityTone = (pct: number, total: number) => {
  if (total <= 0) return { text: 'text-[#8b95a3]', bg: 'bg-white/5' };
  if (pct > 30) return { text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/12' };
  if (pct > 10) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/12' };
  return { text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/12' };
};
