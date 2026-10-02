/**
 * Safe LocalStorage Utility for CineFuel
 * Prevents QuotaExceededError crashes across all browsers and devices.
 */

const MAX_TITLE_CACHE_ITEMS = 50;
const MAX_LINK_CACHE_TITLES = 15;

/**
 * Safely set an item in localStorage with automatic QuotaExceededError protection and cache pruning.
 * Never throws an error — guaranteeing React components never crash from storage limits.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      String(err?.message || '').toLowerCase().includes('quota') ||
      String(err?.message || '').toLowerCase().includes('storage');

    if (isQuotaError) {
      console.warn(`[SafeStorage] Quota exceeded while writing "${key}". Pruning bloated caches...`);
      try {
        // Prune large non-critical caches to instantly free up browser storage quota
        localStorage.removeItem('cinefuel_known_titles_cache');
        localStorage.removeItem('cinefuel_custom_links');

        // Retry writing the key
        localStorage.setItem(key, value);
        return true;
      } catch {
        console.warn(`[SafeStorage] Storage still full after pruning. Skipping key "${key}".`);
        return false;
      }
    }
    return false;
  }
}

/**
 * Safely get an item from localStorage. Never throws.
 */
export function safeGetLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely remove an item from localStorage. Never throws.
 */
export function safeRemoveLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Prunes the local custom links cache so it only stores up to `MAX_LINK_CACHE_TITLES` titles.
 * Prevents the client storage from ever bloating beyond tens of kilobytes.
 */
export function pruneCustomLinksCache(map: Record<string, any>): Record<string, any> {
  const entries = Object.entries(map);
  if (entries.length <= MAX_LINK_CACHE_TITLES) return map;
  // Keep only the most recent titles
  return Object.fromEntries(entries.slice(-MAX_LINK_CACHE_TITLES));
}

/**
 * Prunes the known titles cache to a safe size.
 */
export function pruneKnownTitlesCache(map: Record<string, any>): Record<string, any> {
  const entries = Object.entries(map);
  if (entries.length <= MAX_TITLE_CACHE_ITEMS) return map;
  return Object.fromEntries(entries.slice(-MAX_TITLE_CACHE_ITEMS));
}
