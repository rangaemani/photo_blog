import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { ActiveDrag, Category, DesktopIconState, ContextMenuState, WindowState, PhotoRef, PhotoListItem } from './types';
import { getCategories, createCategory, deleteCategory, trashPhotos, patchPhotoCategory, getSharedLayout, downloadPhotos } from './api/client';
import { useWindowManager } from './hooks/useWindowManager';
import { usePhotos } from './hooks/usePhotos';
import { useSelection } from './hooks/useSelection';
import { useDesktopState } from './hooks/useDesktopState';
import { useWidgetState } from './hooks/useWidgetState';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { DragDropProvider } from './contexts/DragDropContext';
import { SoundProvider, useSoundContext } from './contexts/SoundContext';

import MenuBar from './components/MenuBar/MenuBar';
import WidgetLayer from './components/Widgets/WidgetLayer';
import Desktop from './components/Desktop/Desktop';
import Window from './components/Window/Window';
import WindowToolbar from './components/Window/WindowToolbar';
import StatusBar from './components/StatusBar';
import ContextMenu from './components/ContextMenu';
import LoadingScreen from './components/LoadingScreen';
import PhotoGrid from './components/PhotoGrid/PhotoGrid';
import PhotoDetailView from './components/PhotoDetail/PhotoDetail';
import LoginContent from './components/Auth/LoginContent';
import UploadWindow from './components/Upload/UploadWindow';
import TrashWindow from './components/Trash/TrashWindow';
import ReportsWindow from './components/Reports/ReportsWindow';
import AboutContent from './components/StaticPages/AboutContent';
import ContactContent from './components/StaticPages/ContactContent';
import MapContent from './components/StaticPages/MapPlaceholder';
import ToastContainer, { type ToastMessage } from './components/Toast';
import Throbber from './components/Throbber';
import ShareContent from './components/StaticPages/ShareContent';

export default function App() {
  return (
    <AuthProvider>
      <SoundProvider>
        <AppInner />
      </SoundProvider>
    </AuthProvider>
  );
}

