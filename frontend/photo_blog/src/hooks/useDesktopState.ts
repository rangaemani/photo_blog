import { useState, useEffect, useCallback, useRef } from 'react';
import type { Category, DesktopIconState, DesktopBlob, PhotoRef, Position } from '../types';
import { getLeftColumnPosition, getRightColumnPosition } from '../utils/position';

const STORAGE_KEY_GUEST = 'desktop_state_guest';
const STORAGE_KEY_ADMIN = 'desktop_state_admin';
const GRID = 90;
const snap = (p: Position): Position => ({
  x: Math.round(p.x / GRID) * GRID,
  y: Math.round(p.y / GRID) * GRID,
});

/**
 * Derive the default desktop icon layout from categories and static entries.
 * This is the "factory preset" — what guests see on first load.
 * @param categories - Available photo categories from the API.
 * @returns Default icon array with computed positions.
 */
export function derivePreset(categories: Category[]): DesktopIconState[] {
  const staticLeft: DesktopIconState[] = [
    { id: 'all-photos', label: 'All Photos', iconType: 'app', position: getLeftColumnPosition(0), action: { type: 'openGrid' } },
    { id: 'readme', label: 'README.md', iconType: 'file', position: getLeftColumnPosition(1), action: { type: 'openStatic', contentKey: 'about' } },
  ];

  const categoryIcons: DesktopIconState[] = categories.map((c, i) => ({
    id: `cat-${c.slug}`,
    label: c.name,
    iconType: 'folder' as const,
    position: getLeftColumnPosition(i + 2),
    action: { type: 'openGrid' as const, categorySlug: c.slug },
  }));

  const staticRight: DesktopIconState[] = [
    { id: 'about', label: 'About', iconType: 'file', position: getRightColumnPosition(0), action: { type: 'openStatic', contentKey: 'about' } },
    { id: 'contact', label: 'Contact', iconType: 'file', position: getRightColumnPosition(1), action: { type: 'openStatic', contentKey: 'contact' } },
    { id: 'map', label: 'Map', iconType: 'app', position: getRightColumnPosition(2), action: { type: 'openStatic', contentKey: 'map-placeholder' } },
    { id: 'trash', label: 'Trash', iconType: 'system', position: getRightColumnPosition(3), action: { type: 'openTrash' } },
  ];

  return [...staticLeft, ...categoryIcons, ...staticRight];
}

/**
 * Load persisted desktop blob from localStorage.
 * Handles both the new unified format (DesktopBlob) and the legacy split format.
 */
