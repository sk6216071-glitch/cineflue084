import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redisDb';
import { DefectiveLinkReport } from '@/types';

const REDIS_REPORTS_KEY = 'cinefuel:defective_reports';
const LOCAL_REPORTS_FILE = path.join(process.cwd(), 'src', 'data', 'defectiveReports.json');

function isFileSystemWritable(): boolean {
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.CLOUDFLARE_WORKER || typeof (process as any).getBuiltinModule !== 'undefined') {
    return false;
  }
  return true;
}

/**
 * Reads local JSON fallback file safely
 */
export function getLocalFallbackReports(): DefectiveLinkReport[] {
  if (!isFileSystemWritable()) return [];
  try {
    if (fs.existsSync(LOCAL_REPORTS_FILE)) {
      const raw = fs.readFileSync(LOCAL_REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading local defectiveReports.json:', e);
  }
  return [];
}

/**
 * Writes local JSON fallback file safely
 */
export function saveLocalFallbackReports(data: DefectiveLinkReport[]): boolean {
  if (!isFileSystemWritable()) return false;
  try {
    const dir = path.dirname(LOCAL_REPORTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_REPORTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing local defectiveReports.json:', e);
  }
  return false;
}

/**
 * Fetches all defective link reports from MongoDB Atlas, Redis, or local JSON file
 */
export async function getAllReports(
  filterStatus?: string,
  options?: { page?: number; limit?: number; userId?: string }
): Promise<{
  reports: DefectiveLinkReport[];
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
  const userId = options?.userId;

  // 1. Try MongoDB Atlas first
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('defective_reports');
      const query: any = {};
      if (filterStatus && typeof filterStatus === 'string' && filterStatus !== 'all') {
        const cleanStatus = filterStatus.trim();
        if (!cleanStatus.startsWith('$')) {
          query.status = cleanStatus;
        }
      }
      if (userId && typeof userId === 'string') {
        const cleanUserId = userId.trim();
        if (cleanUserId && !cleanUserId.startsWith('$')) {
          query.userId = cleanUserId;
        }
      }
      const total = await collection.countDocuments(query).catch(() => 0);
      const pendingCount = await collection.countDocuments({
        status: 'pending',
        ...(userId && typeof userId === 'string' && !userId.startsWith('$') ? { userId: userId.trim() } : {}),
      }).catch(() => 0);
      
      let cursor = collection.find(query).sort({ createdAt: -1 });
      if (hasPagination) {
        cursor = cursor.skip((page - 1) * limit).limit(limit);
      }
      const docs = await cursor.toArray();

      const reports: DefectiveLinkReport[] = docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as DefectiveLinkReport;
      });

      return {
        reports,
        total,
        pendingCount,
        page: hasPagination ? page : 1,
        totalPages: hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1,
        limit: hasPagination ? limit : total,
        source: 'mongodb_atlas',
      };
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas defective reports read fallback:', mongoErr.message);
  }

  // 2. Try Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const redisList = await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY);
      let list: DefectiveLinkReport[] = [];
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
          reports: filtered,
          total: list.length,
          pendingCount,
          source: 'upstash_redis',
        };
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis defective reports read failed:', redisErr.message);
    }
  }

  // 3. Fallback to Local JSON
  const localList = getLocalFallbackReports();
  const pendingCount = localList.filter((r) => r.status === 'pending').length;
  const filtered = filterStatus && filterStatus !== 'all'
    ? localList.filter((r) => r.status === filterStatus)
    : localList;

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    reports: filtered,
    total: localList.length,
    pendingCount,
    source: 'local_json',
  };
}

/**
 * Saves a new defective link report to all persistence layers
 */
export async function saveNewReport(report: DefectiveLinkReport): Promise<boolean> {
  let persisted = false;

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('defective_reports').updateOne(
        { id: report.id },
        { $set: { ...report, updatedAt: new Date() } },
        { upsert: true }
      );
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas defective report save warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existing = (await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      const updated = [report, ...currentList.filter((r) => r.id !== report.id)];
      await redisClient.set(REDIS_REPORTS_KEY, updated);
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis defective report save error:', err.message);
    }
  }

  // 3. Local backup (only when filesystem is writable)
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackReports();
      const updated = [report, ...local.filter((r) => r.id !== report.id)];
      if (saveLocalFallbackReports(updated)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local defective report save failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: neither MongoDB nor Redis could persist the report.');
  }

  return true;
}

/**
 * Updates a defective report (e.g. status, replacementUrl, adminNote)
 */
export async function updateReportStatus(
  id: string,
  status: 'pending' | 'fixed' | 'dismissed',
  meta?: {
    replacementUrl?: string;
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
    ...(status === 'fixed' || status === 'dismissed' ? { resolvedAt: new Date().toISOString() } : {}),
    ...(meta?.replacementUrl ? { replacementUrl: meta.replacementUrl } : {}),
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
      await db.collection('defective_reports').updateOne({ id: cleanId }, mongoUpdate);
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas defective report update warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existing = (await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      const updated = currentList.map((r) => (r.id === cleanId ? { ...r, ...updates } : r));
      await redisClient.set(REDIS_REPORTS_KEY, updated);
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis defective report update error:', err.message);
    }
  }

  // 3. Local update (only if writable)
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackReports();
      const updated = local.map((r) => (r.id === cleanId ? { ...r, ...updates } : r));
      if (saveLocalFallbackReports(updated)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local defective report update failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not update report status.');
  }

  return true;
}

/**
 * Deletes a defective report by ID
 */
export async function deleteReport(id: string): Promise<boolean> {
  const cleanId = String(id || '').trim();
  if (!cleanId || cleanId.startsWith('$')) return false;

  let persisted = false;

  // 1. MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('defective_reports').deleteOne({ id: cleanId });
      persisted = true;
    }
  } catch {}

  // 2. Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existing = (await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      await redisClient.set(REDIS_REPORTS_KEY, currentList.filter((r) => r.id !== id));
      persisted = true;
    } catch {}
  }

  // 3. Local
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackReports();
      if (saveLocalFallbackReports(local.filter((r) => r.id !== id))) {
        persisted = true;
      }
    } catch {}
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not delete report.');
  }

  return true;
}

/**
 * Retrieves a single defective report by ID
 */
export async function getReportById(id: string, dbName?: string): Promise<DefectiveLinkReport | null> {
  const cleanId = (id || '').trim();
  if (!cleanId) return null;

  try {
    const db = await getDatabase(dbName);
    if (db) {
      const doc = await db.collection('defective_reports').findOne({ id: cleanId });
      if (doc) {
        const { _id, ...rest } = doc;
        return rest as DefectiveLinkReport;
      }
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas getReportById fallback:', err.message);
  }

  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const list = await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY);
      if (Array.isArray(list)) {
        const found = list.find((r) => r.id === cleanId);
        if (found) return found;
      }
    } catch {}
  }

  const local = getLocalFallbackReports();
  return local.find((r) => r.id === cleanId) || null;
}
