import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Category, UploadFileEntry } from '../../types';
import { uploadPhoto } from '../../api/client';
import { useSoundContext } from '../../contexts/SoundContext';
import { icons } from '../../lib/win98Icons';

interface Props {
  categories: Category[];
  onUploaded: () => void;
}

let fileIdCounter = 0;
const BATCH_THRESHOLD = 8;
const THUMB_SIZE = 80;

async function generateThumbnail(file: File): Promise<string> {
  return new Promise(resolve => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_SIZE;
      canvas.height = THUMB_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(blobUrl); return; }
      const scale = Math.max(THUMB_SIZE / img.naturalWidth, THUMB_SIZE / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (THUMB_SIZE - w) / 2, (THUMB_SIZE - h) / 2, w, h);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.onerror = () => resolve(blobUrl);
    img.src = blobUrl;
  });
}

export default function UploadWindow({ categories, onUploaded }: Props) {
  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionDesc, setSelectionDesc] = useState('');
  const [selectionCategory, setSelectionCategory] = useState('');
  const lastClickedIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const sound = useSoundContext();

  const defaultCategory = categories[0]?.slug ?? '';
  const isBatch = files.length >= BATCH_THRESHOLD;
  const hasSelection = selectedIds.size > 0;

  useEffect(() => {
    if (!batchCategory && defaultCategory) setBatchCategory(defaultCategory);
    if (!selectionCategory && defaultCategory) setSelectionCategory(defaultCategory);
  }, [defaultCategory, batchCategory, selectionCategory]);

  useEffect(() => {
    return () => {
      setFiles(prev => {
        prev.forEach(f => {
          if (f.preview.startsWith('blob:')) URL.revokeObjectURL(f.preview);
        });
        return prev;
      });
    };
  }, []);

  const addFiles = useCallback((fileList: FileList) => {
    const newEntries: UploadFileEntry[] = Array.from(fileList)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        id: `upload-${++fileIdCounter}`,
        file: f,
        title: f.name.replace(/\.[^.]+$/, ''),
        description: '',
        categorySlug: defaultCategory,
        preview: URL.createObjectURL(f),
        status: 'pending' as const,
        progress: 0,
      }));

    setFiles(prev => {
      const next = [...prev, ...newEntries];
      if (next.length >= BATCH_THRESHOLD) {
        [...newEntries, ...prev.filter(e => e.preview.startsWith('blob:'))].forEach(entry => {
          generateThumbnail(entry.file).then(thumb => {
            setFiles(cur => cur.map(f => f.id === entry.id ? { ...f, preview: thumb } : f));
          });
        });
      }
      return next;
    });
  }, [defaultCategory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const updateFile = useCallback((id: string, updates: Partial<UploadFileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const entry = prev.find(f => f.id === id);
      if (entry?.preview.startsWith('blob:')) URL.revokeObjectURL(entry.preview);
      return prev.filter(f => f.id !== id);
    });
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  // Multi-select: click=solo, ctrl/meta=toggle, shift=range
  const handleTileClick = useCallback((e: React.MouseEvent, id: string) => {
    if (isUploading) return;
    const fileIds = files.map(f => f.id);

    if (e.shiftKey && lastClickedIdRef.current) {
      const a = fileIds.indexOf(lastClickedIdRef.current);
      const b = fileIds.indexOf(id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelectedIds(new Set(fileIds.slice(lo, hi + 1)));
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      setSelectedIds(prev => prev.size === 1 && prev.has(id) ? new Set() : new Set([id]));
    }
    lastClickedIdRef.current = id;
  }, [files, isUploading]);

  const applyToSelection = useCallback(() => {
    setFiles(prev => prev.map(f =>
      selectedIds.has(f.id) && f.status === 'pending'
        ? { ...f, categorySlug: selectionCategory, description: selectionDesc }
        : f
    ));
  }, [selectedIds, selectionCategory, selectionDesc]);

  const handleUploadAll = useCallback(async () => {
    setIsUploading(true);
    setSelectedIds(new Set());
    const pending = files.filter(f => f.status === 'pending');
    let successCount = 0;

    for (const entry of pending) {
      const categorySlug = isBatch ? entry.categorySlug : entry.categorySlug;
      updateFile(entry.id, { status: 'uploading', progress: 0 });
      try {
        await uploadPhoto(
          entry.file,
          entry.title,
          entry.description,
          categorySlug,
          (pct) => updateFile(entry.id, { progress: pct }),
        );
        updateFile(entry.id, { status: 'done', progress: 100 });
        successCount++;
      } catch (err) {
        updateFile(entry.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
        sound.play('error');
      }
    }

    // Play once at end for batch, per-file for individual
    if (isBatch) {
      if (successCount > 0) sound.play('uploadComplete');
    } else {
      // individual mode already played per-file above (no sound in loop now)
    }

    setIsUploading(false);
    if (successCount > 0) onUploaded();
  }, [files, isBatch, updateFile, onUploaded, sound]);

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const doneCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div
      style={{ ...styles.container, ...(dragOver ? styles.dragOver : undefined) }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {files.length === 0 ? (
        <div style={styles.dropZone} onClick={() => inputRef.current?.click()}>
          <img src={icons.lg.upload} alt="Upload" style={{ width: 64, height: 64, marginBottom: 12 }} />
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            Drop images here or click to browse
          </p>
        </div>
      ) : isBatch ? (
        <>
          {/* Header — idle or selection toolbar */}
          <div style={styles.batchHeader}>
            {hasSelection ? (
              // Selection toolbar
              <>
                <span style={{ fontSize: 11, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {selectedIds.size} selected
                </span>
                <select
                  style={styles.catSelect}
                  value={selectionCategory}
                  onChange={e => setSelectionCategory(e.target.value)}
                  disabled={isUploading}
                >
                  {categories.map(c => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
                <input
                  style={{ ...styles.descInput, flex: 1 }}
                  placeholder="Description…"
                  value={selectionDesc}
                  onChange={e => setSelectionDesc(e.target.value)}
                  disabled={isUploading}
                />
                <button style={styles.applyBtn} onClick={applyToSelection} disabled={isUploading}>
                  Apply
                </button>
                <button
                  style={{ ...styles.applyBtn, background: 'transparent', border: 'none' }}
                  onClick={() => setSelectedIds(new Set())}
                  title="Deselect all"
                >✕</button>
              </>
            ) : (
              // Idle header
              <>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                  {files.length} files
                  {doneCount > 0 && ` · ${doneCount} done`}
                  {errorCount > 0 && ` · ${errorCount} failed`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>Default category</label>
                  <select
                    style={styles.catSelect}
                    value={batchCategory}
                    onChange={e => setBatchCategory(e.target.value)}
                    disabled={isUploading}
                  >
                    {categories.map(c => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Tile grid */}
          <div style={styles.batchGrid} onClick={(e) => {
            // Click on grid background deselects
            if (e.target === e.currentTarget) setSelectedIds(new Set());
          }}>
            <AnimatePresence initial={false}>
              {files.map(entry => {
                const isSelected = selectedIds.has(entry.id);
                // Show per-file category if it differs from batch default
                const catLabel = entry.categorySlug !== batchCategory
                  ? categories.find(c => c.slug === entry.categorySlug)?.name
                  : undefined;

                return (
                  <motion.div
                    key={entry.id}
                    className="batch-tile"
                    style={{
                      ...styles.batchTile,
                      ...(isSelected ? styles.batchTileSelected : {}),
                    }}
                    title={entry.title + (entry.description ? `\n${entry.description}` : '')}
                    onClick={(e) => handleTileClick(e, entry.id)}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <img
                      src={entry.preview}
                      alt=""
                      style={{ width: THUMB_SIZE, height: THUMB_SIZE, objectFit: 'cover', display: 'block' }}
                    />

                    {/* Status overlays */}
                    {entry.status === 'uploading' && (
                      <div style={{ ...styles.tileOverlay, background: 'rgba(74,127,203,0.6)' }}>
                        <span style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>{entry.progress}%</span>
                      </div>
                    )}
                    {entry.status === 'done' && (
                      <div style={{ ...styles.tileOverlay, background: 'rgba(40,140,60,0.55)' }}>
                        <span style={{ fontSize: 18, color: '#fff' }}>✓</span>
                      </div>
                    )}
                    {entry.status === 'error' && (
                      <div style={{ ...styles.tileOverlay, background: 'rgba(180,30,30,0.65)' }}>
                        <span style={{ fontSize: 14, color: '#fff' }}>✕</span>
                      </div>
                    )}

                    {/* Selection checkmark */}
                    {isSelected && entry.status === 'pending' && (
                      <div style={{ ...styles.tileOverlay, background: 'rgba(74,127,203,0.35)' }}>
                        <span style={{ fontSize: 18, color: '#fff', fontWeight: 'bold' }}>✓</span>
                      </div>
                    )}

                    {/* Remove button (hover, via CSS) */}
                    {entry.status === 'pending' && !isUploading && (
                      <button
                        className="tile-remove"
                        style={styles.tileRemove}
                        onClick={(e) => { e.stopPropagation(); removeFile(entry.id); }}
                        title="Remove"
                      >✕</button>
                    )}

                    {/* Filename + category label */}
                    <div style={styles.tileLabel}>
                      <span style={styles.tileName}>{entry.title}</span>
                      {catLabel && (
                        <span style={styles.tileCat}>{catLabel}</span>
                      )}
                      {entry.description && (
                        <span style={styles.tileCat} title={entry.description}>…</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      ) : (
        // === Individual mode ===
        <div style={styles.fileList}>
          <AnimatePresence initial={false}>
            {files.map(entry => (
              <motion.div
                key={entry.id}
                style={styles.fileRow}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, x: -40, height: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <img src={entry.preview} alt="" style={styles.thumb} />
                <div style={styles.fileInfo}>
                  <input
                    style={styles.titleInput}
                    value={entry.title}
                    onChange={(e) => updateFile(entry.id, { title: e.target.value })}
                    disabled={entry.status !== 'pending'}
                    placeholder="Title"
                  />
                  <input
                    style={styles.titleInput}
                    value={entry.description}
                    onChange={(e) => updateFile(entry.id, { description: e.target.value })}
                    disabled={entry.status !== 'pending'}
                    placeholder="Description (optional)"
                  />
                  <select
                    style={styles.catSelect}
                    value={entry.categorySlug}
                    onChange={(e) => updateFile(entry.id, { categorySlug: e.target.value })}
                    disabled={entry.status !== 'pending'}
                  >
                    {categories.map(c => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                  {entry.status === 'uploading' && (
                    <div style={styles.progressTrack}>
                      <motion.div
                        style={styles.progressBar}
                        initial={{ width: '0%' }}
                        animate={{ width: `${entry.progress}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  )}
                </div>
                <div style={styles.statusCol}>
                  {entry.status === 'pending' && (
                    <button style={styles.removeBtn} onClick={() => removeFile(entry.id)}>✕</button>
                  )}
                  {entry.status === 'uploading' && (
                    <span style={{ fontSize: 11, color: 'var(--accent)' }}>{entry.progress}%</span>
                  )}
                  {entry.status === 'done' && (
                    <motion.span
                      style={{ fontSize: 14, color: '#4caf50' }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >✓</motion.span>
                  )}
                  {entry.status === 'error' && (
                    <span style={{ fontSize: 11, color: '#d32f2f' }} title={entry.error}>✕</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div style={styles.footer}>
        <button style={styles.addBtn} onClick={() => inputRef.current?.click()} disabled={isUploading}>
          + Add Files
        </button>
        <button
          style={{ ...styles.uploadBtn, opacity: pendingCount > 0 && !isUploading ? 1 : 0.4 }}
          onClick={handleUploadAll}
          disabled={pendingCount === 0 || isUploading}
        >
          {isUploading ? 'Uploading...' : `Upload ${pendingCount > 0 ? `(${pendingCount})` : ''}`}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}

const TILE_WIDTH = THUMB_SIZE + 2; // include border

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--window-bg)',
  },
  dragOver: {
    outline: '2px dashed var(--accent)',
    outlineOffset: -4,
  },
  dropZone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  fileList: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderTop: '1px solid var(--bevel-shadow)',
    borderLeft: '1px solid var(--bevel-shadow)',
    borderBottom: '1px solid var(--bevel-highlight)',
    borderRight: '1px solid var(--bevel-highlight)',
    background: 'var(--platinum)',
  },
  thumb: {
    width: 48,
    height: 48,
    objectFit: 'cover',
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  titleInput: {
    fontSize: 13,
    padding: '3px 6px',
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    outline: 'none',
    background: 'var(--inset-bg)',
  },
  catSelect: {
    fontSize: 11,
    padding: '2px 4px',
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    background: 'var(--inset-bg)',
  },
  descInput: {
    fontSize: 11,
    padding: '2px 5px',
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    outline: 'none',
    background: 'var(--inset-bg)',
    minWidth: 0,
  },
  statusCol: {
    width: 32,
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0,
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--slate-grey)',
    fontSize: 14,
  },
  progressTrack: {
    height: 4,
    borderTop: '1px solid var(--bevel-shadow)',
    borderLeft: '1px solid var(--bevel-shadow)',
    borderBottom: '1px solid var(--bevel-highlight)',
    borderRight: '1px solid var(--bevel-highlight)',
    background: 'var(--platinum)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'var(--accent)',
  },
  // === Batch mode ===
  batchHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    borderBottom: '1px solid var(--groove-dark)',
    background: 'var(--toolbar-bg)',
    flexShrink: 0,
  },
  batchGrid: {
    flex: 1,
    overflow: 'auto',
    padding: 6,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignContent: 'flex-start',
  },
  batchTile: {
    position: 'relative',
    width: TILE_WIDTH,
    flexShrink: 0,
    overflow: 'hidden',
    borderTop: '2px solid var(--bevel-highlight)',
    borderLeft: '2px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-shadow)',
    borderRight: '2px solid var(--bevel-shadow)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  batchTileSelected: {
    borderTop: '2px solid var(--accent)',
    borderLeft: '2px solid var(--accent)',
    borderBottom: '2px solid var(--accent)',
    borderRight: '2px solid var(--accent)',
  },
  tileOverlay: {
    position: 'absolute',
    inset: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 18, // leave label row visible
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1px 3px',
    background: 'var(--panel-bg)',
    borderTop: '1px solid var(--bevel-shadow)',
  },
  tileName: {
    fontSize: 9,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: '12px',
  },
  tileCat: {
    fontSize: 8,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: '11px',
  },
  tileRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    background: 'rgba(0,0,0,0.55)',
    border: 'none',
    color: '#fff',
    fontSize: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    opacity: 0,
  },
  applyBtn: {
    fontSize: 11,
    padding: '2px 8px',
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    background: 'var(--pale-slate)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderTop: '1px solid var(--groove-dark)',
    flexShrink: 0,
    background: 'var(--toolbar-bg)',
  },
  addBtn: {
    fontSize: 12,
    padding: '4px 12px',
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    background: 'var(--pale-slate)',
    cursor: 'pointer',
  },
  uploadBtn: {
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 16px',
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    background: 'var(--pale-slate)',
    cursor: 'pointer',
  },
};
