import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addPopTag, removePopTag } from '../../api/client';
import type { PopTagItem } from '../../types';

interface Props {
  photoSlug: string;
  popTags: PopTagItem[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  currentUsername?: string;
  onLoginPrompt: () => void;
  onPopTagsChange: (tags: PopTagItem[]) => void;
}

export default function PopTagOverlay({
  photoSlug,
  popTags,
  isAuthenticated,
  isAdmin,
  currentUsername,
  onLoginPrompt,
  onPopTagsChange,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [taggingMode, setTaggingMode] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!taggingMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingPos({ x, y });
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [taggingMode]);

  const handleSubmit = useCallback(async () => {
    if (!pendingPos || !inputValue.trim()) return;
    setSubmitting(true);
    try {
      const res = await addPopTag(photoSlug, inputValue.trim(), pendingPos.x, pendingPos.y);
      onPopTagsChange(res.pop_tags);
      setPendingPos(null);
      setInputValue('');
      setTaggingMode(false);
    } catch {
      // max reached or error
    } finally {
      setSubmitting(false);
    }
  }, [photoSlug, pendingPos, inputValue, onPopTagsChange]);

  const handleRemove = useCallback(async (tagId: string) => {
    try {
      const res = await removePopTag(photoSlug, tagId);
      onPopTagsChange(res.pop_tags);
    } catch {
      // ignore
    }
  }, [photoSlug, onPopTagsChange]);

  const canRemove = (tag: PopTagItem) =>
    isAdmin || tag.user__username === currentUsername;

  const handleToggleMode = () => {
    if (!isAuthenticated) { onLoginPrompt(); return; }
    setTaggingMode(prev => !prev);
    setPendingPos(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        cursor: taggingMode ? 'crosshair' : 'default',
      }}
      onClick={handleImageClick}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
    >
      {/* Tag mode toggle button */}
      <button
        style={{
          ...styles.modeBtn,
          opacity: revealed || taggingMode ? 1 : 0,
          background: taggingMode ? 'var(--accent, #4285f4)' : 'rgba(0,0,0,0.5)',
          color: '#fff',
        }}
        onClick={(e) => { e.stopPropagation(); handleToggleMode(); }}
        title={taggingMode ? 'Cancel tagging' : 'Add pop tag'}
      >
        {taggingMode ? '✕' : '📌'}
      </button>

      {/* Existing pop tags */}
      <AnimatePresence>
        {(revealed || taggingMode) && popTags.map(tag => (
          <motion.div
            key={tag.id}
            style={{
              ...styles.popTag,
              left: `${tag.x * 100}%`,
              top: `${tag.y * 100}%`,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={styles.popTagLabel}>{tag.label}</span>
            {canRemove(tag) && (
              <button
                style={styles.popTagRemove}
                onClick={() => handleRemove(tag.id)}
              >
                ×
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Dots always visible when tags exist */}
      {!revealed && !taggingMode && popTags.map(tag => (
        <div
          key={`dot-${tag.id}`}
          style={{
            ...styles.dot,
            left: `${tag.x * 100}%`,
            top: `${tag.y * 100}%`,
          }}
        />
      ))}

      {/* Pending tag input */}
      {pendingPos && (
        <motion.div
          style={{
            ...styles.pendingInput,
            left: `${pendingPos.x * 100}%`,
            top: `${pendingPos.y * 100}%`,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <input
              ref={inputRef}
              style={styles.pendingInputField}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') { setPendingPos(null); }
              }}
              placeholder="label"
              maxLength={50}
              disabled={submitting}
            />
          </form>
        </motion.div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  modeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s, background 0.2s',
  },
  popTag: {
    position: 'absolute',
    transform: 'translate(-50%, -100%) translateY(-6px)',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    zIndex: 5,
    pointerEvents: 'auto',
  },
  popTagLabel: {
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    background: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    whiteSpace: 'nowrap',
    backdropFilter: 'blur(4px)',
  },
  popTagRemove: {
    width: 16,
    height: 16,
    padding: 0,
    border: 'none',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: 11,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.8)',
    border: '1.5px solid rgba(0,0,0,0.3)',
    transform: 'translate(-50%, -50%)',
    zIndex: 5,
    pointerEvents: 'none',
  },
  pendingInput: {
    position: 'absolute',
    transform: 'translate(-50%, -100%) translateY(-6px)',
    zIndex: 10,
  },
  pendingInputField: {
    width: 100,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
    border: '2px solid var(--accent, #4285f4)',
    borderRadius: 10,
    outline: 'none',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    backdropFilter: 'blur(4px)',
  },
};
