import { motion } from 'framer-motion';
import type { PhotoDetail } from '../../types';
import {
  formatFocalLength, formatAperture, formatShutterSpeed,
  formatISO, formatFileSize, formatDate,
} from '../../utils/exif';

interface Props {
  photo: PhotoDetail;
}

interface ExifRow {
  label: string;
  value: string | null;
}

export default function ExifCard({ photo }: Props) {
  const camera = [photo.camera_make, photo.camera_model].filter(Boolean).join(' ');

  const leftRows: ExifRow[] = [
    { label: 'Camera', value: camera || null },
    { label: 'Lens', value: photo.lens },
    { label: 'Focal Length', value: formatFocalLength(photo.focal_length) },
    { label: 'Aperture', value: formatAperture(photo.aperture) },
    { label: 'Shutter', value: formatShutterSpeed(photo.shutter_speed) },
    { label: 'ISO', value: formatISO(photo.iso) },
  ].filter(r => r.value != null);

  const rightRows: ExifRow[] = [
    { label: 'Size', value: formatFileSize(photo.file_size) },
    { label: 'Dimensions', value: `${photo.width} \u00D7 ${photo.height}` },
    { label: 'Date', value: formatDate(photo.taken_at) },
  ].filter(r => r.value != null);

  if (leftRows.length === 0 && rightRows.length === 0) return null;

  const rowVariants = {
    hidden: { opacity: 0, x: -8 },
    show: (i: number) => ({
      opacity: 1, x: 0,
      transition: { delay: 0.15 + i * 0.03, type: 'spring' as const, stiffness: 400, damping: 28 },
    }),
  };

  return (
    <motion.div
      style={styles.container}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.25 }}
    >
      {leftRows.length > 0 && (
        <div style={styles.column}>
          {leftRows.map((row, i) => (
            <motion.div key={row.label} style={styles.row} custom={i} variants={rowVariants} initial="hidden" animate="show">
              <span style={styles.label}>{row.label}</span>
              <span style={styles.value}>{row.value}</span>
            </motion.div>
          ))}
        </div>
      )}
      {rightRows.length > 0 && (
        <div style={styles.column}>
          {rightRows.map((row, i) => (
            <motion.div key={row.label} style={styles.row} custom={leftRows.length + i} variants={rowVariants} initial="hidden" animate="show">
              <span style={styles.label}>{row.label}</span>
              <span style={styles.value}>{row.value}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: 24,
    marginTop: 16,
    padding: 12,
    border: '1px solid var(--window-border)',
    borderRadius: 6,
    background: '#faf8f4',
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  value: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontFamily: 'ui-monospace, monospace',
  },
};
