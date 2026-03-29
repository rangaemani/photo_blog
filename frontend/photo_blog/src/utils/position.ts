import type { Position } from '../types';

const STAGGER_OFFSET = 24;
const MOBILE_BREAKPOINT = 600;
const CELL_DESKTOP = 90;
const CELL_MOBILE = 80;
const TOP_MARGIN = 44;
const BOTTOM_MARGIN = 30;
const SIDE_MARGIN = 16;

// Module-level counter — intentionally persists across renders so each
// new window opens at a distinct staggered offset within the session.
let staggerCount = 0;

/** Return a staggered window position, cycling through 10 offsets per session. */
export function getStaggeredPosition(): Position {
  const idx = staggerCount % 10;
  const x = 120 + idx * STAGGER_OFFSET;
  const y = 60 + idx * STAGGER_OFFSET;
  staggerCount++;
  return { x, y };
}

/** True when the viewport width is below the mobile breakpoint. */
export function isMobile(width?: number): boolean {
  return (width ?? window.innerWidth) < MOBILE_BREAKPOINT;
}

/**
 * Assign grid positions to an ordered list of icons based on the current viewport.
 * Fills column-by-column, top-to-bottom (Win98 auto-arrange style).
 *
 * @param icons - Ordered list of icons to position.
 * @param viewport - Current viewport dimensions.
 * @returns Map from icon id to computed position.
 */
export function computeIconLayout(
  icons: { id: string }[],
  viewport: { width: number; height: number },
): Map<string, Position> {
  const mobile = isMobile(viewport.width);
  const cellSize = mobile ? CELL_MOBILE : CELL_DESKTOP;
  const availableHeight = viewport.height - TOP_MARGIN - BOTTOM_MARGIN;
  const maxRows = Math.max(1, Math.floor(availableHeight / cellSize));

  const result = new Map<string, Position>();
  icons.forEach((icon, i) => {
    const col = Math.floor(i / maxRows);
    const row = i % maxRows;
    result.set(icon.id, {
      x: SIDE_MARGIN + col * cellSize,
      y: TOP_MARGIN + row * cellSize,
    });
  });
  return result;
}
