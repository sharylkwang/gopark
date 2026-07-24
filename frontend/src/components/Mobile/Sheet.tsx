import { cockpit } from './theme';
import type { useBottomSheet } from '../../hooks/useBottomSheet';

interface Props {
  sheet: ReturnType<typeof useBottomSheet>;
  darkMode: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}

export function MobileSheet({ sheet, darkMode, summary, children }: Props) {
  const c = cockpit(darkMode);
  const visible = sheet.height - sheet.translateY;
  const closed = visible < 8;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] overflow-hidden ${closed ? 'pointer-events-none' : 'shadow-2xl border-t'} ${c.surface} ${c.line} ${darkMode ? 'shadow-black/60' : 'shadow-black/20'}`}
      style={{
        height: visible,
        transition: sheet.dragging ? 'none' : 'height 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
      <div {...sheet.handleProps}
        onClick={() => sheet.setSnap(sheet.snap === 'full' ? 'peek' : 'full')}
        className="shrink-0 touch-none cursor-grab active:cursor-grabbing pt-2.5 pb-1">
        <div className={`mx-auto h-1 w-9 rounded-full ${darkMode ? 'bg-white/25' : 'bg-black/20'}`} />
        {summary}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain sidebar-scroll pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </div>
  );
}
