import { getDatabase } from '@/lib/mongodb';
import { UserRequest, DefectiveLinkReport, UserNotification } from '@/types';

export { type UserNotification };

let indexesCreated = false;

/**
 * Ensures indexes exist on the notifications collection
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
    // If index already exists with different options or during concurrent calls, log and proceed
    console.warn('Notification indexes check:', err.message);
  }
}

/**
 * Creates a single, idempotent fulfillment notification for a user request.
 * If a notification for this (requestId, type) already exists, it safely ignores duplicate insertion.
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
    // Cannot notify an anonymous or missing user identity
    return { success: false, created: false };
  }

  try {
    const db = await getDatabase(dbName);
    if (!db) {
      throw new Error('Database connection unavailable for notification creation');
    }

    await ensureNotificationIndexes(dbName);
    const collection = db.collection('notifications');

    // Idempotency pre-check
    const existing = await collection.findOne({
      requestId: request.id,
      type: 'REQUEST_FULFILLED',
    });

    if (existing) {
      const { _id, ...rest } = existing;
      return { success: true, created: false, notification: rest as UserNotification };
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
      message: `"${cleanMediaTitle}"${releaseYr} is now available on CineFuel.`,
      mediaTitle: cleanMediaTitle,
      movieId: tmdbId,
      mediaType,
      linkUrl,
      posterPath: request.posterPath || null,
      read: false,
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    try {
      await collection.insertOne({ ...notif });
      return { success: true, created: true, notification: notif };
    } catch (insertErr: any) {
      // E11000 duplicate key error means another concurrent fulfillment already created it
      if (insertErr.code === 11000 || String(insertErr.message).includes('E11000')) {
        const found = await collection.findOne({ requestId: request.id, type: 'REQUEST_FULFILLED' });
        if (found) {
          const { _id, ...rest } = found;
          return { success: true, created: false, notification: rest as UserNotification };
        }
      }
      throw insertErr;
    }
  } catch (err: any) {
    console.error('Failed to create request fulfillment notification:', err.message);
    return { success: false, created: false };
  }
}

/**
 * Creates a single, idempotent notification for a defective link report resolution or update.
 * If a notification for this (reportId, type) already exists, it safely ignores duplicate insertion.
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
    // Cannot notify an anonymous or missing user identity
    return { success: false, created: false };
  }

  try {
    const db = await getDatabase(dbName);
    if (!db) {
      throw new Error('Database connection unavailable for report notification creation');
    }

    await ensureNotificationIndexes(dbName);
    const collection = db.collection('notifications');

    const notifType = status === 'fixed' ? 'DEFECTIVE_LINK_RESOLVED' : 'DEFECTIVE_LINK_DISMISSED';

    // Idempotency pre-check
    const existing = await collection.findOne({
      reportId: report.id,
      type: notifType,
    });

    if (existing) {
      const { _id, ...rest } = existing;
      return { success: true, created: false, notification: rest as UserNotification };
    }

    const mediaType = report.mediaType === 'tv' ? 'tv' : 'movie';
    const movieId = report.movieId;
    const linkUrl = movieId ? `/${mediaType}/${movieId}` : '/';
    const cleanMediaTitle = (report.mediaTitle || 'Reported Title').trim();

    const title = status === 'fixed'
      ? 'Broken Link Report Resolved'
      : 'Broken Link Report Update';

    const message = status === 'fixed'
      ? `The link you reported for "${cleanMediaTitle}" has been verified and resolved.${meta?.adminNote ? ` (${meta.adminNote})` : ''}`
      : `The link report for "${cleanMediaTitle}" has been reviewed.${meta?.adminNote ? ` Admin note: "${meta.adminNote}"` : ' Our curators confirmed the title is active.'}`;

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
    };

    try {
      await collection.insertOne({ ...notif });
      return { success: true, created: true, notification: notif };
    } catch (insertErr: any) {
      if (insertErr.code === 11000 || String(insertErr.message).includes('E11000')) {
        const found = await collection.findOne({ reportId: report.id, type: notifType });
        if (found) {
          const { _id, ...rest } = found;
          return { success: true, created: false, notification: rest as UserNotification };
        }
      }
      throw insertErr;
    }
  } catch (err: any) {
    console.error('Failed to create defective report notification:', err.message);
    return { success: false, created: false };
  }
}

/**
 * Retrieves paginated notifications for a verified user
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

  try {
    const db = await getDatabase(dbName);
    if (!db) {
      return {
        notifications: [],
        total: 0,
        unreadCount: 0,
        page,
        totalPages: 1,
        limit,
        hasMore: false,
      };
    }

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
  } catch (err: any) {
    console.error('Failed to get user notifications:', err.message);
    return {
      notifications: [],
      total: 0,
      unreadCount: 0,
      page,
      totalPages: 1,
      limit,
      hasMore: false,
    };
  }
}

/**
 * Gets efficient unread notification count for authenticated header badge
 */
export async function getUnreadNotificationCount(firebaseUid: string, dbName?: string): Promise<number> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return 0;

  try {
    const db = await getDatabase(dbName);
    if (!db) return 0;
    return await db.collection('notifications').countDocuments({
      $or: [{ firebaseUid: uid }, { userId: uid }],
      read: false,
    }).catch(() => 0);
  } catch (err: any) {
    console.error('Failed to count unread notifications:', err.message);
    return 0;
  }
}

/**
 * Marks a notification as read with strict user ownership validation
 */
export async function markNotificationAsRead(
  notificationId: string,
  firebaseUid: string,
  dbName?: string
): Promise<{ success: boolean; found: boolean }> {
  const uid = (firebaseUid || '').trim();
  const id = (notificationId || '').trim();
  if (!uid || !id) return { success: false, found: false };

  try {
    const db = await getDatabase(dbName);
    if (!db) return { success: false, found: false };

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

    return {
      success: true,
      found: result.matchedCount > 0,
    };
  } catch (err: any) {
    console.error('Failed to mark notification as read:', err.message);
    return { success: false, found: false };
  }
}

/**
 * Marks all notifications for a user as read
 */
export async function markAllNotificationsAsRead(
  firebaseUid: string,
  dbName?: string
): Promise<{ success: boolean; count: number }> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return { success: false, count: 0 };

  try {
    const db = await getDatabase(dbName);
    if (!db) return { success: false, count: 0 };

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

    return {
      success: true,
      count: result.modifiedCount,
    };
  } catch (err: any) {
    console.error('Failed to mark all notifications as read:', err.message);
    return { success: false, count: 0 };
  }
}
