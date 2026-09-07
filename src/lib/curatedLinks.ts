import { CustomLink } from '@/types';

export const BUILTIN_CURATED_LINKS: Record<number, CustomLink[]> = {};

/**
 * Get all consolidated custom links for a title across:
 * 1. Built-in curated catalog (if not deleted by Admin)
 * 2. LocalStorage global custom links added by Admin
 * (NO fake or auto-generated search links!)
 */
export function getConsolidatedCustomLinks(titleId: number, watchlistCustomLinks?: CustomLink[]): CustomLink[] {
  const linksMap = new Map<string, CustomLink>();
  let deletedIds = new Set<string>();

  if (typeof window !== 'undefined') {
    try {
      const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
      if (delStored) {
        deletedIds = new Set(JSON.parse(delStored));
      }
    } catch {
      // ignore
    }
  }

  // 1. Built-in curated links (only if not deleted by Admin)
  const builtin = BUILTIN_CURATED_LINKS[titleId] || [];
  builtin.forEach((l) => {
    if (!deletedIds.has(l.id)) {
      linksMap.set(l.id, l);
    }
  });

  // 2. Storage links added by Admin
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cinefuel_custom_links');
      if (stored) {
        const parsed = JSON.parse(stored);
        const forTitle = parsed[String(titleId)] || parsed[titleId];
        if (Array.isArray(forTitle)) {
          forTitle.forEach((l: CustomLink) => {
            if (!deletedIds.has(l.id)) {
              linksMap.set(l.id, l);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(linksMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Asynchronously sync links from server database into client storage
 */
export async function syncServerLinks(movieId?: number): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const url = movieId
      ? `/api/curated-links?movieId=${movieId}&_t=${Date.now()}`
      : `/api/curated-links?_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const stored = localStorage.getItem('cinefuel_custom_links');
    const parsed = stored ? JSON.parse(stored) : {};

    let changed = false;
    if (movieId && Array.isArray(data.links)) {
      const key = String(movieId);
      parsed[key] = data.links;
      changed = true;
    } else if (data.allLinks && typeof data.allLinks === 'object') {
      Object.entries(data.allLinks).forEach(([key, list]) => {
        if (Array.isArray(list)) {
          parsed[key] = list;
          changed = true;
        }
      });
    }

    if (changed) {
      localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
      window.dispatchEvent(new Event('cinefuel_links_updated'));
    }
  } catch {
    // ignore offline sync
  }
}

/**
 * Save a new custom link into global storage (Admin only)
 */
export function saveGlobalCustomLink(movieId: number, link: CustomLink): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('cinefuel_custom_links');
    const parsed = stored ? JSON.parse(stored) : {};
    const key = String(movieId);
    const existing = parsed[key] || [];
    parsed[key] = [link, ...existing.filter((l: CustomLink) => l.id !== link.id && l.url !== link.url)];
    localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));

    // Un-tombstone in deleted links registry
    const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
    if (delStored) {
      try {
        const delList: string[] = JSON.parse(delStored);
        if (delList.includes(link.id)) {
          localStorage.setItem('cinefuel_deleted_curated_links', JSON.stringify(delList.filter((id) => id !== link.id)));
        }
      } catch {}
    }

    window.dispatchEvent(new Event('cinefuel_links_updated'));

    // Also persist to server database
    fetch('/api/curated-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, link }),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to save global custom link:', err);
  }
}

/**
 * Save multiple custom links in a single atomic batch (Admin only)
 */
export function saveMultipleGlobalCustomLinks(movieId: number, newLinks: CustomLink[]): void {
  if (typeof window === 'undefined' || !newLinks || newLinks.length === 0) return;
  try {
    const stored = localStorage.getItem('cinefuel_custom_links');
    const parsed = stored ? JSON.parse(stored) : {};
    const key = String(movieId);
    const existing: CustomLink[] = parsed[key] || [];
    const newIds = new Set(newLinks.map((l) => l.id));
    const newUrls = new Set(newLinks.map((l) => l.url));
    const filteredExisting = existing.filter((l: CustomLink) => !newIds.has(l.id) && !newUrls.has(l.url));
    parsed[key] = [...newLinks, ...filteredExisting];
    localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));

    // Un-tombstone in deleted links registry
    const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
    if (delStored) {
      try {
        const delList: string[] = JSON.parse(delStored);
        const filtered = delList.filter((id) => !newIds.has(id));
        localStorage.setItem('cinefuel_deleted_curated_links', JSON.stringify(filtered));
      } catch {}
    }

    window.dispatchEvent(new Event('cinefuel_links_updated'));

    // Persist all links to server database in a single atomic request
    fetch('/api/curated-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, links: newLinks }),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to save multiple global custom links:', err);
  }
}

/**
 * Update an existing custom link (Admin only)
 */
export function updateGlobalCustomLink(movieId: number, updatedLink: CustomLink): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('cinefuel_custom_links');
    const parsed = stored ? JSON.parse(stored) : {};
    const key = String(movieId);
    const existing: CustomLink[] = parsed[key] || [];

    const index = existing.findIndex((l) => l.id === updatedLink.id);
    if (index >= 0) {
      existing[index] = { ...existing[index], ...updatedLink };
      parsed[key] = existing;
    } else {
      parsed[key] = [updatedLink, ...existing];
    }

    localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
    window.dispatchEvent(new Event('cinefuel_links_updated'));

    // Also persist to server database
    fetch('/api/curated-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, link: updatedLink }),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to update global custom link:', err);
  }
}

/**
 * Get the set of permanently deleted link IDs
 */
export function getDeletedLinkIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
    if (delStored) {
      return new Set(JSON.parse(delStored));
    }
  } catch {
    // ignore
  }
  return new Set();
}

/**
 * Delete a custom link permanently (Admin only)
 */
export async function deleteGlobalCustomLink(movieId: number, linkId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    // 1. Mark as deleted in deleted links registry
    const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
    const delList: string[] = delStored ? JSON.parse(delStored) : [];
    if (!delList.includes(linkId)) {
      delList.push(linkId);
      localStorage.setItem('cinefuel_deleted_curated_links', JSON.stringify(delList));
    }

    // 2. Remove from custom links storage
    const stored = localStorage.getItem('cinefuel_custom_links');
    if (stored) {
      const parsed = JSON.parse(stored);
      const key = String(movieId);
      if (parsed[key]) {
        parsed[key] = parsed[key].filter((l: CustomLink) => l.id !== linkId);
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
      }
    }

    // 3. Also remove from watchlist storage if present
    const watchStored = localStorage.getItem('cinefuel_watchlist');
    if (watchStored) {
      try {
        const watchParsed = JSON.parse(watchStored);
        if (Array.isArray(watchParsed)) {
          const updatedWatch = watchParsed.map((item: any) => {
            if (item.id === movieId && Array.isArray(item.customLinks)) {
              return {
                ...item,
                customLinks: item.customLinks.filter((l: CustomLink) => l.id !== linkId),
              };
            }
            return item;
          });
          localStorage.setItem('cinefuel_watchlist', JSON.stringify(updatedWatch));
        }
      } catch {
        // ignore
      }
    }

    // 4. Await server & cloud database deletion FIRST so data is guaranteed purged before sync
    try {
      await fetch(`/api/curated-links?movieId=${movieId}&linkId=${linkId}`, {
        method: 'DELETE',
      });
    } catch (netErr) {
      console.warn('Network deletion error:', netErr);
    }

    window.dispatchEvent(new Event('cinefuel_links_updated'));
  } catch (err) {
    console.error('Failed to delete global custom link:', err);
  }
}

/**
 * Batch delete multiple custom links permanently (Admin only)
 */
export async function deleteMultipleGlobalCustomLinks(items: Array<{ movieId: number; linkId: string }>): Promise<void> {
  if (typeof window === 'undefined' || !items.length) return;
  try {
    const linkIds = items.map((i) => i.linkId);
    const delSet = new Set(linkIds);

    // 1. Mark in deleted links registry
    const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
    const delList: string[] = delStored ? JSON.parse(delStored) : [];
    linkIds.forEach((id) => {
      if (!delList.includes(id)) delList.push(id);
    });
    localStorage.setItem('cinefuel_deleted_curated_links', JSON.stringify(delList));

    // 2. Remove from custom links storage
    const stored = localStorage.getItem('cinefuel_custom_links');
    if (stored) {
      const parsed = JSON.parse(stored);
      items.forEach(({ movieId }) => {
        const key = String(movieId);
        if (parsed[key]) {
          parsed[key] = parsed[key].filter((l: CustomLink) => !delSet.has(l.id));
        }
      });
      localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
    }

    // 3. Batch API delete to cloud database
    try {
      await fetch('/api/curated-links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
    } catch (netErr) {
      console.warn('Batch network deletion error:', netErr);
    }

    window.dispatchEvent(new Event('cinefuel_links_updated'));
  } catch (err) {
    console.error('Failed to bulk delete global custom links:', err);
  }
}
