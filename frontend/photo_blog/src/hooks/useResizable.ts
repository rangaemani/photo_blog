import { useCallback, useEffect, useRef } from 'react';
import type { ResizeEdge } from '../types';

interface UseResizableOpts {
  onResize: (width: number, height: number, x: number, y: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  minWidth?: number;
  minHeight?: number;
}

const CURSOR_MAP: Record<string, string> = {
  e: 'ew-resize', w: 'ew-resize', n: 'ns-resize', s: 'ns-resize',
  se: 'nwse-resize', nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
};

/** Provides edge-based mouse resize for window-like elements.
 * @param opts - `{ onResize, onResizeStart, minWidth, minHeight }` — onResize receives absolute (width, height, x, y).
 * @returns `{ onEdgeMouseDown }` handler to call with the mouse event, edge, current dimensions, and current position.
 */
export function useResizable({
  onResize, onResizeStart, onResizeEnd, minWidth = 400, minHeight = 300,
}: UseResizableOpts) {
  const ref = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    origPosX: number;
    origPosY: number;
    edge: ResizeEdge;
  } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const onEdgeMouseDown = useCallback((
    e: React.MouseEvent,
    edge: ResizeEdge,
    currentW: number,
    currentH: number,
    currentX: number,
    currentY: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onResizeStart?.();
    ref.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: currentW,
      origH: currentH,
      origPosX: currentX,
      origPosY: currentY,
      edge,
    };

    document.body.style.cursor = CURSOR_MAP[edge] ?? '';

    const onMouseMove = (ev: MouseEvent) => {
      if (!ref.current) return;
      const dx = ev.clientX - ref.current.startX;
      const dy = ev.clientY - ref.current.startY;
      let w = ref.current.origW;
      let h = ref.current.origH;

      if (ref.current.edge.includes('e')) w += dx;
      if (ref.current.edge.includes('s')) h += dy;
      if (ref.current.edge.includes('w')) w -= dx;
      if (ref.current.edge.includes('n')) h -= dy;

      const clampedW = Math.max(minWidth, w);
      const clampedH = Math.max(minHeight, h);

      // Compute absolute position. When resizing from w/n, the top-left moves.
      let posX = ref.current.origPosX;
      let posY = ref.current.origPosY;
      if (ref.current.edge.includes('w')) posX = ref.current.origPosX + (ref.current.origW - clampedW);
      if (ref.current.edge.includes('n')) posY = ref.current.origPosY + (ref.current.origH - clampedH);

      onResize(clampedW, clampedH, posX, posY);
    };

    const cleanup = () => {
      ref.current = null;
      cleanupRef.current = null;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      onResizeEnd?.();
    };

    const onMouseUp = () => cleanup();

    cleanupRef.current = cleanup;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onResize, onResizeStart, onResizeEnd, minWidth, minHeight]);

  return { onEdgeMouseDown };
}
