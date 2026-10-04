import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redisDb';
import { getAllRequests } from '@/lib/requestsDb';
import { getAllReports } from '@/lib/reportsDb';
import { RegisteredUser } from '@/types';

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
 * Formats and sanitizes a raw user document from database/redis
 * Ensures firebaseUid, name, and status are always populated
 * STRICT RULE: Strips passwordHash and passwordSalt
 */
function sanitizeUserDocument(raw: any): RegisteredUser {
  const { _id, passwordHash, passwordSalt, ...rest } = raw;
  const cleanEmail = (rest.email || '').toLowerCase().trim();
  const uid = rest.firebaseUid || rest.uid || `usr_${Date.now()}`;
  const name = rest.name || rest.displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'Cinephile User');

  return {
    ...rest,
    firebaseUid: uid,
    uid,
    name,
    displayName: name,
    email: cleanEmail,
    photoURL: rest.photoURL || null,
    provider: rest.provider || 'firebase',
    status: rest.status || 'active',
    createdAt: rest.createdAt || new Date().toISOString(),
    lastLoginAt: rest.lastLoginAt || rest.createdAt || new Date().toISOString(),
  } as RegisteredUser;
}

/**
 * Fetches all users from DB and merges live request/report activity (supports optional pagination)
 */
export async function getAllUsers(options?: { page?: number; limit?: number }): Promise<{
  users: RegisteredUser[];
  total: number;
  page?: number;
  totalPages?: number;
  limit?: number;
  source: 'mongodb_atlas' | 'upstash_redis' | 'local_json';
}> {
  let userList: RegisteredUser[] = [];
  let total = 0;
  let source: 'mongodb_atlas' | 'upstash_redis' | 'local_json' = 'local_json';
  const hasPagination = typeof options?.page === 'number' || typeof options?.limit === 'number';
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, Math.min(100, options?.limit || 50));

  // 1. Try MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      const collection = db.collection('users');
      total = await collection.countDocuments().catch(() => 0);
      let query = collection.find({}).sort({ createdAt: -1 });
      if (hasPagination) {
        query = query.skip((page - 1) * limit).limit(limit);
      }
      const docs = await query.toArray();
      if (docs && docs.length > 0) {
        userList = docs.map((d: any) => sanitizeUserDocument(d));
        source = 'mongodb_atlas';
      }
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB Atlas users read fallback:', mongoErr.message);
  }

  // 2. Try Redis if Mongo was empty
  const redisClient = getRedisClient();
  if (userList.length === 0 && redisClient) {
    try {
      const redisData = await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY);
      if (Array.isArray(redisData) && redisData.length > 0) {
        userList = redisData.map((u: any) => sanitizeUserDocument(u));
        source = 'upstash_redis';
      } else if (typeof redisData === 'string') {
        const parsed = JSON.parse(redisData);
        userList = (Array.isArray(parsed) ? parsed : []).map((u: any) => sanitizeUserDocument(u));
        source = 'upstash_redis';
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis users read failed:', redisErr.message);
    }
  }

  // 3. Fallback to local
  if (userList.length === 0) {
    userList = getLocalFallbackUsers().map((u: any) => sanitizeUserDocument(u));
    source = 'local_json';
  }

  // 4. Fetch live requests & reports to correlate user activity
  const usersMap = new Map<string, RegisteredUser>();
  userList.forEach((u: any) => {
    const key = (u.email || u.firebaseUid || u.uid).toLowerCase();
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
          firebaseUid: req.userId || `usr-${Math.random().toString(36).substring(2, 9)}`,
          uid: req.userId || `usr-${Math.random().toString(36).substring(2, 9)}`,
          email: email || 'No email provided',
          name: req.userName || email.split('@')[0] || 'Cinephile User',
          displayName: req.userName || email.split('@')[0] || 'Cinephile User',
          createdAt: req.createdAt,
          lastLoginAt: req.createdAt,
          requestsCount: 0,
          reportsCount: 0,
          recentRequests: [],
          provider: 'request_submitter',
          status: 'active',
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
          firebaseUid: rep.userId || `usr-${Math.random().toString(36).substring(2, 9)}`,
          uid: rep.userId || `usr-${Math.random().toString(36).substring(2, 9)}`,
          email: email || 'No email provided',
          name: rep.userName || email.split('@')[0] || 'Cinephile User',
          displayName: rep.userName || email.split('@')[0] || 'Cinephile User',
          createdAt: rep.createdAt,
          lastLoginAt: rep.createdAt,
          requestsCount: 0,
          reportsCount: 0,
          recentRequests: [],
          provider: 'report_submitter',
          status: 'active',
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
    total: total || finalUsers.length,
    page: hasPagination ? page : 1,
    totalPages: hasPagination ? Math.max(1, Math.ceil((total || finalUsers.length) / limit)) : 1,
    limit: hasPagination ? limit : finalUsers.length,
    source,
  };
}

