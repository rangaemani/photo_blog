import { useCallback, useRef } from 'react';
import { getPhotos, getPhotoBySlug, fetchNextPage } from '../api/client';
import type { PhotoListItem, PhotoDetail, GridPayload } from '../types';

// Simple in-memory caches
const gridCache = new Map<string, { photos: PhotoListItem[]; next: string | null; count: number }>();
const detailCache = new Map<string, PhotoDetail>();

function cacheKey(slug: string | null) {
  return slug ?? '__all__';
}

/** Provides cached photo data fetching — grid listings, pagination, and detail views.
 * @returns `{ fetchGrid, fetchMore, fetchDetail, invalidateAll }` — async methods for loading photos and clearing the cache.
 */
export function usePhotos() {
  const loadingRef = useRef(new Set<string>());

  const fetchGrid = useCallback(async (categorySlug: string | null): Promise<GridPayload> => {
    const key = cacheKey(categorySlug);
    const cached = gridCache.get(key);
    if (cached) {
      return { categorySlug, photos: cached.photos, next: cached.next, count: cached.count, isLoadingMore: false };
    }

    const data = await getPhotos(categorySlug ?? undefined);
    const payload: GridPayload = {
      categorySlug,
      photos: data.results,
      next: data.next,
      count: data.count,
      isLoadingMore: false,
    };
    gridCache.set(key, { photos: data.results, next: data.next, count: data.count });
    return payload;
  }, []);

  const fetchMore = useCallback(async (grid: GridPayload): Promise<GridPayload> => {
    if (!grid.next || grid.isLoadingMore) return grid;

    const key = cacheKey(grid.categorySlug);
    if (loadingRef.current.has(key)) return grid;
    loadingRef.current.add(key);

    try {
      const data = await fetchNextPage(grid.next);
      const updated: GridPayload = {
        ...grid,
        photos: [...grid.photos, ...data.results],
        next: data.next,
        isLoadingMore: false,
      };
      gridCache.set(key, { photos: updated.photos, next: updated.next, count: updated.count });
      return updated;
    } finally {
      loadingRef.current.delete(key);
    }
  }, []);

  const fetchDetail = useCallback(async (slug: string): Promise<PhotoDetail> => {
    const cached = detailCache.get(slug);
    if (cached) return cached;
    const photo = await getPhotoBySlug(slug);
    detailCache.set(slug, photo);
    return photo;
  }, []);

  const invalidateAll = useCallback(() => {
    gridCache.clear();
    detailCache.clear();
  }, []);

  return { fetchGrid, fetchMore, fetchDetail, invalidateAll };
}
