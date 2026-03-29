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

/** Provides edge-based pointer resize for window-like elements.
 * Uses PointerEvent so the same code works for both mouse and touch input.
 * @param opts - `{ onResize, onResizeStart, minWidth, minHeight }` — onResize receives absolute (width, height, x, y).
 * @returns `{ onEdgePointerDown }` handler to call with the pointer event, edge, current dimensions, and position.
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

  const onEdgePointerDown = useCallback((
    e: React.PointerEvent,
    edge: ResizeEdge,
    currentW: number,
    currentH: number,
    currentX: number,
    currentY: number,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onResizeStart?.();

    const { pointerId } = e;
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

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !ref.current) return;
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
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      onResizeEnd?.();
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    };

    cleanupRef.current = cleanup;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [onResize, onResizeStart, onResizeEnd, minWidth, minHeight]);

  return { onEdgePointerDown };
}
