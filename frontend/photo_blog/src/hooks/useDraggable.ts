import { useCallback, useEffect, useRef } from 'react';

interface UseDraggableOpts {
  onDrag: (x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/** Provides mouse-based dragging for absolutely-positioned elements (e.g. windows, icons).
 * @param opts - `{ onDrag, onDragStart }` — onDrag receives the new (x, y) position on each move; onDragStart fires once at drag begin.
 * @returns `{ onMouseDown }` handler to call with the mouse event and current element position.
 */
export function useDraggable({ onDrag, onDragStart, onDragEnd }: UseDraggableOpts) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clean up document listeners if the component unmounts mid-drag
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent, currentX: number, currentY: number) => {
    e.preventDefault();
    onDragStart?.();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentX, origY: currentY };

    document.body.style.cursor = 'grabbing';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onDrag(dragRef.current.origX + dx, dragRef.current.origY + dy);
    };

    const cleanup = () => {
      dragRef.current = null;
      cleanupRef.current = null;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      onDragEnd?.();
    };

    const onMouseUp = () => cleanup();

    cleanupRef.current = cleanup;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onDrag, onDragStart, onDragEnd]);

  return { onMouseDown };
}
