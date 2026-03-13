import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Category, UploadFileEntry } from '../../types';
import { uploadPhoto } from '../../api/client';
import { useSoundContext } from '../../contexts/SoundContext';

interface Props {
  categories: Category[];
  onUploaded: () => void;
}

let fileIdCounter = 0;

export default function UploadWindow({ categories, onUploaded }: Props) {
  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const sound = useSoundContext();

  const defaultCategory = categories[0]?.slug ?? '';

  const addFiles = useCallback((fileList: FileList) => {
    const entries: UploadFileEntry[] = Array.from(fileList)
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
    setFiles(prev => [...prev, ...entries]);
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
      if (entry) URL.revokeObjectURL(entry.preview);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handleUploadAll = useCallback(async () => {
    setIsUploading(true);
    const pending = files.filter(f => f.status === 'pending');

    for (const entry of pending) {
      updateFile(entry.id, { status: 'uploading', progress: 0 });
      try {
        await uploadPhoto(
          entry.file,
          entry.title,
          entry.description,
          entry.categorySlug,
          (pct) => updateFile(entry.id, { progress: pct }),
        );
        updateFile(entry.id, { status: 'done', progress: 100 });
        sound.play('uploadComplete');
      } catch (err) {
        updateFile(entry.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
        sound.play('error');
      }
    }

    setIsUploading(false);
    onUploaded();
  }, [files, updateFile, onUploaded, sound]);

  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <div
      style={{ ...styles.container, ...(dragOver ? styles.dragOver : undefined) }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {files.length === 0 ? (
        <div style={styles.dropZone} onClick={() => inputRef.current?.click()}>
          <span style={{ fontSize: 36 }}>📁</span>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            Drop images here or click to browse
          </p>
        </div>
      ) : (
        <div style={styles.fileList}>
          <AnimatePresence initial={false}>
            {files.map(entry => (
              <motion.div
                key={entry.id}
                style={styles.fileRow}
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
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
                    <button style={styles.removeBtn} onClick={() => removeFile(entry.id)} title="Remove">✕</button>
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
    borderRadius: 6,
    border: '1px solid var(--window-border)',
    background: '#faf8f4',
  },
  thumb: {
    width: 48,
    height: 48,
    objectFit: 'cover',
    borderRadius: 4,
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
    border: '1px solid var(--window-border)',
    borderRadius: 3,
    outline: 'none',
    background: '#fff',
  },
  catSelect: {
    fontSize: 12,
    padding: '2px 4px',
    border: '1px solid var(--window-border)',
    borderRadius: 3,
    background: '#fff',
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
    color: '#999',
    fontSize: 14,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    background: 'var(--window-border)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 2,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderTop: '1px solid var(--window-border)',
    flexShrink: 0,
  },
  addBtn: {
    fontSize: 12,
    padding: '4px 12px',
    border: '1px solid var(--window-border)',
    borderRadius: 4,
    background: 'var(--window-titlebar-bg)',
    cursor: 'pointer',
  },
  uploadBtn: {
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 16px',
    border: '1px solid var(--window-border)',
    borderRadius: 4,
    background: 'var(--window-titlebar-bg)',
    cursor: 'pointer',
  },
};
