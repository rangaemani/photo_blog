import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { DesktopIconState, ContextMenuState, ContextMenuItem } from '../../types';
import { useDropZone } from '../../hooks/useDropZone';
import DesktopIcon from './DesktopIcon';

interface Props {
  icons: DesktopIconState[];
  selectedIconId: string | null;
  isAdmin: boolean;
  onSelectIcon: (id: string | null) => void;
  onOpenIcon: (icon: DesktopIconState) => void;
  onMoveIcon: (id: string, x: number, y: number) => void;
  onRenameIcon: (id: string, label: string) => void;
  onDeleteIcon: (id: string) => void;
  onNewFolder: (position: { x: number; y: number }) => string | Promise<string>;
  onHover: (text: string) => void;
  onHoverEnd: () => void;
  onContextMenu: (menu: ContextMenuState) => void;
  children: React.ReactNode;
}

/**
 * The desktop surface — full-screen backdrop that hosts icons and windows.
 *
 * Registers as a drop zone for photo drags. Provides right-click context menu
 * (New Window, New Folder, Snap to Grid) and delegates icon interactions to
 * `DesktopIcon`. On folder creation, auto-enters rename mode.
 */
export default function Desktop({
  icons, selectedIconId, isAdmin, onSelectIcon, onOpenIcon, onMoveIcon, onRenameIcon, onDeleteIcon, onNewFolder,
  onHover, onHoverEnd, onContextMenu, children,
}: Props) {
  const { ref: desktopRef } = useDropZone('desktop');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const handleDesktopClick = () => {
    onSelectIcon(null);
    setRenamingId(null);
  };

  const handleNewFolder = useCallback(async (x: number, y: number) => {
    const id = await onNewFolder({ x, y });
    // Auto-enter rename mode on the newly created folder
    setRenamingId(id);
  }, [onNewFolder]);

  const GRID = 90;
  const snapAllToGrid = useCallback(() => {
    icons.forEach(ic => {
      const sx = Math.round(ic.position.x / GRID) * GRID;
      const sy = Math.round(ic.position.y / GRID) * GRID;
      if (sx !== ic.position.x || sy !== ic.position.y) onMoveIcon(ic.id, sx, sy);
    });
  }, [icons, onMoveIcon]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { label: 'New Window', action: () => onOpenIcon({ id: 'all-photos', label: 'All Photos', iconType: 'app', position: { x: 0, y: 0 }, action: { type: 'openGrid' } }) },
      { label: 'New Folder', action: () => handleNewFolder(e.clientX, e.clientY) },
      { label: '', divider: true },
      { label: 'Snap All to Grid', action: snapAllToGrid },
      { label: 'Change Background', disabled: true },
    ];
    onContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  return (
    <div
      ref={desktopRef as React.RefObject<HTMLDivElement>}
      className="desktop-noise"
      onClick={handleDesktopClick}
      onContextMenu={handleContextMenu}
      style={{ position: 'fixed', inset: 0 }}
    >
      <AnimatePresence>
        {icons.map(icon => (
          <DesktopIcon
            key={icon.id}
            icon={icon}
            isSelected={selectedIconId === icon.id}
            isRenaming={renamingId === icon.id}
            isAdmin={isAdmin}
            onSelect={onSelectIcon}
            onOpen={onOpenIcon}
            onMove={onMoveIcon}
            onRename={onRenameIcon}
            onDelete={onDeleteIcon}
            onStartRename={setRenamingId}
            onStopRename={() => setRenamingId(null)}
            onContextMenu={onContextMenu}
            onHover={onHover}
            onHoverEnd={onHoverEnd}
          />
        ))}
      </AnimatePresence>
      {children}
    </div>
  );
}
