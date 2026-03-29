import { useCallback, useEffect, useRef } from 'react';

interface UseDraggableOpts {
  onDrag: (x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/** Provides pointer-based dragging for absolutely-positioned elements (e.g. windows, icons).
 * Uses PointerEvent so the same code works for both mouse and touch input.
 * @param opts - `{ onDrag, onDragStart, onDragEnd }` — onDrag receives the new (x, y) position on each move.
 * @returns `{ onPointerDown }` handler to attach to the drag handle element.
 */
export function useDraggable({ onDrag, onDragStart, onDragEnd }: UseDraggableOpts) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clean up document listeners if the component unmounts mid-drag
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent, currentX: number, currentY: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    onDragStart?.();

    const { pointerId } = e;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentX, origY: currentY };

    document.body.style.cursor = 'grabbing';

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onDrag(dragRef.current.origX + dx, dragRef.current.origY + dy);
    };

    const cleanup = () => {
      dragRef.current = null;
      cleanupRef.current = null;
      document.body.style.cursor = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      onDragEnd?.();
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    };

    cleanupRef.current = cleanup;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [onDrag, onDragStart, onDragEnd]);

  return { onPointerDown };
}
