import type { PhotoDetail } from '../../types';
import {
  formatFocalLength, formatAperture, formatShutterSpeed,
  formatISO, formatFileSize, formatDate,
} from '../../utils/exif';

interface Props {
  photo: PhotoDetail;
  padded?: boolean;
}

/** Compact EXIF strip rendered inside the photo frame mat or meta panel. */
export default function ExifStrip({ photo, padded = false }: Props) {
  const camera = [photo.camera_make, photo.camera_model].filter(Boolean).join(' ');
  const focal = formatFocalLength(photo.focal_length);
  const aperture = formatAperture(photo.aperture);
  const shutter = formatShutterSpeed(photo.shutter_speed);
  const iso = formatISO(photo.iso);
  const date = formatDate(photo.taken_at);
  const dims = `${photo.width}×${photo.height}`;
  const size = formatFileSize(photo.file_size);

  const settingsParts = [focal, aperture, shutter, iso].filter(Boolean);
  const hasAnything = camera || settingsParts.length > 0 || date;

  if (!hasAnything) return null;

  return (
    <div style={{ ...styles.container, padding: padded ? '0 28px' : 0 }}>
      <div style={styles.separator} />
      <div style={styles.row}>
        <div style={styles.left}>
          {camera && <span style={styles.camera}>{camera}</span>}
          {photo.lens && camera && <span style={styles.dot}>·</span>}
          {photo.lens && <span style={styles.text}>{photo.lens}</span>}
        </div>
        <div style={styles.right}>
          {settingsParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span style={styles.dot}>·</span>}
              <span style={styles.text}>{part}</span>
            </span>
          ))}
        </div>
      </div>
      <div style={styles.row}>
        <span style={styles.text}>{dims} · {size}</span>
        {date && <span style={styles.text}>{date}</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {    
    padding: '0px',
  },
  separator: {
    height: 0,
    borderTop: '1px solid var(--groove-dark)',
    borderBottom: '1px solid var(--groove-light)',
    margin: '8px 0 6px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    minHeight: 14,
    flexWrap: 'wrap',
  },
  left: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    flex: '1 1 auto',
    minWidth: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 0,
    flexShrink: 0,
  },
  camera: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--slate-grey)',
    letterSpacing: 0.3,
    whiteSpace: 'nowrap',
  },
  text: {
    fontSize: 10,
    color: 'var(--pale-slate-2)',
    fontFamily: 'ui-monospace, "SF Mono", monospace',
    whiteSpace: 'nowrap',
  },
  dot: {
    fontSize: 10,
    color: 'var(--pale-slate-2)',
    margin: '0 3px',
  },
};
