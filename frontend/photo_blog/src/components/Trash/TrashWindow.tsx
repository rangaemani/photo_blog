import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrashedPhotoListItem } from '../../types';
import { getTrashedPhotos, restorePhotos, purgePhotos, emptyTrash } from '../../api/client';
import { useSelection } from '../../hooks/useSelection';
import { drawBlurhash } from '../../utils/blurhash';
import { useSoundContext } from '../../contexts/SoundContext';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  onChanged: () => void;
}

export default function TrashWindow({ onChanged }: Props) {
  const [photos, setPhotos] = useState<TrashedPhotoListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ type: 'purge' | 'empty' } | null>(null);
  const selection = useSelection();
  const sound = useSoundContext();

  const loadTrash = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTrashedPhotos();
      setPhotos(data.results);
    } catch {
      // error loading trash
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTrash(); }, [loadTrash]);

  const handleRestore = useCallback(async () => {
    if (selection.selectedCount === 0) return;
    try {
      await restorePhotos(selection.selectedIds);
      selection.clear();
      loadTrash();
      onChanged();
    } catch { /* TODO: show error toast */ }
  }, [selection, loadTrash, onChanged]);

  const handlePurge = useCallback(async () => {
    try {
      await purgePhotos(selection.selectedIds);
      sound.play('dropTrash');
      selection.clear();
      setConfirm(null);
      loadTrash();
      onChanged();
    } catch { /* TODO: show error toast */ }
  }, [selection, loadTrash, onChanged, sound]);

  const handleEmpty = useCallback(async () => {
    try {
      await emptyTrash();
      sound.play('emptyTrash');
      selection.clear();
      setConfirm(null);
      loadTrash();
      onChanged();
    } catch { /* TODO: show error toast */ }
  }, [selection, loadTrash, onChanged, sound]);

  if (isLoading) {
    return <div style={{ padding: 16, color: 'var(--text-muted)' }}>Loading...</div>;
  }

  if (photos.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <span style={{ fontSize: 48 }}>🗑️</span>
        <p style={{ marginTop: 12, fontSize: 14 }}>Trash is empty</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button style={styles.btn} onClick={() => selection.selectedCount > 0 ? selection.clear() : selection.selectAll(photos.map(p => p.id))}>
          {selection.selectedCount > 0 ? 'Deselect' : 'Select All'}
        </button>
        <button style={{ ...styles.btn, opacity: selection.selectedCount > 0 ? 1 : 0.4 }} onClick={handleRestore} disabled={selection.selectedCount === 0}>
          Restore
        </button>
        <button style={{ ...styles.btn, opacity: selection.selectedCount > 0 ? 1 : 0.4 }} onClick={() => setConfirm({ type: 'purge' })} disabled={selection.selectedCount === 0}>
          Delete Forever
        </button>
        <button style={styles.dangerBtn} onClick={() => setConfirm({ type: 'empty' })}>
          Empty Trash
        </button>
        {selection.selectedCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
            {selection.selectedCount} selected
          </span>
        )}
      </div>

      <motion.div
        style={styles.grid}
        variants={{ show: { transition: { staggerChildren: 0.03 } } }}
        initial="hidden"
        animate="show"
      >
        {photos.map(photo => (
          <TrashCell
            key={photo.id}
            photo={photo}
            selected={selection.isSelected(photo.id)}
            onToggle={() => selection.toggle(photo.id)}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {confirm?.type === 'purge' && (
          <ConfirmDialog
            key="purge"
            message={`Permanently delete ${selection.selectedCount} photo${selection.selectedCount > 1 ? 's' : ''}? This cannot be undone.`}
            confirmLabel="Delete Forever"
            onConfirm={handlePurge}
            onCancel={() => setConfirm(null)}
          />
        )}
        {confirm?.type === 'empty' && (
          <ConfirmDialog
            key="empty"
            message={`Permanently delete all ${photos.length} trashed photo${photos.length > 1 ? 's' : ''}? This cannot be undone.`}
            confirmLabel="Empty Trash"
            onConfirm={handleEmpty}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TrashCell({ photo, selected, onToggle }: { photo: TrashedPhotoListItem; selected: boolean; onToggle: () => void }) {
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas && photo.blurhash) {
      try { drawBlurhash(canvas, photo.blurhash, photo.width, photo.height); } catch { /* */ }
    }
  }, [photo.blurhash, photo.width, photo.height]);

  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
      }}
      whileHover={{ y: -3, boxShadow: '0 6px 16px rgba(0,0,0,0.1)' }}
      style={{ ...styles.cell, ...(selected ? { outline: '2px solid var(--accent)', outlineOffset: -2 } : undefined) }}
      onClick={onToggle}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 4, opacity: loaded ? 0 : 1, transition: 'opacity 200ms' }} />
        <img
          src={photo.thumbnail_url}
          alt={photo.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, opacity: loaded ? 1 : 0, transition: 'opacity 200ms' }}
        />
        <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 16, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          {selected ? '☑' : '☐'}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {photo.title}
      </div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderBottom: '1px solid var(--window-border)',
    background: '#faf8f4',
    flexShrink: 0,
  },
  btn: {
    fontSize: 11,
    padding: '3px 10px',
    border: '1px solid var(--window-border)',
    borderRadius: 3,
    background: 'var(--window-titlebar-bg)',
    cursor: 'pointer',
  },
  dangerBtn: {
    fontSize: 11,
    padding: '3px 10px',
    border: '1px solid var(--close-hover)',
    borderRadius: 3,
    background: 'var(--close-hover)',
    color: '#fff',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  grid: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    alignContent: 'start',
  },
  cell: {
    cursor: 'pointer',
    borderRadius: 6,
  },
};
