import type { PaginatedResponse, PhotoListItem, PhotoDetail, Category, TrashedPhotoListItem, User, OTPRequestResponse, OTPVerifyResponse, CommentItem, ToggleReactionResponse, TagItem, PopTagItem, DesktopBlob, DownloadResult } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

let _csrfToken = '';

function getCsrfToken(): string {
  // Fall back to cookie for local dev (same-origin)
  if (_csrfToken) return _csrfToken;
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match?.[1] ?? '';
}

export async function initCsrf(): Promise<void> {
  try {
    const data = await fetchJSON<{ csrfToken: string }>(`${API_BASE}/auth/csrf/`);
    _csrfToken = data.csrfToken;
  } catch {
    // ignore — cookie fallback will be used
  }
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// === Auth ===

/** Retrieve the currently authenticated user's profile.
 * @returns The logged-in user, or rejects if not authenticated.
 */
export function getUser(): Promise<User> {
  return fetchJSON(`${API_BASE}/auth/user/`);
}

/** Log in with username and password (session-based auth).
 * @param username - The user's username.
 * @param password - The user's password.
 * @returns Confirmation flag and the authenticated user.
 */
export function login(username: string, password: string): Promise<{ ok: boolean; user: User }> {
  return postJSON(`${API_BASE}/auth/login/`, { username, password });
}

/** End the current session and log out.
 * @returns Confirmation flag.
 */
export function logout(): Promise<{ ok: boolean }> {
  return postJSON(`${API_BASE}/auth/logout/`);
}

// === OTP Auth ===

/** Request an OTP code sent to an email or phone number.
 * @param identifier - Email address or phone number.
 */
export function requestOtp(identifier: string): Promise<OTPRequestResponse> {
  return postJSON(`${API_BASE}/auth/otp/request/`, { identifier });
}

/** Verify an OTP code and log in.
 * Returns the response body even on 4xx (invalid code, expired, etc).
 * @param identifier - The email/phone the code was sent to.
 * @param code - The 6-digit verification code.
 */
export async function verifyOtp(identifier: string, code: string): Promise<OTPVerifyResponse> {
  const res = await fetch(`${API_BASE}/auth/otp/verify/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify({ identifier, code }),
  });
  // Parse body regardless of status (4xx contains structured error info)
  const body = await res.json() as OTPVerifyResponse;
  if (!res.ok && !body.error) throw new Error(`API error: ${res.status}`);
  return body;
}

/** Set display name for a newly created user (first-time OTP login).
 * @param display_name - The chosen display name.
 */
export function setDisplayName(display_name: string): Promise<{ ok: boolean; user: User }> {
  return postJSON(`${API_BASE}/auth/otp/set-name/`, { display_name });
}

// === Photos (public) ===

/** Fetch the first page of photos, optionally filtered by category.
 * @param categorySlug - Filter to a single category. Omit for all photos.
 * @param order - Sort direction — `'desc'` for newest first (default), `'asc'` for oldest first.
 * @param includeReported - If true, include photos that have pending reports (admin use).
 * @returns First page of photo summaries with pagination cursor.
 */
export function getPhotos(categorySlug?: string, order: 'asc' | 'desc' = 'desc', includeReported = false): Promise<PaginatedResponse<PhotoListItem>> {
  const params = new URLSearchParams();
  if (categorySlug) params.set('category', categorySlug);
  params.set('order', order);
  if (includeReported) params.set('include_reported', 'true');
  return fetchJSON(`${API_BASE}/photos/?${params.toString()}`);
}

/** Fetch full details for a single photo by its URL slug.
 * @param slug - The photo's unique slug.
 * @returns Full photo detail including metadata and image URLs.
 */
export function getPhotoBySlug(slug: string): Promise<PhotoDetail> {
  return fetchJSON(`${API_BASE}/photos/${slug}/`);
}

/** Fetch all available photo categories.
 * @returns Array of categories.
 */
export function getCategories(): Promise<Category[]> {
  return fetchJSON(`${API_BASE}/categories/`);
}

/** Fetch the next page of photos using a full pagination URL.
 * @param url - The absolute `next` URL from a previous paginated response.
 * @returns Next page of photo summaries.
 */
export function fetchNextPage(url: string): Promise<PaginatedResponse<PhotoListItem>> {
  return fetchJSON(url);
}

async function deleteJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'X-CSRFToken': getCsrfToken(),
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return (res.status === 204 ? Promise.resolve({} as T) : res.json() as Promise<T>);
}

async function patchJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// === Photo management (admin) ===

/** Create a new category (admin only).
 * @param name - Display name for the new category.
 * @returns The newly created category.
 */
export function createCategory(name: string): Promise<Category> {
  return postJSON(`${API_BASE}/categories/create/`, { name });
}

/** Delete a category and reassign its photos to Uncategorized (admin only).
 * @param slug - The category's slug to delete.
 * @returns Confirmation and the reassigned photos' info for desktop pinning.
 */
export function deleteCategory(slug: string): Promise<{
  ok: boolean;
  reassigned_photos: { id: string; slug: string; title: string; thumbnail_url: string }[];
}> {
  return deleteJSON(`${API_BASE}/categories/${slug}/delete/`);
}

/** Update a photo's category (admin only).
 * @param slug - The photo's unique slug.
 * @param categorySlug - The new category to assign.
 * @returns The updated category slug.
 */
export function patchPhotoCategory(slug: string, categorySlug: string): Promise<{ category: string }> {
  return patchJSON(`${API_BASE}/photos/${slug}/patch/`, { category: categorySlug });
}

/** Update the geotag coordinates for a photo (admin only).
 * Pass `null` for both to clear the location.
 * @param slug - The photo's unique slug.
 * @param lat - Latitude, or `null` to clear.
 * @param lng - Longitude, or `null` to clear.
 */
export function patchPhotoLocation(slug: string, lat: number | null, lng: number | null): Promise<{ lat: number | null; lng: number | null }> {
  return patchJSON(`${API_BASE}/photos/${slug}/geotag/`, { lat, lng });
}


/** Upload a new photo with metadata (admin only). Uses XHR for progress tracking.
 * @param file - The image file to upload.
 * @param title - Display title for the photo.
 * @param description - Optional description text.
 * @param categorySlug - Category to file the photo under.
 * @param onProgress - Callback fired with upload percentage (0-100).
 * @returns The newly created photo detail.
 */
export function uploadPhoto(
  file: File,
  title: string,
  description: string,
  categorySlug: string,
  onProgress?: (pct: number) => void,
): Promise<PhotoDetail> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/photos/upload/`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-CSRFToken', getCsrfToken());

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as PhotoDetail);
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Upload network error')));

    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    if (description) form.append('description', description);
    form.append('category', categorySlug);
    xhr.send(form);
  });
}

