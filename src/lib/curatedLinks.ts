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
    const url = movieId ? `/api/curated-links?movieId=${movieId}` : '/api/curated-links';
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const stored = localStorage.getItem('cinefuel_custom_links');
    const parsed = stored ? JSON.parse(stored) : {};

    let changed = false;
    if (movieId && Array.isArray(data.links)) {
      const key = String(movieId);
      const existing: CustomLink[] = parsed[key] || [];
      const linkMap = new Map<string, CustomLink>();
      existing.forEach((l) => linkMap.set(l.id, l));
      data.links.forEach((l: CustomLink) => {
        if (!linkMap.has(l.id)) {
          linkMap.set(l.id, l);
          changed = true;
        }
      });
      if (changed) {
        parsed[key] = Array.from(linkMap.values());
      }
    } else if (data.allLinks && typeof data.allLinks === 'object') {
      Object.entries(data.allLinks).forEach(([key, list]) => {
        if (Array.isArray(list)) {
          const existing: CustomLink[] = parsed[key] || [];
          const linkMap = new Map<string, CustomLink>();
          existing.forEach((l) => linkMap.set(l.id, l));
          list.forEach((l: CustomLink) => {
            if (!linkMap.has(l.id)) {
              linkMap.set(l.id, l);
              changed = true;
            }
          });
          parsed[key] = Array.from(linkMap.values());
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
export function deleteGlobalCustomLink(movieId: number, linkId: string): void {
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

    window.dispatchEvent(new Event('cinefuel_links_updated'));

    // Also persist deletion to server database
    fetch(`/api/curated-links?movieId=${movieId}&linkId=${linkId}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to delete global custom link:', err);
  }
}
