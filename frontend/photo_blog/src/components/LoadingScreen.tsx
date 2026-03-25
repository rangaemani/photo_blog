import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  visible: boolean;
}

export default function LoadingScreen({ visible }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={styles.overlay}
          className="desktop-noise"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={styles.pill}
          >
            <span style={{ fontSize: 16 }}>&#9203;</span>
            <span style={styles.text}>Developing photos...</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30000,
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--platinum)',
    borderTop: '2px solid var(--bevel-highlight)',
    borderLeft: '2px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-dark)',
    borderRight: '2px solid var(--bevel-dark)',
    borderRadius: 0,
    padding: '10px 28px',
    boxShadow: '2px 2px 6px rgba(0,0,0,0.3)',
  },
  text: {
    fontSize: 14,
    color: 'var(--text-secondary)',
  },
};
