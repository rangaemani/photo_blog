import { useState, useEffect, useCallback, useRef } from 'react';
import type { WidgetType, WidgetState, Position } from '../types';

const STORAGE_KEY = 'widget_state';

const WIDGET_SIZES: Record<WidgetType, { width: number; height: number }> = {
  clock:       { width: 140, height: 160 },
  notes:       { width: 200, height: 220 },
  weather:     { width: 180, height: 140 },
  systemInfo:  { width: 220, height: 180 },
  musicPlayer: { width: 240, height: 120 },
};

/**
 * Compute a default bottom-right position for a widget.
 * Stacks widgets upward based on `index` so multiple open widgets don't overlap.
 */
function defaultPosition(type: WidgetType, index: number): Position {
  const w = WIDGET_SIZES[type].width;
  const h = WIDGET_SIZES[type].height;
  const x = window.innerWidth - w - 20;
  const y = window.innerHeight - 26 - h - 20 - index * 40;
  return { x: Math.max(0, x), y: Math.max(28, y) };
}

function loadWidgets(): WidgetState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WidgetState[];
  } catch { /* ignore */ }
  return [];
}

/**
 * Manages desktop widget lifecycle — open/close, position persistence, and move.
 *
 * Widget state is persisted to localStorage. On first open, each widget is placed
 * in the bottom-right corner; subsequent opens restore the last known position.
 */
export function useWidgetState() {
  const [widgets, setWidgets] = useState<WidgetState[]>(loadWidgets);
  const initialized = useRef(false);

  useEffect(() => { initialized.current = true; }, []);

  // Debounced persist
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    }, 300);
    return () => clearTimeout(timer);
  }, [widgets]);

  const toggleWidget = useCallback((type: WidgetType) => {
    setWidgets(prev => {
      const existing = prev.find(w => w.type === type);
      if (existing) {
        return existing.isOpen
          ? prev.map(w => w.type === type ? { ...w, isOpen: false } : w)
          : prev.map(w => w.type === type ? { ...w, isOpen: true } : w);
      }
      const openCount = prev.filter(w => w.isOpen).length;
      return [...prev, {
        id: `widget-${type}`,
        type,
        position: defaultPosition(type, openCount),
        isOpen: true,
      }];
    });
  }, []);

  const moveWidget = useCallback((id: string, x: number, y: number) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, position: { x, y } } : w));
  }, []);

  const closeWidget = useCallback((id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, isOpen: false } : w));
  }, []);

  const openWidgetTypes = widgets.filter(w => w.isOpen).map(w => w.type);

  return { widgets, toggleWidget, moveWidget, closeWidget, openWidgetTypes, WIDGET_SIZES };
}
