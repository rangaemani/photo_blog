import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDraggable } from '../../hooks/useDraggable';

interface Props {
  title: string;
  width: number;
  height: number;
  x: number;
  y: number;
  onMove: (x: number, y: number) => void;
  onClose: () => void;
  children: React.ReactNode;
}

export default function WidgetShell({ title, width, height, x, y, onMove, onClose, children }: Props) {
  const { onMouseDown } = useDraggable({ onDrag: onMove });

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    onMouseDown(e, x, y);
  }, [onMouseDown, x, y]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, left: x, top: y }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        position: 'absolute',
        width,
        height,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--platinum)',
        borderTop: '2px solid var(--bevel-highlight)',
        borderLeft: '2px solid var(--bevel-highlight)',
        borderBottom: '2px solid var(--bevel-dark)',
        borderRight: '2px solid var(--bevel-dark)',
        overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div
        onMouseDown={handleTitleMouseDown}
        style={{
          height: 20,
          background: 'linear-gradient(180deg, var(--pale-slate) 0%, var(--pale-slate-2) 100%)',
          borderBottom: '1px solid var(--groove-dark)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 3px',
          cursor: 'default',
          flexShrink: 0,
        }}
      >
        <span style={{
          flex: 1,
          fontSize: 10,
          fontFamily: "'CyberH', 'PixeAn', sans-serif",
          color: 'var(--carbon-black)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: 0.8,
        }}>
          {title}
        </span>
        <button
          className="win-btn win-btn-close"
          onClick={onClose}
          style={{ width: 14, height: 14, fontSize: 8 }}
          title="Close"
        >
          &#10005;
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </motion.div>
  );
}