/** Fetch paginated list of soft-deleted photos (admin only).
 * @param page - Page number for pagination.
 * @returns Paginated list of trashed photo summaries.
 */
export function getTrashedPhotos(page?: number): Promise<PaginatedResponse<TrashedPhotoListItem>> {
  const qs = page ? `?page=${page}` : '';
  return fetchJSON(`${API_BASE}/photos/trash/list/${qs}`);
}

/** Soft-delete one or more photos by moving them to trash (admin only).
 * @param ids - Array of photo IDs to trash.
 * @returns Count of photos trashed.
 */
export function trashPhotos(ids: string[]): Promise<{ trashed: number }> {
  return postJSON(`${API_BASE}/photos/trash/`, { ids });
}

/** Restore one or more photos from trash (admin only).
 * @param ids - Array of trashed photo IDs to restore.
 * @returns Count of photos restored.
 */
export function restorePhotos(ids: string[]): Promise<{ restored: number }> {
  return postJSON(`${API_BASE}/photos/trash/restore/`, { ids });
}

/** Permanently delete one or more trashed photos (admin only).
 * @param ids - Array of trashed photo IDs to permanently delete.
 * @returns Count of photos purged.
 */
export function purgePhotos(ids: string[]): Promise<{ purged: number }> {
  return postJSON(`${API_BASE}/photos/trash/purge/`, { ids });
}

/** Permanently delete all trashed photos at once (admin only).
 * @returns Count of photos purged.
 */
export function emptyTrash(): Promise<{ purged: number }> {
  return postJSON(`${API_BASE}/photos/trash/empty/`, {});
}

/** Download one or more photos as a file attachment.
 * Single photo → raw image file. Multiple photos → ZIP archive.
 * Requires authentication. Maximum 50 photos per request.
 * @param ids - Array of photo IDs (UUIDs) to download.
 * @returns The file blob and a suggested save filename from Content-Disposition.
 */
