 // === Shared geometry ===

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type ResizeEdge = 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw';

// === Auth ===

export interface User {
  username: string;
  is_staff: boolean;
  display_name?: string;
}

export interface OTPRequestResponse {
  ok: boolean;
  identifier_type: 'email' | 'phone';
  /** Seconds until the OTP expires. */
  expires_in: number;
}

export interface OTPVerifyResponse {
  ok: boolean;
  /** True if this is the user's first login — they need to set a display name. */
  is_new?: boolean;
  user?: User;
  /** Present on failure (invalid code, expired, etc.). */
  error?: string;
  /** How many verification attempts remain before the code is invalidated. */
  attempts_remaining?: number;
}

// === API response types ===

export interface PhotoListItem {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string;
  width: number;
  height: number;
  taken_at: string | null;
  category_slug: string;
  blurhash: string;  
  lat: number | null;
  lng: number | null;
  location_name: string | null;
  is_reported: boolean;
}

export interface PhotoDetail extends PhotoListItem {
  original_url: string;
  description: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  focal_length: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: number | null;
  file_size: number;
  reaction_summary: Record<string, number>;
  user_reactions: string[];
  comment_count: number;
  tags: TagItem[];
  pop_tags: PopTagItem[];
}

/** Result of a photo download request. */
export interface DownloadResult {
  /** The file blob — image/jpeg for single, application/zip for multiple. */
  blob: Blob;
  /** Suggested save filename from Content-Disposition (e.g. "slug.jpg" or "photos_2026-03-28.zip"). */
  filename: string;
}

export interface CommentItem {
  id: string;
  text: string;
  display_name: string;
  created_at: string;
}

export interface TagItem {
  id: string;
  text: string;
  user__username: string;
}

export interface PopTagItem {
  id: string;
  label: string;
  x: number;
  y: number;
  user__username: string;
}

export interface ToggleReactionResponse {
  active: boolean;
  reaction_summary: Record<string, number>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  photo_count: number;
}

export interface TrashedPhotoListItem extends PhotoListItem {
  trashed_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// === Desktop persistence ===

/** Minimal photo data stored in folder contents — enough to render a grid cell. */
export interface PhotoRef {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string;
  width: number;
  height: number;
  blurhash: string;
}

/** Self-contained desktop state blob for persistence and sharing. */
export interface DesktopBlob {
  version: 1;
  icons: DesktopIconState[];
  /** folderId → photos in that folder */
  folders: Record<string, PhotoRef[]>;
}

// === App state types ===

export type StaticContentKey = 'about' | 'contact' | 'map-placeholder' | 'share';

export type IconActionType =
  | { type: 'openGrid'; categorySlug?: string }
  | { type: 'openStatic'; contentKey: StaticContentKey }
  | { type: 'openTrash' }
  | { type: 'openDetail'; photoSlug: string };

export type IconKind = 'file' | 'folder' | 'app' | 'system' | 'photo';

export interface DesktopIconState {
  id: string;
  label: string;
  iconType: IconKind;
  position: Position;
  action: IconActionType;
  thumbnailUrl?: string;
}

/** Payload carried through the drag-drop context while a photo is being dragged. */
export interface ActiveDrag {
  photoId: string;
  photoSlug: string;
  thumbnailUrl: string;
  /** Where the drag originated — affects drop handling (e.g. grid-cell drags can be removed from their window). */
  sourceKind: 'grid-cell' | 'desktop-icon';
  /** Window ID if dragged from a grid window — used to remove the photo on drop. */
  sourceWindowId?: string;
}

export type WindowContentType = 'grid' | 'detail' | 'static' | 'login' | 'upload' | 'trash' | 'reports';

// === Widget types ===

export type WidgetType = 'clock' | 'notes' | 'weather' | 'systemInfo' | 'musicPlayer';

export interface WidgetState {
  id: string;
  type: WidgetType;
  position: Position;
  isOpen: boolean;
}

export interface GridPayload {
  categorySlug: string | null;
  photos: PhotoListItem[];
  next: string | null;
  count: number;
  isLoadingMore: boolean;
  order: 'asc' | 'desc';
}

export interface DetailPayload {
  slug: string;
  photo: PhotoDetail | null;
  isLoading: boolean;
  parentWindowId?: string;
}

export interface StaticPayload {
  contentKey: StaticContentKey;
}

export interface TrashPayload {
  photos: TrashedPhotoListItem[];
  next: string | null;
  count: number;
  isLoading: boolean;
}

export interface UploadFileEntry {
  id: string;
  file: File;
  title: string;
  description: string;
  categorySlug: string;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export interface UploadPayload {
  files: UploadFileEntry[];
}

export interface WindowState {
  id: string;
  title: string;
  windowType: WindowContentType;
  position: Position;
  size: Size;
  /** Saved geometry from before the last maximize, used to restore on un-maximize. */
  preMaximizeRect?: Position & Size;
  isMaximized: boolean;
  isMinimized: boolean;
  /** Stacking order. Higher = on top. Incremented by `focusWindow`. */
  zIndex: number;
  gridPayload?: GridPayload;
  detailPayload?: DetailPayload;
  staticPayload?: StaticPayload;
  trashPayload?: TrashPayload;
  uploadPayload?: UploadPayload;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface ContextMenuItem {
  label: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  shortcut?: string;
}