function AppInner() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [gridColumns, setGridColumns] = useState(3);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, text, type }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  const [selectMode, setSelectMode] = useState(false);
  const [busyWindows, setBusyWindows] = useState<Record<string, 'downloading' | 'trashing' | 'sorting'>>({});

  const wm = useWindowManager();
  const photos = usePhotos();
  const selection = useSelection();
  const auth = useAuthContext();
  const { isAuthenticated } = auth;
  const desktop = useDesktopState(categories);
  const widgets = useWidgetState();
  const sound = useSoundContext();

  // Initial load: fetch categories
  useEffect(() => {
    getCategories().then(cats => {
      setCategories(cats);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  // Import shared layout from URL param (e.g. ?layout=abc1234567)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('layout');
    if (!slug || categories.length === 0) return;
    getSharedLayout(slug).then((data) => {
      const blob = data as { version?: number; icons?: unknown[]; folders?: Record<string, unknown[]> };
      if (blob.version === 1 && Array.isArray(blob.icons)) {
        // Encode as base64 for importBlob
        desktop.importBlob(btoa(JSON.stringify(blob)));
        showToast('Loaded shared desktop layout!');
      }
    }).catch(() => {
      showToast('Could not load shared layout', 'error');
    }).finally(() => {
      // Strip the param from URL without reload
      params.delete('layout');
      const clean = params.toString();
      window.history.replaceState({}, '', clean ? `?${clean}` : window.location.pathname);
    });
  // Only run once when categories are ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  // === Window open helpers ===

  const openGridWindow = useCallback(async (categorySlug?: string, categoryName?: string) => {
    // Single-instance: if a window for this category is already open, focus it
    const existing = wm.windows.find(w =>
      w.windowType === 'grid' && w.gridPayload?.categorySlug === (categorySlug ?? null)
    );
    if (existing) { wm.focusWindow(existing.id); if (existing.isMinimized) wm.minimizeWindow(existing.id); return; }

    const title = categoryName ?? 'All Photos';

    sound.play('windowOpen');
    const id = wm.openWindow(title + ' — loading...', 'grid', {
      gridPayload: { categorySlug: categorySlug ?? null, photos: [], next: null, count: 0, isLoadingMore: false, order: 'desc' },
    });
    selection.clear();
    try {
      const grid = await photos.fetchGrid(categorySlug ?? null, 'desc', isAuthenticated);
      // Guest: merge locally-added photos on top of API results
      const folderId = categorySlug ? `cat-${categorySlug}` : null;
      const localPhotos = folderId ? desktop.getFolderContents(folderId) : [];
      if (!isAuthenticated && localPhotos.length > 0) {
        const extras: PhotoListItem[] = localPhotos
          .filter(lp => !grid.photos.some(p => p.id === lp.id))
          .map(lp => ({ ...lp, taken_at: null, category_slug: categorySlug ?? '', location_name: null, lat: null, lng: null, is_reported: false }));
        const merged = [...grid.photos, ...extras];
        wm.updateWindow(id, {
          title: `${title} — ${merged.length} photos`,
          gridPayload: { ...grid, photos: merged, count: merged.length },
        });
      } else {
        wm.updateWindow(id, {
          title: `${title} — ${grid.count} photos`,
          gridPayload: grid,
        });
      }
    } catch {
      wm.updateWindow(id, { title: `${title} — error` });
    }
  }, [wm, photos, selection, isAuthenticated, desktop, sound]);

  const openDetailWindow = useCallback(async (slug: string, parentWindowId?: string) => {
    const existing = wm.windows.find(w => w.windowType === 'detail' && w.detailPayload?.slug === slug);
    if (existing) { wm.focusWindow(existing.id); if (existing.isMinimized) wm.minimizeWindow(existing.id); return; }

    sound.play('shutter');
    const id = wm.openWindow('Loading...', 'detail', {
      detailPayload: { slug, photo: null, isLoading: true, parentWindowId },
    });

    try {
      const photo = await photos.fetchDetail(slug);
      wm.updateWindow(id, {
        title: photo.title || photo.slug,
        detailPayload: { slug, photo, isLoading: false, parentWindowId },
      });
    } catch {
      wm.updateWindow(id, {
        title: 'Error',
        detailPayload: { slug, photo: null, isLoading: false, parentWindowId },
      });
    }
  }, [wm, photos, sound]);

  const openStaticWindow = useCallback((key: 'about' | 'contact' | 'map-placeholder' | 'share') => {
    const existing = wm.windows.find(w => w.windowType === 'static' && w.staticPayload?.contentKey === key);
    if (existing) { wm.focusWindow(existing.id); if (existing.isMinimized) wm.minimizeWindow(existing.id); return; }
    sound.play('windowOpen');
    const titles: Record<string, string> = { about: 'README.md', contact: 'Contact', 'map-placeholder': 'Map', share: 'Share'};
    wm.openWindow(titles[key], 'static', { staticPayload: { contentKey: key } });
  }, [wm, sound]);

  const openLoginWindow = useCallback(() => {
    const existing = wm.windows.find(w => w.windowType === 'login');
    if (existing) { wm.focusWindow(existing.id); if (existing.isMinimized) wm.minimizeWindow(existing.id); return; }
    sound.play('windowOpen');
    wm.openWindow('Log In', 'login', {});
  }, [wm, sound]);

  const openUploadWindow = useCallback(() => {
    const existing = wm.windows.find(w => w.windowType === 'upload');
    if (existing) { wm.focusWindow(existing.id); if (existing.isMinimized) wm.minimizeWindow(existing.id); return; }
    sound.play('windowOpen');
    wm.openWindow('Upload Photos', 'upload', { uploadPayload: { files: [] } });
  }, [wm]);

  const openTrashWindow = useCallback(() => {
    const existing = wm.windows.find(w => w.windowType === 'trash');
    if (existing) { wm.focusWindow(existing.id); if (existing.isMinimized) wm.minimizeWindow(existing.id); return; }
    sound.play('windowOpen');
    wm.openWindow('Trash', 'trash', { trashPayload: { photos: [], next: null, count: 0, isLoading: true } });
  }, [wm, sound]);

  const openReportsWindow = useCallback(() => {
    const existing = wm.windows.find(w => w.windowType === 'reports');
    if (existing) { wm.focusWindow(existing.id); if (existing.isMinimized) wm.minimizeWindow(existing.id); return; }
    sound.play('windowOpen');
    wm.openWindow('Reports', 'reports', {});
  }, [wm, sound]);

  // === Icon handlers ===

  const handleOpenIcon = useCallback((icon: DesktopIconState) => {
    const action = icon.action;
    if (action.type === 'openGrid') {
      // Guest folders: populate from persisted folder contents
      if (icon.id.startsWith('guest-folder-')) {
        const refs = desktop.getFolderContents(icon.id);
        const folderPhotos: PhotoListItem[] = refs.map(r => ({ ...r, taken_at: null, category_slug: '', location_name: null, lat: null, lng: null, is_reported: false }));
        sound.play('windowOpen');
        wm.openWindow(
          folderPhotos.length > 0 ? `${icon.label} — ${folderPhotos.length} photos` : icon.label,
          'grid',
          { gridPayload: { categorySlug: icon.id, photos: folderPhotos, next: null, count: folderPhotos.length, isLoadingMore: false, order: 'desc' } },
        );
        return;
      }
      const cat = categories.find(c => c.slug === action.categorySlug);
      openGridWindow(action.categorySlug, cat?.name);
    } else if (action.type === 'openTrash') {
      openTrashWindow();
    } else if (action.type === 'openDetail') {
      openDetailWindow(action.photoSlug);
    } else {
      openStaticWindow(action.contentKey);
    }
  }, [categories, wm, desktop, sound, openGridWindow, openStaticWindow, openTrashWindow, openDetailWindow]);

  // === Grid load more ===

  const handleLoadMore = useCallback(async (win: WindowState) => {
    if (!win.gridPayload?.next || win.gridPayload.isLoadingMore) return;

    wm.updateWindow(win.id, {
      gridPayload: { ...win.gridPayload, isLoadingMore: true },
    });

    try {
      const updated = await photos.fetchMore(win.gridPayload);
      wm.updateWindow(win.id, { gridPayload: updated });
    } catch {
      wm.updateWindow(win.id, {
        gridPayload: { ...win.gridPayload, isLoadingMore: false },
      });
    }
  }, [wm, photos]);

  // === Grid column toggle ===

  const toggleGridSize = useCallback(() => {
    setGridColumns(prev => {
      if (prev === 2) return 3;
      if (prev === 3) return 4;
      return 2;
    });
  }, []);

  // === Sort order toggle for grid windows ===

  const handleSortChange = useCallback(async (win: WindowState, order: 'asc' | 'desc') => {
    if (!win.gridPayload) return;
    const slug = win.gridPayload.categorySlug;
    if (slug?.startsWith('guest-folder-')) {
      wm.updateWindow(win.id, {
        gridPayload: { ...win.gridPayload, photos: [...win.gridPayload.photos].reverse(), order },
      });
      return;
    }
    setBusyWindows(prev => ({ ...prev, [win.id]: 'sorting' }));
    try {
      const grid = await photos.fetchGrid(slug, order, isAuthenticated);
      const cat = categories.find(c => c.slug === slug);
      wm.updateWindow(win.id, {
        title: `${cat?.name ?? 'All Photos'} — ${grid.count} photos`,
        gridPayload: grid,
      });
    } catch { /* leave as-is */ }
    finally {
      setBusyWindows(prev => { const n = { ...prev }; delete n[win.id]; return n; });
    }
  }, [wm, photos, categories]);

  // === Refresh all open windows after a mutation ===

  const refreshOpenWindows = useCallback(async () => {
    photos.invalidateAll();
    getCategories().then(setCategories).catch(() => {});
    for (const win of wm.windows) {
      if (win.windowType === 'grid') {
        const slug = win.gridPayload?.categorySlug ?? null;
        // Skip guest folder windows (they have no backend data to refresh)
        if (slug?.startsWith('guest-folder-')) continue;
        try {
          const grid = await photos.fetchGrid(slug, 'desc', isAuthenticated);
          const cat = categories.find(c => c.slug === slug);
          wm.updateWindow(win.id, {
            title: `${cat?.name ?? 'All Photos'} — ${grid.count} photos`,
            gridPayload: grid,
          });
        } catch { /* leave as-is on error */ }
      }
      if (win.windowType === 'trash' && win.trashPayload) {
        wm.updateWindow(win.id, {
          trashPayload: { ...win.trashPayload, isLoading: true },
        });
      }
    }
  }, [photos, wm, categories]);

  // === Trash selected photos ===

  const handleTrashSelected = useCallback(async (win: WindowState) => {
    if (selection.selectedCount === 0 || !win.gridPayload) return;

    const idsToTrash = new Set(selection.selectedIds);
    setBusyWindows(prev => ({ ...prev, [win.id]: 'trashing' }));
    try {
      await trashPhotos([...idsToTrash]);
      selection.clear();
      await refreshOpenWindows();
    } catch {
      showToast('Failed to trash photos', 'error');
    } finally {
      setBusyWindows(prev => { const n = { ...prev }; delete n[win.id]; return n; });
    }
  }, [selection, refreshOpenWindows, showToast]);

  const handleDownloadSelected = useCallback(async (win: WindowState) => {
    if (selection.selectedCount === 0) return;
    setBusyWindows(prev => ({ ...prev, [win.id]: 'downloading' }));
    try {
      const { blob, filename } = await downloadPhotos([...selection.selectedIds]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setBusyWindows(prev => { const n = { ...prev }; delete n[win.id]; return n; });
    }
  }, [selection, showToast]);

  // === Drag-drop handlers ===

  /** Look up a photo's title from any open grid window. */
  const findPhotoTitle = useCallback((photoId: string): string => {
    for (const win of wm.windows) {
      if (win.gridPayload) {
        const photo = win.gridPayload.photos.find(p => p.id === photoId);
        if (photo) return photo.title;
      }
    }
    return 'Photo';
  }, [wm.windows]);

  const handleDropToDesktop = useCallback((drag: ActiveDrag, pos: { x: number; y: number }) => {
    sound.play('drop');
    if (drag.sourceKind === 'desktop-icon') {
      desktop.moveIcon(drag.photoId, pos.x, pos.y);
    } else {
      const title = findPhotoTitle(drag.photoId);
      desktop.addPhotoIcon(drag.photoId, drag.photoSlug, title, drag.thumbnailUrl, pos);
    }
  }, [desktop, findPhotoTitle, sound]);

  const handleDropToTrash = useCallback(async (drag: ActiveDrag) => {
    sound.play('dropTrash');
    if (!isAuthenticated) {
      if (drag.sourceKind === 'desktop-icon') desktop.removeIcon(drag.photoId);
      return;
    }
    try {
      await trashPhotos([drag.photoId]);
      if (drag.sourceKind === 'desktop-icon') {
        desktop.removeIcon(drag.photoId);
      }
      await refreshOpenWindows();
    } catch {
      sound.play('error');
    }
  }, [isAuthenticated, desktop, refreshOpenWindows, sound]);

  /** Resolve a PhotoRef from a drag payload by looking up the full photo in open windows. */
  const resolvePhotoRef = useCallback((drag: ActiveDrag): PhotoRef | null => {
    const allPhotos = wm.windows.flatMap(w => w.gridPayload?.photos ?? []);
    const match = allPhotos.find(p => p.id === drag.photoId);
    if (match) return { id: match.id, slug: match.slug, title: match.title, thumbnail_url: match.thumbnail_url, width: match.width, height: match.height, blurhash: match.blurhash };
    // Fallback: construct from drag payload (missing dimensions/blurhash)
    return { id: drag.photoId, slug: drag.photoSlug, title: drag.photoSlug, thumbnail_url: drag.thumbnailUrl, width: 1, height: 1, blurhash: '' };
  }, [wm.windows]);

  const handleDropToCategory = useCallback(async (drag: ActiveDrag, categorySlug: string) => {
    sound.play('drop');
    if (!isAuthenticated) {
      const folderId = `cat-${categorySlug}`;
      const ref = resolvePhotoRef(drag);
      if (ref) desktop.addToFolder(folderId, ref);
      if (drag.sourceKind === 'desktop-icon') desktop.removeIcon(drag.photoId);
      // Refresh any open window for this category folder
      for (const win of wm.windows) {
        if (win.windowType === 'grid' && win.gridPayload?.categorySlug === categorySlug) {
          const existing = win.gridPayload.photos;
          if (!existing.some(p => p.id === drag.photoId) && ref) {
            const asListItem: PhotoListItem = { ...ref, taken_at: null, category_slug: categorySlug, location_name: null, lat: null, lng: null, is_reported: false };
            const merged = [...existing, asListItem];
            const baseName = win.title.split(' — ')[0];
            wm.updateWindow(win.id, {
              title: `${baseName} — ${merged.length} photos`,
              gridPayload: { ...win.gridPayload, photos: merged, count: merged.length },
            });
          }
        }
      }
      return;
    }
    // Admin: reassign category via API
    try {
      await patchPhotoCategory(drag.photoSlug, categorySlug);
      if (drag.sourceKind === 'desktop-icon') {
        desktop.removeIcon(drag.photoId);
      }
      await refreshOpenWindows();
    } catch {
      // TODO: show error toast
    }
  }, [isAuthenticated, desktop, wm, refreshOpenWindows, sound]);

  const handleDropToGuestFolder = useCallback((drag: ActiveDrag, folderId: string) => {
    sound.play('drop');
    const ref = resolvePhotoRef(drag);
    if (ref) desktop.addToFolder(folderId, ref);
    if (drag.sourceKind === 'desktop-icon') desktop.removeIcon(drag.photoId);
    // Refresh any open window for this folder
    for (const win of wm.windows) {
      if (win.windowType === 'grid' && win.gridPayload?.categorySlug === folderId) {
        const existing = win.gridPayload.photos;
        if (!existing.some(p => p.id === drag.photoId) && ref) {
          const asListItem: PhotoListItem = { ...ref, taken_at: null, category_slug: '', location_name: null, lat: null, lng: null, is_reported: false };
          const merged = [...existing, asListItem];
          const baseName = win.title.split(' — ')[0];
          wm.updateWindow(win.id, {
            title: `${baseName} — ${merged.length} photos`,
            gridPayload: { ...win.gridPayload, photos: merged, count: merged.length },
          });
        }
      }
    }
  }, [desktop, wm, resolvePhotoRef, sound]);

  // === New Folder — always creates a local placeholder, admin promotes on rename ===

  const handleNewFolder = useCallback((position: { x: number; y: number }): string => {
    return desktop.addFolder(position);
  }, [desktop]);

  // === Rename — admin placeholder folders get promoted to real categories ===

  const handleRenameIcon = useCallback(async (id: string, label: string) => {
    if (isAuthenticated && id.startsWith('guest-folder-')) {
      const icon = desktop.icons.find(ic => ic.id === id);
      if (!icon) return;
      try {
        const cat = await createCategory(label);
        // Atomically replace placeholder with real category icon at same position
        desktop.replaceIcon(id, {
          id: `cat-${cat.slug}`,
          label: cat.name,
          iconType: 'folder',
          position: icon.position,
          action: { type: 'openGrid', categorySlug: cat.slug },
        });
        // Refresh categories for menus; suppress merge to avoid clobbering replaceIcon
        desktop.suppressNextMerge();
        const cats = await getCategories();
        setCategories(cats);
      } catch {
        // Leave as placeholder on error — user can retry rename
      }
      return;
    }
    desktop.renameIcon(id, label);
  }, [isAuthenticated, desktop]);

  // === Delete icon — admin category folders trigger API delete + scatter photos ===

  const handleDeleteIcon = useCallback(async (id: string) => {
    // Admin deleting a real category folder
    if (isAuthenticated && id.startsWith('cat-')) {
      const slug = id.slice(4);

      if (slug === 'uncategorized') {
        showToast("Can\u2019t delete the Uncategorized folder", 'error');
        return;
      }

      const icon = desktop.icons.find(ic => ic.id === id);
      if (!icon) return;

      // Confirm before deleting
      const cat = categories.find(c => c.slug === slug);
      const photoCount = cat?.photo_count ?? 0;
      const msg = photoCount > 0
        ? `Delete "${icon.label}"? ${photoCount} photo${photoCount === 1 ? '' : 's'} will be scattered on your desktop.`
        : `Delete "${icon.label}"?`;
      if (!window.confirm(msg)) return;

      try {
        const result = await deleteCategory(slug);

        // Remove the folder icon
        desktop.removeIcon(id);

        // Scatter reassigned photos around where the folder was
        const baseX = icon.position.x;
        const baseY = icon.position.y;
        const cols = Math.ceil(Math.sqrt(result.reassigned_photos.length));
        result.reassigned_photos.forEach((photo, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = baseX + col * 90 - (cols > 1 ? ((cols - 1) * 90) / 2 : 0);
          const y = baseY + 80 + row * 90;
          desktop.addPhotoIcon(photo.id, photo.slug, photo.title, photo.thumbnail_url, { x, y });
        });

        // Close any open windows for this category
        for (const win of wm.windows) {
          if (win.windowType === 'grid' && win.gridPayload?.categorySlug === slug) {
            wm.closeWindow(win.id);
          }
        }

        // Refresh categories; suppress merge to avoid clobbering the icons we just placed
        desktop.suppressNextMerge();
        const cats = await getCategories();
        setCategories(cats);
      } catch {
        showToast('Failed to delete folder', 'error');
      }
      return;
    }

    // Guest folders or photo icons — just remove locally
    desktop.removeIcon(id);
  }, [isAuthenticated, categories, desktop, wm, showToast]);

  // === Keyboard shortcuts ===

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'w') {
        e.preventDefault();
        const topWin = [...wm.windows]
          .filter(w => !w.isMinimized)
          .sort((a, b) => b.zIndex - a.zIndex)[0];
        if (topWin) wm.closeWindow(topWin.id);
      }
      if (mod && e.key === 'n') {
        e.preventDefault();
        openGridWindow();
      }
      // Window cycling: Ctrl+` (backtick) to cycle through open windows
      // (Ctrl+Tab is intercepted by browsers, so we use backtick)
      if (mod && e.key === '`') {
        e.preventDefault();
        const visible = [...wm.windows]
          .filter(w => !w.isMinimized)
          .sort((a, b) => b.zIndex - a.zIndex);
        if (visible.length >= 2) {
          // Focus the second-highest window (send current top to back)
          wm.focusWindow(visible[1].id);
        } else if (visible.length === 1) {
          wm.focusWindow(visible[0].id);
        }
      }
      if (e.key === 'Escape') {
        setSelectedIconId(null);
        setContextMenu(null);
        selection.clear();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [wm, selection, openGridWindow]);

  // Close context menu on any left click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  // === Render window content ===

  function getWindowDropZoneId(win: WindowState): string | undefined {
    if (win.windowType === 'grid' && win.gridPayload?.categorySlug) {
      const slug = win.gridPayload.categorySlug;
      // Guest folder windows use the folder ID directly as zone prefix
      if (slug.startsWith('guest-folder-')) return `win-${slug}`;
      return `win-cat-${slug}`;
    }
    if (win.windowType === 'trash') return 'win-trash';
    return undefined;
  }

  function renderWindowContent(win: WindowState) {
    switch (win.windowType) {
      case 'grid':
        if (!win.gridPayload) return (
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
            <Throbber />Loading...
          </div>
        );
        return (
          <PhotoGrid
            grid={win.gridPayload}
            columns={gridColumns}
            onPhotoClick={(slug) => openDetailWindow(slug, win.id)}
            onLoadMore={() => handleLoadMore(win)}
            onHover={setStatusText}
            onHoverEnd={() => setStatusText('')}
            onContextMenu={setContextMenu}
            selectable={selectMode}
            isSelected={selection.isSelected}
            onToggleSelect={selection.toggle}
            onRangeSelect={selection.rangeSelect}
            onTrashed={() => refreshOpenWindows()}
            onSortChange={(order) => handleSortChange(win, order)}
            isDraggable={!selectMode}
            sourceWindowId={win.id}
            showReportedBadges={isAuthenticated}
          />
        );
      case 'detail':
        return (
          <PhotoDetailView
            photo={win.detailPayload?.photo ?? null}
            isLoading={win.detailPayload?.isLoading ?? true}
            onContextMenu={setContextMenu}
            selectable={isAuthenticated}
            onTrashed={() => refreshOpenWindows()}
            isAuthenticated={isAuthenticated}
            currentUsername={auth.user?.username}
            onLoginPrompt={openLoginWindow}
            windowWidth={win.size.width}
            windowHeight={win.size.height}
          />
        );
      case 'static':
        switch (win.staticPayload?.contentKey) {
          case 'about': return <AboutContent />;
          case 'contact': return <ContactContent />;
          case 'map-placeholder': return <MapContent />;
          case 'share': return <ShareContent onExport={desktop.exportBlob} onShowToast={showToast} />
          default: return null;
        }
      case 'login':
        return <LoginContent onSuccess={() => wm.closeWindow(win.id)} />;
      case 'upload':
        return <UploadWindow categories={categories} onUploaded={() => refreshOpenWindows()} />;
      case 'trash':
        return <TrashWindow onChanged={() => refreshOpenWindows()} />;
      case 'reports':
        return <ReportsWindow onChanged={() => refreshOpenWindows()} />;
    }
  }

  function renderToolbar(win: WindowState) {
    if (win.windowType === 'grid') {
      return (
        <WindowToolbar
          showViewToggle
          gridColumns={gridColumns}
          onToggleGrid={toggleGridSize}
          isAdmin={auth.user?.is_staff === true}
          isAuthenticated={isAuthenticated}
          selectMode={selectMode}
          onToggleSelectMode={() => {
            setSelectMode(prev => {
              if (prev) selection.clear();
              return !prev;
            });
          }}
          selectedCount={selection.selectedCount}
          totalCount={win.gridPayload?.count ?? 0}
          onSelectAll={() => {
            if (win.gridPayload) selection.selectAll(win.gridPayload.photos.map(p => p.id));
          }}
          onDeselectAll={selection.clear}
          onTrashSelected={() => handleTrashSelected(win)}
          onDownloadSelected={() => handleDownloadSelected(win)}
          busyOp={busyWindows[win.id]}
        />
      );
    }
    if (win.windowType === 'detail') {
      const parentId = win.detailPayload?.parentWindowId;
      return (
        <WindowToolbar
          canGoBack={!!parentId}
          onBack={() => {
            if (parentId) {
              wm.focusWindow(parentId);
              wm.closeWindow(win.id);
            }
          }}
        />
      );
    }
    return null;
  }

  return (
    <DragDropProvider
      onDropToDesktop={handleDropToDesktop}
      onDropToTrash={handleDropToTrash}
      onDropToCategory={handleDropToCategory}
      onDropToGuestFolder={handleDropToGuestFolder}
    >
      <LoadingScreen visible={isLoading} />
      <MenuBar
        categories={categories}
        onOpenAllPhotos={() => openGridWindow()}
        onOpenCategory={(slug, name) => openGridWindow(slug, name)}
        onOpenStatic={openStaticWindow}
        onToggleGridSize={toggleGridSize}
        onOpenLogin={openLoginWindow}
        onOpenUpload={openUploadWindow}
        onOpenReports={isAuthenticated ? openReportsWindow : undefined}
        onResetDesktop={desktop.reset}
        onToggleWidget={widgets.toggleWidget}
        openWidgetTypes={widgets.openWidgetTypes}
      />
      <Desktop
        icons={desktop.icons}
        selectedIconId={selectedIconId}
        isAdmin={isAuthenticated}
        onSelectIcon={setSelectedIconId}
        onOpenIcon={handleOpenIcon}
        onMoveIcon={desktop.moveIcon}
        onRenameIcon={handleRenameIcon}
        onDeleteIcon={handleDeleteIcon}
        onNewFolder={handleNewFolder}
        onHover={setStatusText}
        onHoverEnd={() => setStatusText('')}
        onContextMenu={setContextMenu}
      >
        <WidgetLayer
          widgets={widgets.widgets}
          onMove={widgets.moveWidget}
          onClose={widgets.closeWidget}
        />
        <AnimatePresence>
          {(() => {
            const maxZ = wm.windows.filter(w => !w.isMinimized).reduce((m, w) => Math.max(m, w.zIndex), 0);
            return wm.windows.map(win => (
              <Window
                key={win.id}
                win={win}
                isFocused={!win.isMinimized && win.zIndex === maxZ}
                onClose={() => { sound.play('windowClose'); wm.closeWindow(win.id); }}
                onMinimize={() => { sound.play('windowMinimize'); wm.minimizeWindow(win.id); }}
                onMaximize={() => { sound.play('windowMaximize'); wm.maximizeWindow(win.id); }}
                onFocus={() => wm.focusWindow(win.id)}
                onMove={(x, y) => wm.moveWindow(win.id, x, y)}
                onResize={(w, h, x, y) => wm.resizeWindow(win.id, w, h, x, y)}
                toolbar={renderToolbar(win)}
                dropZoneId={getWindowDropZoneId(win)}
              >
                {renderWindowContent(win)}
              </Window>
            ));
          })()}
        </AnimatePresence>
      </Desktop>
      <StatusBar
        statusText={statusText || `${desktop.icons.length} items on desktop`}
        windows={wm.windows}
        onWindowClick={wm.focusWindow}
        onMinimizeWindow={wm.minimizeWindow}
      />
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu key="ctx" menu={contextMenu} onClose={() => setContextMenu(null)} />
        )}
      </AnimatePresence>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </DragDropProvider>
  );
}