export async function downloadPhotos(ids: string[]): Promise<DownloadResult> {
  const res = await fetch(`${API_BASE}/photos/download/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? (ids.length === 1 ? 'photo.jpg' : 'photos.zip');
  return { blob, filename };
}

// === Reactions & Comments ===

/** Toggle an emoji reaction on a photo. Adds it if not present, removes it if already set.
 * @param slug - The photo's unique slug.
 * @param emoji - The emoji character to react with.
 * @returns Whether the reaction is now active, plus the updated aggregate counts.
 */
export function toggleReaction(slug: string, emoji: string): Promise<ToggleReactionResponse> {
  return postJSON(`${API_BASE}/photos/${slug}/react/`, { emoji });
}

/** Fetch paginated comments for a photo.
 * @param slug - The photo's unique slug.
 * @param page - Page number (omit for first page).
 */
export function getComments(slug: string, page?: number): Promise<PaginatedResponse<CommentItem>> {
  const qs = page ? `?page=${page}` : '';
  return fetchJSON(`${API_BASE}/photos/${slug}/comments/${qs}`);
}

/** Post a new comment on a photo (requires authentication).
 * @param slug - The photo's unique slug.
 * @param text - Comment body text.
 * @returns The newly created comment.
 */
export function postComment(slug: string, text: string): Promise<CommentItem> {
  return postJSON(`${API_BASE}/photos/${slug}/comments/`, { text });
}

/** Delete a comment (admin only).
 * @param slug - The photo's unique slug.
 * @param commentId - ID of the comment to delete.
 */
export function deleteComment(slug: string, commentId: string): Promise<{ ok: boolean }> {
  return deleteJSON(`${API_BASE}/photos/${slug}/comments/${commentId}/`);
}

// === Tags ===

/** Add a text tag to a photo (requires authentication).
 * @param slug - The photo's unique slug.
 * @param text - Tag text.
 * @returns Updated full tag list for the photo.
 */
export function addTag(slug: string, text: string): Promise<{ tags: TagItem[] }> {
  return postJSON(`${API_BASE}/photos/${slug}/tags/`, { text });
}

/** Remove a tag from a photo (admin or tag owner).
 * @param slug - The photo's unique slug.
 * @param tagId - ID of the tag to remove.
 * @returns Updated full tag list for the photo.
 */
export function removeTag(slug: string, tagId: string): Promise<{ tags: TagItem[] }> {
  return deleteJSON(`${API_BASE}/photos/${slug}/tags/${tagId}/`);
}

// === Pop Tags ===

/** Add a positioned pop-tag overlay on a photo (requires authentication).
 * @param slug - The photo's unique slug.
 * @param label - Tag label text.
 * @param x - Horizontal position as a percentage of image width (0–100).
 * @param y - Vertical position as a percentage of image height (0–100).
 * @returns Updated full pop-tag list for the photo.
 */
export function addPopTag(slug: string, label: string, x: number, y: number): Promise<{ pop_tags: PopTagItem[] }> {
  return postJSON(`${API_BASE}/photos/${slug}/pop-tags/`, { label, x, y });
}

/** Remove a pop-tag from a photo (admin or tag owner).
 * @param slug - The photo's unique slug.
 * @param tagId - ID of the pop-tag to remove.
 * @returns Updated full pop-tag list for the photo.
 */
export function removePopTag(slug: string, tagId: string): Promise<{ pop_tags: PopTagItem[] }> {
  return deleteJSON(`${API_BASE}/photos/${slug}/pop-tags/${tagId}/`);
}

// === Reports ===

export interface ReportTarget {
  type: 'image' | 'tag' | 'pop_tag' | 'comment';
  id?: string;
}

export interface AdminReport {
  id: string;
  photo_title: string;
  photo_slug: string;
  photo_thumbnail_url: string;
  targets: ReportTarget[];
  reason: string;
  reporter_ip: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
  reviewed_at: string | null;
}

/** Submit a content report for a photo (unauthenticated allowed).
 * @param slug - The photo's unique slug.
 * @param targets - One or more content items being reported (image, tags, comments).
 * @param reason - Free-text description of the issue.
 * @returns The created report's ID.
 */
export function reportPhoto(slug: string, targets: ReportTarget[], reason: string): Promise<{ id: string }> {
  return postJSON(`${API_BASE}/photos/${slug}/report/`, { targets, reason });
}

/** Fetch all pending and reviewed reports (admin only). */
export function getAdminReports(): Promise<AdminReport[]> {
  return fetchJSON(`${API_BASE}/admin/reports/`);
}

/** Take action on a report: dismiss it or delete the reported content (admin only).
 * @param id - The report ID.
 * @param action - `'dismiss'` marks it reviewed without removing content; `'delete'` removes the reported items.
 */
export function actionReport(id: string, action: 'dismiss' | 'delete'): Promise<{ ok: boolean }> {
  return postJSON(`${API_BASE}/admin/reports/${id}/action/`, { action });
}

// === Shared Layouts ===

/** Persist a desktop layout blob server-side and return a shareable slug.
 * @param blob - The full desktop state to share.
 * @returns A short slug that can be used to retrieve the layout via `getSharedLayout`.
 */
export function shareLayout(blob: DesktopBlob): Promise<{ slug: string }> {
  return postJSON(`${API_BASE}/layouts/`, blob);
}

/** Retrieve a previously shared desktop layout by slug.
 * @param slug - The share slug returned by `shareLayout`.
 */
export function getSharedLayout(slug: string): Promise<DesktopBlob> {
  return fetchJSON(`${API_BASE}/layouts/${slug}/`);
}
