import { motion } from 'framer-motion';
import { useState } from 'react';

export default function AboutContent() {
  const [isOpen, setIsOpen] = useState(false);

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
      <h2 style={{ ...styles.h2, cursor: 'pointer' }} onClick={() => setIsOpen(!isOpen)}>
        Privacy Policy {isOpen ? '▼' : '▶'}
      </h2>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{ overflow: 'hidden' }}
      >
        <div style={styles.policyBody}>
          <p style={styles.policyNote}>
            <strong>TL;DR:</strong> This is my personal blog, and all photos pictured are my own intellectual property.
            If you’d like a photo, tag, or comment removed, feel free to make use of the report system.
          </p>
          <h3 style={styles.h3}>1. Overview</h3>
          <p style={styles.pp}>
            This is a personal, non-commercial photo journal operated by me. This Privacy Policy explains what information I collect and how I use it.
          </p>
          <h3 style={styles.h3}>2. Information Collected</h3>
          <p style={styles.pp}>I collect limited information necessary to operate the site:</p>
          <ul style={styles.ul}>
            <li>Email address (used for login via one-time password)</li>
            <li>User-submitted content (such as comments, reactions, and tags)</li>
            <li>Basic technical data (such as IP address or browser information, typically logged automatically for security and performance)</li>
          </ul>
          <h3 style={styles.h3}>3. How Information Is Used</h3>
          <p style={styles.pp}>I use this information only to:</p>
          <ul style={styles.ul}>
            <li>Authenticate users and provide access to features</li>
            <li>Display user-generated content (such as comments and tags)</li>
            <li>Maintain site functionality and prevent abuse</li>
          </ul>
          <p style={styles.pp}>I do not sell or share personal information with third parties.</p>
          <h3 style={styles.h3}>4. Public Content</h3>
          <p style={styles.pp}>
            This is a public website. Any content submitted (including comments, reactions, and tags) may be visible to others.
          </p>
          <h3 style={styles.h3}>5. Photos and Identification</h3>
          <p style={styles.pp}>Photos on this site may include identifiable individuals.</p>
          <p style={styles.pp}>
            Users may tag or identify people in photos. These identifications are user-generated and may not always be accurate.
          </p>
          <p style={styles.pp}>
            If you appear in a photo or are identified and would like content removed or corrected, you can use the report button on any photo or contact me directly (see below).
          </p>
          <h3 style={styles.h3}>6. Data Retention</h3>
          <p style={styles.pp}>
            I keep information only as long as necessary to operate the site. You may request deletion of your email or user content at any time.
          </p>
          <h3 style={styles.h3}>7. Security</h3>
          <p style={styles.pp}>
            I take reasonable measures to protect stored information, but no system is completely secure.
          </p>
          <h3 style={styles.h3}>8. Your Rights</h3>
          <p style={styles.pp}>You may request:</p>
          <ul style={styles.ul}>
            <li>Access to or deletion of your personal data</li>
            <li>Removal of photos or tags involving you</li>
          </ul>
          <p style={styles.pp}>I will make a good-faith effort to respond to all requests.</p>
          <h3 style={styles.h3}>9. Contact</h3>
          <p style={styles.pp}>
            For privacy-related requests or concerns, contact: [your email]
          </p>
        </div>
      </motion.div>
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
  policyBody: {
    padding: '4px 0 8px',
  },
  policyNote: {
    fontSize: 13,
    color: 'var(--text-primary)',
    background: 'var(--inset-bg)',
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    padding: '8px 10px',
    marginBottom: 12,
  },
  h3: {
    fontSize: 13,
    fontWeight: 600,
    marginTop: 14,
    marginBottom: 4,
    color: 'var(--text-primary)',
  },
  pp: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  ul: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    paddingLeft: 20,
    listStyle: 'disc',
  },
};
