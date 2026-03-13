import type { Position } from '../types';

const STAGGER_OFFSET = 24;
const ICON_SPACING = 90;
const LEFT_MARGIN = 16;
const TOP_MARGIN = 44;

// Module-level counter — intentionally persists across renders so each
// new window opens at a distinct staggered offset within the session.
let staggerCount = 0;

/** Return a staggered window position, cycling through 10 offsets per session.
 * @returns A position with x/y coordinates for the new window.
 */
export function getStaggeredPosition(): Position {
  const idx = staggerCount % 10;
  const x = 120 + idx * STAGGER_OFFSET;
  const y = 60 + idx * STAGGER_OFFSET;
  staggerCount++;
  return { x, y };
}

/** Compute the position for an icon in the left desktop column.
 * @param index - Zero-based row index of the icon.
 * @returns A position anchored to the left margin.
 */
export function getLeftColumnPosition(index: number): Position {
  return { x: LEFT_MARGIN, y: TOP_MARGIN + index * ICON_SPACING };
}

/** Compute the position for an icon in the right desktop column.
 * @param index - Zero-based row index of the icon.
 * @returns A position anchored to the right margin.
 */
export function getRightColumnPosition(index: number): Position {
  return { x: window.innerWidth - 80 - LEFT_MARGIN, y: TOP_MARGIN + index * ICON_SPACING };
}
