import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { getAllRequests } from '@/lib/requestsDb';
import { getAllReports } from '@/lib/reportsDb';
import { RegisteredUser } from '@/types';

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
    console.error('Failed to initialize Upstash Redis client for users:', err);
  }
}

const REDIS_USERS_KEY = 'cinefuel:registered_users';
const LOCAL_USERS_FILE = path.join(process.cwd(), 'src', 'data', 'registeredUsers.json');

/**
 * Reads local JSON fallback users file
 */
export function getLocalFallbackUsers(): RegisteredUser[] {
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const raw = fs.readFileSync(LOCAL_USERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading local registeredUsers.json:', e);
  }
  return [];
}

/**
 * Writes local JSON fallback users file
 */
export function saveLocalFallbackUsers(data: RegisteredUser[]): boolean {
  try {
    const dir = path.dirname(LOCAL_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing local registeredUsers.json:', e);
    return false;
  }
}

/**
 * Fetches all users from DB and merges live request/report activity
 */
export async function getAllUsers(): Promise<{
  users: RegisteredUser[];
  total: number;
  source: 'mongodb_atlas' | 'upstash_redis' | 'local_json';
}> {
  let userList: RegisteredUser[] = [];
  let source: 'mongodb_atlas' | 'upstash_redis' | 'local_json' = 'local_json';

  // 1. Try MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('users');
      const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
      if (docs && docs.length > 0) {
        userList = docs.map((d: any) => {
          const { _id, ...rest } = d;
          return rest as RegisteredUser;
        });
        source = 'mongodb_atlas';
      }
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas users read fallback:', mongoErr.message);
  }

  // 2. Try Redis if Mongo was empty
  if (userList.length === 0 && redisClient) {
    try {
      const redisData = await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY);
      if (Array.isArray(redisData) && redisData.length > 0) {
        userList = redisData;
        source = 'upstash_redis';
      } else if (typeof redisData === 'string') {
        userList = JSON.parse(redisData);
        source = 'upstash_redis';
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis users read failed:', redisErr.message);
    }
  }

  // 3. Fallback to local
  if (userList.length === 0) {
    userList = getLocalFallbackUsers();
    source = 'local_json';
  }

  // 4. Fetch live requests & reports to correlate user activity
  const usersMap = new Map<string, RegisteredUser>();
  userList.forEach((u) => {
    const key = (u.email || u.uid).toLowerCase();
    usersMap.set(key, { ...u, requestsCount: 0, reportsCount: 0, recentRequests: [] });
  });

  try {
    const { requests } = await getAllRequests('all');
    requests.forEach((req) => {
      const email = req.userEmail || req.userContact || '';
      const key = (email || req.userId || '').toLowerCase();
      if (!key) return;

      if (!usersMap.has(key)) {
        usersMap.set(key, {
          uid: req.userId || `usr-${Math.random().toString(36).substring(2, 9)}`,
          email: email || 'No email provided',
          displayName: req.userName || email.split('@')[0] || 'Cinephile User',
          createdAt: req.createdAt,
          lastLoginAt: req.createdAt,
          requestsCount: 0,
          reportsCount: 0,
          recentRequests: [],
          provider: 'request_submitter',
        });
      }

      const existing = usersMap.get(key)!;
      existing.requestsCount = (existing.requestsCount || 0) + 1;
      if (!existing.recentRequests) existing.recentRequests = [];
      if (!existing.recentRequests.includes(req.title)) {
        existing.recentRequests.push(req.title);
      }
    });
  } catch (e) {
    console.warn('Failed to correlate requests to users:', e);
  }

  try {
    const { reports } = await getAllReports('all');
    reports.forEach((rep) => {
      const email = rep.userEmail || '';
      const key = (email || rep.userId || '').toLowerCase();
      if (!key) return;

      if (!usersMap.has(key)) {
        usersMap.set(key, {
          uid: rep.userId || `usr-${Math.random().toString(36).substring(2, 9)}`,
          email: email || 'No email provided',
          displayName: rep.userName || email.split('@')[0] || 'Cinephile User',
          createdAt: rep.createdAt,
          lastLoginAt: rep.createdAt,
          requestsCount: 0,
          reportsCount: 0,
          recentRequests: [],
          provider: 'report_submitter',
        });
      }

      const existing = usersMap.get(key)!;
      existing.reportsCount = (existing.reportsCount || 0) + 1;
    });
  } catch (e) {
    console.warn('Failed to correlate reports to users:', e);
  }

  const finalUsers = Array.from(usersMap.values());
  finalUsers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return {
    users: finalUsers,
    total: finalUsers.length,
    source,
  };
}

/**
 * Saves or updates a registered user across persistence layers
 */
export async function saveUserToDatabase(user: Partial<RegisteredUser> & { uid: string; email: string }): Promise<boolean> {
  const newUser: RegisteredUser = {
    uid: user.uid,
    email: user.email.toLowerCase().trim(),
    displayName: user.displayName || user.email.split('@')[0] || 'Cinephile User',
    photoURL: user.photoURL || null,
    createdAt: user.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    provider: user.provider || 'email_password',
  };

  // 1. Local JSON
  try {
    const local = getLocalFallbackUsers();
    const updated = [newUser, ...local.filter((u) => u.uid !== newUser.uid && u.email !== newUser.email)];
    saveLocalFallbackUsers(updated);
  } catch (err: any) {
    console.error('Local user save failed:', err.message);
  }

  // 2. Upstash Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY)) || [];
      const currentList = Array.isArray(existing) ? existing : [];
      const updated = [newUser, ...currentList.filter((u) => u.uid !== newUser.uid && u.email !== newUser.email)];
      await redisClient.set(REDIS_USERS_KEY, updated);
    } catch (err: any) {
      console.error('Upstash Redis user save error:', err.message);
    }
  }

  // 3. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('users').updateOne(
        { uid: newUser.uid },
        { $set: { ...newUser, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas user save warning:', err.message);
  }

  return true;
}

/**
 * Deletes a user by uid
 */
export async function deleteUserFromDatabase(uid: string): Promise<boolean> {
  // 1. Local
  try {
    const local = getLocalFallbackUsers();
    saveLocalFallbackUsers(local.filter((u) => u.uid !== uid));
  } catch (e) {}

  // 2. Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY)) || [];
      if (Array.isArray(existing)) {
        await redisClient.set(REDIS_USERS_KEY, existing.filter((u) => u.uid !== uid));
      }
    } catch (e) {}
  }

  // 3. Mongo
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('users').deleteOne({ uid });
    }
  } catch (e) {}

  return true;
}
