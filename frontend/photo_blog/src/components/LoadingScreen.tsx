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
    background: '#fffdf8',
    borderRadius: 22,
    padding: '10px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  text: {
    fontSize: 14,
    color: '#555',
  },
};
