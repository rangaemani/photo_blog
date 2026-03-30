import { useState, useEffect, useCallback, useRef } from 'react';
import type { Category, DesktopIconState, PhotoRef, Position } from '../types';
import { computeIconLayout, isMobile } from '../utils/position';

const STORAGE_KEY = 'desktop_icons';

interface DesktopBlobV2 {
  version: 2;
  /** Only photo icons and guest folders — preset icons are never persisted. */
  userIcons: DesktopIconState[];
  folders: Record<string, PhotoRef[]>;
}

const RIGHT_ICON_IDS: ReadonlySet<string> = new Set(['contact', 'map', 'trash']);

/**
 * Derive the ordered preset icon list. Positions are placeholders ({x:0,y:0}) —
 * the layout effect overwrites them based on viewport before first paint.
 *
 * Returns icons plus `rightIds` — the set of IDs that belong in the right-anchored
 * column on desktop (Contact, Map, Trash). Pass this to `computeIconLayout`.
 */
export function derivePreset(categories: Category[]): {
  icons: DesktopIconState[];
  rightIds: ReadonlySet<string>;
} {
  const placeholder: Position = { x: 0, y: 0 };

  const staticLeft: DesktopIconState[] = [
    { id: 'all-photos', label: 'All Photos', iconType: 'app', position: placeholder, action: { type: 'openGrid' } },
    { id: 'readme', label: 'README.md', iconType: 'file', position: placeholder, action: { type: 'openStatic', contentKey: 'about' } },
  ];

  const categoryIcons: DesktopIconState[] = categories.map(c => ({
    id: `cat-${c.slug}`,
    label: c.name,
    iconType: 'folder' as const,
    position: placeholder,
    action: { type: 'openGrid' as const, categorySlug: c.slug },
  }));

  const staticRight: DesktopIconState[] = [
    { id: 'contact', label: 'Contact', iconType: 'file', position: placeholder, action: { type: 'openStatic', contentKey: 'contact' } },
    { id: 'map', label: 'Map', iconType: 'app', position: placeholder, action: { type: 'openStatic', contentKey: 'map-placeholder' } },
    { id: 'trash', label: 'Trash', iconType: 'system', position: placeholder, action: { type: 'openTrash' } },
  ];

  return {
    icons: [...staticLeft, ...categoryIcons, ...staticRight],
    rightIds: RIGHT_ICON_IDS,
  };
}

function loadBlob(): { userIcons: DesktopIconState[]; folders: Record<string, PhotoRef[]> } {
  const empty = { userIcons: [], folders: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);

    // v2 format
    if (parsed.version === 2 && Array.isArray(parsed.userIcons)) {
      return { userIcons: parsed.userIcons, folders: parsed.folders ?? {} };
    }

    // v1 migration: extract only user-created icons, drop preset positions
    if ((parsed.version === 1 || !parsed.version) && Array.isArray(parsed.icons)) {
      const userIcons = (parsed.icons as DesktopIconState[]).filter(
        ic => ic.iconType === 'photo' || ic.id.startsWith('guest-folder-')
      );
      return { userIcons, folders: parsed.folders ?? {} };
    }

    return empty;
  } catch {
    return empty;
  }
}

