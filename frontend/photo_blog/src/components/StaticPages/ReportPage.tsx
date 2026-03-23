import { motion } from 'framer-motion';

export default function ReportContent() {
  return (
    <motion.div
      style={styles.container}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h1 style={styles.h1}>Report Something!</h1>
      <p style={styles.p}>
        Place for depositing bug reports or other feedback. 
      </p>
      <h2 style={styles.h2}>Report</h2>
      <p style={styles.p}>Feedback form coming soon.</p>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 640,
    margin: '0 auto',
    padding: 24,
    lineHeight: 1.6,
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 16,
    color: 'var(--text-primary)',
  },
  h2: {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 24,
    marginBottom: 8,
    color: 'var(--text-primary)',
  },
  p: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 12,
  },
};
