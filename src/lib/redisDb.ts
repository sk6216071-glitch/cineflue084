import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { TitleDetails } from '@/types';
import { getTitleDetails, getLightweightTitleCard } from '@/lib/tmdb';
import { detectShowPlatform, stripWatermarks } from '@/lib/seasonParser';

import { getEnv } from '@/lib/env';

export function getRedisClient(): Redis | null {
  const url = (getEnv('UPSTASH_REDIS_REST_URL') || getEnv('KV_REST_API_URL')).replace(/^["']|["']$/g, '').trim();
  const token = (getEnv('UPSTASH_REDIS_REST_TOKEN') || getEnv('KV_REST_API_TOKEN')).replace(/^["']|["']$/g, '').trim();
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (err) {
    console.error('Failed to initialize Upstash Redis client:', err);
    return null;
  }
}

const REDIS_HASH_KEY = 'cinefuel:curated_links';
const REDIS_DELETED_KEY = 'cinefuel:deleted_link_ids';
const LOCAL_FILE = path.join(process.cwd(), 'src', 'data', 'serverLinks.json');

/**
 * Configurable catalog cache TTL in seconds (default 300s / 5 minutes)
 */
export const CATALOG_CACHE_TTL_SECONDS = 300;

let localCachedCatalogVersion = 1;
let localCatalogVersionExpiresAt = 0;

/**
 * Returns current catalog cache version from Redis (versioned namespace)
 */
export async function getCatalogCacheVersion(): Promise<number> {
  const now = Date.now();
  if (localCatalogVersionExpiresAt > now) {
    return localCachedCatalogVersion;
  }
  const redisClient = getRedisClient();
  if (!redisClient) return 1;
  const env = (getEnv('APP_ENV') || getEnv('CINEFUEL_ENV') || 'staging').toLowerCase();
  try {
    const v = await redisClient.get<number>(`cinefuel:${env}:catalog:version`);
    const num = Number(v) || 1;
    localCachedCatalogVersion = num;
    localCatalogVersionExpiresAt = now + 10000; // 10s local TTL
    return num;
  } catch {
    return 1;
  }
}

/**
 * Invalidates the Redis catalog summary cache for all media types
 * Uses an atomic version counter in Redis so all previous page caches become obsolete
 * without needing FLUSHDB or deleting unrelated keys.
 */
export async function invalidateCatalogCache(): Promise<void> {
  const redisClient = getRedisClient();
  if (!redisClient) return;
  const env = (getEnv('APP_ENV') || getEnv('CINEFUEL_ENV') || 'staging').toLowerCase();
  try {
    const nextVer = await redisClient.incr(`cinefuel:${env}:catalog:version`);
    localCachedCatalogVersion = Number(nextVer) || (localCachedCatalogVersion + 1);
    localCatalogVersionExpiresAt = Date.now() + 10000;

    // Delete legacy unversioned root keys
    const keys = [
      `cinefuel:${env}:catalog:all`,
      `cinefuel:${env}:catalog:movie`,
      `cinefuel:${env}:catalog:tv`,
    ];
    await redisClient.del(...keys).catch(() => {});
  } catch (err: any) {
    console.warn('Failed to invalidate catalog cache in Redis:', err.message);
  }
}

export interface CatalogCursorData {
  page: number;
  sortDate?: string;
  movieId?: string;
}

export function encodeCatalogCursor(data: CatalogCursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCatalogCursor(token?: string | null): CatalogCursorData | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.page === 'number' && parsed.page >= 1) {
      return parsed as CatalogCursorData;
    }
  } catch {}
  return null;
}

// In-memory single-flight promise map to prevent cache stampedes in Cloudflare Worker runtime
const inFlightCatalogRequests = new Map<string, Promise<PaginatedUploadedResult>>();

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

function isFileSystemWritable(): boolean {
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.CLOUDFLARE_WORKER || typeof (process as any).getBuiltinModule !== 'undefined') {
    return false;
  }
  return true;
}

/**
 * Writes local JSON fallback file safely
 */
export function saveLocalFallbackLinks(data: Record<string, any[]>): boolean {
  if (!isFileSystemWritable()) return false;
  try {
    const dir = path.dirname(LOCAL_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing local serverLinks.json:', e);
  }
  return false;
}

/**
 * Fetches all links or links for a specific movie from Upstash Redis (with local fallback)
 */
export async function getLinksFromDatabase(
  movieId?: number | string,
  pagination?: { page?: number; limit?: number }
): Promise<{
  links?: any[];
  allLinks?: Record<string, any[]>;
  total?: number;
  source: 'mongodb_atlas' | 'upstash_redis' | 'local_json';
}> {
  // 1. Try MongoDB Atlas if connected
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('links');
      if (movieId) {
        const docs = await collection.find({ movieId: String(movieId) }).sort({ createdAt: -1 }).toArray();
        if (docs && docs.length > 0) {
          const cleaned = docs.map(({ _id, ...rest }) => rest);
          return { links: cleaned, source: 'mongodb_atlas' };
        }
      } else {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.max(1, Math.min(200, pagination?.limit || 50));
        const total = await collection.estimatedDocumentCount().catch(() => 0);
        const docs = await collection
          .find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray();
        const grouped: Record<string, any[]> = {};
        for (const doc of docs || []) {
          const { _id, movieId: mId, ...rest } = doc;
          const k = String(mId || rest.movieId);
          if (!grouped[k]) grouped[k] = [];
          grouped[k].push(rest);
        }
        return { allLinks: grouped, total, source: 'mongodb_atlas' };
      }
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas read fallback:', mongoErr.message);
  }

  const localData = getLocalFallbackLinks();
  const redisClient = getRedisClient();

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
  let persisted = false;

  // 1. MongoDB Atlas Cloud save
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('links').updateOne(
        { movieId: key, url: link.url },
        { $set: { ...link, movieId: key, updatedAt: new Date() } },
        { upsert: true }
      );
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas save warning:', err.message);
  }

  // 2. Upstash Cloud Redis save
  const redisClient = getRedisClient();
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
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis save error:', err.message);
    }
  }

  // 3. Local backup (only when writable)
  if (isFileSystemWritable()) {
    try {
      const localData = getLocalFallbackLinks();
      const existing = localData[key] || [];
      localData[key] = [link, ...existing.filter((l: any) => l.id !== link.id && l.url !== link.url)];
      if (saveLocalFallbackLinks(localData)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local backup save failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not save link.');
  }

  await invalidateCatalogCache().catch(() => {});
  return true;
}

/**
 * Checks whether a specific link URL already exists for a movie in the database.
 */
export function isLinkAlreadyInDatabase(movieId: number | string, url: string): boolean {
  if (!url) return false;
  const localData = getLocalFallbackLinks();
  const existing = localData[String(movieId)] || [];
  return existing.some((l: any) => l.url === url);
}

/**
 * Saves multiple links to Upstash Redis and local JSON backup in one atomic operation
 */
export async function saveMultipleLinksToDatabase(movieId: number | string, links: any[]): Promise<boolean> {
  if (!links || links.length === 0) return true;
  const key = String(movieId);
  let persisted = false;

  // 1. MongoDB Atlas Cloud batch save
  try {
    const db = await getDatabase();
    if (db) {
      const ops = links.map((l) => ({
        updateOne: {
          filter: { movieId: key, url: l.url },
          update: { $set: { ...l, movieId: key, updatedAt: new Date() } },
          upsert: true,
        },
      }));
      if (ops.length > 0) {
        await db.collection('links').bulkWrite(ops);
        persisted = true;
      }
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas batch save warning:', err.message);
  }

  // 2. Upstash Cloud Redis save
  const redisClient = getRedisClient();
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
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis batch save error:', err.message);
    }
  }

  // 3. Local backup
  if (isFileSystemWritable()) {
    try {
      const localData = getLocalFallbackLinks();
      const existing = localData[key] || [];
      const newIds = new Set(links.map((l) => l.id).filter(Boolean));
      const newUrls = new Set(links.map((l) => l.url).filter(Boolean));
      const filteredExisting = existing.filter((l: any) => !newIds.has(l.id) && !newUrls.has(l.url));
      localData[key] = [...links, ...filteredExisting];
      if (saveLocalFallbackLinks(localData)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local backup batch save failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not save batch links.');
  }

  await invalidateCatalogCache().catch(() => {});
  return true;
}

/**
 * Deletes a link from Upstash Redis and local JSON backup
 */
export async function deleteLinkFromDatabase(movieId: number | string, linkId: string): Promise<boolean> {
  const key = String(movieId);
  let persisted = false;

  // 1. MongoDB Atlas Cloud deletion
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('links').deleteOne({ movieId: key, id: linkId });
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas delete warning:', err.message);
  }

  // 2. Upstash Cloud Redis deletion
  const redisClient = getRedisClient();
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
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis deletion error:', err.message);
    }
  }

  // 3. Local backup deletion
  if (isFileSystemWritable()) {
    try {
      const localData = getLocalFallbackLinks();
      if (localData[key]) {
        localData[key] = localData[key].filter((l: any) => l.id !== linkId);
        if (saveLocalFallbackLinks(localData)) {
          persisted = true;
        }
      }
    } catch {}
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not delete link.');
  }

  await invalidateCatalogCache().catch(() => {});
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
  const redisClient = getRedisClient();
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

  // 3. MongoDB Atlas Cloud batch deletion
  try {
    const db = await getDatabase();
    if (db) {
      const ids = items.map((i) => i.linkId);
      await db.collection('links').deleteMany({ id: { $in: ids } });
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas batch delete warning:', err.message);
  }

  await invalidateCatalogCache().catch(() => {});
  return true;
}

