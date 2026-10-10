import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redisDb';
import { getUserByFirebaseUid } from '@/lib/usersDb';
import { UserRequest, DefectiveLinkReport, UserNotification } from '@/types';

export { type UserNotification };

const REDIS_NOTIFICATIONS_KEY = 'cinefuel:user_notifications';
const LOCAL_NOTIFICATIONS_FILE = path.join(process.cwd(), 'src', 'data', 'userNotifications.json');

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
  if (
    process.env.NEXT_RUNTIME === 'edge' ||
    process.env.CLOUDFLARE_WORKER ||
    typeof (process as any).getBuiltinModule !== 'undefined'
  ) {
    return false;
  }
  return true;
}

/**
 * Reads local JSON fallback notifications file safely
 */
export function getLocalFallbackNotifications(): UserNotification[] {
  if (!isFileSystemWritable()) return [];
  try {
    if (fs.existsSync(LOCAL_NOTIFICATIONS_FILE)) {
      const raw = fs.readFileSync(LOCAL_NOTIFICATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading local userNotifications.json:', e);
  }
  return [];
}

/**
 * Writes local JSON fallback notifications file safely
 */
export function saveLocalFallbackNotifications(data: UserNotification[]): boolean {
  if (!isFileSystemWritable()) return false;
  try {
    const dir = path.dirname(LOCAL_NOTIFICATIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_NOTIFICATIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing local userNotifications.json:', e);
    return false;
  }
}

let indexesCreated = false;

/**
 * Ensures indexes exist on the notifications collection in MongoDB
 */
export async function ensureNotificationIndexes(dbName?: string): Promise<void> {
  if (indexesCreated) return;
  try {
    const db = await getDatabase(dbName);
    if (!db) return;
    const collection = db.collection('notifications');

    await collection.createIndex({ firebaseUid: 1, createdAt: -1 }, { background: true });
    await collection.createIndex({ firebaseUid: 1, read: 1, createdAt: -1 }, { background: true });

    try {
      await collection.createIndex(
        { requestId: 1, type: 1 },
        { unique: true, sparse: true, background: true }
      );
    } catch (idxErr: any) {
      if (idxErr.code === 86 || idxErr.codeName === 'IndexKeySpecsConflict') {
        await collection.dropIndex('requestId_1_type_1').catch(() => {});
        await collection.createIndex(
          { requestId: 1, type: 1 },
          { unique: true, sparse: true, background: true }
        );
      }
    }

    try {
      await collection.createIndex(
        { reportId: 1, type: 1 },
        { unique: true, sparse: true, background: true }
      );
    } catch (idxErr: any) {
      if (idxErr.code === 86 || idxErr.codeName === 'IndexKeySpecsConflict') {
        await collection.dropIndex('reportId_1_type_1').catch(() => {});
        await collection.createIndex(
          { reportId: 1, type: 1 },
          { unique: true, sparse: true, background: true }
        );
      }
    }

    indexesCreated = true;
  } catch (err: any) {
    console.warn('Notification indexes check:', err.message);
  }
}

/**
 * Checks whether user has in-app notifications enabled for requests or reports across all storage engines
 */
export async function isUserNotificationEnabled(
  firebaseUid: string,
  category: 'request' | 'report',
  db?: any
): Promise<boolean> {
  try {
    const cleanUid = (firebaseUid || '').trim();
    if (!cleanUid) return true;

    // 1. Try MongoDB
    if (db) {
      const userDoc = await db.collection('users').findOne({
        $or: [{ firebaseUid: cleanUid }, { uid: cleanUid }],
      });
      if (userDoc?.notificationPreferences) {
        return category === 'request'
          ? userDoc.notificationPreferences.inAppRequests !== false
          : userDoc.notificationPreferences.inAppReports !== false;
      }
    }

    // 2. Try User Profile directory lookup (checks Mongo, Redis, local)
    const profile = await getUserByFirebaseUid(cleanUid);
    if (profile?.notificationPreferences) {
      return category === 'request'
        ? profile.notificationPreferences.inAppRequests !== false
        : profile.notificationPreferences.inAppReports !== false;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Internal helper to persist a notification across MongoDB, Upstash Redis, and Local JSON.
 * Returns true if persisted in at least one layer.
 */
async function saveNotificationRecord(
  notif: UserNotification,
  dbName?: string
): Promise<{ success: boolean; created: boolean; notification: UserNotification }> {
  let persisted = false;
  let isDuplicate = false;

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase(dbName);
    if (db) {
      await ensureNotificationIndexes(dbName);
      const collection = db.collection('notifications');

      // Idempotency check in Mongo
      const query: any = { id: notif.id };
      if (notif.requestId && notif.type !== 'ADMIN_REPLY') {
        query.$or = [{ id: notif.id }, { requestId: notif.requestId, type: notif.type }];
      } else if (notif.reportId && notif.type !== 'ADMIN_REPLY') {
        query.$or = [{ id: notif.id }, { reportId: notif.reportId, type: notif.type }];
      }

      const existing = await collection.findOne(query);
      if (existing) {
        const { _id, ...rest } = existing;
        return { success: true, created: false, notification: rest as UserNotification };
      }

      try {
        await collection.insertOne({ ...notif });
        persisted = true;
      } catch (insertErr: any) {
        if (insertErr.code === 11000 || String(insertErr.message).includes('E11000')) {
          const found = await collection.findOne(query);
          if (found) {
            const { _id, ...rest } = found;
            return { success: true, created: false, notification: rest as UserNotification };
          }
        }
      }
    }
  } catch (mongoErr: any) {
    console.warn('MongoDB notification save warning:', mongoErr.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const raw = await redisClient.get<any>(REDIS_NOTIFICATIONS_KEY);
      const list = parseRedisList<UserNotification>(raw);

      // Check for duplicate in Redis
      const existing = list.find((n) => {
        if (n.id === notif.id) return true;
        if (notif.requestId && notif.type !== 'ADMIN_REPLY' && n.requestId === notif.requestId && n.type === notif.type) return true;
        if (notif.reportId && notif.type !== 'ADMIN_REPLY' && n.reportId === notif.reportId && n.type === notif.type) return true;
        return false;
      });

      if (existing) {
        return { success: true, created: false, notification: existing };
      }

      // Prepend and cap at 1000 items
      const updated = [notif, ...list.filter((n) => n.id !== notif.id)].slice(0, 1000);
      await redisClient.set(REDIS_NOTIFICATIONS_KEY, updated);
      persisted = true;
    } catch (redisErr: any) {
      console.warn('Upstash Redis notification save warning:', redisErr.message);
    }
  }

  // 3. Local fallback JSON
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackNotifications();
      const existing = local.find((n) => n.id === notif.id);
      if (!existing) {
        const updated = [notif, ...local.filter((n) => n.id !== notif.id)].slice(0, 500);
        if (saveLocalFallbackNotifications(updated)) {
          persisted = true;
        }
      }
    } catch (localErr: any) {
      console.warn('Local notification save warning:', localErr.message);
    }
  }

  if (!persisted) {
    console.warn('Notification was not persisted: no storage backend was available.');
    return { success: false, created: false, notification: notif };
  }

  return { success: true, created: true, notification: notif };
}

/**
 * Creates a single, idempotent fulfillment notification for a user request.
 */
export async function createRequestFulfilledNotification(
  request: UserRequest,
  meta?: {
    fulfilledLinkId?: string;
    fulfilledLinkUrl?: string;
    adminNote?: string;
  },
  dbName?: string
): Promise<{ success: boolean; created: boolean; notification?: UserNotification }> {
  const uid = (request.userId || '').trim();
  if (!uid || uid === 'guest-user-default') {
    return { success: false, created: false };
  }

  try {
    const enabled = await isUserNotificationEnabled(uid, 'request');
    if (!enabled) {
      return { success: true, created: false };
    }

    const mediaType = request.mediaType === 'tv' ? 'tv' : 'movie';
    const tmdbId = request.tmdbId;
    const linkUrl = tmdbId ? `/${mediaType}/${tmdbId}` : (meta?.fulfilledLinkUrl || '/');
    const releaseYr = request.releaseYear ? ` (${request.releaseYear})` : '';
    const cleanMediaTitle = request.title.trim();

    const notif: UserNotification = {
      id: `notif-${request.id}`,
      userId: uid,
      firebaseUid: uid,
      requestId: request.id,
      type: 'REQUEST_FULFILLED',
      title: 'Your request has been fulfilled',
      message: `"${cleanMediaTitle}"${releaseYr} is now available on CineFuel.${meta?.adminNote ? ` Admin note: "${meta.adminNote}"` : ''}`,
      mediaTitle: cleanMediaTitle,
      movieId: tmdbId,
      mediaType,
      linkUrl,
      posterPath: request.posterPath || null,
      read: false,
      createdAt: new Date().toISOString(),
      readAt: null,
      adminReply: meta?.adminNote || undefined,
    };

    return await saveNotificationRecord(notif, dbName);
  } catch (err: any) {
    console.error('Failed to create request fulfillment notification:', err.message);
    return { success: false, created: false };
  }
}

/**
 * Creates a notification when a user request is marked in-progress.
 */
export async function createRequestInProgressNotification(
  request: UserRequest,
  meta?: {
    adminNote?: string;
  },
  dbName?: string
): Promise<{ success: boolean; created: boolean; notification?: UserNotification }> {
  const uid = (request.userId || '').trim();
  if (!uid || uid === 'guest-user-default') {
    return { success: false, created: false };
  }

  try {
    const enabled = await isUserNotificationEnabled(uid, 'request');
    if (!enabled) {
      return { success: true, created: false };
    }

    const mediaType = request.mediaType === 'tv' ? 'tv' : 'movie';
    const tmdbId = request.tmdbId;
    const linkUrl = tmdbId ? `/${mediaType}/${tmdbId}` : '/profile#my-requests';
    const cleanMediaTitle = request.title.trim();

    const notif: UserNotification = {
      id: `notif-prog-${request.id}`,
      userId: uid,
      firebaseUid: uid,
      requestId: request.id,
      type: 'REQUEST_IN_PROGRESS',
      title: `Request in Progress: ${cleanMediaTitle}`,
      message: `Our curators are working on sourcing "${cleanMediaTitle}".${meta?.adminNote ? ` (${meta.adminNote})` : ''}`,
      mediaTitle: cleanMediaTitle,
      movieId: tmdbId,
      mediaType,
      linkUrl,
      posterPath: request.posterPath || null,
      read: false,
      createdAt: new Date().toISOString(),
      readAt: null,
      adminReply: meta?.adminNote || undefined,
    };

    return await saveNotificationRecord(notif, dbName);
  } catch (err: any) {
    console.error('Failed to create request in-progress notification:', err.message);
    return { success: false, created: false };
  }
}

/**
 * Creates a single, idempotent notification for a defective link report resolution or update.
 */
export async function createReportNotification(
  report: DefectiveLinkReport,
  status: 'fixed' | 'dismissed',
  meta?: {
    replacementUrl?: string;
    adminNote?: string;
  },
  dbName?: string
): Promise<{ success: boolean; created: boolean; notification?: UserNotification }> {
  const uid = (report.userId || '').trim();
  if (!uid || uid === 'guest-user-default') {
    return { success: false, created: false };
  }

  try {
    const enabled = await isUserNotificationEnabled(uid, 'report');
    if (!enabled) {
      return { success: true, created: false };
    }

    const notifType = status === 'fixed' ? 'DEFECTIVE_LINK_RESOLVED' : 'DEFECTIVE_LINK_DISMISSED';
    const mediaType = report.mediaType === 'tv' ? 'tv' : 'movie';
    const movieId = report.movieId;
    const linkUrl = meta?.replacementUrl || (movieId ? `/${mediaType}/${movieId}` : '/profile#my-reports');
    const cleanMediaTitle = (report.mediaTitle || 'Reported Title').trim();

    const title = status === 'fixed'
      ? 'Broken Link Report Resolved'
      : 'Broken Link Report Dismissed';

    const message = status === 'fixed'
      ? `The link you reported for "${cleanMediaTitle}" has been verified and repaired.${meta?.adminNote ? ` (${meta.adminNote})` : ''}`
      : `The link report for "${cleanMediaTitle}" was checked and dismissed.${meta?.adminNote ? ` Note: "${meta.adminNote}"` : ' Our curators confirmed the title is active.'}`;

    const notif: UserNotification = {
      id: `notif-rep-${report.id}-${status}`,
      userId: uid,
      firebaseUid: uid,
      reportId: report.id,
      type: notifType,
      title,
      message,
      mediaTitle: cleanMediaTitle,
      movieId,
      mediaType,
      linkUrl,
      posterPath: report.posterPath || null,
      read: false,
      createdAt: new Date().toISOString(),
      readAt: null,
      adminReply: meta?.adminNote || undefined,
    };

    return await saveNotificationRecord(notif, dbName);
  } catch (err: any) {
    console.error('Failed to create defective report notification:', err.message);
    return { success: false, created: false };
  }
}

/**
 * Creates a notification when a defective link report is marked in-progress.
 */
export async function createReportInProgressNotification(
  report: DefectiveLinkReport,
  meta?: {
    adminNote?: string;
  },
  dbName?: string
): Promise<{ success: boolean; created: boolean; notification?: UserNotification }> {
  const uid = (report.userId || '').trim();
  if (!uid || uid === 'guest-user-default') {
    return { success: false, created: false };
  }

  try {
    const enabled = await isUserNotificationEnabled(uid, 'report');
    if (!enabled) {
      return { success: true, created: false };
    }

    const mediaType = report.mediaType === 'tv' ? 'tv' : 'movie';
    const movieId = report.movieId;
    const linkUrl = movieId ? `/${mediaType}/${movieId}` : '/profile#my-reports';
    const cleanMediaTitle = (report.mediaTitle || 'Reported Title').trim();

    const notif: UserNotification = {
      id: `notif-rep-prog-${report.id}`,
      userId: uid,
      firebaseUid: uid,
      reportId: report.id,
      type: 'DEFECTIVE_LINK_IN_PROGRESS',
      title: `Broken Link Report In Progress: ${cleanMediaTitle}`,
      message: `Our technical team is currently investigating and repairing the reported link for "${cleanMediaTitle}".${meta?.adminNote ? ` (${meta.adminNote})` : ''}`,
      mediaTitle: cleanMediaTitle,
      movieId,
      mediaType,
      linkUrl,
      posterPath: report.posterPath || null,
      read: false,
      createdAt: new Date().toISOString(),
      readAt: null,
      adminReply: meta?.adminNote || undefined,
    };

    return await saveNotificationRecord(notif, dbName);
  } catch (err: any) {
    console.error('Failed to create defective report in-progress notification:', err.message);
    return { success: false, created: false };
  }
}

/**
 * Creates an in-app notification when an admin replies to a user request or broken link report
 */
export async function createAdminReplyNotification(
  targetType: 'request' | 'report',
  item: UserRequest | DefectiveLinkReport,
  replyText: string,
  dbName?: string
): Promise<{ success: boolean; created: boolean; notification?: UserNotification }> {
  const uid = (item.userId || '').trim();
  if (!uid || uid === 'guest-user-default' || !replyText.trim()) {
    return { success: false, created: false };
  }

  try {
    const enabled = await isUserNotificationEnabled(uid, targetType);
    if (!enabled) {
      return { success: true, created: false };
    }

    const cleanMediaTitle = targetType === 'request'
      ? (item as UserRequest).title.trim()
      : ((item as DefectiveLinkReport).mediaTitle || 'Reported Title').trim();

    const mediaType = ((item as any).mediaType === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
    const movieId = targetType === 'request'
      ? (item as UserRequest).tmdbId
      : (item as DefectiveLinkReport).movieId;

    const linkUrl = movieId ? `/${mediaType}/${movieId}` : '/profile';
    const notifId = `notif-reply-${item.id}-${Date.now()}`;

    const notif: UserNotification = {
      id: notifId,
      userId: uid,
      firebaseUid: uid,
      ...(targetType === 'request' ? { requestId: item.id } : { reportId: item.id }),
      type: 'ADMIN_REPLY',
      title: targetType === 'request'
        ? `Admin Replied to Your Request: ${cleanMediaTitle}`
        : `Admin Replied to Your Broken Link Report: ${cleanMediaTitle}`,
      message: `Admin reply: "${replyText.trim()}"`,
      mediaTitle: cleanMediaTitle,
      movieId,
      mediaType,
      linkUrl,
      posterPath: item.posterPath || null,
      read: false,
      createdAt: new Date().toISOString(),
      readAt: null,
      adminReply: replyText.trim(),
    };

    return await saveNotificationRecord(notif, dbName);
  } catch (err: any) {
    console.error('Failed to create admin reply notification:', err.message);
    return { success: false, created: false };
  }
}

/**
 * Retrieves paginated notifications for a verified user across MongoDB Atlas, Upstash Redis, and Local JSON.
 */
export async function getUserNotifications(
  firebaseUid: string,
  options: { page?: number; limit?: number; unreadOnly?: boolean } = {},
  dbName?: string
): Promise<{
  notifications: UserNotification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
  limit: number;
  hasMore: boolean;
}> {
  const uid = (firebaseUid || '').trim();
  if (!uid) {
    return {
      notifications: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      totalPages: 1,
      limit: 20,
      hasMore: false,
    };
  }

  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(50, options.limit || 20));

  // 1. Try MongoDB Atlas
  try {
    const db = await getDatabase(dbName);
    if (db) {
      const collection = db.collection('notifications');

      const filter: any = {
        $or: [{ firebaseUid: uid }, { userId: uid }],
      };
      if (options.unreadOnly) {
        filter.read = false;
      }

      const unreadCount = await collection.countDocuments({
        $or: [{ firebaseUid: uid }, { userId: uid }],
        read: false,
      }).catch(() => 0);

      const total = await collection.countDocuments(filter).catch(() => 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const docs = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const notifications: UserNotification[] = docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as UserNotification;
      });

      return {
        notifications,
        total,
        unreadCount,
        page,
        totalPages,
        limit,
        hasMore: page < totalPages,
      };
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas notifications read fallback:', err.message);
  }

  // 2. Try Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const raw = await redisClient.get<any>(REDIS_NOTIFICATIONS_KEY);
      const list = parseRedisList<UserNotification>(raw);

      const userNotifs = list.filter((n) => n.firebaseUid === uid || n.userId === uid);
      const unreadCount = userNotifs.filter((n) => !n.read).length;

      const filtered = options.unreadOnly ? userNotifs.filter((n) => !n.read) : userNotifs;
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const paged = filtered.slice((page - 1) * limit, page * limit);

      return {
        notifications: paged,
        total,
        unreadCount,
        page,
        totalPages,
        limit,
        hasMore: page < totalPages,
      };
    } catch (redisErr: any) {
      console.warn('Upstash Redis notifications read failed:', redisErr.message);
    }
  }

  // 3. Fallback to Local JSON
  const localList = getLocalFallbackNotifications();
  const userNotifs = localList.filter((n) => n.firebaseUid === uid || n.userId === uid);
  const unreadCount = userNotifs.filter((n) => !n.read).length;

  const filtered = options.unreadOnly ? userNotifs.filter((n) => !n.read) : userNotifs;
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return {
    notifications: paged,
    total,
    unreadCount,
    page,
    totalPages,
    limit,
    hasMore: page < totalPages,
  };
}

/**
 * Gets efficient unread notification count for authenticated header badge
 */
export async function getUnreadNotificationCount(firebaseUid: string, dbName?: string): Promise<number> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return 0;

  // 1. Try MongoDB
  try {
    const db = await getDatabase(dbName);
    if (db) {
      return await db.collection('notifications').countDocuments({
        $or: [{ firebaseUid: uid }, { userId: uid }],
        read: false,
      }).catch(() => 0);
    }
  } catch (err: any) {
    console.warn('MongoDB Atlas countUnread fallback:', err.message);
  }

  // 2. Try Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const raw = await redisClient.get<any>(REDIS_NOTIFICATIONS_KEY);
      const list = parseRedisList<UserNotification>(raw);
      return list.filter((n) => (n.firebaseUid === uid || n.userId === uid) && !n.read).length;
    } catch (redisErr: any) {
      console.warn('Upstash Redis countUnread failed:', redisErr.message);
    }
  }

  // 3. Local fallback
  const local = getLocalFallbackNotifications();
  return local.filter((n) => (n.firebaseUid === uid || n.userId === uid) && !n.read).length;
}

