import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    // Guard Enter: if the confirm button already has focus the native click fires it,
    // so only handle Enter from the global listener when another element has focus.
    if (e.key === 'Enter' && document.activeElement !== confirmRef.current) onConfirm();
  }, [onConfirm, onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <motion.div
      style={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onCancel}
    >
      <motion.div
        style={styles.dialog}
        initial={{ opacity: 0, scale: 0.88, y: -24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          style={styles.icon}
          initial={{ scale: 0.5, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.05 }}
        >
          ⚠️
        </motion.div>
        <p style={styles.message}>{message}</p>
        <div style={styles.buttons}>
          <button style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button ref={confirmRef} style={styles.confirmBtn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dialog: {
    background: 'var(--window-bg)',
    borderTop: '2px solid var(--bevel-highlight)',
    borderLeft: '2px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-dark)',
    borderRight: '2px solid var(--bevel-dark)',
    borderRadius: 0,
    padding: '20px 24px',
    maxWidth: 320,
    boxShadow: '3px 3px 8px rgba(0,0,0,0.35)',
    textAlign: 'center' as const,
  },
  icon: {
    fontSize: 28,
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    marginBottom: 16,
  },
  buttons: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  cancelBtn: {
    fontSize: 12,
    padding: '6px 16px',
    borderTop: '2px solid var(--bevel-highlight)',
    borderLeft: '2px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-shadow)',
    borderRight: '2px solid var(--bevel-shadow)',
    borderRadius: 0,
    background: 'var(--pale-slate)',
    cursor: 'pointer',
  },
  confirmBtn: {
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 16px',
    borderTop: '2px solid #e87070',
    borderLeft: '2px solid #e87070',
    borderBottom: '2px solid #8a1a1a',
    borderRight: '2px solid #8a1a1a',
    borderRadius: 0,
    background: 'var(--close-hover)',
    color: '#fff',
    cursor: 'pointer',
  },
};
