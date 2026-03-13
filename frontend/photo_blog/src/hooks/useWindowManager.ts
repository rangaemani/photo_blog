import { useState, useCallback } from 'react';
import type { WindowState, WindowContentType, GridPayload, DetailPayload, StaticPayload, TrashPayload, UploadPayload } from '../types';
import { getStaggeredPosition } from '../utils/position';

const MENU_BAR_HEIGHT = 28;
const STATUS_BAR_HEIGHT = 24;

let idCounter = 0;
function nextId(): string {
  return `win-${++idCounter}`;
}

const DEFAULT_SIZES: Record<WindowContentType, { width: number; height: number }> = {
  grid: { width: 800, height: 560 },
  detail: { width: 640, height: 480 },
  static: { width: 640, height: 480 },
  login: { width: 360, height: 320 },
  upload: { width: 600, height: 500 },
  trash: { width: 800, height: 560 },
};

const MIN_WIDTH = 320;
const MIN_HEIGHT = 280;

interface WindowPayload {
  gridPayload?: GridPayload;
  detailPayload?: DetailPayload;
  staticPayload?: StaticPayload;
  trashPayload?: TrashPayload;
  uploadPayload?: UploadPayload;
}

/** Manages the desktop window lifecycle — open, close, focus, minimize, maximize, move, and resize.
 * @returns Window state array and mutation methods: openWindow, closeWindow, focusWindow, minimizeWindow, maximizeWindow, moveWindow, resizeWindow, updateWindow.
 */
export function useWindowManager() {
  const [windows, setWindows] = useState<WindowState[]>([]);

  const openWindow = useCallback((
    title: string,
    windowType: WindowContentType,
    payload: WindowPayload,
  ): string => {
    const id = nextId();
    const position = getStaggeredPosition();
    const size = { ...DEFAULT_SIZES[windowType] };

    setWindows(prev => {
      const nextZ = prev.reduce((max, w) => Math.max(max, w.zIndex), 100) + 1;
      const win: WindowState = {
        id, title, windowType, position, size,
        isMaximized: false, isMinimized: false, zIndex: nextZ,
        ...payload,
      };
      return [...prev, win];
    });
    return id;
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => {
      const nextZ = prev.reduce((max, w) => Math.max(max, w.zIndex), 100) + 1;
      return prev.map(w => w.id === id ? { ...w, zIndex: nextZ, isMinimized: false } : w);
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.isMaximized) {
        return {
          ...w,
          isMaximized: false,
          position: w.preMaximizeRect
            ? { x: w.preMaximizeRect.x, y: w.preMaximizeRect.y }
            : w.position,
          size: w.preMaximizeRect
            ? { width: w.preMaximizeRect.width, height: w.preMaximizeRect.height }
            : w.size,
          preMaximizeRect: undefined,
        };
      }
      return {
        ...w,
        isMaximized: true,
        preMaximizeRect: { ...w.position, ...w.size },
        position: { x: 0, y: MENU_BAR_HEIGHT },
        size: {
          width: window.innerWidth,
          height: window.innerHeight - MENU_BAR_HEIGHT - STATUS_BAR_HEIGHT,
        },
      };
    }));
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, position: { x, y }, isMaximized: false } : w,
    ));
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number, x?: number, y?: number) => {
    setWindows(prev => prev.map(w =>
      w.id === id
        ? {
            ...w,
            size: { width: Math.max(MIN_WIDTH, width), height: Math.max(MIN_HEIGHT, height) },
            ...(x !== undefined && y !== undefined ? { position: { x, y } } : {}),
            isMaximized: false,
          }
        : w,
    ));
  }, []);

  const updateWindow = useCallback((id: string, updates: Partial<WindowState>) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  return {
    windows,
    openWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    resizeWindow,
    updateWindow,
  } as const;
}
