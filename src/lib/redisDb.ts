import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { TitleDetails } from '@/types';
import { getTitleDetails } from '@/lib/tmdb';

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
        const allDocs = await collection.find({}).toArray();
        if (allDocs && allDocs.length > 0) {
          const grouped: Record<string, any[]> = {};
          for (const doc of allDocs) {
            const { _id, movieId: mId, ...rest } = doc;
            const k = String(mId || rest.movieId);
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(rest);
          }
          return { allLinks: grouped, source: 'mongodb_atlas' };
        }
      }
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas read fallback:', mongoErr.message);
  }

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

  // 3. MongoDB Atlas Cloud save
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('links').updateOne(
        { movieId: key, url: link.url },
        { $set: { ...link, movieId: key, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas save warning:', err.message);
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

  // 3. MongoDB Atlas Cloud batch save
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
      }
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas batch save warning:', err.message);
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

  // 3. MongoDB Atlas Cloud deletion
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('links').deleteOne({ movieId: key, id: linkId });
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas delete warning:', err.message);
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

/**
 * Fetches the most recently uploaded titles from MongoDB Atlas (or local fallback)
 * and retrieves their TMDB metadata for display in the "Recently Added" carousel.
 */
export async function getRecentlyAddedTitles(limit = 18): Promise<TitleDetails[]> {
  const recentMovieEntries: Array<{ movieId: string; mediaType: 'movie' | 'tv'; doc?: any }> = [];
  const seen = new Set<string>();

  // 1. Try MongoDB Atlas first
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('links');
      const docs = await collection
        .find({})
        .sort({ createdAt: -1, updatedAt: -1 })
        .limit(100)
        .toArray();

      for (const doc of docs) {
        const mId = String(doc.movieId || '');
        if (!mId || mId === 'undefined' || mId === 'null' || seen.has(mId)) continue;
        seen.add(mId);

        let mediaType: 'movie' | 'tv' = 'movie';
        const isTv =
          doc.mediaType === 'tv' ||
          (typeof doc.seasonNumber === 'number' && doc.seasonNumber > 0) ||
          doc.linkType === 'zip_pack' ||
          doc.linkType === 'single_episode' ||
          doc.category === 'ZipPack' ||
          doc.category === 'SingleEpisode';

        if (isTv) {
          mediaType = 'tv';
        } else if (doc.mediaType === 'movie') {
          mediaType = 'movie';
        }

        recentMovieEntries.push({ movieId: mId, mediaType, doc });
        if (recentMovieEntries.length >= limit) break;
      }
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas getRecentlyAddedTitles warning:', err.message);
  }

  // 2. If MongoDB returned fewer than limit, supplement from local fallback
  if (recentMovieEntries.length < limit) {
    try {
      const localData = getLocalFallbackLinks();
      const localList: Array<{ movieId: string; createdAt: string; link: any }> = [];
      for (const [mId, links] of Object.entries(localData)) {
        if (!mId || mId === 'undefined' || mId === 'null' || seen.has(mId)) continue;
        if (Array.isArray(links) && links.length > 0) {
          const latest = links.reduce((a, b) =>
            new Date(a.createdAt || 0) > new Date(b.createdAt || 0) ? a : b
          );
          localList.push({ movieId: mId, createdAt: latest.createdAt || '', link: latest });
        }
      }

      localList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      for (const item of localList) {
        if (seen.has(item.movieId)) continue;
        seen.add(item.movieId);

        let mediaType: 'movie' | 'tv' = 'movie';
        const isTv =
          item.link?.mediaType === 'tv' ||
          (typeof item.link?.seasonNumber === 'number' && item.link?.seasonNumber > 0) ||
          item.link?.linkType === 'zip_pack' ||
          item.link?.linkType === 'single_episode' ||
          item.link?.category === 'ZipPack' ||
          item.link?.category === 'SingleEpisode';

        if (isTv) {
          mediaType = 'tv';
        }

        recentMovieEntries.push({ movieId: item.movieId, mediaType, doc: item.link });
        if (recentMovieEntries.length >= limit) break;
      }
    } catch (err) {
      console.warn('Local fallback getRecentlyAddedTitles error:', err);
    }
  }

  if (recentMovieEntries.length === 0) return [];

  // Helper to detect synthetic/dummy placeholders
  const isDummyTitle = (t?: string) =>
    !t || t.startsWith('Series Feature #') || t.startsWith('Cinema Feature #');

  // 3. Resolve metadata: prioritize stored doc metadata first, then live TMDB
  const results = await Promise.all(
    recentMovieEntries.map(async ({ movieId, mediaType, doc }) => {
      // 3A. If stored doc in MongoDB/local link already has movieTitle and posterPath, use it instantly!
      if (doc?.movieTitle && doc?.posterPath && !isDummyTitle(doc.movieTitle)) {
        return {
          id: Number(movieId),
          title: doc.movieTitle,
          name: doc.movieTitle,
          overview: doc.overview || 'Available for streaming & high-speed download on CineFuel.',
          poster_path: doc.posterPath,
          backdrop_path: doc.backdropPath || doc.posterPath,
          release_date: doc.releaseDate || '',
          first_air_date: doc.releaseDate || '',
          vote_average: doc.voteAverage || 7.8,
          vote_count: 1500,
          media_type: doc.mediaType || mediaType,
          genres: [{ id: 28, name: 'Featured' }],
        } as TitleDetails;
      }

      // 3B. Otherwise, fetch live TMDB details
      try {
        let details = await getTitleDetails(mediaType, movieId);
        if (isDummyTitle(details?.title || details?.name)) {
          // Retry with alternate mediaType
          const altType = mediaType === 'movie' ? 'tv' : 'movie';
          const altDetails = await getTitleDetails(altType, movieId);
          if (!isDummyTitle(altDetails?.title || altDetails?.name)) {
            details = altDetails;
            mediaType = altType;
          }
        }

        if (details && !isDummyTitle(details.title || details.name)) {
          return {
            ...details,
            media_type: mediaType,
          };
        }
      } catch (e) {
        // ignore error
      }

      return null;
    })
  );

  return results.filter(Boolean) as TitleDetails[];
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


