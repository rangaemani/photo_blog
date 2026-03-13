import { motion } from 'framer-motion';

export default function AboutContent() {
  return (
    <motion.div
      style={styles.container}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h1 style={styles.h1}>README.md</h1>
      <p style={styles.p}>
        Personal photoblog I made
      </p>
      <h2 style={styles.h2}>About</h2>
      <p style={styles.p}>
        Click around, why don't you
      </p>
      <h2 style={styles.h2}>Tech Stack</h2>
      <ul style={styles.ul}>
        <li>Frontend: React + TypeScript + Vite</li>
        <li>Backend: Django + Django REST Framework</li>
        <li>Blob Storage: Cloudflare R2</li>
        <li>Database: PostgreSQL</li>        
      </ul>
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
  ul: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    paddingLeft: 20,
    listStyle: 'disc',
  },
};
