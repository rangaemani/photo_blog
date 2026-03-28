import type { WindowContentType } from '../../types';
import { icons } from '../../lib/win98Icons';

interface Props {
  title: string;
  windowType: WindowContentType;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const TYPE_ICONS: Record<WindowContentType, string> = {
  grid: icons.sm.grid,
  detail: icons.sm.detail,
  static: icons.sm.static,
  login: icons.sm.login,
  upload: icons.sm.upload,
  trash: icons.sm.trash,
  reports: icons.sm.reports,
};

export default function WindowTitleBar({ title, windowType, onClose, onMinimize, onMaximize, onMouseDown }: Props) {
  return (
    <div style={styles.bar} onMouseDown={onMouseDown} onDoubleClick={onMaximize}>
      <div style={styles.left}>
        <img src={TYPE_ICONS[windowType]} alt="" style={styles.icon} draggable={false} />
      </div>
      <div style={styles.title}>{title}</div>
      <div style={styles.controls}>
        <button className="win-btn" onClick={(e) => { e.stopPropagation(); onMinimize(); }} title="Minimize">&mdash;</button>
        <button className="win-btn" onClick={(e) => { e.stopPropagation(); onMaximize(); }} title="Maximize">&#9634;</button>
        <button className="win-btn win-btn-close" onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close">&#10005;</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 28,
    background: 'linear-gradient(180deg, var(--pale-slate) 0%, var(--pale-slate-2) 100%)',
    borderBottom: '1px solid var(--groove-dark)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 4px',
    cursor: 'default',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 16,
    height: 16,
    imageRendering: 'pixelated' as const,
  },
  title: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 13,
    fontFamily: "'PixeAn', sans-serif",
    fontWeight: 'normal' as const,
    color: 'var(--carbon-black)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    letterSpacing: 1,
  },
  controls: {
    display: 'flex',
    gap: 3,
  },
};
