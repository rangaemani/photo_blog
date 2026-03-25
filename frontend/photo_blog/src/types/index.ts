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
  expires_in: number;
}

export interface OTPVerifyResponse {
  ok: boolean;
  is_new?: boolean;
  user?: User;
  error?: string;
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

export interface ActiveDrag {
  photoId: string;
  photoSlug: string;
  thumbnailUrl: string;
  sourceKind: 'grid-cell' | 'desktop-icon';
  /** Window ID if dragged from a grid window — used to remove the photo on drop */
  sourceWindowId?: string;
}

export type WindowContentType = 'grid' | 'detail' | 'static' | 'login' | 'upload' | 'trash';

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
  preMaximizeRect?: Position & Size;
  isMaximized: boolean;
  isMinimized: boolean;
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
