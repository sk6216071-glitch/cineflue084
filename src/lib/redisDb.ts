import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

// Support both standard Upstash env vars and Vercel KV auto-provisioned env vars
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/^["']|["']$/g, '').trim();
const REDIS_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').replace(/^["']|["']$/g, '').trim();

let redisClient: Redis | null = null;

if (REDIS_URL && REDIS_TOKEN) {
  try {
    redisClient = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
  } catch (err) {
    console.error('Failed to initialize Upstash Redis client:', err);
  }
}

const REDIS_HASH_KEY = 'cinefuel:curated_links';
const REDIS_DELETED_KEY = 'cinefuel:deleted_link_ids';
const LOCAL_FILE = path.join(process.cwd(), 'src', 'data', 'serverLinks.json');

/**
 * Reads local JSON fallback file safely
 */
export function getLocalFallbackLinks(): Record<string, any[]> {
  try {
    if (fs.existsSync(LOCAL_FILE)) {
      const raw = fs.readFileSync(LOCAL_FILE, 'utf-8');
      return JSON.parse(raw || '{}');
    }
  } catch (e) {
    console.error('Error reading local serverLinks.json:', e);
  }
  return {};
}

/**
 * Writes local JSON fallback file safely
 */
export function saveLocalFallbackLinks(data: Record<string, any[]>) {
  try {
    const dir = path.dirname(LOCAL_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing local serverLinks.json:', e);
  }
}

/**
 * Fetches all links or links for a specific movie from Upstash Redis (with local fallback)
 */
export async function getLinksFromDatabase(movieId?: number | string): Promise<{
  links?: any[];
  allLinks?: Record<string, any[]>;
  source: 'upstash_redis' | 'local_json';
}> {
  const localData = getLocalFallbackLinks();

  if (redisClient) {
    try {
      // Get all deleted link IDs to guarantee deleted links are never resurrected
      let deletedSet = new Set<string>();
      try {
        const deletedIds = await redisClient.smembers(REDIS_DELETED_KEY);
        if (Array.isArray(deletedIds)) {
          deletedSet = new Set(deletedIds as string[]);
        }
      } catch {}

      if (movieId) {
        const key = String(movieId);
        const redisLinks = await redisClient.hget<any[]>(REDIS_HASH_KEY, key);
        let list: any[] = [];
        if (Array.isArray(redisLinks)) {
          list = redisLinks;
        } else if (typeof redisLinks === 'string') {
          try { list = JSON.parse(redisLinks); } catch {}
        } else {
          // If key is totally absent in Redis, fallback to local
          list = localData[key] || [];
        }

        const filtered = list.filter((l: any) => l?.id && !deletedSet.has(l.id));
        return { links: filtered, source: 'upstash_redis' };
      }

      const allRedis = await redisClient.hgetall<Record<string, any>>(REDIS_HASH_KEY);
      if (allRedis && Object.keys(allRedis).length > 0) {
        const result: Record<string, any[]> = {};
        const allKeys = new Set([...Object.keys(localData), ...Object.keys(allRedis)]);

        for (const k of allKeys) {
          const rawVal = allRedis[k] !== undefined ? allRedis[k] : localData[k];
          let list: any[] = [];
          if (Array.isArray(rawVal)) {
            list = rawVal;
          } else if (typeof rawVal === 'string') {
            try { list = JSON.parse(rawVal); } catch {}
          }
          const filtered = list.filter((l: any) => l?.id && !deletedSet.has(l.id));
          if (filtered.length > 0) {
            result[k] = filtered;
          }
        }
        return { allLinks: result, source: 'upstash_redis' };
      }
    } catch (err: any) {
      console.warn('Upstash Redis read failed, using local JSON fallback:', err.message);
    }
  }

  // Fallback to local
  if (movieId) {
    return { links: localData[String(movieId)] || [], source: 'local_json' };
  }
  return { allLinks: localData, source: 'local_json' };
}

/**
 * Saves a link to Upstash Redis and local JSON backup
 */
export async function saveLinkToDatabase(movieId: number | string, link: any): Promise<boolean> {
  const key = String(movieId);

  // 1. Local backup
  try {
    const localData = getLocalFallbackLinks();
    const existing = localData[key] || [];
    localData[key] = [link, ...existing.filter((l: any) => l.id !== link.id && l.url !== link.url)];
    saveLocalFallbackLinks(localData);
  } catch (err: any) {
    console.error('Local backup save failed:', err.message);
  }

  // 2. Upstash Cloud Redis save
  if (redisClient) {
    try {
      if (link.id) {
        // Remove from deleted set in case of re-addition
        await redisClient.srem(REDIS_DELETED_KEY, link.id).catch(() => {});
      }

      let current: any[] = [];
      try {
        const fetched = await redisClient.hget<any>(REDIS_HASH_KEY, key);
        if (Array.isArray(fetched)) current = fetched;
        else if (typeof fetched === 'string') {
          try { current = JSON.parse(fetched); } catch {}
        }
      } catch {}

      if (current.length === 0) {
        const localData = getLocalFallbackLinks();
        current = localData[key] || [];
      }

      const updated = [link, ...current.filter((l: any) => l.id !== link.id && l.url !== link.url)];
      await redisClient.hset(REDIS_HASH_KEY, { [key]: updated });
    } catch (err: any) {
      console.error('Upstash Redis save error:', err.message);
    }
  }

  return true;
}

/**
 * Saves multiple links to Upstash Redis and local JSON backup in one atomic operation
 */
export async function saveMultipleLinksToDatabase(movieId: number | string, links: any[]): Promise<boolean> {
  if (!links || links.length === 0) return true;
  const key = String(movieId);

  // 1. Local backup
  try {
    const localData = getLocalFallbackLinks();
    const existing = localData[key] || [];
    const newIds = new Set(links.map((l) => l.id).filter(Boolean));
    const newUrls = new Set(links.map((l) => l.url).filter(Boolean));
    const filteredExisting = existing.filter((l: any) => !newIds.has(l.id) && !newUrls.has(l.url));
    localData[key] = [...links, ...filteredExisting];
    saveLocalFallbackLinks(localData);
  } catch (err: any) {
    console.error('Local backup batch save failed:', err.message);
  }

  // 2. Upstash Cloud Redis save
  if (redisClient) {
    try {
      const linkIds = links.map((l) => l.id).filter(Boolean);
      if (linkIds.length > 0) {
        await redisClient.srem(REDIS_DELETED_KEY, ...linkIds).catch(() => {});
      }

      let current: any[] = [];
      try {
        const fetched = await redisClient.hget<any>(REDIS_HASH_KEY, key);
        if (Array.isArray(fetched)) current = fetched;
        else if (typeof fetched === 'string') {
          try { current = JSON.parse(fetched); } catch {}
        }
      } catch {}

      if (current.length === 0) {
        const localData = getLocalFallbackLinks();
        current = localData[key] || [];
      }

      const newIds = new Set(links.map((l) => l.id).filter(Boolean));
      const newUrls = new Set(links.map((l) => l.url).filter(Boolean));
      const filteredCurrent = current.filter((l: any) => !newIds.has(l.id) && !newUrls.has(l.url));
      const updated = [...links, ...filteredCurrent];

      await redisClient.hset(REDIS_HASH_KEY, { [key]: updated });
    } catch (err: any) {
      console.error('Upstash Redis batch save error:', err.message);
    }
  }

  return true;
}

/**
 * Deletes a link from Upstash Redis and local JSON backup
 */
export async function deleteLinkFromDatabase(movieId: number | string, linkId: string): Promise<boolean> {
  const key = String(movieId);

  // 1. Local backup deletion
  try {
    const localData = getLocalFallbackLinks();
    if (localData[key]) {
      localData[key] = localData[key].filter((l: any) => l.id !== linkId);
      saveLocalFallbackLinks(localData);
    }
  } catch {}

  // 2. Upstash Cloud Redis deletion
  if (redisClient) {
    try {
      // Record in permanent tombstone set
      await redisClient.sadd(REDIS_DELETED_KEY, linkId);

      const fetched = await redisClient.hget<any>(REDIS_HASH_KEY, key);
      let list: any[] = [];
      if (Array.isArray(fetched)) {
        list = fetched;
      } else if (typeof fetched === 'string') {
        try { list = JSON.parse(fetched); } catch {}
      }
      const updated = list.filter((l: any) => l.id !== linkId);
      await redisClient.hset(REDIS_HASH_KEY, { [key]: updated });
    } catch (err: any) {
      console.error('Upstash Redis deletion error:', err.message);
    }
  }

  return true;
}

/**
 * Batch deletes multiple links from Upstash Redis and local JSON backup
 */
export async function deleteMultipleLinksFromDatabase(items: Array<{ movieId: number | string; linkId: string }>): Promise<boolean> {
  if (!items || items.length === 0) return true;

  // 1. Local backup deletion
  try {
    const localData = getLocalFallbackLinks();
    const delSet = new Set(items.map((i) => i.linkId));
    items.forEach(({ movieId }) => {
      const key = String(movieId);
      if (localData[key]) {
        localData[key] = localData[key].filter((l: any) => !delSet.has(l.id));
      }
    });
    saveLocalFallbackLinks(localData);
  } catch {}

  // 2. Upstash Cloud Redis deletion
  if (redisClient) {
    try {
      const linkIds = items.map((i) => i.linkId);
      if (linkIds.length > 0) {
        await redisClient.sadd(REDIS_DELETED_KEY, linkIds[0], ...linkIds.slice(1));
      }

      const byMovie: Record<string, Set<string>> = {};
      items.forEach(({ movieId, linkId }) => {
        const k = String(movieId);
        if (!byMovie[k]) byMovie[k] = new Set();
        byMovie[k].add(linkId);
      });

      for (const [key, delIds] of Object.entries(byMovie)) {
        const fetched = await redisClient.hget<any>(REDIS_HASH_KEY, key);
        let list: any[] = [];
        if (Array.isArray(fetched)) {
          list = fetched;
        } else if (typeof fetched === 'string') {
          try { list = JSON.parse(fetched); } catch {}
        }
        const updated = list.filter((l: any) => !delIds.has(l.id));
        await redisClient.hset(REDIS_HASH_KEY, { [key]: updated });
      }
    } catch (err: any) {
      console.error('Upstash Redis batch deletion error:', err.message);
    }
  }

  return true;
}

/**
 * Seeds all local links into Upstash Redis
 */
export async function seedLocalLinksToRedis(): Promise<{ success: boolean; totalTitles: number }> {
  if (!redisClient) return { success: false, totalTitles: 0 };
  try {
    const local = getLocalFallbackLinks();
    const keys = Object.keys(local);
    if (keys.length === 0) return { success: true, totalTitles: 0 };

    await redisClient.hset(REDIS_HASH_KEY, local);
    return { success: true, totalTitles: keys.length };
  } catch (err: any) {
    console.error('Seeding to Upstash Redis failed:', err.message);
    return { success: false, totalTitles: 0 };
  }
}
