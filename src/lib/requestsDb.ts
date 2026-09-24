import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { UserRequest } from '@/types';

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
    console.error('Failed to initialize Upstash Redis client for requests:', err);
  }
}

const REDIS_REQUESTS_KEY = 'cinefuel:user_requests';
const LOCAL_REQUESTS_FILE = path.join(process.cwd(), 'src', 'data', 'userRequests.json');

/**
 * Reads local JSON fallback file safely
 */
export function getLocalFallbackRequests(): UserRequest[] {
  try {
    if (fs.existsSync(LOCAL_REQUESTS_FILE)) {
      const raw = fs.readFileSync(LOCAL_REQUESTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading local userRequests.json:', e);
  }
  return [];
}

/**
 * Writes local JSON fallback file safely
 */
export function saveLocalFallbackRequests(data: UserRequest[]): boolean {
  try {
    const dir = path.dirname(LOCAL_REQUESTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_REQUESTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing local userRequests.json:', e);
    return false;
  }
}

/**
 * Fetches all user requests from MongoDB Atlas, Redis, or local JSON file
 */
export async function getAllRequests(filterStatus?: string): Promise<{
  requests: UserRequest[];
  total: number;
  pendingCount: number;
  source: 'mongodb_atlas' | 'upstash_redis' | 'local_json';
}> {
  // 1. Try MongoDB Atlas first
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('requests');
      const query = filterStatus && filterStatus !== 'all' ? { status: filterStatus } : {};
      const docs = await collection.find(query).sort({ createdAt: -1 }).toArray();

      const allDocs = filterStatus && filterStatus !== 'all'
        ? await collection.find({}).toArray()
        : docs;

      const pendingCount = allDocs.filter((d: any) => d.status === 'pending').length;

      const requests: UserRequest[] = docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as UserRequest;
      });

      return {
        requests,
        total: allDocs.length,
        pendingCount,
        source: 'mongodb_atlas',
      };
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas requests read fallback:', mongoErr.message);
  }

  // 2. Try Upstash Redis
  if (redisClient) {
    try {
      const redisList = await redisClient.get<UserRequest[]>(REDIS_REQUESTS_KEY);
      let list: UserRequest[] = [];
      if (Array.isArray(redisList)) {
        list = redisList;
      } else if (typeof redisList === 'string') {
        try {
          list = JSON.parse(redisList);
        } catch {}
      }

      if (list.length > 0) {
        const pendingCount = list.filter((r) => r.status === 'pending').length;
        const filtered = filterStatus && filterStatus !== 'all'
          ? list.filter((r) => r.status === filterStatus)
          : list;

        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
          requests: filtered,
          total: list.length,
          pendingCount,
          source: 'upstash_redis',
        };
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis requests read failed:', redisErr.message);
    }
  }

  // 3. Fallback to Local JSON
  const localList = getLocalFallbackRequests();
  const pendingCount = localList.filter((r) => r.status === 'pending').length;
  const filtered = filterStatus && filterStatus !== 'all'
    ? localList.filter((r) => r.status === filterStatus)
    : localList;

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    requests: filtered,
    total: localList.length,
    pendingCount,
    source: 'local_json',
  };
}

/**
 * Saves a new user link request to all persistence layers
 */
export async function saveNewRequest(request: UserRequest): Promise<boolean> {
  // 1. Local backup
  try {
    const local = getLocalFallbackRequests();
    const updated = [request, ...local.filter((r) => r.id !== request.id)];
    saveLocalFallbackRequests(updated);
  } catch (err: any) {
    console.error('Local request save failed:', err.message);
  }

  // 2. Upstash Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<UserRequest[]>(REDIS_REQUESTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      const updated = [request, ...currentList.filter((r) => r.id !== request.id)];
      await redisClient.set(REDIS_REQUESTS_KEY, updated);
    } catch (err: any) {
      console.error('Upstash Redis request save error:', err.message);
    }
  }

  // 3. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('requests').updateOne(
        { id: request.id },
        { $set: { ...request, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas request save warning:', err.message);
  }

  return true;
}

/**
 * Updates a user request (e.g. status, fulfilledLinkUrl, adminNote)
 */
export async function updateRequestStatus(
  id: string,
  status: 'pending' | 'fulfilled' | 'rejected',
  meta?: {
    fulfilledLinkId?: string;
    fulfilledLinkUrl?: string;
    adminNote?: string;
  }
): Promise<boolean> {
  const updates: Partial<UserRequest> = {
    status,
    ...(status === 'fulfilled' ? { fulfilledAt: new Date().toISOString() } : {}),
    ...(meta?.fulfilledLinkId ? { fulfilledLinkId: meta.fulfilledLinkId } : {}),
    ...(meta?.fulfilledLinkUrl ? { fulfilledLinkUrl: meta.fulfilledLinkUrl } : {}),
    ...(meta?.adminNote ? { adminNote: meta.adminNote } : {}),
  };

  // 1. Local update
  try {
    const local = getLocalFallbackRequests();
    const updated = local.map((r) => (r.id === id ? { ...r, ...updates } : r));
    saveLocalFallbackRequests(updated);
  } catch (err: any) {
    console.error('Local request update failed:', err.message);
  }

  // 2. Upstash Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<UserRequest[]>(REDIS_REQUESTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      const updated = currentList.map((r) => (r.id === id ? { ...r, ...updates } : r));
      await redisClient.set(REDIS_REQUESTS_KEY, updated);
    } catch (err: any) {
      console.error('Upstash Redis request update error:', err.message);
    }
  }

  // 3. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('requests').updateOne(
        { id },
        { $set: { ...updates, updatedAt: new Date() } }
      );
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas request update warning:', err.message);
  }

  return true;
}

/**
 * Deletes a request by ID
 */
export async function deleteRequest(id: string): Promise<boolean> {
  // 1. Local
  try {
    const local = getLocalFallbackRequests();
    saveLocalFallbackRequests(local.filter((r) => r.id !== id));
  } catch {}

  // 2. Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<UserRequest[]>(REDIS_REQUESTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      await redisClient.set(REDIS_REQUESTS_KEY, currentList.filter((r) => r.id !== id));
    } catch {}
  }

  // 3. MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('requests').deleteOne({ id });
    }
  } catch {}

  return true;
}
