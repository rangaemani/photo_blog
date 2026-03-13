import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastMessage {
  id: number;
  text: string;
  type?: 'error' | 'info';
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  return (
    <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isError = toast.type === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{
        padding: '8px 16px',
        borderRadius: 6,
        background: isError ? '#3a1a1a' : 'var(--window-bg)',
        color: isError ? '#f5a5a5' : 'var(--text-primary)',
        border: `1px solid ${isError ? '#5a2a2a' : 'var(--window-border)'}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        fontSize: 13,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.text}
    </motion.div>
  );
}
