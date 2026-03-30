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
 *
 * On desktop (≥600px), icons whose IDs are in `rightIds` are placed in a single
 * column anchored to the right edge. All other icons fill column-by-column from
 * the left.
 *
 * On mobile, `rightIds` is ignored and all icons flow in a single left-to-right grid.
 *
 * @param icons   - Ordered list of icons to position.
 * @param viewport - Current viewport dimensions.
 * @param rightIds - Set of icon IDs to place in the right-anchored column (desktop only).
 */
export function computeIconLayout(
  icons: { id: string }[],
  viewport: { width: number; height: number },
  rightIds?: ReadonlySet<string>,
): Map<string, Position> {
  const mobile = isMobile(viewport.width);
  const cellSize = mobile ? CELL_MOBILE : CELL_DESKTOP;
  const availableHeight = viewport.height - TOP_MARGIN - BOTTOM_MARGIN;
  const maxRows = Math.max(1, Math.floor(availableHeight / cellSize));

  const result = new Map<string, Position>();

  if (mobile || !rightIds?.size) {
    // Single grid: fill all icons left-to-right, column by column
    icons.forEach((icon, i) => {
      const col = Math.floor(i / maxRows);
      const row = i % maxRows;
      result.set(icon.id, {
        x: SIDE_MARGIN + col * cellSize,
        y: TOP_MARGIN + row * cellSize,
      });
    });
  } else {
    // Desktop two-zone layout: left column(s) + right-anchored column
    const leftIcons = icons.filter(ic => !rightIds.has(ic.id));
    const rightIcons = icons.filter(ic => rightIds.has(ic.id));

    leftIcons.forEach((icon, i) => {
      const col = Math.floor(i / maxRows);
      const row = i % maxRows;
      result.set(icon.id, {
        x: SIDE_MARGIN + col * cellSize,
        y: TOP_MARGIN + row * cellSize,
      });
    });

    const rightX = viewport.width - SIDE_MARGIN - cellSize;
    rightIcons.forEach((icon, i) => {
      result.set(icon.id, {
        x: rightX,
        y: TOP_MARGIN + i * cellSize,
      });
    });
  }

  return result;
}
