import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PhotoDetail } from '../../types';
import {
  formatFocalLength, formatAperture, formatShutterSpeed,
  formatISO, formatFileSize, formatDate,
} from '../../utils/exif';

interface Props {
  photo: PhotoDetail;
}

export default function ExifCard({ photo }: Props) {
  const [open, setOpen] = useState(false);

  const camera = [photo.camera_make, photo.camera_model].filter(Boolean).join(' ');
  const focal = formatFocalLength(photo.focal_length);
  const aperture = formatAperture(photo.aperture);
  const shutter = formatShutterSpeed(photo.shutter_speed);
  const iso = formatISO(photo.iso);
  const date = formatDate(photo.taken_at);

  // Summary chips: compact one-liner shown when collapsed
  const summaryParts = [
    camera || null,
    [focal, aperture, shutter, iso].filter(Boolean).join(' · ') || null,
    date,
  ].filter(Boolean) as string[];

  if (summaryParts.length === 0) return null;

  const rows = [
    { label: 'Camera', value: camera || null },
    { label: 'Lens', value: photo.lens },
    { label: 'Focal Length', value: focal },
    { label: 'Aperture', value: aperture },
    { label: 'Shutter', value: shutter },
    { label: 'ISO', value: iso },
    { label: 'Date', value: date },
    { label: 'Dimensions', value: `${photo.width} × ${photo.height}` },
    { label: 'File Size', value: formatFileSize(photo.file_size) },
  ].filter(r => r.value != null) as { label: string; value: string }[];

  return (
    <div style={styles.container}>
      {/* Collapsed summary row — always visible */}
      <button style={styles.summary} onClick={() => setOpen(o => !o)}>
        <span style={styles.summaryText}>
          {summaryParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span style={styles.dot}>·</span>}
              {part}
            </span>
          ))}
        </span>
        <span style={{ ...styles.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      </button>

      {/* Expanded grid */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            style={styles.grid}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {rows.map(row => (
              <div key={row.label} style={styles.row}>
                <span style={styles.label}>{row.label}</span>
                <span style={styles.value}>{row.value}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 8,
    marginBottom: 2,
    border: '1px solid var(--window-border)',
    borderRadius: 6,
    background: '#faf8f4',
    overflow: 'hidden',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '5px 10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    gap: 8,
  },
  summaryText: {
    fontSize: 11,
    color: 'var(--text-muted)',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0 4px',
    lineHeight: 1.5,
  },
  dot: {
    margin: '0 2px',
    opacity: 0.4,
  },
  chevron: {
    fontSize: 11,
    color: 'var(--text-muted)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  grid: {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    padding: '4px 10px 8px',
    borderTop: '1px solid var(--window-border)',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 11,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  value: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    fontFamily: 'ui-monospace, monospace',
    textAlign: 'right' as const,
  },
};
