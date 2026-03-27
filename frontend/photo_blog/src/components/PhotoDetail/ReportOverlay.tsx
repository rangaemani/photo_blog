import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TagItem, PopTagItem, CommentItem } from '../../types';
import { reportPhoto, type ReportTarget } from '../../api/client';

interface Props {
  photoSlug: string;
  tags: TagItem[];
  popTags: PopTagItem[];
  comments: CommentItem[];
  onClose: () => void;
  onReported: () => void;
}

type Step = 'select' | 'confirm' | 'success';

const BTN: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 12px',
  borderTop: '1px solid var(--bevel-highlight)',
  borderLeft: '1px solid var(--bevel-highlight)',
  borderBottom: '1px solid var(--bevel-shadow)',
  borderRight: '1px solid var(--bevel-shadow)',
  background: 'var(--pale-slate)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const BTN_PRIMARY: React.CSSProperties = { ...BTN, fontWeight: 700 };

export default function ReportOverlay({ photoSlug, tags, popTags, comments, onClose, onReported }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildTargets(): ReportTarget[] {
    const targets: ReportTarget[] = [];
    for (const key of selected) {
      if (key === 'image') targets.push({ type: 'image' });
      else if (key.startsWith('tag:')) targets.push({ type: 'tag', id: key.slice(4) });
      else if (key.startsWith('pop_tag:')) targets.push({ type: 'pop_tag', id: key.slice(8) });
      else if (key.startsWith('comment:')) targets.push({ type: 'comment', id: key.slice(8) });
    }
    return targets;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await reportPhoto(photoSlug, buildTargets(), reason);
      setStep('success');
      setTimeout(() => onReported(), 2000);
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const hasItems = tags.length > 0 || popTags.length > 0 || comments.length > 0;

  return (
    <div style={styles.overlay}>
      {/* Title bar */}
      <div style={styles.titleBar}>
        <span style={styles.titleText}>
          {step === 'select' && 'Report content'}
          {step === 'confirm' && 'Confirm report'}
          {step === 'success' && 'Report submitted'}
        </span>
        {step !== 'success' && (
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.15 }}
            style={styles.body}
          >
            <p style={styles.intro}>
              Select what you'd like to report. The photo will be temporarily hidden while we review it.
            </p>

            <div style={styles.checkList}>
              <label style={styles.checkRow}>
                <input type="checkbox" checked={selected.has('image')} onChange={() => toggle('image')} />
                <span style={styles.checkLabel}>
                  <strong>The photo itself</strong>
                </span>
              </label>

              {hasItems && (
                <div style={styles.sectionDivider}>User-generated content</div>
              )}

              {tags.map(tag => (
                <label key={tag.id} style={styles.checkRow}>
                  <input type="checkbox" checked={selected.has(`tag:${tag.id}`)} onChange={() => toggle(`tag:${tag.id}`)} />
                  <span style={styles.checkLabel}>Tag: <em>#{tag.text}</em></span>
                </label>
              ))}
              {popTags.map(pt => (
                <label key={pt.id} style={styles.checkRow}>
                  <input type="checkbox" checked={selected.has(`pop_tag:${pt.id}`)} onChange={() => toggle(`pop_tag:${pt.id}`)} />
                  <span style={styles.checkLabel}>Label: <em>"{pt.label}"</em></span>
                </label>
              ))}
              {comments.map(c => (
                <label key={c.id} style={styles.checkRow}>
                  <input type="checkbox" checked={selected.has(`comment:${c.id}`)} onChange={() => toggle(`comment:${c.id}`)} />
                  <span style={styles.checkLabel}>
                    Comment by <em>{c.display_name}</em>: "{c.text.slice(0, 35)}{c.text.length > 35 ? '…' : ''}"
                  </span>
                </label>
              ))}
            </div>

            <div style={styles.reasonWrap}>
              <label style={styles.reasonLabel}>Reason <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="text"
                placeholder="Briefly describe the issue…"
                maxLength={500}
                value={reason}
                onChange={e => setReason(e.target.value)}
                style={styles.reasonInput}
              />
            </div>

            <div style={styles.actions}>
              <button style={BTN} onClick={onClose}>Cancel</button>
              <button
                style={{ ...BTN_PRIMARY, opacity: selected.size === 0 ? 0.45 : 1, cursor: selected.size === 0 ? 'default' : 'pointer' }}
                disabled={selected.size === 0}
                onClick={() => setStep('confirm')}
              >
                Continue →
              </button>
            </div>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            style={styles.body}
          >
            <div style={styles.confirmBox}>
              <div style={styles.confirmIcon}>⚠</div>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 12 }}>Are you sure?</p>
                <p style={{ margin: '0 0 6px', fontSize: 12, lineHeight: 1.5 }}>
                  Submitting this report will immediately hide this photo from the blog
                  while it's reviewed. This helps keep the site safe for everyone.
                </p>
                <p style={{ margin: 0, fontSize: 12 }}>
                  You selected <strong>{selected.size} item{selected.size !== 1 ? 's' : ''}</strong> to report.
                  {reason && <> Reason: "{reason}"</>}
                </p>
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.actions}>
              <button style={BTN} onClick={() => setStep('select')} disabled={submitting}>← Go Back</button>
              <button
                style={{ ...BTN_PRIMARY, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{ ...styles.body, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}
          >
            <div style={{ fontSize: 28 }}>✓</div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Report received
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The photo has been hidden and is under review. Thank you for helping keep things tidy.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'var(--platinum)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px 6px 12px',
    borderBottom: '2px solid var(--groove-dark)',
    background: 'var(--toolbar-bg)',
    flexShrink: 0,
  },
  titleText: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 11,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 14px 12px',
    gap: 8,
    overflow: 'hidden',
    minHeight: 0,
  },
  intro: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    flexShrink: 0,
  },
  checkList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    paddingRight: 2,
  },
  sectionDivider: {
    fontSize: 10,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: 4,
    paddingTop: 4,
    borderTop: '1px solid var(--groove-dark)',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    cursor: 'pointer',
  },
  checkLabel: {
    fontSize: 12,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  },
  reasonWrap: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  reasonInput: {
    fontSize: 11,
    padding: '3px 5px',
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    background: 'var(--inset-bg)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  confirmBox: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    background: 'var(--inset-bg)',
    padding: '10px 12px',
    flex: 1,
    color: 'var(--text-primary)',
  },
  confirmIcon: {
    fontSize: 20,
    lineHeight: 1,
    flexShrink: 0,
    color: '#b06000',
  },
  error: {
    fontSize: 11,
    color: '#c00',
    flexShrink: 0,
  },
};
