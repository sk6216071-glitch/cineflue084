import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redisDb';
import { UserRequest } from '@/types';

const REDIS_REQUESTS_KEY = 'cinefuel:user_requests';
const LOCAL_REQUESTS_FILE = path.join(process.cwd(), 'src', 'data', 'userRequests.json');

export function parseRedisList<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

function isFileSystemWritable(): boolean {
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.CLOUDFLARE_WORKER || typeof (process as any).getBuiltinModule !== 'undefined') {
    return false;
  }
  return true;
}

/**
 * Reads local JSON fallback file safely
 */
export function getLocalFallbackRequests(): UserRequest[] {
  if (!isFileSystemWritable()) return [];
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
  if (!isFileSystemWritable()) return false;
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
export async function getAllRequests(
  filterStatus?: string,
  options?: { page?: number; limit?: number; userId?: string },
  dbName?: string
): Promise<{
  requests: UserRequest[];
  total: number;
  pendingCount: number;
  page?: number;
  totalPages?: number;
  limit?: number;
  source: 'mongodb_atlas' | 'upstash_redis' | 'local_json';
}> {
  const hasPagination = typeof options?.page === 'number' || typeof options?.limit === 'number';
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, Math.min(100, options?.limit || 50));
  const userFilter = options?.userId ? options.userId.trim() : null;

  // 1. Try MongoDB Atlas first
  try {
    const db = await getDatabase(dbName);
    if (db) {
      const collection = db.collection('requests');
      const query: any = {};
      if (filterStatus && typeof filterStatus === 'string' && filterStatus !== 'all') {
        const cleanStatus = filterStatus.trim();
        if (!cleanStatus.startsWith('$')) {
          query.status = cleanStatus;
        }
      }
      if (userFilter && typeof userFilter === 'string') {
        const cleanUser = userFilter.trim();
        if (cleanUser && !cleanUser.startsWith('$')) {
          query.$or = [{ userId: cleanUser }, { userEmail: cleanUser }];
        }
      }

      const total = await collection.countDocuments(query).catch(() => 0);
      const pendingQuery: any = { status: 'pending' };
      if (userFilter && typeof userFilter === 'string') {
        const cleanUser = userFilter.trim();
        if (cleanUser && !cleanUser.startsWith('$')) {
          pendingQuery.$or = [{ userId: cleanUser }, { userEmail: cleanUser }];
        }
      }
      const pendingCount = await collection.countDocuments(pendingQuery).catch(() => 0);

      let cursor = collection.find(query).sort({ createdAt: -1 });
      if (hasPagination) {
        cursor = cursor.skip((page - 1) * limit).limit(limit);
      }
      const docs = await cursor.toArray();

      const requests: UserRequest[] = docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as UserRequest;
      });

      return {
        requests,
        total,
        pendingCount,
        page: hasPagination ? page : 1,
        totalPages: hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1,
        limit: hasPagination ? limit : total,
        source: 'mongodb_atlas',
      };
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas requests read fallback:', mongoErr.message);
  }

  // 2. Try Upstash Redis
  const redisClient = getRedisClient();
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
        let filtered = list;
        if (userFilter) {
          filtered = filtered.filter((r) => r.userId === userFilter || r.userEmail === userFilter);
        }
        const pendingCount = filtered.filter((r) => r.status === 'pending').length;
        if (filterStatus && filterStatus !== 'all') {
          filtered = filtered.filter((r) => r.status === filterStatus);
        }

        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const total = filtered.length;
        const paginated = hasPagination ? filtered.slice((page - 1) * limit, page * limit) : filtered;

        return {
          requests: paginated,
          total,
          pendingCount,
          page: hasPagination ? page : 1,
          totalPages: hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1,
          limit: hasPagination ? limit : total,
          source: 'upstash_redis',
        };
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis requests read failed:', redisErr.message);
    }
  }

  // 3. Fallback to Local JSON
  const localList = getLocalFallbackRequests();
  let filtered = localList;
  if (userFilter) {
    filtered = filtered.filter((r) => r.userId === userFilter || r.userEmail === userFilter);
  }
  const pendingCount = filtered.filter((r) => r.status === 'pending').length;
  if (filterStatus && filterStatus !== 'all') {
    filtered = filtered.filter((r) => r.status === filterStatus);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = filtered.length;
  const paginated = hasPagination ? filtered.slice((page - 1) * limit, page * limit) : filtered;

  return {
    requests: paginated,
    total,
    pendingCount,
    page: hasPagination ? page : 1,
    totalPages: hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1,
    limit: hasPagination ? limit : total,
    source: 'local_json',
  };
}

/**
 * Saves a new user link request to all persistence layers
 */
