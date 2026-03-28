import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminReports, actionReport, type AdminReport } from '../../api/client';
import { icons } from '../../lib/win98Icons';

interface Props {
  onChanged: () => void;
}

type DragState = {
  report: AdminReport;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null;

type DropZone = 'dismiss' | 'delete' | null;

const CARD_W = 160;
const CARD_H = 130;

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function targetLabel(targets: AdminReport['targets']): string {
  const types = [...new Set(targets.map(t => t.type))];
  return types.map(t => ({ image: 'Photo', tag: 'Tag', pop_tag: 'Label', comment: 'Comment' }[t])).join(', ');
}

export default function ReportsWindow({ onChanged }: Props) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drag, setDrag] = useState<DragState>(null);
  const [hoverZone, setHoverZone] = useState<DropZone>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminReports();
      setReports(data);
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stagger cards in a natural pile
  function cardOffset(i: number, total: number): { x: number; y: number; rotate: number } {
    // spread across center with slight fanning
    const spread = Math.min(total - 1, 6);
    const slot = total <= 1 ? 0 : (i / Math.max(spread, 1)) - 0.5;
    return {
      x: slot * 18,
      y: -i * 3,
      rotate: slot * 7,
    };
  }

  function getZoneFromPoint(x: number, y: number): DropZone {
    for (const [ref, zone] of [[dismissRef, 'dismiss'], [deleteRef, 'delete']] as const) {
      const rect = ref.current?.getBoundingClientRect();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return zone;
      }
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent, report: AdminReport) {
    if (processing.has(report.id)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ report, startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const updated = { ...drag, currentX: e.clientX, currentY: e.clientY };
    setDrag(updated);
    setHoverZone(getZoneFromPoint(e.clientX, e.clientY));
  }

  async function handlePointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const zone = getZoneFromPoint(e.clientX, e.clientY);
    const { report } = drag;
    setDrag(null);
    setHoverZone(null);

    if (!zone) return;

    setProcessing(prev => new Set(prev).add(report.id));
    setDismissed(prev => new Set(prev).add(report.id));

    try {
      await actionReport(report.id, zone === 'dismiss' ? 'dismiss' : 'delete');
      // Small delay so the exit animation plays, then remove
      setTimeout(() => {
        setReports(prev => prev.filter(r => r.id !== report.id));
        setDismissed(prev => { const s = new Set(prev); s.delete(report.id); return s; });
        setProcessing(prev => { const s = new Set(prev); s.delete(report.id); return s; });
        onChanged();
      }, 400);
    } catch {
      setProcessing(prev => { const s = new Set(prev); s.delete(report.id); return s; });
      setDismissed(prev => { const s = new Set(prev); s.delete(report.id); return s; });
    }
  }

  const visibleReports = reports.filter(r => !dismissed.has(r.id));
  const isDragging = drag !== null;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
        Loading reports...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)' }}>
        <img src={icons.lg.warning} alt="" style={{ width: 32, height: 32, imageRendering: 'pixelated', opacity: 0.4 }} />
        <span style={{ fontSize: 13 }}>No pending reports</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={styles.root}
      onPointerMove={isDragging ? handlePointerMove : undefined}
      onPointerUp={isDragging ? handlePointerUp : undefined}
    >
      {/* Header count */}
      <div style={styles.header}>
        {visibleReports.length} pending report{visibleReports.length !== 1 ? 's' : ''}
        <span style={styles.headerHint}>— drag cards to a folder to act</span>
      </div>

      {/* Pile area */}
      <div style={styles.pileArea}>
        <AnimatePresence>
          {visibleReports.map((report, i) => {
            const { x, y, rotate } = cardOffset(i, visibleReports.length);
            const isDragTarget = drag?.report.id === report.id;
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, scale: 0.8, y: -30 }}
                animate={dismissed.has(report.id)
                  ? { opacity: 0, scale: 0.7, y: -20 }
                  : { opacity: isDragTarget ? 0.3 : 1, scale: 1, x, y, rotate }
                }
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                style={{
                  ...styles.card,
                  zIndex: i + 1,
                  cursor: processing.has(report.id) ? 'wait' : 'grab',
                  position: 'absolute',
                  userSelect: 'none',
                }}
                onPointerDown={(e) => handlePointerDown(e, report)}
              >
                <img
                  src={report.photo_thumbnail_url}
                  alt={report.photo_title}
                  style={styles.thumb}
                  draggable={false}
                />
                <div style={styles.cardBody}>
                  <div style={styles.cardTitle}>{report.photo_title}</div>
                  <div style={{ ...styles.cardMeta, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <img src={icons.sm.warning} alt="" style={{ width: 12, height: 12, imageRendering: 'pixelated' }} />
                    {targetLabel(report.targets)}
                  </div>
                  {report.reason && (
                    <div style={styles.cardReason}>"{report.reason.slice(0, 40)}{report.reason.length > 40 ? '…' : ''}"</div>
                  )}
                  <div style={styles.cardTime}>{timeAgo(report.created_at)}</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Fixed drag ghost — follows cursor, bypasses framer-motion */}
      {drag && (
        <div style={{
          position: 'fixed',
          left: drag.currentX - CARD_W / 2,
          top: drag.currentY - CARD_H / 2,
          width: CARD_W,
          height: CARD_H,
          pointerEvents: 'none',
          zIndex: 9999,
          transform: 'rotate(3deg)',
          ...styles.card,
        }}>
          <img src={drag.report.photo_thumbnail_url} alt={drag.report.photo_title} style={styles.thumb} draggable={false} />
          <div style={styles.cardBody}>
            <div style={styles.cardTitle}>{drag.report.photo_title}</div>
            <div style={{ ...styles.cardMeta, display: 'flex', alignItems: 'center', gap: 3 }}>
              <img src={icons.sm.warning} alt="" style={{ width: 12, height: 12, imageRendering: 'pixelated' }} />
              {targetLabel(drag.report.targets)}
            </div>
          </div>
        </div>
      )}

      {/* Drop zones */}
      <div style={styles.dropRow}>
        <div
          ref={dismissRef}
          style={{ ...styles.dropZone, ...(hoverZone === 'dismiss' ? styles.dropZoneActive : {}) }}
        >
          <FolderSVG color={hoverZone === 'dismiss' ? '#b8d0b8' : '#c8c8c8'} />
          <span style={styles.dropLabel}>Dismiss</span>
          <span style={styles.dropSub}>Clear report, restore photo</span>
        </div>
        <div
          ref={deleteRef}
          style={{ ...styles.dropZone, ...(hoverZone === 'delete' ? styles.dropZoneActive : {}) }}
        >
          <FolderSVG color={hoverZone === 'delete' ? '#d0b8b8' : '#c8c8c8'} />
          <span style={styles.dropLabel}>Delete</span>
          <span style={styles.dropSub}>Trash the photo</span>
        </div>
      </div>
    </div>
  );
}