function persistBlob(userIcons: DesktopIconState[], folders: Record<string, PhotoRef[]>): void {
  try {
    const blob: DesktopBlobV2 = { version: 2, userIcons, folders };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/** Layout helper: apply `computeIconLayout` to an icon array using the current viewport. */
function applyLayout(
  icons: DesktopIconState[],
  rightIds: ReadonlySet<string>,
): DesktopIconState[] {
  const positions = computeIconLayout(
    icons,
    { width: window.innerWidth, height: window.innerHeight },
    rightIds,
  );
  return icons.map(ic => ({ ...ic, position: positions.get(ic.id) ?? ic.position }));
}

/**
 * Manages desktop icon state with dynamic viewport-aware layout.
 *
 * Preset icons (All Photos, categories, etc.) get their positions computed
 * from the viewport on mount and on resize. User-created icons (photo pins,
 * guest folders) are persisted to localStorage.
 *
 * @param categories - Photo categories from the API.
 * @returns Icon array and mutation methods: `moveIcon`, `addFolder`, `addPhotoIcon`,
 *   `renameIcon`, `replaceIcon`, `removeIcon`, `addToFolder`, `getFolderContents`,
 *   `exportBlob`, `importBlob`, `reset`.
 */
export function useDesktopState(categories: Category[]) {
  const [icons, setIcons] = useState<DesktopIconState[]>([]);
  const initialized = useRef(false);
  const folderContentsRef = useRef<Map<string, PhotoRef[]>>(new Map());
  // Stable ref so resize handler and callbacks always see current rightIds
  const rightIdsRef = useRef<ReadonlySet<string>>(RIGHT_ICON_IDS);

  // Hydrate once when categories load
  useEffect(() => {
    if (categories.length === 0) return;
    const { icons: presetIcons, rightIds } = derivePreset(categories);
    rightIdsRef.current = rightIds;

    const { userIcons, folders } = loadBlob();
    const merged = [...presetIcons, ...userIcons];

    setIcons(applyLayout(merged, rightIds));

    const map = new Map<string, PhotoRef[]>();
    for (const [k, v] of Object.entries(folders)) map.set(k, v);
    folderContentsRef.current = map;
    initialized.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Recompute layout on viewport resize (orientation changes, window resize)
  useEffect(() => {
    if (!initialized.current) return;

    let debounce: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        setIcons(prev => applyLayout(prev, rightIdsRef.current));
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(debounce);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Persist user-created icons (photo pins + guest folders) on change
  useEffect(() => {
    if (!initialized.current || icons.length === 0) return;
    const timer = setTimeout(() => {
      const userIcons = icons.filter(
        ic => ic.iconType === 'photo' || ic.id.startsWith('guest-folder-')
      );
      const folders: Record<string, PhotoRef[]> = {};
      for (const [k, v] of folderContentsRef.current) folders[k] = v;
      persistBlob(userIcons, folders);
    }, 300);
    return () => clearTimeout(timer);
  }, [icons]);

  const moveIcon = useCallback((id: string, x: number, y: number) => {
    // On mobile, icons are auto-arranged — drags are disabled in DesktopIcon.
    // On desktop, honor the user's move.
    if (isMobile()) return;
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
      const newIcon: DesktopIconState = {
        id,
        label,
        iconType: 'folder',
        position,
        action: { type: 'openGrid' },
      };
      return applyLayout([...prev, newIcon], rightIdsRef.current);
    });
    return id;
  }, []);

  const renameIcon = useCallback((id: string, label: string) => {
    setIcons(prev => prev.map(ic => ic.id === id ? { ...ic, label } : ic));
  }, []);

  const replaceIcon = useCallback((oldId: string, newIcon: DesktopIconState) => {
    setIcons(prev => [...prev.filter(ic => ic.id !== oldId), newIcon]);
  }, []);

  const addPhotoIcon = useCallback((photoId: string, photoSlug: string, label: string, thumbnailUrl: string, position: Position) => {
    setIcons(prev => {
      if (prev.some(ic => ic.id === photoId)) return prev;
      const newIcon: DesktopIconState = {
        id: photoId,
        label,
        iconType: 'photo',
        position,
        action: { type: 'openDetail', photoSlug },
        thumbnailUrl,
      };
      return applyLayout([...prev, newIcon], rightIdsRef.current);
    });
  }, []);

  // --- Folder contents ---

  const addToFolder = useCallback((folderId: string, photo: PhotoRef) => {
    const list = folderContentsRef.current.get(folderId) ?? [];
    if (list.some(p => p.id === photo.id)) return;
    folderContentsRef.current.set(folderId, [...list, photo]);
    // Trigger persist by bumping icons (cheapest way to re-run the persist effect)
    setIcons(prev => [...prev]);
  }, []);

  const getFolderContents = useCallback((folderId: string): PhotoRef[] => {
    return folderContentsRef.current.get(folderId) ?? [];
  }, []);

  // --- Export / Import ---

  const exportBlob = useCallback((): string => {
    const folders: Record<string, PhotoRef[]> = {};
    for (const [k, v] of folderContentsRef.current) folders[k] = v;
    const userIcons = icons.filter(
      ic => ic.iconType === 'photo' || ic.id.startsWith('guest-folder-')
    );
    const blob: DesktopBlobV2 = { version: 2, userIcons, folders };
    return btoa(encodeURIComponent(JSON.stringify(blob)).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
  }, [icons]);

  const importBlob = useCallback((base64: string) => {
    try {
      const blob = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
      if (blob.version !== 2 || !Array.isArray(blob.userIcons)) return false;
      setIcons(prev => {
        const preset = prev.filter(ic => ic.iconType !== 'photo' && !ic.id.startsWith('guest-folder-'));
        return applyLayout([...preset, ...blob.userIcons], rightIdsRef.current);
      });
      const map = new Map<string, PhotoRef[]>();
      for (const [k, v] of Object.entries(blob.folders ?? {})) map.set(k, v as PhotoRef[]);
      folderContentsRef.current = map;
      return true;
    } catch {
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    folderContentsRef.current = new Map();
    const { icons: presetIcons, rightIds } = derivePreset(categories);
    rightIdsRef.current = rightIds;
    setIcons(applyLayout(presetIcons, rightIds));
  }, [categories]);

  // suppressNextMerge is no longer needed (no merge on role switch), kept as no-op
  // to avoid breaking callers.
  const suppressNextMerge = useCallback(() => {}, []);

  return {
    icons, moveIcon, addFolder, addPhotoIcon, renameIcon, replaceIcon, removeIcon,
    suppressNextMerge, addToFolder, getFolderContents, exportBlob, importBlob, reset,
  };
}