export async function saveNewRequest(request: UserRequest): Promise<boolean> {
  let persisted = false;

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('requests').updateOne(
        { id: request.id },
        { $set: { ...request, updatedAt: new Date() } },
        { upsert: true }
      );
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas request save warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existing = await redisClient.get<any>(REDIS_REQUESTS_KEY);
      const currentList = parseRedisList<UserRequest>(existing);
      const updated = [request, ...currentList.filter((r) => r.id !== request.id)];
      await redisClient.set(REDIS_REQUESTS_KEY, updated);
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis request save error:', err.message);
    }
  }

  // 3. Local backup (only when filesystem is writable)
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackRequests();
      const updated = [request, ...local.filter((r) => r.id !== request.id)];
      if (saveLocalFallbackRequests(updated)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local request save failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: neither MongoDB nor Redis could persist the request.');
  }

  return true;
}

/**
 * Updates a user request (e.g. status, fulfilledLinkUrl, adminNote)
 */
export async function updateRequestStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'fulfilled' | 'rejected',
  meta?: {
    fulfilledLinkId?: string;
    fulfilledLinkUrl?: string;
    adminNote?: string;
    adminReply?: string;
  }
): Promise<boolean> {
  const cleanId = String(id || '').trim();
  if (!cleanId || cleanId.startsWith('$')) return false;

  let persisted = false;
  const replyObj = meta?.adminReply?.trim()
    ? { sender: 'admin', message: meta.adminReply.trim(), createdAt: new Date().toISOString() }
    : null;

  const updates: any = {
    status,
    ...(status === 'fulfilled' ? { fulfilledAt: new Date().toISOString() } : {}),
    ...(meta?.fulfilledLinkId ? { fulfilledLinkId: meta.fulfilledLinkId } : {}),
    ...(meta?.fulfilledLinkUrl ? { fulfilledLinkUrl: meta.fulfilledLinkUrl } : {}),
    ...(meta?.adminNote ? { adminNote: meta.adminNote } : (replyObj ? { adminNote: replyObj.message } : {})),
  };

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      const mongoUpdate: any = { $set: { ...updates, updatedAt: new Date() } };
      if (replyObj) {
        mongoUpdate.$push = { adminReplies: replyObj };
      }
      await db.collection('requests').updateOne({ id: cleanId }, mongoUpdate);
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas request update warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existing = await redisClient.get<any>(REDIS_REQUESTS_KEY);
      const currentList = parseRedisList<UserRequest>(existing);
      const updated = currentList.map((r) => {
        if (r.id === cleanId) {
          return {
            ...r,
            ...updates,
            ...(replyObj ? { adminReplies: [...(r.adminReplies || []), replyObj] } : {}),
          };
        }
        return r;
      });
      await redisClient.set(REDIS_REQUESTS_KEY, updated);
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis request update error:', err.message);
    }
  }

  // 3. Local update (only if writable)
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackRequests();
      const updated = local.map((r) => {
        if (r.id === cleanId) {
          return {
            ...r,
            ...updates,
            ...(replyObj ? { adminReplies: [...(r.adminReplies || []), replyObj] } : {}),
          };
        }
        return r;
      });
      if (saveLocalFallbackRequests(updated)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local request update failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not update request status.');
  }

  return true;
}

/**
 * Deletes a request by ID
 */
export async function deleteRequest(id: string): Promise<boolean> {
  const cleanId = String(id || '').trim();
  if (!cleanId || cleanId.startsWith('$')) return false;

  let persisted = false;

  // 1. MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('requests').deleteOne({ id: cleanId });
      persisted = true;
    }
  } catch {}

  // 2. Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existing = await redisClient.get<any>(REDIS_REQUESTS_KEY);
      const currentList = parseRedisList<UserRequest>(existing);
      await redisClient.set(REDIS_REQUESTS_KEY, currentList.filter((r) => r.id !== id));
      persisted = true;
    } catch {}
  }

  // 3. Local
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackRequests();
      if (saveLocalFallbackRequests(local.filter((r) => r.id !== id))) {
        persisted = true;
      }
    } catch {}
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not delete request.');
  }

  return true;
}

/**
 * Retrieves a single request by its ID
 */
export async function getRequestById(id: string, dbName?: string): Promise<UserRequest | null> {
  const reqId = (id || '').trim();
  if (!reqId) return null;

  // 1. MongoDB
  try {
    const db = await getDatabase(dbName);
    if (db) {
      const doc = await db.collection('requests').findOne({ id: reqId });
      if (doc) {
        const { _id, ...rest } = doc;
        return rest as UserRequest;
      }
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas getRequestById fallback:', err.message);
  }

  // 2. Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const redisList = await redisClient.get<any>(REDIS_REQUESTS_KEY);
      const list = parseRedisList<UserRequest>(redisList);
      const found = list.find((r) => r.id === reqId);
      if (found) return found;
    } catch {}
  }

  // 3. Local JSON fallback
  const local = getLocalFallbackRequests();
  return local.find((r) => r.id === reqId) || null;
}