/**
 * Marks a notification as read with strict user ownership validation across all stores
 */
export async function markNotificationAsRead(
  notificationId: string,
  firebaseUid: string,
  dbName?: string
): Promise<{ success: boolean; found: boolean }> {
  const uid = (firebaseUid || '').trim();
  const id = (notificationId || '').trim();
  if (!uid || !id) return { success: false, found: false };

  let found = false;

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase(dbName);
    if (db) {
      const result = await db.collection('notifications').updateOne(
        {
          id,
          $or: [{ firebaseUid: uid }, { userId: uid }],
        },
        {
          $set: {
            read: true,
            readAt: new Date().toISOString(),
            updatedAt: new Date(),
          },
        }
      );
      if (result.matchedCount > 0) {
        found = true;
      }
    }
  } catch (err: any) {
    console.warn('MongoDB markNotificationAsRead warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const raw = await redisClient.get<any>(REDIS_NOTIFICATIONS_KEY);
      const list = parseRedisList<UserNotification>(raw);
      let updatedAny = false;
      const updated = list.map((n) => {
        if (n.id === id && (n.firebaseUid === uid || n.userId === uid)) {
          updatedAny = true;
          found = true;
          return { ...n, read: true, readAt: new Date().toISOString() };
        }
        return n;
      });
      if (updatedAny) {
        await redisClient.set(REDIS_NOTIFICATIONS_KEY, updated);
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis markNotificationAsRead failed:', redisErr.message);
    }
  }

  // 3. Local fallback
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackNotifications();
      let updatedLocal = false;
      const updated = local.map((n) => {
        if (n.id === id && (n.firebaseUid === uid || n.userId === uid)) {
          updatedLocal = true;
          found = true;
          return { ...n, read: true, readAt: new Date().toISOString() };
        }
        return n;
      });
      if (updatedLocal) {
        saveLocalFallbackNotifications(updated);
      }
    } catch (localErr: any) {
      console.warn('Local markNotificationAsRead failed:', localErr.message);
    }
  }

  return {
    success: true,
    found,
  };
}

