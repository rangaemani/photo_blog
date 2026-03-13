import { useEffect, useRef } from 'react';
import { useDragDropContext } from '../contexts/DragDropContext';

/** Registers an element as a drop target within the drag-drop system.
 * @param zoneId - Unique identifier for this drop zone.
 * @returns `{ ref, isOver }` — ref to attach to the drop target element, and whether a drag is currently over it.
 */
export function useDropZone(zoneId: string) {
  const { registerDropZone, unregisterDropZone, activeDropZoneId } = useDragDropContext();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    registerDropZone(zoneId, ref);
    return () => unregisterDropZone(zoneId);
  }, [zoneId, registerDropZone, unregisterDropZone]);

  const isOver = activeDropZoneId === zoneId;

  return { ref, isOver };
}