function FolderSVG({ color }: { color: string }) {
  return (
    <svg width="56" height="44" viewBox="0 0 56 44" fill="none">
      {/* folder back */}
      <rect x="0" y="10" width="56" height="34" fill={color} stroke="#888" strokeWidth="1" />
      {/* folder tab */}
      <path d="M0 10 L14 10 L18 4 L56 4 L56 10 Z" fill={color} stroke="#888" strokeWidth="1" />
      {/* bevel highlight top-left */}
      <line x1="1" y1="10" x2="1" y2="43" stroke="#fff" strokeWidth="1" />
      <line x1="0" y1="10" x2="56" y2="10" stroke="#fff" strokeWidth="1" />
      {/* bevel shadow bottom-right */}
      <line x1="55" y1="10" x2="55" y2="44" stroke="#888" strokeWidth="1" />
      <line x1="0" y1="43" x2="56" y2="43" stroke="#888" strokeWidth="1" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--pale-slate)',
    userSelect: 'none',
  },
  header: {
    fontSize: 12,
    color: 'var(--text-primary)',
    padding: '8px 14px 6px',
    borderBottom: '1px solid var(--groove-dark)',
    background: 'var(--platinum)',
    flexShrink: 0,
  },
  headerHint: {
    color: 'var(--text-muted)',
    marginLeft: 6,
  },
  pileArea: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    background: 'var(--bright-snow, #fff)',
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-shadow)',
    borderRight: '2px solid var(--bevel-shadow)',
    boxShadow: '2px 4px 8px rgba(0,0,0,0.18)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  thumb: {
    width: '100%',
    height: 70,
    objectFit: 'cover',
    display: 'block',
    flexShrink: 0,
  },
  cardBody: {
    padding: '4px 6px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    fontSize: 10,
    color: '#b06000',
  },
  cardReason: {
    fontSize: 10,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontStyle: 'italic',
  },
  cardTime: {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 'auto',
  },
  dropRow: {
    display: 'flex',
    gap: 24,
    padding: '12px 24px 16px',
    justifyContent: 'center',
    borderTop: '2px solid var(--groove-dark)',
    background: 'var(--platinum)',
    flexShrink: 0,
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 16px',
    minWidth: 100,
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    background: 'var(--pale-slate)',
    transition: 'background 100ms',
  },
  dropZoneActive: {
    background: 'var(--alabaster-grey)',
  },
  dropLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  dropSub: {
    fontSize: 10,
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
  },
};