/**
 * Seeds all local links into Upstash Redis
 */
export async function seedLocalLinksToRedis(): Promise<{ success: boolean; totalTitles: number }> {
  const redisClient = getRedisClient();
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

/**
 * Migrates an old filehost domain to a new active domain across all links
 */
export async function migrateDomainInDatabase(
  oldDomain: string,
  newDomain: string
): Promise<{ success: boolean; updatedCount: number; oldDomain: string; newDomain: string }> {
  const cleanOld = oldDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  const cleanNew = newDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  if (!cleanOld || !cleanNew || cleanOld === cleanNew) {
    return { success: false, updatedCount: 0, oldDomain: cleanOld, newDomain: cleanNew };
  }

  let totalUpdated = 0;

  // 1. Local fallback update
  try {
    const localData = getLocalFallbackLinks();
    let localCount = 0;
    for (const [movieId, links] of Object.entries(localData)) {
      if (!Array.isArray(links)) continue;
      for (const link of links) {
        if (link.url && link.url.includes(cleanOld)) {
          link.url = link.url.replace(cleanOld, cleanNew);
          link.updatedAt = new Date().toISOString();
          localCount++;
        }
      }
    }
    if (localCount > 0) {
      saveLocalFallbackLinks(localData);
      totalUpdated = Math.max(totalUpdated, localCount);
    }
  } catch (err) {
    console.error('Local JSON domain migration error:', err);
  }

  // 2. Upstash Redis Cloud update
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const allKeys = await redisClient.hgetall(REDIS_HASH_KEY);
      if (allKeys && typeof allKeys === 'object') {
        let redisCount = 0;
        const toUpdate: Record<string, any[]> = {};
        for (const [movieId, linksVal] of Object.entries(allKeys)) {
          let links: any[] = [];
          if (Array.isArray(linksVal)) links = linksVal;
          else if (typeof linksVal === 'string') {
            try { links = JSON.parse(linksVal); } catch {}
          }
          let modified = false;
          for (const link of links) {
            if (link.url && link.url.includes(cleanOld)) {
              link.url = link.url.replace(cleanOld, cleanNew);
              link.updatedAt = new Date().toISOString();
              modified = true;
              redisCount++;
            }
          }
          if (modified) {
            toUpdate[movieId] = links;
          }
        }
        if (Object.keys(toUpdate).length > 0) {
          await redisClient.hset(REDIS_HASH_KEY, toUpdate);
          totalUpdated = Math.max(totalUpdated, redisCount);
        }
      }
    } catch (err: any) {
      console.warn('Redis domain migration warning:', err.message);
    }
  }

  // 3. MongoDB Atlas Cloud update
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('links');
      const docs = await collection.find({ url: { $regex: cleanOld, $options: 'i' } }).toArray();
      if (docs && docs.length > 0) {
        const ops = docs.map((doc) => {
          const newUrl = doc.url.replace(new RegExp(cleanOld, 'gi'), cleanNew);
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: {
                  url: newUrl,
                  updatedAt: new Date(),
                },
              },
            },
          };
        });
        if (ops.length > 0) {
          await collection.bulkWrite(ops);
          totalUpdated = Math.max(totalUpdated, ops.length);
        }
      }
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas domain migration warning:', err.message);
  }

  return { success: true, updatedCount: totalUpdated, oldDomain: cleanOld, newDomain: cleanNew };
}

