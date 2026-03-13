import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { ContextMenuState } from '../types';

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
}

export default function ContextMenu({ menu, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const [origin, setOrigin] = useState('top left');
  const [focusIdx, setFocusIdx] = useState(-1);

  const actionableItems = menu.items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !item.divider && !item.disabled);

  // Reposition if the menu overflows the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Wait one frame for the element to have dimensions
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      let x = menu.x;
      let y = menu.y;
      let ox = 'left';
      let oy = 'top';

      if (x + rect.width > window.innerWidth) {
        x = menu.x - rect.width;
        ox = 'right';
      }
      if (y + rect.height > window.innerHeight) {
        y = menu.y - rect.height;
        oy = 'bottom';
      }
      setPos({ x: Math.max(0, x), y: Math.max(0, y) });
      setOrigin(`${oy} ${ox}`);
    });
  }, [menu.x, menu.y]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Keyboard navigation
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
      const item = menu.items[focusIdx];
      if (item && !item.disabled && item.action) {
        item.action();
        onClose();
      }
    }
  }, [onClose, focusIdx, menu.items, actionableItems]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 8,
        boxShadow: 'var(--dropdown-shadow)',
        padding: '4px 0',
        minWidth: 160,
        zIndex: 20000,
        transformOrigin: origin,
      }}
    >
      {menu.items.map((item, i) =>
        item.divider ? (
          <div key={i} style={{ height: 1, background: '#e5e5e5', margin: '4px 8px' }} />
        ) : (
          <div
            key={i}
            className="context-menu-item"
            data-disabled={item.disabled || undefined}
            data-focused={focusIdx === i || undefined}
            style={{ color: item.disabled ? undefined : '#333' }}
            onClick={() => {
              if (item.disabled) return;
              item.action?.();
              onClose();
            }}
            onMouseEnter={() => setFocusIdx(i)}
            onMouseLeave={() => setFocusIdx(-1)}
          >
            {item.label}
            {item.shortcut && <span style={{ marginLeft: 'auto', paddingLeft: 16, fontSize: 11, color: '#999' }}>{item.shortcut}</span>}
          </div>
        )
      )}
    </motion.div>
  );
}