/**
 * Marks all notifications for a user as read across all stores
 */
export async function markAllNotificationsAsRead(
  firebaseUid: string,
  dbName?: string
): Promise<{ success: boolean; count: number }> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return { success: false, count: 0 };

  let count = 0;

  // 1. MongoDB Atlas
  try {
    const db = await getDatabase(dbName);
    if (db) {
      const result = await db.collection('notifications').updateMany(
        {
          $or: [{ firebaseUid: uid }, { userId: uid }],
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date().toISOString(),
            updatedAt: new Date(),
          },
        }
      );
      count = result.modifiedCount;
    }
  } catch (err: any) {
    console.warn('MongoDB markAllNotificationsAsRead warning:', err.message);
  }

  // 2. Upstash Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const raw = await redisClient.get<any>(REDIS_NOTIFICATIONS_KEY);
      const list = parseRedisList<UserNotification>(raw);
      let redisCount = 0;
      const updated = list.map((n) => {
        if ((n.firebaseUid === uid || n.userId === uid) && !n.read) {
          redisCount++;
          return { ...n, read: true, readAt: new Date().toISOString() };
        }
        return n;
      });
      if (redisCount > 0) {
        await redisClient.set(REDIS_NOTIFICATIONS_KEY, updated);
        if (count === 0) count = redisCount;
      }
    } catch (redisErr: any) {
      console.warn('Upstash Redis markAllNotificationsAsRead failed:', redisErr.message);
    }
  }

  // 3. Local JSON
  if (isFileSystemWritable()) {
    try {
      const local = getLocalFallbackNotifications();
      let localCount = 0;
      const updated = local.map((n) => {
        if ((n.firebaseUid === uid || n.userId === uid) && !n.read) {
          localCount++;
          return { ...n, read: true, readAt: new Date().toISOString() };
        }
        return n;
      });
      if (localCount > 0) {
        saveLocalFallbackNotifications(updated);
        if (count === 0) count = localCount;
      }
    } catch {}
  }

  return {
    success: true,
    count,
  };
}
