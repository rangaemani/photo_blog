import { useRef, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GridPayload, ContextMenuState } from '../../types';
import PhotoCell from './PhotoCell';
import { icons } from '../../lib/win98Icons';

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
  onSortChange?: (order: 'asc' | 'desc') => void;
  isDraggable?: boolean;
  sourceWindowId?: string;
  showReportedBadges?: boolean;
}

export default function PhotoGrid({ grid, columns, onPhotoClick, onLoadMore, onHover, onHoverEnd, onContextMenu, selectable, isSelected, onToggleSelect, onRangeSelect, onTrashed, onSortChange, isDraggable, sourceWindowId, showReportedBadges }: Props) {
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
        <img src={icons.lg.grid} alt="" style={{ width: 48, height: 48, imageRendering: 'pixelated', opacity: 0.5 }} />
        <p style={{ marginTop: 12, fontSize: 14 }}>No photos yet</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {onSortChange && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '4px 8px',
          borderBottom: '1px solid var(--groove-dark)',
          background: 'var(--toolbar-bg)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => onSortChange(grid.order === 'desc' ? 'asc' : 'desc')}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderTop: '1px solid var(--bevel-highlight)',
              borderLeft: '1px solid var(--bevel-highlight)',
              borderBottom: '1px solid var(--bevel-shadow)',
              borderRight: '1px solid var(--bevel-shadow)',
              background: 'var(--pale-slate)',
              cursor: 'pointer',
            }}
            title={grid.order === 'desc' ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
          >
            {grid.order === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
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
            showReportedBadge={showReportedBadges}
          />
        ))}
      </motion.div>
      <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {grid.isLoadingMore && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading more...</span>}
      </div>
      </div>
    </div>
  );
}
