import { memo, useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { PhotoListItem, ContextMenuState } from '../../types';
import { trashPhotos } from '../../api/client';
import { drawBlurhash } from '../../utils/blurhash';
import { formatDate } from '../../utils/exif';
import { createContextMenuHandler, type ContextMenuOption } from '../../utils/contextMenu';
import { useDragSource } from '../../hooks/useDragSource';

interface Props {
  photo: PhotoListItem;
  onClick: (slug: string) => void;
  onHover: (text: string) => void;
  onHoverEnd: () => void;
  onContextMenu: (menu: ContextMenuState) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onRangeSelect?: (id: string) => void;
  onTrashed?: () => void;
  isDraggable?: boolean;
  sourceWindowId?: string;
}

export default memo(function PhotoCell({ photo, onClick, onHover, onHoverEnd, onContextMenu, selectable, selected, onToggleSelect, onRangeSelect, onTrashed, isDraggable, sourceWindowId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  const getDrag = useCallback(() => ({
    photoId: photo.id,
    photoSlug: photo.slug,
    thumbnailUrl: photo.thumbnail_url,
    sourceKind: 'grid-cell' as const,
    sourceWindowId,
  }), [photo.id, photo.slug, photo.thumbnail_url, sourceWindowId]);

  const { onPointerDown } = useDragSource(getDrag);

  useEffect(() => {
    if (canvasRef.current && photo.blurhash) {
      try {
        drawBlurhash(canvasRef.current, photo.blurhash, photo.width, photo.height);
      } catch {
        // invalid blurhash
      }
    }
  }, [photo.blurhash, photo.width, photo.height]);

  const handleContext = useMemo(() => {
    const options: ContextMenuOption[] = [
      { label: 'Open in New Window', action: () => onClick(photo.slug) },
      {
        label: 'View Original',
        action: () =>
          window.open(
            photo.thumbnail_url.replace('/thumbnails/', '/originals/').replace('.webp', '.jpg'),
            '_blank',
          ),
      },
      { label: 'Copy Image URL', action: () => navigator.clipboard.writeText(photo.thumbnail_url) },
      { label: '', divider: true, visible: selectable },
      {
        label: 'Move to Trash',
        action: () => { trashPhotos([photo.id]).then(() => onTrashed?.()).catch(() => {}); },
        visible: selectable,
      },
    ];
    return createContextMenuHandler(options, onContextMenu);
  }, [photo.id, photo.slug, photo.thumbnail_url, onClick, selectable, onTrashed, onContextMenu]);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
      }}
      whileHover={{ y: -4, boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}
      style={{
        ...styles.cell,
        ...(selected ? { outline: '2px solid var(--accent)', outlineOffset: -2, borderRadius: 6 } : undefined),
      }}
      onPointerDown={isDraggable && !selectable ? onPointerDown : undefined}
      onClick={(e) => {
        if (selectable) {
          if (e.shiftKey && onRangeSelect) onRangeSelect(photo.id);
          else if (e.ctrlKey || e.metaKey) onToggleSelect?.(photo.id);
          else onToggleSelect?.(photo.id);
        } else if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd+click opens in new window even outside select mode
          onClick(photo.slug);
        } else {
          onClick(photo.slug);
        }
      }}
      onDoubleClick={() => selectable ? onClick(photo.slug) : undefined}
      onMouseEnter={() => onHover(photo.title)}
      onMouseLeave={onHoverEnd}
      onContextMenu={handleContext}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: `${photo.width} / ${photo.height}` }}>
        {selectable && (
          <div
            style={styles.checkbox}
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(photo.id); }}
          >
            {selected ? '☑' : '☐'}
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            borderRadius: 4,
            opacity: loaded ? 0 : 1,
            transition: 'opacity 200ms',
          }}
        />
        <img
          src={photo.thumbnail_url}
          alt={photo.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 4,
            display: 'block',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 200ms',
          }}
        />
      </div>
      <div style={styles.info}>
        <div style={styles.title}>{photo.title}</div>
        {photo.taken_at && (
          <div style={styles.date}>{formatDate(photo.taken_at)}</div>
        )}
      </div>
    </motion.div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  cell: {
    cursor: 'pointer',
    overflow: 'hidden',
  },
  info: {
    padding: '4px 2px',
  },
  title: {
    fontSize: 12,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  date: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  checkbox: {
    position: 'absolute' as const,
    top: 6,
    left: 6,
    zIndex: 2,
    fontSize: 16,
    lineHeight: 1,
    color: '#fff',
    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
    cursor: 'pointer',
  },
};
