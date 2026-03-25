import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addTag, removeTag } from '../../api/client';
import type { TagItem } from '../../types';

interface Props {
  photoSlug: string;
  tags: TagItem[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  currentUsername?: string;
  onLoginPrompt: () => void;
  onTagsChange: (tags: TagItem[]) => void;
}

export default function TagBar({
  photoSlug,
  tags,
  isAuthenticated,
  isAdmin,
  currentUsername,
  onLoginPrompt,
  onTagsChange,
}: Props) {
  const [inputOpen, setInputOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(async () => {
    const text = inputValue.trim().toLowerCase();
    if (!text) return;

    setSubmitting(true);
    try {
      const res = await addTag(photoSlug, text);
      onTagsChange(res.tags);
      setInputValue('');
      setInputOpen(false);
    } catch {
      // duplicate or error — just close
    } finally {
      setSubmitting(false);
    }
  }, [photoSlug, inputValue, onTagsChange]);

  const handleRemove = useCallback(async (tagId: string) => {
    try {
      const res = await removeTag(photoSlug, tagId);
      onTagsChange(res.tags);
    } catch {
      // ignore
    }
  }, [photoSlug, onTagsChange]);

  const canRemove = (tag: TagItem) =>
    isAdmin || tag.user__username === currentUsername;

  return (
    <div style={styles.container}>
      <AnimatePresence initial={false}>
        {tags.map(tag => (
          <motion.span
            key={tag.id}
            style={styles.tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {tag.text}
            {canRemove(tag) && (
              <button
                style={styles.removeBtn}
                onClick={() => handleRemove(tag.id)}
                title="Remove tag"
              >
                ×
              </button>
            )}
          </motion.span>
        ))}
      </AnimatePresence>

      {inputOpen ? (
        <motion.form
          style={styles.inputWrap}
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
        >
          <input
            ref={inputRef}
            style={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { setInputOpen(false); setInputValue(''); }
            }}
            placeholder="add tag"
            maxLength={50}
            autoFocus
            disabled={submitting}
            onBlur={() => { if (!inputValue.trim()) { setInputOpen(false); } }}
          />
        </motion.form>
      ) : (
        <motion.button
          style={styles.addBtn}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (!isAuthenticated) { onLoginPrompt(); return; }
            setInputOpen(true);
          }}
          title="Add tag"
        >
          +
        </motion.button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'var(--platinum)',
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    borderRadius: 0,
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
    color: 'var(--text-muted)',
    borderRadius: 0,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    borderRadius: 0,
    background: 'var(--platinum)',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  inputWrap: {
    display: 'inline-flex',
  },
  input: {
    width: 80,
    padding: '2px 6px',
    fontSize: 11,
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    borderRadius: 0,
    outline: 'none',
    background: 'var(--inset-bg)',
    color: 'var(--text-primary)',
  },
};
