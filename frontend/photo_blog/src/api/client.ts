import type { PaginatedResponse, PhotoListItem, PhotoDetail, Category, TrashedPhotoListItem, User, OTPRequestResponse, OTPVerifyResponse, CommentItem, ToggleReactionResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match?.[1] ?? '';
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

/** Fetch paginated photo list, optionally filtered by category.
 * @param categorySlug - Filter by category. Omit for all photos.
 * @param page - Page number for pagination.
 * @returns Paginated list of photo summaries.
 */
export function getPhotos(categorySlug?: string, page?: number): Promise<PaginatedResponse<PhotoListItem>> {
  const params = new URLSearchParams();
  if (categorySlug) params.set('category', categorySlug);
  if (page) params.set('page', String(page));
  const qs = params.toString();
  return fetchJSON(`${API_BASE}/photos/${qs ? `?${qs}` : ''}`);
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
  return res.json() as Promise<T>;
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

// === Reactions & Comments ===

export function toggleReaction(slug: string, emoji: string): Promise<ToggleReactionResponse> {
  return postJSON(`${API_BASE}/photos/${slug}/react/`, { emoji });
}

export function getComments(slug: string, page?: number): Promise<PaginatedResponse<CommentItem>> {
  const qs = page ? `?page=${page}` : '';
  return fetchJSON(`${API_BASE}/photos/${slug}/comments/${qs}`);
}

export function postComment(slug: string, text: string): Promise<CommentItem> {
  return postJSON(`${API_BASE}/photos/${slug}/comments/`, { text });
}

export function deleteComment(slug: string, commentId: string): Promise<{ ok: boolean }> {
  return deleteJSON(`${API_BASE}/photos/${slug}/comments/${commentId}/`);
}

// === Shared Layouts ===

export function shareLayout(blob: unknown): Promise<{ slug: string }> {
  return postJSON(`${API_BASE}/layouts/`, blob);
}

export function getSharedLayout(slug: string): Promise<unknown> {
  return fetchJSON(`${API_BASE}/layouts/${slug}/`);
}
