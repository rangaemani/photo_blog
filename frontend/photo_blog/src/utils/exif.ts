/** Format a raw EXIF focal length value into a human-readable string (e.g. "50mm").
 * @param raw - Raw focal length string, either a fraction like "50/1" or a plain number.
 * @returns Formatted string with "mm" suffix, or null if input is null.
 */
export function formatFocalLength(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)\/(\d+)$/);
  if (match) {
    const val = parseInt(match[1]) / parseInt(match[2]);
    return `${Math.round(val)}mm`;
  }
  if (/^\d+$/.test(raw)) return `${raw}mm`;
  return raw;
}

/** Format a raw EXIF aperture value into f-stop notation (e.g. "f/2.8").
 * @param raw - Raw aperture string, either a fraction like "28/10" or a plain number.
 * @returns Formatted f-stop string, or null if input is null.
 */
export function formatAperture(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('f/')) return raw;
  const match = raw.match(/^(\d+)\/(\d+)$/);
  if (match) {
    const val = parseInt(match[1]) / parseInt(match[2]);
    return `f/${val.toFixed(1).replace(/\.0$/, '')}`;
  }
  return `f/${raw}`;
}

/** Format a raw EXIF shutter speed into a display string (e.g. "1/250" or "2s").
 * @param raw - Raw shutter speed string, typically a fraction like "1/250".
 * @returns Formatted shutter speed, or null if input is null.
 */
export function formatShutterSpeed(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)\/(\d+)$/);
  if (match) {
    const num = parseInt(match[1]);
    const den = parseInt(match[2]);
    if (num >= den) return `${(num / den).toFixed(0)}s`;
  }
  return raw;
}

/** Format an ISO sensitivity value with the "ISO" prefix (e.g. "ISO 800").
 * @param iso - Numeric ISO value.
 * @returns Formatted ISO string, or null if input is null.
 */
export function formatISO(iso: number | null): string | null {
  if (iso == null) return null;
  return `ISO ${iso}`;
}

/** Format a byte count into a human-readable file size (KB or MB).
 * @param bytes - File size in bytes.
 * @returns Formatted size string (e.g. "350 KB" or "2.1 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Format an ISO date string into a localized short date (e.g. "Mar 16, 2026").
 * @param iso - ISO 8601 date string.
 * @returns Formatted date string, or null if input is null.
 */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
