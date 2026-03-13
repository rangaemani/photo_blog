import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface MenuItem {
  label: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  external?: boolean;
  shortcut?: string;
}

interface Props {
  items: MenuItem[];
  onClose: () => void;
}

export default function MenuDropdown({ items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);

  const actionableItems = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !item.divider && !item.disabled);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(prev => {
        const idx = actionableItems.findIndex(({ i }) => i > (prev === -1 ? -1 : prev));
        return idx !== -1 ? actionableItems[idx].i : (actionableItems[0]?.i ?? -1);
      });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(prev => {
        const reversed = [...actionableItems].reverse();
        const idx = reversed.findIndex(({ i }) => i < (prev === -1 ? Infinity : prev));
        return idx !== -1 ? reversed[idx].i : (reversed[0]?.i ?? -1);
      });
    }
    if (e.key === 'Enter' && focusIdx >= 0) {
      const item = items[focusIdx];
      if (item && !item.disabled && item.action) {
        item.action();
        onClose();
      }
    }
  }, [onClose, focusIdx, items, actionableItems]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      style={{ ...styles.dropdown, transformOrigin: 'top left' }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} style={styles.divider} />
        ) : (
          <div
            key={i}
            className="context-menu-item"
            data-disabled={item.disabled || undefined}
            data-focused={focusIdx === i || undefined}
            onMouseEnter={() => setFocusIdx(i)}
            onMouseLeave={() => setFocusIdx(-1)}
            onClick={() => {
              if (item.disabled) return;
              item.action?.();
              onClose();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span style={{ marginLeft: 'auto', paddingLeft: 16, fontSize: 11, color: '#999' }}>{item.shortcut}</span>}
            {item.external && <span style={{ marginLeft: 4, fontSize: 10 }}>&nearr;</span>}
          </div>
        )
      )}
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 6,
    boxShadow: 'var(--dropdown-shadow)',
    padding: '4px 0',
    minWidth: 180,
    zIndex: 10000,
  },
  divider: {
    height: 1,
    background: '#e5e5e5',
    margin: '4px 8px',
  },
};
