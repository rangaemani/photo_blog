import type { WindowContentType } from '../../types';

interface Props {
  title: string;
  windowType: WindowContentType;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const TYPE_ICONS: Record<WindowContentType, string> = {
  grid: '\uD83D\uDCC1',
  detail: '\uD83D\uDDBC\uFE0F',
  static: '\uD83D\uDCC4',
  login: '\uD83D\uDD10',
  upload: '\uD83D\uDCE4',
  trash: '\uD83D\uDDD1\uFE0F',
};

export default function WindowTitleBar({ title, windowType, onClose, onMinimize, onMaximize, onMouseDown }: Props) {
  return (
    <div style={styles.bar} onMouseDown={onMouseDown} onDoubleClick={onMaximize}>
      <div style={styles.left}>
        <span style={styles.icon}>{TYPE_ICONS[windowType]}</span>
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
    height: 32,
    background: 'var(--window-titlebar-bg)',
    borderBottom: '1px solid var(--window-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    cursor: 'default',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 13,
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  controls: {
    display: 'flex',
    gap: 2,
  },
};
