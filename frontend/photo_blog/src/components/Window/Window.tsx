import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import type { WindowState, ResizeEdge } from '../../types';
import { useDraggable } from '../../hooks/useDraggable';
import { useResizable } from '../../hooks/useResizable';
import { useDropZone } from '../../hooks/useDropZone';
import WindowTitleBar from './WindowTitleBar';

interface Props {
  win: WindowState;
  isFocused?: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number, x: number, y: number) => void;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  dropZoneId?: string;
}

const EDGE_SIZE = 6;

const MIN_SIZES: Record<string, { width: number; height: number }> = {
  grid:   { width: 360, height: 300 },
  detail: { width: 420, height: 380 },
  static: { width: 320, height: 280 },
  login:  { width: 320, height: 280 },
  upload: { width: 400, height: 360 },
  trash:  { width: 360, height: 300 },
};

const RESIZE_EDGES: { edge: ResizeEdge; style: React.CSSProperties }[] = [
  { edge: 'e',  style: { top: 0, right: 0, width: EDGE_SIZE, height: '100%', cursor: 'ew-resize' } },
  { edge: 'w',  style: { top: 0, left: 0, width: EDGE_SIZE, height: '100%', cursor: 'ew-resize' } },
  { edge: 's',  style: { bottom: 0, left: 0, width: '100%', height: EDGE_SIZE, cursor: 'ns-resize' } },
  { edge: 'n',  style: { top: 0, left: 0, width: '100%', height: EDGE_SIZE, cursor: 'ns-resize' } },
  { edge: 'se', style: { bottom: 0, right: 0, width: EDGE_SIZE * 2, height: EDGE_SIZE * 2, cursor: 'nwse-resize' } },
  { edge: 'sw', style: { bottom: 0, left: 0, width: EDGE_SIZE * 2, height: EDGE_SIZE * 2, cursor: 'nesw-resize' } },
  { edge: 'ne', style: { top: 0, right: 0, width: EDGE_SIZE * 2, height: EDGE_SIZE * 2, cursor: 'nesw-resize' } },
  { edge: 'nw', style: { top: 0, left: 0, width: EDGE_SIZE * 2, height: EDGE_SIZE * 2, cursor: 'nwse-resize' } },
];

export default function Window({ win, isFocused = false, onClose, onMinimize, onMaximize, onFocus, onMove, onResize, children, toolbar, dropZoneId }: Props) {
  // Track whether user is actively dragging/resizing — bypass spring during those operations
  const [isInteracting, setIsInteracting] = useState(false);

  const startInteract = useCallback(() => {
    setIsInteracting(true);
    onFocus();
  }, [onFocus]);

  const endInteract = useCallback(() => {
    setIsInteracting(false);
  }, []);

  const { onMouseDown: onTitleDrag } = useDraggable({
    onDrag: onMove,
    onDragStart: startInteract,
    onDragEnd: endInteract,
  });

  const minSize = MIN_SIZES[win.windowType] ?? { width: 320, height: 280 };

  const { onEdgeMouseDown } = useResizable({
    onResize,
    onResizeStart: startInteract,
    onResizeEnd: endInteract,
    minWidth: minSize.width,
    minHeight: minSize.height,
  });

  // Register window body as a drop zone when dropZoneId is provided
  const { ref: dropRef, isOver } = useDropZone(dropZoneId ?? `__noop-win-${win.id}`);

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    onTitleDrag(e, win.position.x, win.position.y);
  }, [onTitleDrag, win.position.x, win.position.y]);

  const handleEdge = useCallback((e: React.MouseEvent, edge: ResizeEdge) => {
    onEdgeMouseDown(e, edge, win.size.width, win.size.height, win.position.x, win.position.y);
  }, [onEdgeMouseDown, win.size.width, win.size.height, win.position.x, win.position.y]);

  // Focus shadow: deeper when this is the front-most visible window
  const shadow = isFocused && !win.isMinimized
    ? '0 8px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)'
    : '0 2px 8px rgba(0,0,0,0.06)';

  // During drag/resize: instant position updates; otherwise spring for maximize/restore
  const layoutTransition = isInteracting
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 350, damping: 30 };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -10 }}
      animate={{
        opacity: win.isMinimized ? 0 : 1,
        scale: win.isMinimized ? 0.88 : 1,
        y: win.isMinimized ? 12 : 0,
        left: win.position.x,
        top: win.position.y,
        width: win.size.width,
        height: win.size.height,
        boxShadow: shadow,
      }}
      exit={{ opacity: 0, scale: 0.94, y: -10 }}
      transition={layoutTransition}
      style={{
        position: 'absolute',
        zIndex: win.zIndex,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--window-bg)',
        border: '1px solid var(--window-border)',
        borderRadius: 6,
        overflow: 'hidden',
        pointerEvents: win.isMinimized ? 'none' : 'auto',
      }}
      onMouseDown={onFocus}
    >
      <WindowTitleBar
        title={win.title}
        windowType={win.windowType}
        onClose={onClose}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onMouseDown={handleTitleMouseDown}
      />
      {toolbar}
      <div
        ref={dropZoneId ? dropRef as React.RefObject<HTMLDivElement> : undefined}
        className="window-body"
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          ...(isOver && dropZoneId ? { outline: '2px solid var(--accent)', outlineOffset: -2, borderRadius: 4 } : undefined),
        }}
      >
        {children}
      </div>

      {!win.isMaximized && RESIZE_EDGES.map(({ edge, style }) => (
        <div
          key={edge}
          style={{ position: 'absolute', ...style }}
          onMouseDown={(e) => handleEdge(e, edge)}
        />
      ))}
    </motion.div>
  );
}
