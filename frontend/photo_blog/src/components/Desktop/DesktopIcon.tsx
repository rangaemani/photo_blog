import { useCallback, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { DesktopIconState, IconKind, ContextMenuState, ContextMenuItem } from '../../types';
import { useDraggable } from '../../hooks/useDraggable';
import { useDragSource } from '../../hooks/useDragSource';
import { useDropZone } from '../../hooks/useDropZone';
import { useSoundContext } from '../../contexts/SoundContext';

interface Props {
  icon: DesktopIconState;
  isSelected: boolean;
  isRenaming: boolean;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onOpen: (icon: DesktopIconState) => void;
  onMove: (id: string, x: number, y: number) => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onStartRename: (id: string) => void;
  onStopRename: () => void;
  onContextMenu: (menu: ContextMenuState) => void;
  onHover: (text: string) => void;
  onHoverEnd: () => void;
}

const KIND_EMOJI: Record<IconKind, string> = {
  app: '\uD83D\uDDBC\uFE0F',
  folder: '\uD83D\uDCC1',
  file: '\uD83D\uDCC4',
  system: '\uD83D\uDDD1\uFE0F',
  photo: '\uD83D\uDDBC\uFE0F',
};

// Overrides for well-known icon IDs that differ from their iconType default
const ID_EMOJI: Record<string, string> = {
  about: '\u2139\uFE0F',
  contact: '\u2709\uFE0F',
  map: '\uD83D\uDDFA\uFE0F',
};

function resolveEmoji(icon: DesktopIconState): string {
  if (icon.iconType === 'photo') return '\uD83D\uDDBC\uFE0F';
  return ID_EMOJI[icon.id] ?? KIND_EMOJI[icon.iconType];
}

/** Whether this icon is a user-created item that can be renamed. */
function isRenamable(icon: DesktopIconState): boolean {
  return icon.id.startsWith('guest-folder-') || icon.iconType === 'photo';
}

// Drop zone id for this icon (null = not a drop target)
function getDropZoneId(icon: DesktopIconState): string | null {
  if (icon.action.type === 'openTrash') return 'trash';
  if (icon.action.type === 'openGrid' && icon.action.categorySlug) return `cat-${icon.action.categorySlug}`;
  // Guest folders use their own ID directly (no cat- prefix) to avoid prefix overlap
  if (icon.id.startsWith('guest-folder-')) return icon.id;
  return null;
}

export default function DesktopIcon({ icon, isSelected, isRenaming, isAdmin, onSelect, onOpen, onMove, onRename, onDelete, onStartRename, onStopRename, onContextMenu, onHover, onHoverEnd }: Props) {
  const iconRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(icon.label);
  const sound = useSoundContext();

  // Auto-focus + select all when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      setEditValue(icon.label);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming, icon.label]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== icon.label) {
      onRename(icon.id, trimmed);
    }
    onStopRename();
  }, [editValue, icon.id, icon.label, onRename, onStopRename]);

  // Track dragging to bypass spring during mouse move (avoid wobble)
  const [isDragging, setIsDragging] = useState(false);

  // Positional drag (reposition the icon on desktop) — used by all icon types
  const handleDrag = useCallback((x: number, y: number) => {
    onMove(icon.id, x, y);
  }, [icon.id, onMove]);
  const { onMouseDown: startPositionalDrag } = useDraggable({
    onDrag: handleDrag,
    onDragStart: useCallback(() => setIsDragging(true), []),
    onDragEnd: useCallback(() => setIsDragging(false), []),
  });

  // Photo drag source — only for photo icons, sends photo to drop zones
  const isPhotoIcon = icon.iconType === 'photo' && icon.action.type === 'openDetail';
  const getDrag = useCallback(() => ({
    photoId: icon.id,
    photoSlug: icon.action.type === 'openDetail' ? icon.action.photoSlug : '',
    thumbnailUrl: icon.thumbnailUrl ?? '',
    sourceKind: 'desktop-icon' as const,
  }), [icon]);
  const { onPointerDown: startPhotoDrag } = useDragSource(getDrag);

  // Drop zone registration — trash, category folders, and guest folders are drop targets
  const dropZoneId = getDropZoneId(icon);
  const { ref: dropRef, isOver } = useDropZone(dropZoneId ?? `__noop-${icon.id}`);

  // Merge refs: the icon element is both the drop zone target and the drag handle
  const setRefs = useCallback((el: HTMLDivElement | null) => {
    (iconRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    (dropRef as React.MutableRefObject<HTMLElement | null>).current = el;
  }, [dropRef]);

  // Attach photo-drag via native pointerdown so framer-motion's gesture system can't swallow it
  useEffect(() => {
    const el = iconRef.current;
    if (!el || !isPhotoIcon || isRenaming) return;
    const handler = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation(); // prevent desktop click from clearing selection
      onSelect(icon.id);
      startPhotoDrag(e as unknown as React.PointerEvent);
    };
    el.addEventListener('pointerdown', handler);
    return () => el.removeEventListener('pointerdown', handler);
  }, [icon.id, isPhotoIcon, isRenaming, onSelect, startPhotoDrag]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isRenaming || isPhotoIcon) return;
    sound.play('click');
    onSelect(icon.id);
    startPositionalDrag(e, icon.position.x, icon.position.y);
  }, [icon.id, icon.position.x, icon.position.y, isPhotoIcon, isRenaming, onSelect, startPositionalDrag, sound]);

  const handleDoubleClick = useCallback(() => {
    if (isRenaming) return;
    onOpen(icon);
  }, [icon, isRenaming, onOpen]);

  // Slow double-click on label to rename (select first click, rename second click with delay)
  const handleLabelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected && !isRenaming && isRenamable(icon)) {
      onStartRename(icon.id);
    }
  }, [icon, isSelected, isRenaming, onStartRename]);

  // Whether this icon can be deleted: user-created items always, category folders only for admin
  const isDeletable = isRenamable(icon) || (isAdmin && icon.id.startsWith('cat-'));

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(icon.id);
    const GRID = 90;
    const items: ContextMenuItem[] = [
      { label: 'Open', action: () => onOpen(icon) },
      { label: '', divider: true },
      { label: 'Snap to Grid', action: () => onMove(icon.id, Math.round(icon.position.x / GRID) * GRID, Math.round(icon.position.y / GRID) * GRID) },
      ...(isRenamable(icon) ? [
        { label: '', divider: true },
        { label: 'Rename', action: () => onStartRename(icon.id) },
        { label: 'Delete', action: () => onDelete(icon.id) },
      ] : isDeletable ? [
        { label: '', divider: true },
        { label: 'Delete Folder', action: () => onDelete(icon.id) },
      ] : []),
    ];
    onContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [icon, isAdmin, isDeletable, onSelect, onOpen, onMove, onStartRename, onDelete, onContextMenu]);

  const hoverText = icon.action.type === 'openGrid'
    ? (icon.action.categorySlug ? `/photos?category=${icon.action.categorySlug}` : '/photos')
    : icon.action.type === 'openTrash'
      ? '/trash'
      : icon.action.type === 'openDetail'
        ? `/photos/${icon.action.photoSlug}`
        : `/${icon.action.contentKey}`;

  const dropOutline = dropZoneId && isOver
    ? (dropZoneId === 'trash' ? '2px solid #e05050' : '2px solid var(--accent)')
    : '2px solid transparent';

  return (
    <motion.div
      ref={setRefs}
      initial={{ opacity: 0, scale: 0.5, y: 10 }}
      animate={{
        opacity: 1,
        scale: isSelected ? [1, 1.08, 1] : 1,
        left: icon.position.x,
        top: icon.position.y,
        outline: dropOutline,
        borderRadius: 6,
      }}
      exit={{ opacity: 0, scale: 0.5 }}
      whileHover={{ y: -3, scale: 1.05 }}
      whileTap={isPhotoIcon ? undefined : { scale: 0.95 }}
      transition={isDragging
        ? { left: { duration: 0 }, top: { duration: 0 }, scale: { type: 'spring', stiffness: 400, damping: 25 } }
        : { type: 'spring', stiffness: 340, damping: 28 }
      }
      style={{
        position: 'absolute',
        width: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => onHover(hoverText)}
      onMouseLeave={onHoverEnd}
    >
      <div style={{
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 32,
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {icon.iconType === 'photo' && icon.thumbnailUrl
          ? (
            <img
              src={icon.thumbnailUrl}
              alt={icon.label}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, display: 'block' }}
              draggable={false}
            />
          )
          : resolveEmoji(icon)
        }
      </div>
      {isRenaming ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') onStopRename();
            e.stopPropagation(); // prevent global keyboard shortcuts
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            marginTop: 2,
            fontSize: 11,
            textAlign: 'center',
            lineHeight: '14px',
            width: 76,
            padding: '1px 2px',
            borderRadius: 3,
            border: '1px solid var(--accent)',
            outline: 'none',
            background: '#fff',
            color: 'var(--text-primary)',
          }}
        />
      ) : (
        <span
          style={{
            marginTop: 2,
            fontSize: 11,
            textAlign: 'center',
            lineHeight: '14px',
            maxWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            padding: '1px 4px',
            borderRadius: 3,
            color: isSelected ? '#fff' : 'var(--text-primary)',
            background: isSelected ? 'var(--accent-light)' : 'transparent',
          }}
          onClick={handleLabelClick}
        >
          {icon.label}
        </span>
      )}
    </motion.div>
  );
}
