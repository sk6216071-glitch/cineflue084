import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

function isFileSystemWritable(): boolean {
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.CLOUDFLARE_WORKER || typeof (process as any).getBuiltinModule !== 'undefined') {
    return false;
  }
  return true;
}

/**
 * Writes local JSON fallback users file
 */
export function saveLocalFallbackUsers(data: RegisteredUser[]): boolean {
  if (!isFileSystemWritable()) return false;
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
          const { _id, passwordHash, passwordSalt, ...rest } = d;
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
        userList = redisData.map((u: any) => {
          const { passwordHash, passwordSalt, ...rest } = u;
          return rest as RegisteredUser;
        });
        source = 'upstash_redis';
      } else if (typeof redisData === 'string') {
        const parsed = JSON.parse(redisData);
        userList = (Array.isArray(parsed) ? parsed : []).map((u: any) => {
          const { passwordHash, passwordSalt, ...rest } = u;
          return rest as RegisteredUser;
        });
        source = 'upstash_redis';
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis users read failed:', redisErr.message);
    }
  }

  // 3. Fallback to local
  if (userList.length === 0) {
    userList = getLocalFallbackUsers().map((u: any) => {
      const { passwordHash, passwordSalt, ...rest } = u;
      return rest as RegisteredUser;
    });
    source = 'local_json';
  }

  // 4. Fetch live requests & reports to correlate user activity
  const usersMap = new Map<string, RegisteredUser>();
  userList.forEach((u: any) => {
    const { passwordHash, passwordSalt, ...safeU } = u;
    const key = (safeU.email || safeU.uid).toLowerCase();
    usersMap.set(key, { ...safeU, requestsCount: 0, reportsCount: 0, recentRequests: [] });
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
 * Hashes a password using crypto.pbkdf2Sync
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, userSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: userSalt };
}

/**
 * Verifies a password against a stored hash and salt
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === storedHash;
  } catch {
    return false;
  }
}

/**
 * Finds a user by email across MongoDB, Redis, and local JSON
 */
export async function getUserByEmail(email: string): Promise<RegisteredUser | null> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return null;

  // 1. Try MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      const doc = await db.collection('users').findOne({ email: cleanEmail });
      if (doc) {
        const { _id, ...rest } = doc;
        return rest as RegisteredUser;
      }
    }
  } catch (err: any) {
    console.warn('MongoDB getUserByEmail warning:', err.message);
  }

  // 2. Try Redis
  if (redisClient) {
    try {
      const redisData = await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY);
      const list = Array.isArray(redisData) ? redisData : (typeof redisData === 'string' ? JSON.parse(redisData) : []);
      const found = list.find((u: RegisteredUser) => u.email.toLowerCase() === cleanEmail);
      if (found) return found;
    } catch (e) {}
  }

  // 3. Try Local JSON
  try {
    const local = getLocalFallbackUsers();
    const found = local.find((u) => u.email.toLowerCase() === cleanEmail);
    if (found) return found;
  } catch (e) {}

  return null;
}

/**
 * Saves or updates a registered user across persistence layers
 */
export async function saveUserToDatabase(user: Partial<RegisteredUser> & { uid?: string; email: string }): Promise<RegisteredUser> {
  const cleanEmail = user.email.toLowerCase().trim();
  const existing = await getUserByEmail(cleanEmail);

  const finalUser: RegisteredUser = {
    uid: user.uid || existing?.uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: cleanEmail,
    displayName: user.displayName || existing?.displayName || cleanEmail.split('@')[0] || 'Cinephile User',
    photoURL: user.photoURL !== undefined ? user.photoURL : (existing?.photoURL || null),
    bio: user.bio || existing?.bio || '',
    favoriteGenres: user.favoriteGenres || existing?.favoriteGenres || [],
    createdAt: user.createdAt || existing?.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    provider: user.provider || existing?.provider || 'email_password',
    passwordHash: user.passwordHash || existing?.passwordHash,
    passwordSalt: user.passwordSalt || existing?.passwordSalt,
    requestsCount: existing?.requestsCount || 0,
    reportsCount: existing?.reportsCount || 0,
    recentRequests: existing?.recentRequests || [],
  };

  let persisted = false;

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('users').updateOne(
        { $or: [{ email: cleanEmail }, { uid: finalUser.uid }] },
        { $set: { ...finalUser, updatedAt: new Date() } },
        { upsert: true }
      );
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas user save warning:', err.message);
  }

  // 2. Upstash Redis
  if (redisClient) {
    try {
      const existingRedis = (await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY)) || [];
      const currentList = Array.isArray(existingRedis) ? existingRedis : [];
      const updated = [finalUser, ...currentList.filter((u) => u.uid !== finalUser.uid && u.email !== finalUser.email)];
      await redisClient.set(REDIS_USERS_KEY, updated);
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis user save error:', err.message);
    }
  }

  // 3. Local JSON (only if writable)
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackUsers();
      const updated = [finalUser, ...local.filter((u) => u.uid !== finalUser.uid && u.email !== finalUser.email)];
      if (saveLocalFallbackUsers(updated)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local user save failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not save user.');
  }

  return finalUser;
}

/**
 * Deletes a user by uid
 */
export async function deleteUserFromDatabase(uid: string): Promise<boolean> {
  let persisted = false;

  // 1. Mongo
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('users').deleteOne({ uid });
      persisted = true;
    }
  } catch (e) {}

  // 2. Redis
  if (redisClient) {
    try {
      const existing = (await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY)) || [];
      if (Array.isArray(existing)) {
        await redisClient.set(REDIS_USERS_KEY, existing.filter((u) => u.uid !== uid));
        persisted = true;
      }
    } catch (e) {}
  }

  // 3. Local
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackUsers();
      if (saveLocalFallbackUsers(local.filter((u) => u.uid !== uid))) {
        persisted = true;
      }
    } catch (e) {}
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not delete user.');
  }

  return true;
}