/**
 * Hashes a password using crypto.pbkdf2Sync (legacy password auth)
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, userSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: userSalt };
}

/**
 * Verifies a password against a stored hash and salt (legacy password auth)
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
 * Finds a user by Firebase UID across persistence layers
 */
export async function getUserByFirebaseUid(firebaseUid: string): Promise<RegisteredUser | null> {
  const cleanUid = (firebaseUid || '').trim();
  if (!cleanUid) return null;

  // 1. Try MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      const doc = await db.collection('users').findOne({
        $or: [{ firebaseUid: cleanUid }, { uid: cleanUid }],
      });
      if (doc) {
        return sanitizeUserDocument(doc);
      }
    }
  } catch (err: any) {
    console.warn('MongoDB getUserByFirebaseUid warning:', err.message);
  }

  // 2. Try Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const redisData = await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY);
      const list = Array.isArray(redisData) ? redisData : (typeof redisData === 'string' ? JSON.parse(redisData) : []);
      const found = list.find((u: RegisteredUser) => (u.firebaseUid === cleanUid || u.uid === cleanUid));
      if (found) return sanitizeUserDocument(found);
    } catch (e) {}
  }

  // 3. Try Local JSON
  try {
    const local = getLocalFallbackUsers();
    const found = local.find((u) => (u.firebaseUid === cleanUid || u.uid === cleanUid));
    if (found) return sanitizeUserDocument(found);
  } catch (e) {}

  return null;
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
        return sanitizeUserDocument(doc);
      }
    }
  } catch (err: any) {
    console.warn('MongoDB getUserByEmail warning:', err.message);
  }

  // 2. Try Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const redisData = await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY);
      const list = Array.isArray(redisData) ? redisData : (typeof redisData === 'string' ? JSON.parse(redisData) : []);
      const found = list.find((u: RegisteredUser) => u.email.toLowerCase() === cleanEmail);
      if (found) return sanitizeUserDocument(found);
    } catch (e) {}
  }

  // 3. Try Local JSON
  try {
    const local = getLocalFallbackUsers();
    const found = local.find((u) => u.email.toLowerCase() === cleanEmail);
    if (found) return sanitizeUserDocument(found);
  } catch (e) {}

  return null;
}

/**
 * Saves or updates a Firebase authenticated user profile across persistence layers.
 * STRICT SECURITY RULES:
 * 1. UID comes strictly from verified Firebase identity (firebaseUid).
 * 2. Email comes strictly from verified Firebase identity.
 * 3. Name comes strictly from verified Firebase display name (with graceful fallback).
 * 4. NEVER stores passwordHash or passwordSalt.
 * 5. Guarantees unique firebaseUid indexing in MongoDB.
 */
