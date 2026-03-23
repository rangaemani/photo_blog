import { motion } from 'framer-motion';

export default function MapPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        gap: 12,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 48 }}>🗺️</span>
      <p style={{ fontSize: 14 }}>Map view coming soon.</p>
    </motion.div>
  );
}
