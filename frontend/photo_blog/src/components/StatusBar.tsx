import { motion, AnimatePresence } from 'framer-motion';
import type { WindowState } from '../types';

interface Props {
  statusText: string;
  windows: WindowState[];
  onWindowClick: (id: string) => void;
  onMinimizeWindow: (id: string) => void;
}

export default function StatusBar({ statusText, windows, onWindowClick, onMinimizeWindow }: Props) {
  const topZ = windows.length > 0
    ? Math.max(...windows.filter(w => !w.isMinimized).map(w => w.zIndex), 0)
    : 0;

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={styles.text}>{statusText}</span>
      </div>
      <div style={styles.right}>
        <AnimatePresence initial={false}>
          {windows.map(w => {
            const isFocused = !w.isMinimized && w.zIndex === topZ;
            return (
              <motion.button
                key={w.id}
                layout
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ opacity: w.isMinimized ? 0.5 : 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                style={{
                  ...styles.pill,
                  ...(isFocused ? styles.pillActive : undefined),
                }}
                onClick={() => {
                  if (w.isMinimized) {
                    onWindowClick(w.id);
                  } else if (isFocused) {
                    onMinimizeWindow(w.id);
                  } else {
                    onWindowClick(w.id);
                  }
                }}
                title={w.title}
              >
                {w.title.length > 18 ? w.title.slice(0, 18) + '\u2026' : w.title}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    background: 'var(--status-bg)',
    borderTop: '1px solid var(--status-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px',
    zIndex: 9999,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  text: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'ui-monospace, monospace',
  },
  right: {
    display: 'flex',
    gap: 4,
    overflow: 'hidden',
  },
  pill: {
    border: '1px solid var(--status-border)',
    background: 'rgba(255,255,255,0.6)',
    borderRadius: 3,
    padding: '1px 8px',
    fontSize: 11,
    cursor: 'pointer',
    color: '#333',
    whiteSpace: 'nowrap' as const,
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pillActive: {
    background: 'rgba(255,255,255,0.9)',
    borderColor: '#999',
    fontWeight: 600,
  },
};
