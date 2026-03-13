import type { ContextMenuItem, ContextMenuState } from '../types';
import type React from 'react';

export type ContextMenuOption = ContextMenuItem & {
  /** If false, the option will be excluded from the resulting menu. */
  visible?: boolean;
};

/** Filter and strip visibility metadata from context menu options.
 * @param options - Menu options, each optionally gated by a `visible` flag.
 * @returns Clean ContextMenuItem array with non-visible entries removed.
 */
export function buildContextMenuItems(options: ContextMenuOption[]): ContextMenuItem[] {
  return options
    .filter((option) => option.visible !== false)
    .map(({ visible: _, ...item }) => item);
}

/** Create a right-click handler that opens a context menu at the cursor position.
 * @param options - Menu options to display (filtered by visibility).
 * @param onContextMenu - Callback to set the context menu state.
 * @returns A React mouse-event handler for the `onContextMenu` prop.
 */
export function createContextMenuHandler(
  options: ContextMenuOption[],
  onContextMenu: (menu: ContextMenuState) => void,
) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items = buildContextMenuItems(options);

    onContextMenu({ x: e.clientX, y: e.clientY, items });
  };
}
