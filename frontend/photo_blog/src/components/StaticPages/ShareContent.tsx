import { useState } from 'react';
import { motion } from 'framer-motion';
import { shareLayout } from '../../api/client';

interface Props {
  onExport: () => string;
  onShowToast: (text: string, type?: 'info' | 'error') => void;
}

export default function ShareContent({ onExport, onShowToast }: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const base64 = onExport();
      const blob = JSON.parse(atob(base64));
      const { slug } = await shareLayout(blob);
      const url = `${window.location.origin}?layout=${slug}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      onShowToast('Link copied to clipboard!');
    } catch {
      onShowToast('Failed to create share link', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    onShowToast('Link copied to clipboard!');
  };

  return (
    <motion.div
      style={styles.container}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h1 style={styles.h1}>Share Desktop</h1>
      <p style={styles.p}>
        Generate a link to share your current desktop layout — icon positions, folders, and their contents.
        Anyone who opens the link will see your arrangement.
      </p>

      <button
        style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
        onClick={handleShare}
        disabled={loading}
      >
        {loading ? 'Creating link...' : shareUrl ? 'Regenerate Link' : 'Create Share Link'}
      </button>

      {shareUrl && (
        <div style={styles.urlBox}>
          <input
            style={styles.urlInput}
            value={shareUrl}
            readOnly
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <button style={styles.copyBtn} onClick={handleCopy}>Copy</button>
        </div>
      )}

      <p style={styles.hint}>
        Links are based on content — the same layout always produces the same link.
        Layouts are stored for 30 days.
      </p>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: 24,
    lineHeight: 1.6,
  },
  h1: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
    color: 'var(--text-primary)',
  },
  p: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 16,
  },
  hint: {
    fontSize: 11,
    color: 'var(--text-muted, #999)',
    marginTop: 12,
  },
  btn: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid var(--accent)',
    borderRadius: 6,
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  urlBox: {
    display: 'flex',
    gap: 6,
    marginTop: 16,
  },
  urlInput: {
    flex: 1,
    padding: '6px 10px',
    fontSize: 12,
    fontFamily: 'ui-monospace, monospace',
    border: '1px solid var(--window-border)',
    borderRadius: 4,
    background: 'var(--window-bg)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  copyBtn: {
    padding: '6px 12px',
    fontSize: 12,
    border: '1px solid var(--window-border)',
    borderRadius: 4,
    background: 'var(--window-bg)',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
};
