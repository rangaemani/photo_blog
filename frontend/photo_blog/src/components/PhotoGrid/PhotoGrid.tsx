import { useRef, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GridPayload, ContextMenuState } from '../../types';
import PhotoCell from './PhotoCell';

interface Props {
  grid: GridPayload;
  columns: number;
  onPhotoClick: (slug: string) => void;
  onLoadMore: () => void;
  onHover: (text: string) => void;
  onHoverEnd: () => void;
  onContextMenu: (menu: ContextMenuState) => void;
  selectable?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
  onRangeSelect?: (id: string, orderedIds: string[]) => void;
  onTrashed?: () => void;
  isDraggable?: boolean;
  sourceWindowId?: string;
}

export default function PhotoGrid({ grid, columns, onPhotoClick, onLoadMore, onHover, onHoverEnd, onContextMenu, selectable, isSelected, onToggleSelect, onRangeSelect, onTrashed, isDraggable, sourceWindowId }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const orderedIds = useMemo(() => grid.photos.map(p => p.id), [grid.photos]);
  const handleRangeSelect = useCallback((id: string) => {
    onRangeSelect?.(id, orderedIds);
  }, [onRangeSelect, orderedIds]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && grid.next && !grid.isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [grid.next, grid.isLoadingMore, onLoadMore]);

  if (grid.photos.length === 0 && !grid.isLoadingMore) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <span style={{ fontSize: 48 }}>📷</span>
        <p style={{ marginTop: 12, fontSize: 14 }}>No photos yet</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <motion.div
        key={grid.photos[0]?.id ?? 'empty'}
        variants={{
          show: { transition: { staggerChildren: 0.03 } },
        }}
        initial="hidden"
        animate="show"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 12,
        }}
      >
        {grid.photos.map(photo => (
          <PhotoCell
            key={photo.id}
            photo={photo}
            onClick={onPhotoClick}
            onHover={onHover}
            onHoverEnd={onHoverEnd}
            onContextMenu={onContextMenu}
            selectable={selectable}
            selected={isSelected?.(photo.id)}
            onToggleSelect={onToggleSelect}
            onRangeSelect={onRangeSelect ? handleRangeSelect : undefined}
            onTrashed={onTrashed}
            isDraggable={isDraggable}
            sourceWindowId={sourceWindowId}
          />
        ))}
      </motion.div>
      <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {grid.isLoadingMore && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading more...</span>}
      </div>
    </div>
  );
}
