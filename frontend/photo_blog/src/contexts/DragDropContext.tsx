import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ActiveDrag, Position } from '../types';
import { useSoundContext } from './SoundContext';

type DropZoneRef = React.RefObject<HTMLElement | null>;

interface DropZoneEntry {
  id: string;
  ref: DropZoneRef;
}

interface DragDropContextValue {
  activeDrag: ActiveDrag | null;
  activeDropZoneId: string | null;
  startDrag: (drag: ActiveDrag, startPos: Position) => void;
  registerDropZone: (id: string, ref: DropZoneRef) => void;
  unregisterDropZone: (id: string) => void;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

/** Access the drag-drop context. Must be called inside a `<DragDropProvider>`. */
export function useDragDropContext(): DragDropContextValue {
  const ctx = useContext(DragDropContext);
  if (!ctx) throw new Error('useDragDropContext must be used inside DragDropProvider');
  return ctx;
}

interface ProviderProps {
  children: React.ReactNode;
  onDropToDesktop: (drag: ActiveDrag, pos: Position) => void;
  onDropToTrash: (drag: ActiveDrag) => void;
  onDropToCategory: (drag: ActiveDrag, categorySlug: string) => void;
  onDropToGuestFolder: (drag: ActiveDrag, folderId: string) => void;
}

/**
 * Provides drag-drop state and coordination for the entire app.
 * Renders a portal-based ghost image while a drag is active.
 *
 * Drops that don't land on a recognized zone (trash, category folder, guest folder)
 * are treated as cancellations — the ghost disappears and nothing happens.
 *
 * @param onDropToTrash - Called when a photo is dropped on the trash icon or trash window.
 * @param onDropToCategory - Called when a photo is dropped on a category folder or category window.
 * @param onDropToGuestFolder - Called when a photo is dropped on a guest-created folder or its window.
 */
export function DragDropProvider({ children, onDropToDesktop, onDropToTrash, onDropToCategory, onDropToGuestFolder }: ProviderProps) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dragPos, setDragPos] = useState<Position>({ x: 0, y: 0 });
  const [activeDropZoneId, setActiveDropZoneId] = useState<string | null>(null);

  const zonesRef = useRef<DropZoneEntry[]>([]);
  const dragRef = useRef<ActiveDrag | null>(null);
  const sound = useSoundContext();

  const registerDropZone = useCallback((id: string, ref: DropZoneRef) => {
    zonesRef.current = [...zonesRef.current.filter(z => z.id !== id), { id, ref }];
  }, []);

  const unregisterDropZone = useCallback((id: string) => {
    zonesRef.current = zonesRef.current.filter(z => z.id !== id);
  }, []);

  /**
   * Hit-test registered drop zones at (x, y).
   * Uses elementsFromPoint for window-level zones (win-* prefix) to respect
   * visual stacking order, and bounding-rect for desktop-level zones (icons).
   */
  const getZoneUnderCursor = useCallback((x: number, y: number): string | null => {
    // 1. Check window-level zones via elementsFromPoint (z-order aware)
    const elToZone = new Map<Element, string>();
    for (const zone of zonesRef.current) {
      if (zone.ref.current && zone.id.startsWith('win-')) {
        elToZone.set(zone.ref.current, zone.id);
      }
    }
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      let node: Element | null = el;
      while (node) {
        const zoneId = elToZone.get(node);
        if (zoneId) return zoneId;
        node = node.parentElement;
      }
    }

    // 2. Check desktop-level zones via bounding rect (icons are small, no overlap issues)
    let fallback: string | null = null;
    for (const zone of zonesRef.current) {
      if (zone.id.startsWith('win-')) continue; // already checked above
      const el = zone.ref.current;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        if (zone.id === 'desktop') { fallback = zone.id; continue; }
        return zone.id;
      }
    }
    return fallback;
  }, []);

  const startDrag = useCallback((drag: ActiveDrag, startPos: Position) => {
    sound.play('dragStart');
    dragRef.current = drag;
    setActiveDrag(drag);
    setDragPos(startPos);
    setActiveDropZoneId(null);

    const onPointerMove = (e: PointerEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY });
      const zone = getZoneUnderCursor(e.clientX, e.clientY);
      setActiveDropZoneId(zone);
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('keydown', onKeyDown);
    };

    const cancelDrag = () => {
      cleanup();
      dragRef.current = null;
      setActiveDrag(null);
      setActiveDropZoneId(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag();
    };

    const onPointerUp = (e: PointerEvent) => {
      cleanup();

      const currentDrag = dragRef.current;
      if (!currentDrag) return;

      const zoneId = getZoneUnderCursor(e.clientX, e.clientY);

      // Route drop to the appropriate handler based on zone ID prefix.
      // Unmatched drops (desktop surface, null, unrecognized) are no-ops.
      if (zoneId === 'trash' || zoneId === 'win-trash') {
        onDropToTrash(currentDrag);
      } else if (zoneId?.startsWith('guest-folder-')) {
        onDropToGuestFolder(currentDrag, zoneId);
      } else if (zoneId?.startsWith('win-guest-folder-')) {
        onDropToGuestFolder(currentDrag, zoneId.slice(4));
      } else if (zoneId?.startsWith('cat-')) {
        onDropToCategory(currentDrag, zoneId.slice(4));
      } else if (zoneId?.startsWith('win-cat-')) {
        onDropToCategory(currentDrag, zoneId.slice(8));
      } else if (zoneId === 'desktop') {
        onDropToDesktop(currentDrag, { x: e.clientX, y: e.clientY });
      }

      dragRef.current = null;
      setActiveDrag(null);
      setActiveDropZoneId(null);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('keydown', onKeyDown);
  }, [getZoneUnderCursor, onDropToDesktop, onDropToTrash, onDropToCategory, onDropToGuestFolder, sound]);

  return (
    <DragDropContext.Provider value={{ activeDrag, activeDropZoneId, startDrag, registerDropZone, unregisterDropZone }}>
      {children}
      {activeDrag && createPortal(
        <DragGhost drag={activeDrag} pos={dragPos} />,
        document.body,
      )}
    </DragDropContext.Provider>
  );
}

/** Floating thumbnail that follows the cursor during a drag. Rendered as a portal to escape overflow clipping. */
function DragGhost({ drag, pos }: { drag: ActiveDrag; pos: Position }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x - 32,
        top: pos.y - 32,
        width: 64,
        height: 64,
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: 0.75,
        transform: 'rotate(3deg) scale(1.05)',
        transformOrigin: 'center center',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      <img
        src={drag.thumbnailUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
