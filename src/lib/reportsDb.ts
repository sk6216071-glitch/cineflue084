import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { DefectiveLinkReport } from '@/types';

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
    console.error('Failed to initialize Upstash Redis client for defective reports:', err);
  }
}

const REDIS_REPORTS_KEY = 'cinefuel:defective_reports';
const LOCAL_REPORTS_FILE = path.join(process.cwd(), 'src', 'data', 'defectiveReports.json');

/**
 * Reads local JSON fallback file safely
 */
export function getLocalFallbackReports(): DefectiveLinkReport[] {
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
export async function getAllReports(filterStatus?: string): Promise<{
  reports: DefectiveLinkReport[];
  total: number;
  pendingCount: number;
  source: 'mongodb_atlas' | 'upstash_redis' | 'local_json';
}> {
  // 1. Try MongoDB Atlas first
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('defective_reports');
      const query = filterStatus && filterStatus !== 'all' ? { status: filterStatus } : {};
      const docs = await collection.find(query).sort({ createdAt: -1 }).toArray();

      const allDocs = filterStatus && filterStatus !== 'all'
        ? await collection.find({}).toArray()
        : docs;

      const pendingCount = allDocs.filter((d: any) => d.status === 'pending').length;

      const reports: DefectiveLinkReport[] = docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as DefectiveLinkReport;
      });

      return {
        reports,
        total: allDocs.length,
        pendingCount,
        source: 'mongodb_atlas',
      };
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas defective reports read fallback:', mongoErr.message);
  }

  // 2. Try Upstash Redis
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
  // 1. Local backup
  try {
    const local = getLocalFallbackReports();
    const updated = [report, ...local.filter((r) => r.id !== report.id)];
    saveLocalFallbackReports(updated);
  } catch (err: any) {
    console.error('Local defective report save failed:', err.message);
  }

  // 2. Upstash Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      const updated = [report, ...currentList.filter((r) => r.id !== report.id)];
      await redisClient.set(REDIS_REPORTS_KEY, updated);
    } catch (err: any) {
      console.error('Upstash Redis defective report save error:', err.message);
    }
  }

  // 3. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('defective_reports').updateOne(
        { id: report.id },
        { $set: { ...report, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas defective report save warning:', err.message);
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
  }
): Promise<boolean> {
  const updates: Partial<DefectiveLinkReport> = {
    status,
    ...(status === 'fixed' || status === 'dismissed' ? { resolvedAt: new Date().toISOString() } : {}),
    ...(meta?.replacementUrl ? { replacementUrl: meta.replacementUrl } : {}),
    ...(meta?.adminNote ? { adminNote: meta.adminNote } : {}),
  };

  // 1. Local update
  try {
    const local = getLocalFallbackReports();
    const updated = local.map((r) => (r.id === id ? { ...r, ...updates } : r));
    saveLocalFallbackReports(updated);
  } catch (err: any) {
    console.error('Local defective report update failed:', err.message);
  }

  // 2. Upstash Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      const updated = currentList.map((r) => (r.id === id ? { ...r, ...updates } : r));
      await redisClient.set(REDIS_REPORTS_KEY, updated);
    } catch (err: any) {
      console.error('Upstash Redis defective report update error:', err.message);
    }
  }

  // 3. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('defective_reports').updateOne(
        { id },
        { $set: { ...updates, updatedAt: new Date() } }
      );
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas defective report update warning:', err.message);
  }

  return true;
}

/**
 * Deletes a defective report by ID
 */
export async function deleteReport(id: string): Promise<boolean> {
  // 1. Local
  try {
    const local = getLocalFallbackReports();
    saveLocalFallbackReports(local.filter((r) => r.id !== id));
  } catch {}

  // 2. Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<DefectiveLinkReport[]>(REDIS_REPORTS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      await redisClient.set(REDIS_REPORTS_KEY, currentList.filter((r) => r.id !== id));
    } catch {}
  }

  // 3. MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('defective_reports').deleteOne({ id });
    }
  } catch {}

  return true;
}
