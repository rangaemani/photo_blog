import { useCallback, useEffect, useRef } from 'react';
import type { ActiveDrag } from '../types';
import { useDragDropContext } from '../contexts/DragDropContext';

const DRAG_THRESHOLD = 5;

/** Initiates a drag operation after a pointer-down + threshold movement.
 * @param getDrag - Factory that returns the drag payload (item data and sourceKind) for the current drag.
 * @returns `{ onPointerDown }` handler to attach to the draggable element.
 */
export function useDragSource(getDrag: () => Omit<ActiveDrag, 'sourceKind'> & { sourceKind: ActiveDrag['sourceKind'] }) {
  const { startDrag } = useDragDropContext();
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clean up document listeners if the component unmounts mid-drag
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle primary button (left click)
    if (e.button !== 0) return;

    const drag = getDrag() as ActiveDrag;
    const startX = e.clientX;
    const startY = e.clientY;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        cleanup();
        startDrag(drag, { x: ev.clientX, y: ev.clientY });
      }
    };

    const onPointerUp = () => cleanup();

    const cleanup = () => {
      cleanupRef.current = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    cleanupRef.current = cleanup;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [getDrag, startDrag]);

  return { onPointerDown };
}