function loadBlob(key: string): DesktopBlob | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // New format: has version field
    if (parsed.version === 1 && Array.isArray(parsed.icons)) {
      return parsed as DesktopBlob;
    }
    // Legacy format: { icons: [] } without version — migrate
    if (Array.isArray(parsed.icons)) {
      const blob: DesktopBlob = { version: 1, icons: parsed.icons, folders: {} };
      // Migrate legacy folder contents from separate key
      try {
        const fRaw = localStorage.getItem(`${key}_folders`);
        if (fRaw) {
          const fParsed: Record<string, string[]> = JSON.parse(fRaw);
          // Legacy folders only stored IDs — can't recover photo objects, so drop them
          // They'll be empty until the user re-adds photos
          for (const k of Object.keys(fParsed)) blob.folders[k] = [];
          localStorage.removeItem(`${key}_folders`); // clean up legacy key
        }
      } catch { /* ignore */ }
      return blob;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist the desktop blob to localStorage. */
function persistBlob(blob: DesktopBlob, key: string): void {
  try {
    localStorage.setItem(key, JSON.stringify(blob));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * Merge saved icon state with the current admin-derived preset.
 *
 * Strategy:
 * - Preset icons present in saved → use saved position (user moved it)
 * - Preset icons missing from saved → new category from admin, add at default position
 * - Saved icons not in preset with iconType 'photo' → user-pinned, keep them
 * - Saved icons not in preset with id 'guest-folder-*' → user-created folder, keep
 * - Other saved icons not in preset → stale (admin removed category), prune
 *
 * @param saved - Previously persisted icon array.
 * @param preset - Current factory-default icon array.
 * @returns Merged icon array.
 */
function mergeWithPreset(saved: DesktopIconState[], preset: DesktopIconState[]): DesktopIconState[] {
  const savedById = new Map(saved.map(ic => [ic.id, ic]));
  const presetIds = new Set(preset.map(ic => ic.id));

  // Preset icons: prefer saved position, fall back to default
  const merged = preset.map(presetIcon => {
    const savedIcon = savedById.get(presetIcon.id);
    if (savedIcon) {
      // Keep saved position but use preset's action/label (admin may have renamed)
      return { ...presetIcon, position: savedIcon.position };
    }
    return presetIcon;
  });

  // Surviving user-created icons (photos pinned to desktop, guest-created folders)
  const userIcons = saved.filter(ic =>
    !presetIds.has(ic.id) && (ic.iconType === 'photo' || ic.id.startsWith('guest-folder-'))
  );

  return [...merged, ...userIcons];
}

/**
 * Manages desktop icon state with localStorage persistence, separated by auth role.
 *
 * Admin and guest each have their own storage key. On login/logout the hook
 * re-initializes from the appropriate key, so guest customizations don't
 * bleed into admin sessions and vice versa.
 *
 * @param categories - Photo categories from the API. When empty (still loading), the hook waits.
 * @param isAdmin - Whether the current user is authenticated as admin.
 * @returns Icon array and mutation helpers.
 */
export function useDesktopState(categories: Category[], isAdmin: boolean) {
  const [icons, setIcons] = useState<DesktopIconState[]>([]);
  const initialized = useRef(false);
  const suppressMergeRef = useRef(false);
  const folderContentsRef = useRef<Map<string, PhotoRef[]>>(new Map());
  // Track which storageKey the current icons belong to — prevents cross-contamination on role switch
  const hydratedKeyRef = useRef<string | null>(null);

  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_GUEST;

  // Hydrate when categories load or auth role changes
  useEffect(() => {
    if (categories.length === 0) return;
    if (suppressMergeRef.current) {
      suppressMergeRef.current = false;
      hydratedKeyRef.current = storageKey;
      return;
    }

    const preset = derivePreset(categories);
    const blob = loadBlob(storageKey);

    if (blob) {
      setIcons(mergeWithPreset(blob.icons, preset));
      const map = new Map<string, PhotoRef[]>();
      for (const [k, v] of Object.entries(blob.folders)) map.set(k, v);
      folderContentsRef.current = map;
    } else {
      setIcons(preset);
      folderContentsRef.current = new Map();
    }
    hydratedKeyRef.current = storageKey;
    initialized.current = true;
  }, [categories, isAdmin, storageKey]);

  // Persist on every change — only if icons belong to the current storageKey
  const persistAll = useCallback(() => {
    if (!initialized.current) return;
    if (hydratedKeyRef.current !== storageKey) return; // role switch in progress, skip
    const folders: Record<string, PhotoRef[]> = {};
    for (const [k, v] of folderContentsRef.current) folders[k] = v;
    persistBlob({ version: 1, icons, folders }, storageKey);
  }, [icons, storageKey]);

  useEffect(() => {
    if (initialized.current && icons.length > 0) persistAll();
  }, [icons, persistAll]);

  const moveIcon = useCallback((id: string, x: number, y: number) => {
    setIcons(prev => prev.map(ic => ic.id === id ? { ...ic, position: { x, y } } : ic));
  }, []);

  const removeIcon = useCallback((id: string) => {
    setIcons(prev => prev.filter(ic => ic.id !== id));
  }, []);

  const addFolder = useCallback((position: Position): string => {
    const id = `guest-folder-${Date.now()}`;
    setIcons(prev => {
      const baseName = 'New Folder';
      const existing = prev.filter(ic => ic.label === baseName || ic.label.startsWith(baseName + ' ('));
      const label = existing.length === 0 ? baseName : `${baseName} (${existing.length + 1})`;
      return [...prev, {
        id,
        label,
        iconType: 'folder' as const,
        position: snap(position),
        action: { type: 'openGrid' as const },
      }];
    });
    return id;
  }, []);

  const renameIcon = useCallback((id: string, label: string) => {
    setIcons(prev => prev.map(ic => ic.id === id ? { ...ic, label } : ic));
  }, []);

  const replaceIcon = useCallback((oldId: string, newIcon: DesktopIconState) => {
    setIcons(prev => [...prev.filter(ic => ic.id !== oldId), newIcon]);
  }, []);

  const suppressNextMerge = useCallback(() => {
    suppressMergeRef.current = true;
  }, []);

  const addPhotoIcon = useCallback((photoId: string, photoSlug: string, label: string, thumbnailUrl: string, position: Position) => {
    setIcons(prev => {
      if (prev.some(ic => ic.id === photoId)) return prev;
      return [...prev, {
        id: photoId,
        label,
        iconType: 'photo' as const,
        position: snap(position),
        action: { type: 'openDetail' as const, photoSlug },
        thumbnailUrl,
      }];
    });
  }, []);

  // --- Folder contents (PhotoRef-based) ---

  const addToFolder = useCallback((folderId: string, photo: PhotoRef) => {
    const list = folderContentsRef.current.get(folderId) ?? [];
    if (list.some(p => p.id === photo.id)) return; // already in folder
    folderContentsRef.current.set(folderId, [...list, photo]);
    persistAll();
  }, [persistAll]);

  const getFolderContents = useCallback((folderId: string): PhotoRef[] => {
    return folderContentsRef.current.get(folderId) ?? [];
  }, []);

  // --- Export / Import ---

  const exportBlob = useCallback((): string => {
    const folders: Record<string, PhotoRef[]> = {};
    for (const [k, v] of folderContentsRef.current) folders[k] = v;
    const blob: DesktopBlob = { version: 1, icons, folders };
    return btoa(JSON.stringify(blob));
  }, [icons]);

  const importBlob = useCallback((base64: string) => {
    try {
      const blob: DesktopBlob = JSON.parse(atob(base64));
      if (blob.version !== 1 || !Array.isArray(blob.icons)) return false;
      setIcons(blob.icons);
      const map = new Map<string, PhotoRef[]>();
      for (const [k, v] of Object.entries(blob.folders ?? {})) map.set(k, v);
      folderContentsRef.current = map;
      persistBlob(blob, storageKey);
      return true;
    } catch {
      return false;
    }
  }, [storageKey]);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    folderContentsRef.current = new Map();
    setIcons(derivePreset(categories));
  }, [categories, storageKey]);

  return {
    icons, moveIcon, addFolder, addPhotoIcon, renameIcon, replaceIcon, removeIcon,
    suppressNextMerge, addToFolder, getFolderContents, exportBlob, importBlob, reset,
  };
}