// Helper to detect synthetic/dummy placeholders
export const isDummyTitle = (t?: string) =>
  !t || t.startsWith('Series Feature #') || t.startsWith('Cinema Feature #');

export const extractUploadMeta = (docItem: any, mType: 'movie' | 'tv', details?: any) => {
  const docTitle = String(docItem?.title || '');
  const docQuality = String(docItem?.quality || '');
  const docAudio = String(docItem?.audioLanguage || '');
  const movieTitle = String(details?.title || details?.name || docItem?.movieTitle || '');
  const origLang = String(
    details?.original_language || docItem?.originalLanguage || docItem?.original_language || ''
  ).toLowerCase().trim();
  const origCountry: string[] = Array.isArray(details?.origin_country)
    ? details.origin_country
    : Array.isArray(docItem?.originCountry)
    ? docItem.originCountry
    : [];

  const cleanDocTitle = stripWatermarks(docTitle);
  const cleanDocQuality = stripWatermarks(docQuality);

  const has1080p = /(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(cleanDocTitle) ||
                   /(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(cleanDocQuality);
  const has720p = /(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(cleanDocTitle) ||
                  /(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(cleanDocQuality);
  const has480p = /(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(cleanDocTitle) ||
                  /(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(cleanDocQuality);

  // Only genuine 4K if NOT explicitly 1080p / 720p / 480p
  const is4k = !has1080p && !has720p && !has480p && (
    /(?:^|[\s._\-[\]()])(?:2160p|2160i|uhd|\b4k\b)(?:[\s._\-[\]()]|$)/i.test(cleanDocTitle) ||
    /(?:^|[\s._\-[\]()])(?:2160p|2160i|uhd|\b4k\b)(?:[\s._\-[\]()]|$)/i.test(cleanDocQuality)
  );
  const is1080p = has1080p || (!is4k && !has720p && !has480p);
  const isDV = /(?:^|[\s._\-[\]()])(?:dv|dovi|dolby[.\s_-]*vision)(?:[\s._\-[\]()]|$)/i.test(cleanDocTitle);
  const isHDR = /(?:^|[\s._\-[\]()])(?:hdr10\+|hdr10|hdr)(?:[\s._\-[\]()]|$)/i.test(cleanDocTitle);
  const isBluRay = /(?:^|[\s._\-[\]()])(?:bluray|blu-ray|remux|bdrip)(?:[\s._\-[\]()]|$)/i.test(cleanDocTitle);

  const platform = detectShowPlatform(docTitle, details);

  // Comprehensive category classification (Matches OlAMovies standard)
  let category = '';
  const titleCombined = `${movieTitle} ${docTitle}`.toLowerCase();
  const isHollywoodTitle = /(?:marvel|avenger|spider[- ]*man|spiderman|iron[- ]*man|thor|captain\s*america|captain\s*marvel|black\s*widow|ant[- ]*man|antman|doctor\s*strange|black\s*panther|guardians\s*of\s*the\s*galaxy|deadpool|wolverine|x[- ]*men|eternals|shang[- ]*chi|loki|hawkeye|daredevil|punisher|batman|superman|justice\s*league|wonder\s*woman|aquaman|flash|joker|harley\s*quinn|shazam|lanterns|star\s*wars|avatar|jurassic|fast\s*(?:and|&)\s*furious|mission:?\s*impossible|transformers?|harry\s*potter|fantastic\s*beasts|lord\s*of\s*the\s*rings|hobbit|game\s*of\s*thrones|house\s*of\s*the\s*dragon|stranger\s*things|godzilla|kong|john\s*wick|dune|oppenheimer|interstellar|inception|matrix|terminator|gladiator|alien|predator|blade\s*runner|mad\s*max|planet\s*of\s*the\s*apes|fallout|the\s*boys|reacher|jack\s*ryan|witcher|halo|peaky\s*blinders|walking\s*dead|american\s*primeval|squid\s*game|toy\s*story|pixar|disney)/i.test(titleCombined);
  const hasEnglishOrDual = /(?:dual|multi|english|eng|\+\s*eng|eng\s*\+|org\s*eng|atmos|truehd)/i.test(`${docTitle} ${docAudio}`);
  const isExplicitBollywood = /(?:bollywood|hindi\s*movie|desiremovies|bollyflix|vegamovies|katmoviehd)/i.test(`${titleCombined} ${docAudio}`);
  const isIndianLang = origLang === 'hi' || (origCountry.includes('IN') && (origLang === 'hi' || !origLang));

  if (mType === 'tv') {
    category = 'TV SERIES';
  } else if (isIndianLang && !isHollywoodTitle) {
    category = 'BOLLYWOOD';
  } else if (['te', 'ta', 'ml', 'kn'].includes(origLang) && !isHollywoodTitle) {
    category = 'SOUTH INDIAN';
  } else if (origLang === 'ja') {
    category = 'ANIME';
  } else if (origLang === 'ko') {
    category = 'KOREAN';
  } else if (origLang === 'en' || origCountry.some((c: string) => ['US', 'GB', 'CA', 'AU', 'NZ'].includes(c))) {
    category = 'HOLLYWOOD';
  } else if (isHollywoodTitle || hasEnglishOrDual) {
    category = 'HOLLYWOOD';
  } else if (isExplicitBollywood) {
    category = 'BOLLYWOOD';
  } else {
    category = 'HOLLYWOOD';
  }

  const sizeMatch = docItem?.size || docTitle.match(/\b(\d+(?:\.\d+)?\s*(?:gb|mb|tb))\b/i)?.[1]?.toUpperCase();

  return {
    is4k,
    is1080p,
    isDV,
    isHDR,
    isBluRay,
    platform: platform || (mType === 'tv' ? 'TV' : 'MOVIE'),
    category,
    size: sizeMatch || '',
    createdAt: docItem?.createdAt || docItem?.updatedAt || '',
    rawTitle: docTitle,
  };
};

export interface PaginatedUploadedOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  type?: 'all' | 'movie' | 'tv';
  quality?: string;
  category?: string;
  audio?: string;
  ott?: string;
  query?: string;
  genre?: string | number;
  skipCount?: boolean;
}

export interface PaginatedUploadedResult {
  items: TitleDetails[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore?: boolean;
  source?: 'cache' | 'database';
}

/**
 * Fetches paginated titles that CONTAIN CUSTOM LINKS exclusively.
 * Implements TRUE DATABASE-LEVEL PAGINATION, PROJECTION, and REDIS PAGE CACHING.
 * Retrieves only the requested page (e.g. 24 titles) rather than thousands of documents.
 */
export async function getPaginatedUploadedTitles(
  options: PaginatedUploadedOptions = {}
): Promise<PaginatedUploadedResult> {
  const {
    cursor,
    page: rawPage = 1,
    limit: rawLimit = 24,
    type = 'all',
    quality,
    category,
    audio,
    ott,
    query,
  } = options;

  let page = rawPage;
  if (cursor) {
    const decoded = decodeCatalogCursor(cursor);
    if (decoded && typeof decoded.page === 'number') {
      page = decoded.page;
    } else {
      page = 1;
    }
  }

  const safeLimit = Math.max(1, Math.min(100, rawLimit));
  const safePage = Math.max(1, page);

  // 1. Try Redis Page Cache First (300s TTL)
  const redisClient = getRedisClient();
  const env = (getEnv('APP_ENV') || getEnv('CINEFUEL_ENV') || 'staging').toLowerCase();
  const version = await getCatalogCacheVersion();
  const filterKey = `${quality || '_'}:${audio || '_'}:${category || '_'}:${ott || '_'}:${query || '_'}`.toLowerCase();
  const countTag = options.skipCount ? 'fast' : 'full';
  const cacheKey = `cinefuel:${env}:catalog:v${version}:${type}:p${safePage}:l${safeLimit}:${countTag}:${filterKey}`;
  const fullCacheKey = `cinefuel:${env}:catalog:v${version}:${type}:p${safePage}:l${safeLimit}:full:${filterKey}`;

  if (redisClient) {
    try {
      let cached: any = null;
      if (options.skipCount) {
        cached = (await redisClient.get<PaginatedUploadedResult>(fullCacheKey)) || (await redisClient.get<PaginatedUploadedResult>(cacheKey));
      } else {
        cached = await redisClient.get<PaginatedUploadedResult>(cacheKey);
      }
      let data: PaginatedUploadedResult | null = null;
      if (typeof cached === 'string') {
        try { data = JSON.parse(cached); } catch {}
      } else if (cached && typeof cached === 'object' && Array.isArray((cached as any).items)) {
        data = cached as PaginatedUploadedResult;
      }
      if (data && Array.isArray(data.items)) {
        return { ...data, source: 'cache' as any };
      }
    } catch (cacheErr: any) {
      console.warn('Redis catalog page cache read error (continuing with DB fallback):', cacheErr.message);
    }
  }

  // 2. Prevent Cache Stampedes via In-Flight Single-Flight Promise
  if (inFlightCatalogRequests.has(cacheKey)) {
    return await inFlightCatalogRequests.get(cacheKey)!;
  }

  const queryPromise = (async (): Promise<PaginatedUploadedResult> => {
    // 3. Database-Level Query on MongoDB Atlas
    try {
      const db = await getDatabase();
      if (db) {
        const collection = db.collection('links');

        // Build Match Stage
        const matchStage: any = {};
        if (type === 'movie') {
          matchStage.mediaType = 'movie';
        } else if (type === 'tv') {
          matchStage.$or = [
            { mediaType: 'tv' },
            { linkType: { $in: ['zip_pack', 'single_episode'] } },
            { category: { $in: ['ZipPack', 'SingleEpisode'] } },
            { seasonNumber: { $gt: 0 } },
          ];
        } else {
          matchStage.mediaType = { $in: ['movie', 'tv'] };
        }

        // Quality filter
        if (quality) {
          const qLower = quality.toLowerCase();
          if (qLower === '4k' || qLower === '2160p') {
            matchStage.$or = [{ quality: /4k|2160p|uhd/i }, { title: /4k|2160p|uhd/i }];
          } else if (qLower === 'remux') {
            matchStage.$or = [{ quality: /remux/i }, { title: /remux/i }];
          } else if (qLower === 'hdr' || qLower === '4k_hdr') {
            matchStage.$or = [{ quality: /hdr|dovi|dolby\s*vision/i }, { title: /hdr|dovi|dolby\s*vision/i }];
          } else if (qLower === '1080p') {
            matchStage.$or = [{ quality: /1080p|fhd/i }, { title: /1080p|fhd/i }];
          } else if (qLower === '720p') {
            matchStage.$or = [{ quality: /720p/i }, { title: /720p/i }];
          }
        }

        // Audio filter
        if (audio) {
          const aLower = audio.toLowerCase();
          if (aLower === 'hindi') {
            matchStage.$or = [{ audioLanguage: /hindi/i }, { title: /hindi/i }];
          } else if (aLower === 'dual') {
            matchStage.$or = [{ audioLanguage: /dual|\+|hindi.*eng/i }, { title: /dual|\+|hindi.*eng/i }];
          } else if (aLower === 'english') {
            matchStage.$or = [{ audioLanguage: /english|eng/i }, { title: /english|eng/i }];
          }
        }

        // Category filter
        if (category) {
          const cLower = category.toLowerCase();
          if (cLower === 'zippack' || cLower === 'zip') {
            matchStage.$or = [
              { linkType: 'zip_pack' },
              { category: 'ZipPack' },
              { title: /season.*complete|zip.*pack/i },
            ];
          }
        }

        // Query filter
        if (query && query.trim()) {
          const words = query.trim().split(/\s+/).map((w) => new RegExp(w, 'i'));
          matchStage.$and = words.map((w) => ({
            $or: [{ title: w }, { movieTitle: w }],
          }));
        }

        // Distinct titles count (cached in Redis with 300s TTL)
        const countCacheKey = `cinefuel:${env}:catalog:v${version}:count:${type}:${filterKey}`;
        let total = 0;
        if (options.skipCount) {
          total = safeLimit;
        } else {
          if (redisClient) {
            try {
              const cachedCount = await redisClient.get<number>(countCacheKey);
              if (typeof cachedCount === 'number') total = cachedCount;
            } catch {}
          }
          if (!total) {
            const distinctMovieIds = await collection.distinct('movieId', matchStage).catch(() => []);
            total = distinctMovieIds.length;
            if (redisClient && total > 0) {
              await redisClient.set(countCacheKey, total, { ex: CATALOG_CACHE_TTL_SECONDS }).catch(() => {});
            }
          }
        }

        const totalPages = Math.max(1, Math.ceil(total / safeLimit));

        if (safePage > totalPages && total > 0) {
          const emptyResult: PaginatedUploadedResult = {
            items: [],
            total,
            page: safePage,
            totalPages,
            limit: safeLimit,
            nextCursor: null,
            prevCursor: encodeCatalogCursor({ page: safePage - 1 }),
            hasMore: false,
          };
          return emptyResult;
        }

        // Pipeline with Projection & Limit before transfer
        const pipeline: any[] = [];
        if (Object.keys(matchStage).length > 0) {
          pipeline.push({ $match: matchStage });
        }

        pipeline.push(
          { $sort: { createdAt: -1, updatedAt: -1, movieId: 1 } },
          {
            $project: {
              movieId: 1,
              mediaType: 1,
              title: 1,
              movieTitle: 1,
              posterPath: 1,
              backdropPath: 1,
              quality: 1,
              audioLanguage: 1,
              category: 1,
              linkType: 1,
              createdAt: 1,
              updatedAt: 1,
              seasonNumber: 1,
              episodeNumber: 1,
              releaseDate: 1,
              voteAverage: 1,
            },
          },
          {
            $group: {
              _id: '$movieId',
              latestDoc: { $first: '$$ROOT' },
              linksCount: { $sum: 1 },
              sortDate: { $first: '$createdAt' },
            },
          },
          { $sort: { sortDate: -1, _id: 1 } },
          { $skip: (safePage - 1) * safeLimit },
          { $limit: safeLimit }
        );

        const aggResults = await collection.aggregate(pipeline).toArray();

        // Enrich the current page entries (at most safeLimit records) into lightweight card objects
        const items = aggResults.map((item: any) => {
          const mId = String(item._id || item.latestDoc?.movieId || '');
          const doc = item.latestDoc || {};
          const isTv =
            doc.mediaType === 'tv' ||
            (typeof doc.seasonNumber === 'number' && doc.seasonNumber > 0) ||
            doc.linkType === 'zip_pack' ||
            doc.linkType === 'single_episode' ||
            doc.category === 'ZipPack' ||
            doc.category === 'SingleEpisode' ||
            /s\d{1,2}e\d{1,2}|season\s*\d+/i.test(doc.title || '');

          const mediaType: 'movie' | 'tv' = isTv ? 'tv' : 'movie';
          const card = getLightweightTitleCard(mediaType, mId, doc, item.linksCount || 1);
          return {
            ...card,
            uploadMeta: extractUploadMeta(doc, mediaType, card),
          };
        }).filter(Boolean) as TitleDetails[];
        const hasMore = safePage < totalPages;
        const lastItem = aggResults[aggResults.length - 1];
        const nextCursor =
          hasMore && lastItem
            ? encodeCatalogCursor({
                page: safePage + 1,
                sortDate: lastItem.sortDate,
                movieId: String(lastItem._id),
              })
            : null;

        const prevCursor = safePage > 1 ? encodeCatalogCursor({ page: safePage - 1 }) : null;

        const resultPayload: PaginatedUploadedResult = {
          items,
          total,
          page: safePage,
          totalPages,
          limit: safeLimit,
          nextCursor,
          prevCursor,
          hasMore,
        };

        // Cache in Redis with 300s TTL
        if (redisClient && items.length > 0) {
          await redisClient.set(cacheKey, JSON.stringify(resultPayload), { ex: CATALOG_CACHE_TTL_SECONDS }).catch(() => {});
        }

        return { ...resultPayload, source: 'database' as any };
      }
    } catch (mongoErr: any) {
      console.warn('MongoDB Atlas getPaginatedUploadedTitles error (using local fallback):', mongoErr.message);
    }

    // 4. Local Fallback if MongoDB is offline
    const localData = getLocalFallbackLinks();
    const localList: Array<{ movieId: string; createdAt: string; link: any }> = [];
    const seen = new Set<string>();

    for (const [mId, links] of Object.entries(localData)) {
      if (!mId || mId === 'undefined' || mId === 'null' || seen.has(mId)) continue;
      if (Array.isArray(links) && links.length > 0) {
        const latest = links.reduce((a, b) =>
          new Date(a.createdAt || 0) > new Date(b.createdAt || 0) ? a : b
        );
        seen.add(mId);
        localList.push({ movieId: mId, createdAt: latest.createdAt || '', link: latest });
      }
    }

    localList.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const filtered = localList.filter((item) => {
      const isTv =
        item.link?.mediaType === 'tv' ||
        (typeof item.link?.seasonNumber === 'number' && item.link?.seasonNumber > 0) ||
        item.link?.linkType === 'zip_pack' ||
        item.link?.linkType === 'single_episode' ||
        item.link?.category === 'ZipPack' ||
        item.link?.category === 'SingleEpisode' ||
        /s\d{1,2}e\d{1,2}|season\s*\d+/i.test(item.link?.title || '');

      const mediaType: 'movie' | 'tv' = isTv ? 'tv' : 'movie';
      if (type === 'movie' && mediaType !== 'movie') return false;
      if (type === 'tv' && mediaType !== 'tv') return false;
      return true;
    });

    const localTotal = filtered.length;
    const localTotalPages = Math.max(1, Math.ceil(localTotal / safeLimit));
    const pagedEntries = filtered.slice((safePage - 1) * safeLimit, safePage * safeLimit);

    const localItems: TitleDetails[] = pagedEntries.map(({ movieId, link }) => ({
      id: Number(movieId) || (movieId as any),
      title: link?.title || 'Unknown Title',
      name: link?.title || 'Unknown Title',
      overview: 'Available on CineFuel.',
      poster_path: link?.posterPath || '/placeholder-poster.svg',
      backdrop_path: link?.backdropPath || '/placeholder-backdrop.svg',
      release_date: link?.releaseDate || '',
      first_air_date: link?.releaseDate || '',
      vote_average: 7.5,
      vote_count: 500,
      media_type: type === 'tv' ? 'tv' : 'movie',
      genres: [{ id: 28, name: 'Featured' }],
      uploadMeta: extractUploadMeta(link, type === 'tv' ? 'tv' : 'movie', link),
    }));

    const hasMore = safePage < localTotalPages;
    return {
      items: localItems,
      total: localTotal,
      page: safePage,
      totalPages: localTotalPages,
      limit: safeLimit,
      nextCursor: hasMore ? encodeCatalogCursor({ page: safePage + 1 }) : null,
      prevCursor: safePage > 1 ? encodeCatalogCursor({ page: safePage - 1 }) : null,
      hasMore,
    };
  })();

  inFlightCatalogRequests.set(cacheKey, queryPromise);
  try {
    return await queryPromise;
  } finally {
    inFlightCatalogRequests.delete(cacheKey);
  }
}

/**
 * Fetches the most recently uploaded titles from MongoDB Atlas (or local fallback)
 * and retrieves their TMDB metadata for display in the "Recently Added" carousel.
 */
export async function getRecentlyAddedTitles(
  limit = 24,
  mediaTypeFilter: 'all' | 'movie' | 'tv' = 'all'
): Promise<TitleDetails[]> {
  const paginated = await getPaginatedUploadedTitles({
    limit,
    type: mediaTypeFilter,
    page: 1,
    skipCount: true,
  });
  return paginated.items;
}

export interface FilterUploadedOptions {
  type?: 'movie' | 'tv' | 'all';
  quality?: string;
  category?: string;
  audio?: string;
  ott?: string;
  query?: string;
  limit?: number;
}

export interface EnrichedUploadedTitle extends TitleDetails {
  qualities: string[];
  linksCount: number;
  hasZipPack: boolean;
}

/**
 * Retrieves uploaded titles from MongoDB Atlas & local links with filtering by
 * Quality (4K, HDR, REMUX, 1080p), Media Type (Movie/TV), Audio, Category (ZipPack), or OTT platform.
 */
export async function getFilteredUploadedTitles(
  options: FilterUploadedOptions = {}
): Promise<{ items: EnrichedUploadedTitle[]; total: number }> {
  const {
    type = 'all',
    quality,
    category,
    audio,
    ott,
    query,
    limit = 60,
  } = options;

  const filterConditions: any[] = [];

  // 1. Media Type Filter
  if (type === 'movie') {
    filterConditions.push({ mediaType: 'movie' });
  } else if (type === 'tv') {
    filterConditions.push({
      $or: [
        { mediaType: 'tv' },
        { linkType: { $in: ['zip_pack', 'single_episode'] } },
        { category: { $in: ['ZipPack', 'SingleEpisode'] } },
        { seasonNumber: { $gt: 0 } },
      ],
    });
  }

  // 2. Quality Filter (HDR, REMUX, 1080p, 4K, 4k_hdr)
  if (quality) {
    const qLower = quality.toLowerCase();
    if (qLower === '4k_hdr' || qLower === '4khdr') {
      filterConditions.push({
        $or: [
          { quality: /4k|2160p/i },
          { quality: /hdr|dolby vision|dovi/i },
          { title: /4k|2160p/i },
          { title: /hdr|dolby vision|dovi/i },
        ],
      });
    } else if (qLower === '4k' || qLower === '2160p') {
      filterConditions.push({
        $or: [{ quality: /4k|2160p/i }, { title: /4k|2160p/i }],
      });
    } else if (qLower === 'hdr') {
      filterConditions.push({
        $or: [{ quality: /hdr|dolby vision|dovi/i }, { title: /hdr|dolby vision|dovi/i }],
      });
    } else if (qLower === 'remux') {
      filterConditions.push({
        $or: [{ quality: /remux/i }, { title: /remux/i }],
      });
    } else if (qLower === '1080p' || qLower === 'fhd') {
      filterConditions.push({
        $or: [{ quality: /1080p|fhd/i }, { title: /1080p|fhd/i }],
      });
    } else if (qLower === '720p' || qLower === 'hd') {
      filterConditions.push({
        $or: [{ quality: /720p/i }, { title: /720p/i }],
      });
    } else if (qLower === 'bluray') {
      filterConditions.push({
        $or: [{ quality: /bluray|bdrip/i }, { title: /bluray|bdrip/i }],
      });
    }
  }

  // 3. Category Filter (zippack)
  if (category) {
    const cLower = category.toLowerCase();
    if (cLower === 'zippack' || cLower === 'zip') {
      filterConditions.push({
        $or: [
          { linkType: 'zip_pack' },
          { category: 'ZipPack' },
          { title: /season.*complete/i },
          { title: /zip.*pack/i },
        ],
      });
    } else if (cLower === 'single_episode' || cLower === 'episode') {
      filterConditions.push({
        $or: [{ linkType: 'single_episode' }, { category: 'SingleEpisode' }],
      });
    }
  }

  // 4. Audio Language Filter
  if (audio) {
    const aLower = audio.toLowerCase();
    if (aLower === 'hindi') {
      filterConditions.push({
        $or: [{ audioLanguage: /hindi/i }, { title: /hindi/i }],
      });
    } else if (aLower === 'dual') {
      filterConditions.push({
        $or: [
          { audioLanguage: /dual|\+|hindi.*eng/i },
          { title: /dual|\+|hindi.*eng/i },
        ],
      });
    } else if (aLower === 'english') {
      filterConditions.push({
        $or: [{ audioLanguage: /english/i }, { title: /english/i }],
      });
    }
  }

  // 5. OTT Provider Filter
  if (ott) {
    const oLower = ott.toLowerCase();
    let ottRegex = new RegExp(oLower, 'i');
    if (oLower === 'netflix') ottRegex = /\b(nf|netflix)\b/i;
    else if (oLower === 'prime' || oLower === 'amazon') ottRegex = /\b(amzn|amazon|prime)\b/i;
    else if (oLower === 'hotstar') ottRegex = /\b(hs|hotstar|disney)\b/i;
    else if (oLower === 'jiocinema') ottRegex = /\b(jio|jiocinema)\b/i;
    else if (oLower === 'sonyliv') ottRegex = /\b(sony|sonyliv|liv)\b/i;
    else if (oLower === 'zee5') ottRegex = /\b(zee|zee5)\b/i;
    else if (oLower === 'appletv') ottRegex = /\b(atvp|apple)\b/i;

    filterConditions.push({
      $or: [
        { audioLanguage: ottRegex },
        { title: ottRegex },
        { quality: ottRegex },
        { url: ottRegex },
      ],
    });
  }

  // 6. Text Query
  if (query && query.trim().length > 0) {
    const qReg = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filterConditions.push({
      $or: [{ movieTitle: qReg }, { title: qReg }, { quality: qReg }],
    });
  }

  const mongoQuery = filterConditions.length > 0 ? { $and: filterConditions } : {};

  // Query MongoDB Atlas
  const groupedTitles = new Map<string, EnrichedUploadedTitle>();

  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('links');
      const docs = await collection
        .find(mongoQuery)
        .sort({ createdAt: -1, updatedAt: -1 })
        .limit(300)
        .toArray();

      for (const doc of docs) {
        const mId = String(doc.movieId || '');
        if (!mId || mId === 'undefined' || mId === 'null') continue;

        const qualString = `${doc.quality || ''} ${doc.title || ''}`.toUpperCase();
        const extractedQualities: string[] = [];
        if (qualString.includes('4K') || qualString.includes('2160P')) extractedQualities.push('4K UHD');
        if (qualString.includes('HDR') || qualString.includes('DOVI')) extractedQualities.push('HDR');
        if (qualString.includes('REMUX')) extractedQualities.push('REMUX');
        if (qualString.includes('1080P') || qualString.includes('FHD')) extractedQualities.push('1080p');
        if (qualString.includes('720P')) extractedQualities.push('720p');

        const isZip = doc.linkType === 'zip_pack' || doc.category === 'ZipPack' || /season.*complete/i.test(doc.title || '');

        if (!groupedTitles.has(mId)) {
          let mediaType: 'movie' | 'tv' = doc.mediaType === 'tv' ? 'tv' : 'movie';
          if (doc.mediaType !== 'movie' && (isZip || (typeof doc.seasonNumber === 'number' && doc.seasonNumber > 0))) {
            mediaType = 'tv';
          }

          groupedTitles.set(mId, {
            id: Number(mId),
            title: doc.movieTitle || `Title #${mId}`,
            name: doc.movieTitle || `Title #${mId}`,
            poster_path: doc.posterPath || null,
            backdrop_path: doc.backdropPath || doc.posterPath || null,
            release_date: doc.releaseDate || '',
            first_air_date: doc.releaseDate || '',
            vote_average: doc.voteAverage || 7.8,
            vote_count: 1200,
            overview: doc.overview || 'Available for high-speed download on CineFuel.',
            media_type: mediaType,
            qualities: extractedQualities,
            linksCount: 1,
            hasZipPack: isZip,
          } as EnrichedUploadedTitle);
        } else {
          const item = groupedTitles.get(mId)!;
          item.linksCount++;
          if (isZip) item.hasZipPack = true;
          for (const q of extractedQualities) {
            if (!item.qualities.includes(q)) item.qualities.push(q);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas getFilteredUploadedTitles warning:', err.message);
  }

  // Filter out any dummy title
  const finalItems = Array.from(groupedTitles.values())
    .filter((t) => t.title && !t.title.startsWith('Series Feature #') && !t.title.startsWith('Cinema Feature #'))
    .slice(0, limit);

  return { items: finalItems, total: finalItems.length };
}