export async function saveFirebaseUserToDatabase(profile: {
  firebaseUid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  provider?: string;
  createdAt?: string;
  lastLoginAt?: string;
  status?: string;
}): Promise<RegisteredUser> {
  const cleanEmail = (profile.email || '').toLowerCase().trim();
  const cleanUid = (profile.firebaseUid || '').trim();
  if (!cleanUid) {
    throw new Error('firebaseUid is required');
  }

  const existing = (await getUserByFirebaseUid(cleanUid)) || (cleanEmail ? await getUserByEmail(cleanEmail) : null);
  const finalName = profile.name ? profile.name.trim() : (cleanEmail ? cleanEmail.split('@')[0] : 'Cinephile User');

  const finalUser: RegisteredUser = {
    firebaseUid: cleanUid,
    uid: cleanUid,
    name: finalName,
    displayName: finalName,
    email: cleanEmail,
    photoURL: profile.photoURL !== undefined ? profile.photoURL : (existing?.photoURL || null),
    bio: existing?.bio || '',
    favoriteGenres: existing?.favoriteGenres || [],
    provider: profile.provider || existing?.provider || 'google.com',
    status: (profile.status as any) || existing?.status || 'active',
    createdAt: existing?.createdAt || profile.createdAt || new Date().toISOString(),
    lastLoginAt: profile.lastLoginAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requestsCount: existing?.requestsCount || 0,
    reportsCount: existing?.reportsCount || 0,
    recentRequests: existing?.recentRequests || [],
  };

  let persisted = false;

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase();
    if (db) {
      try {
        await db.collection('users').createIndex(
          { firebaseUid: 1 },
          { unique: true, sparse: true, background: true }
        );
      } catch {}

      await db.collection('users').updateOne(
        { $or: [{ firebaseUid: cleanUid }, { uid: cleanUid }, ...(cleanEmail ? [{ email: cleanEmail }] : [])] },
        {
          $set: finalUser,
          $unset: { passwordHash: '', passwordSalt: '' },
        },
        { upsert: true }
      );
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas Firebase user save warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existingRedis = (await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY)) || [];
      const currentList = Array.isArray(existingRedis) ? existingRedis : [];
      const updated = [
        finalUser,
        ...currentList.filter((u) => u.firebaseUid !== cleanUid && u.uid !== cleanUid && (!cleanEmail || u.email !== cleanEmail)),
      ];
      await redisClient.set(REDIS_USERS_KEY, updated);
      persisted = true;
    } catch (err: any) {
      console.error('Upstash Redis Firebase user save error:', err.message);
    }
  }

  // 3. Local JSON (only if writable)
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackUsers();
      const updated = [
        finalUser,
        ...local.filter((u) => u.firebaseUid !== cleanUid && u.uid !== cleanUid && (!cleanEmail || u.email !== cleanEmail)),
      ];
      if (saveLocalFallbackUsers(updated)) {
        persisted = true;
      }
    } catch (err: any) {
      console.error('Local Firebase user save failed:', err.message);
    }
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not save Firebase user profile.');
  }

  return finalUser;
}

/**
 * Saves or updates a registered user across persistence layers (legacy password auth)
 */
export async function saveUserToDatabase(user: Partial<RegisteredUser> & { uid?: string; email: string }): Promise<RegisteredUser> {
  const cleanEmail = user.email.toLowerCase().trim();
  const existing = await getUserByEmail(cleanEmail);
  const uid = user.firebaseUid || user.uid || existing?.firebaseUid || existing?.uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const name = user.name || user.displayName || existing?.name || existing?.displayName || cleanEmail.split('@')[0] || 'Cinephile User';

  const finalUser: RegisteredUser = {
    firebaseUid: uid,
    uid,
    name,
    displayName: name,
    email: cleanEmail,
    photoURL: user.photoURL !== undefined ? user.photoURL : (existing?.photoURL || null),
    bio: user.bio || existing?.bio || '',
    favoriteGenres: user.favoriteGenres || existing?.favoriteGenres || [],
    createdAt: user.createdAt || existing?.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    provider: user.provider || existing?.provider || 'email_password',
    status: user.status || existing?.status || 'active',
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
        { $or: [{ email: cleanEmail }, { firebaseUid: finalUser.uid }, { uid: finalUser.uid }] },
        { $set: { ...finalUser, updatedAt: new Date() } },
        { upsert: true }
      );
      persisted = true;
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas user save warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
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
 * Deletes a user by uid or firebaseUid
 */
export async function deleteUserFromDatabase(uid: string): Promise<boolean> {
  const cleanUid = (uid || '').trim();
  if (!cleanUid) return false;
  let persisted = false;

  // 1. Mongo
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection('users').deleteOne({
        $or: [{ firebaseUid: cleanUid }, { uid: cleanUid }],
      });
      persisted = true;
    }
  } catch (e) {}

  // 2. Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const existing = (await redisClient.get<RegisteredUser[]>(REDIS_USERS_KEY)) || [];
      if (Array.isArray(existing)) {
        await redisClient.set(
          REDIS_USERS_KEY,
          existing.filter((u) => u.firebaseUid !== cleanUid && u.uid !== cleanUid)
        );
        persisted = true;
      }
    } catch (e) {}
  }

  // 3. Local
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackUsers();
      if (saveLocalFallbackUsers(local.filter((u) => u.firebaseUid !== cleanUid && u.uid !== cleanUid))) {
        persisted = true;
      }
    } catch (e) {}
  }

  if (!persisted) {
    throw new Error('Database persistence unavailable: could not delete user.');
  }

  return true;
}
