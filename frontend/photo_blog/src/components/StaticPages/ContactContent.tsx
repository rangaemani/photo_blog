import { motion } from 'framer-motion';

export default function ContactContent() {
  return (
    <motion.div
      style={styles.container}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h1 style={styles.h1}>Contact</h1>
      <p style={styles.p}>
        Say hello !
      </p>
      <div style={styles.links}>        
        <a href="https://github.com/rangaemani" target="_blank" rel="noopener noreferrer" style={styles.link}>GitHub</a>
        <a href="https://ranga.me" target="_blank" rel="noopener noreferrer" style={styles.link}>Website</a>
      </div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: 24,
    textAlign: 'center',
    lineHeight: 1.6,
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 16,
    color: 'var(--text-primary)',
  },
  p: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 24,
  },
  links: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
    color: 'var(--accent)',
    textDecoration: 'none',
  },
};
