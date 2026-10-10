import { getDatabase } from '@/lib/mongodb';
import { getEnv } from '@/lib/env';
import {
  UserRequest,
  DefectiveLinkReport,
  UserNotification,
  TelegramLink,
  TelegramLinkingToken,
  NotificationDelivery,
} from '@/types';

let telegramIndexesCreated = false;

function getBotToken(): string {
  return (getEnv('TELEGRAM_BOT_TOKEN') || process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

export function getBotUsername(): string {
  return (getEnv('TELEGRAM_BOT_USERNAME') || process.env.TELEGRAM_BOT_USERNAME || 'CineFlue_bot').replace(/^@/, '').trim();
}

export function getSiteUrl(): string {
  const url = getEnv('NEXT_PUBLIC_SITE_URL') || process.env.NEXT_PUBLIC_SITE_URL || 'https://cineflue084.sk6216071.workers.dev';
  return url.replace(/\/+$/, '');
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Ensures required indexes on Telegram collections exist
 */
export async function ensureTelegramIndexes(dbName?: string): Promise<void> {
  if (telegramIndexesCreated) return;
  try {
    const db = await getDatabase(dbName);
    if (!db) return;

    const linksCol = db.collection('telegram_links');
    await linksCol.createIndex({ firebaseUid: 1 }, { unique: true, background: true });
    await linksCol.createIndex({ telegramChatId: 1 }, { background: true });

    const tokensCol = db.collection('telegram_linking_tokens');
    await tokensCol.createIndex({ token: 1 }, { unique: true, background: true });
    await tokensCol.createIndex({ expiresAt: 1 }, { background: true });
    await tokensCol.createIndex({ firebaseUid: 1 }, { background: true });

    const deliveriesCol = db.collection('notification_deliveries');
    await deliveriesCol.createIndex({ notificationId: 1, channel: 1 }, { background: true });
    await deliveriesCol.createIndex({ userId: 1, sentAt: -1 }, { background: true });

    telegramIndexesCreated = true;
  } catch (err: any) {
    console.warn('Telegram indexes check warning:', err.message);
  }
}

/**
 * Generates a cryptographically random, short-lived, single-use linking token for an authenticated user
 */
export async function generateTelegramLinkingToken(
  firebaseUid: string,
  dbName?: string
): Promise<{ token: string; expiresAt: string; botUsername: string; telegramUrl: string }> {
  const uid = (firebaseUid || '').trim();
  if (!uid || uid === 'guest-user-default') {
    throw new Error('Valid authenticated user identity required to generate Telegram linking token');
  }

  const db = await getDatabase(dbName);
  if (!db) {
    throw new Error('Database connection unavailable for linking token generation');
  }

  await ensureTelegramIndexes(dbName);

  // Generate cryptographically random token (32 hex characters)
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const token = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes TTL

  const tokenRecord: TelegramLinkingToken = {
    token,
    firebaseUid: uid,
    createdAt: now.toISOString(),
    expiresAt,
    used: false,
    usedAt: null,
  };

  await db.collection('telegram_linking_tokens').insertOne({ ...tokenRecord });

  const botUsername = getBotUsername();
  const telegramUrl = `https://t.me/${botUsername}?start=${token}`;

  return {
    token,
    expiresAt,
    botUsername,
    telegramUrl,
  };
}

/**
 * Validates and atomically consumes a one-time linking token
 */
export async function verifyAndConsumeTelegramLinkingToken(
  token: string,
  dbName?: string
): Promise<{ valid: boolean; firebaseUid?: string; error?: string }> {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return { valid: false, error: 'Empty token' };
  }

  try {
    const db = await getDatabase(dbName);
    if (!db) {
      return { valid: false, error: 'Database unavailable' };
    }

    await ensureTelegramIndexes(dbName);

    const nowIso = new Date().toISOString();

    // Atomically find and mark token as used
    const result = await db.collection('telegram_linking_tokens').findOneAndUpdate(
      {
        token: cleanToken,
        used: false,
        expiresAt: { $gt: nowIso },
      },
      {
        $set: {
          used: true,
          usedAt: nowIso,
        },
      },
      { returnDocument: 'after' }
    );

    const doc = result && ('value' in result ? (result as any).value : result);

    if (!doc || !doc.firebaseUid) {
      return { valid: false, error: 'Token is invalid, expired, or already used' };
    }

    return { valid: true, firebaseUid: doc.firebaseUid };
  } catch (err: any) {
    console.error('Error verifying Telegram linking token:', err.message);
    return { valid: false, error: err.message };
  }
}

/**
 * Links a Telegram chat/user to a CineFuel user account
 */
export async function linkTelegramAccount(
  firebaseUid: string,
  telegramInfo: {
    chatId: number;
    userId: number;
    username?: string;
  },
  dbName?: string
): Promise<{ success: boolean; link?: TelegramLink }> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return { success: false };

  try {
    const db = await getDatabase(dbName);
    if (!db) return { success: false };

    await ensureTelegramIndexes(dbName);

    const nowIso = new Date().toISOString();
    const linkDoc: TelegramLink = {
      firebaseUid: uid,
      telegramChatId: telegramInfo.chatId,
      telegramUserId: telegramInfo.userId,
      telegramUsername: telegramInfo.username || undefined,
      status: 'active',
      requestNotifications: true,
      reportNotifications: true,
      linkedAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('telegram_links').updateOne(
      { firebaseUid: uid },
      {
        $set: {
          telegramChatId: telegramInfo.chatId,
          telegramUserId: telegramInfo.userId,
          telegramUsername: telegramInfo.username || undefined,
          status: 'active',
          updatedAt: nowIso,
        },
        $setOnInsert: {
          requestNotifications: true,
          reportNotifications: true,
          linkedAt: nowIso,
        },
      },
      { upsert: true }
    );

    return { success: true, link: linkDoc };
  } catch (err: any) {
    console.error('Failed to link Telegram account:', err.message);
    return { success: false };
  }
}

/**
 * Gets Telegram link record for a user
 */
export async function getTelegramLinkForUser(
  firebaseUid: string,
  dbName?: string
): Promise<TelegramLink | null> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return null;

  try {
    const db = await getDatabase(dbName);
    if (!db) return null;

    const doc = await db.collection('telegram_links').findOne({ firebaseUid: uid });
    if (!doc) return null;

    const { _id, ...rest } = doc;
    return rest as TelegramLink;
  } catch (err: any) {
    console.error('Failed to get Telegram link for user:', err.message);
    return null;
  }
}

/**
 * Updates notification preferences (requestNotifications, reportNotifications)
 */
export async function updateTelegramPreferences(
  firebaseUid: string,
  prefs: {
    requestNotifications?: boolean;
    reportNotifications?: boolean;
  },
  dbName?: string
): Promise<{ success: boolean }> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return { success: false };

  try {
    const db = await getDatabase(dbName);
    if (!db) return { success: false };

    const updateFields: any = { updatedAt: new Date().toISOString() };
    if (typeof prefs.requestNotifications === 'boolean') {
      updateFields.requestNotifications = prefs.requestNotifications;
    }
    if (typeof prefs.reportNotifications === 'boolean') {
      updateFields.reportNotifications = prefs.reportNotifications;
    }

    const res = await db.collection('telegram_links').updateOne(
      { firebaseUid: uid },
      { $set: updateFields }
    );

    return { success: res.matchedCount > 0 };
  } catch (err: any) {
    console.error('Failed to update Telegram preferences:', err.message);
    return { success: false };
  }
}

/**
 * Disconnects Telegram from a CineFuel user account
 */
export async function disconnectTelegramAccount(
  firebaseUid: string,
  dbName?: string
): Promise<{ success: boolean }> {
  const uid = (firebaseUid || '').trim();
  if (!uid) return { success: false };

  try {
    const db = await getDatabase(dbName);
    if (!db) return { success: false };

    const res = await db.collection('telegram_links').updateOne(
      { firebaseUid: uid },
      {
        $set: {
          status: 'disconnected',
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return { success: res.matchedCount > 0 };
  } catch (err: any) {
    console.error('Failed to disconnect Telegram account:', err.message);
    return { success: false };
  }
}

/**
 * Sends a raw Telegram message via Telegram Bot API
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: any
): Promise<{ ok: boolean; messageId?: number; description?: string }> {
  const token = getBotToken();
  if (!token) {
    console.warn('Cannot send Telegram message: TELEGRAM_BOT_TOKEN not configured');
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    const data = await res.json();
    if (data?.ok) {
      return { ok: true, messageId: data.result?.message_id };
    }
    console.warn('Telegram sendMessage API error response:', data?.description);
    return { ok: false, description: data?.description || 'Telegram API returned not ok' };
  } catch (err: any) {
    console.warn('Telegram sendMessage network error:', err.message);
    return { ok: false, description: err.message };
  }
}

/**
 * Dispatches Telegram notification for a fulfilled user request
 */
export async function dispatchTelegramNotificationForRequest(
  request: UserRequest,
  notification: UserNotification,
  dbName?: string
): Promise<{ dispatched: boolean; delivery?: NotificationDelivery }> {
  const uid = (request.userId || '').trim();
  if (!uid || uid === 'guest-user-default') {
    return { dispatched: false };
  }

  try {
    const tgLink = await getTelegramLinkForUser(uid, dbName);
    if (!tgLink || tgLink.status !== 'active' || tgLink.requestNotifications === false) {
      return { dispatched: false };
    }

    const siteUrl = getSiteUrl();
    const mediaType = request.mediaType === 'tv' ? 'tv' : 'movie';
    const destinationUrl = notification.linkUrl?.startsWith('http')
      ? notification.linkUrl
      : `${siteUrl}${notification.linkUrl || (request.tmdbId ? `/${mediaType}/${request.tmdbId}` : '/')}`;

    const title = escapeHtml(request.title.trim());
    const releaseYear = request.releaseYear ? ` (${escapeHtml(request.releaseYear)})` : '';
    const quality = request.quality ? escapeHtml(request.quality) : '';
    const audio = request.audioLanguage ? escapeHtml(request.audioLanguage) : '';

    const messageHtml =
`🎬 <b>CineFuel Request Fulfilled</b>

Your requested title is now available!

<b>${title}${releaseYear}</b>

${quality ? `💎 <b>Quality:</b> <code>${quality}</code>\n` : ''}${audio ? `🔊 <b>Audio:</b> <code>${audio}</code>\n` : ''}
🚀 <i>Your request has been added to the CineFuel library. Enjoy streaming or downloading!</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🎬 Watch Now',
            url: destinationUrl,
          },
        ],
      ],
    };

    const sendRes = await sendTelegramMessage(tgLink.telegramChatId, messageHtml, replyMarkup);

    const delivery: NotificationDelivery = {
      id: `deliv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      notificationId: notification.id,
      userId: uid,
      channel: 'telegram',
      telegramChatId: tgLink.telegramChatId,
      type: 'REQUEST_FULFILLED',
      status: sendRes.ok ? 'sent' : 'failed',
      telegramMessageId: sendRes.messageId || null,
      sentAt: new Date().toISOString(),
      error: sendRes.ok ? undefined : sendRes.description,
    };

    // Record delivery status
    try {
      const db = await getDatabase(dbName);
      if (db) {
        await db.collection('notification_deliveries').insertOne({ ...delivery });
      }
    } catch (logErr) {
      console.warn('Failed to record notification delivery:', logErr);
    }

    return { dispatched: sendRes.ok, delivery };
  } catch (err: any) {
    console.error('Failed to dispatch Telegram request notification:', err.message);
    return { dispatched: false };
  }
}

/**
 * Dispatches Telegram notification for a resolved/dismissed defective link report
 */
export async function dispatchTelegramNotificationForReport(
  report: DefectiveLinkReport,
  status: 'fixed' | 'dismissed',
  notification: UserNotification,
  dbName?: string
): Promise<{ dispatched: boolean; delivery?: NotificationDelivery }> {
  const uid = (report.userId || '').trim();
  if (!uid || uid === 'guest-user-default') {
    return { dispatched: false };
  }

  try {
    const tgLink = await getTelegramLinkForUser(uid, dbName);
    if (!tgLink || tgLink.status !== 'active' || tgLink.reportNotifications === false) {
      return { dispatched: false };
    }

    const siteUrl = getSiteUrl();
    const mediaType = report.mediaType === 'tv' ? 'tv' : 'movie';
    const destinationUrl = notification.linkUrl?.startsWith('http')
      ? notification.linkUrl
      : `${siteUrl}${notification.linkUrl || (report.movieId ? `/${mediaType}/${report.movieId}` : '/')}`;

    const mediaTitle = escapeHtml((report.mediaTitle || 'Reported Title').trim());
    const isFixed = status === 'fixed';

    let messageHtml = '';
    if (isFixed) {
      messageHtml =
`🔧 <b>CineFuel Link Report Resolved</b>

Good news!

The link you reported for:
<b>${mediaTitle}</b>

has been reviewed and resolved by our curators.
${report.adminNote ? `\n💬 <i>Admin Note: ${escapeHtml(report.adminNote)}</i>\n` : ''}
🚀 <i>Working download and stream mirrors are now live on CineFuel.</i>`;
    } else {
      messageHtml =
`ℹ️ <b>CineFuel Link Report Update</b>

The link report for:
<b>${mediaTitle}</b>

has been reviewed by our curation team.
${report.adminNote ? `\n💬 <i>Admin Note: ${escapeHtml(report.adminNote)}</i>\n` : '\n<i>Our team verified that the active title mirrors are online and working properly.</i>\n'}`;
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🎬 Open Title',
            url: destinationUrl,
          },
        ],
      ],
    };

    const sendRes = await sendTelegramMessage(tgLink.telegramChatId, messageHtml, replyMarkup);

    const notifType = isFixed ? 'DEFECTIVE_LINK_RESOLVED' : 'DEFECTIVE_LINK_DISMISSED';

    const delivery: NotificationDelivery = {
      id: `deliv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      notificationId: notification.id,
      userId: uid,
      channel: 'telegram',
      telegramChatId: tgLink.telegramChatId,
      type: notifType,
      status: sendRes.ok ? 'sent' : 'failed',
      telegramMessageId: sendRes.messageId || null,
      sentAt: new Date().toISOString(),
      error: sendRes.ok ? undefined : sendRes.description,
    };

    // Record delivery status
    try {
      const db = await getDatabase(dbName);
      if (db) {
        await db.collection('notification_deliveries').insertOne({ ...delivery });
      }
    } catch (logErr) {
      console.warn('Failed to record notification delivery:', logErr);
    }

    return { dispatched: sendRes.ok, delivery };
  } catch (err: any) {
    console.error('Failed to dispatch Telegram report notification:', err.message);
    return { dispatched: false };
  }
}

const ADMIN_TELEGRAM_IDS = [930928310];

// Deduplication cache to prevent sending duplicate alerts when the same event is retried
const sentAdminAlerts = new Set<string>();

/**
 * Notifies telegram admin(s) instantly when a user submits a new request on the website.
 * Telegram is ONLY for alerting admins; all review, replies, fixes, and fulfillment happen in the web admin panel.
 */
export async function notifyAdminOnTelegramNewRequest(request: UserRequest): Promise<void> {
  const alertKey = `req:${request.id}`;
  if (sentAdminAlerts.has(alertKey)) {
    return;
  }
  sentAdminAlerts.add(alertKey);
  if (sentAdminAlerts.size > 1000) {
    const first = sentAdminAlerts.values().next().value;
    if (first) sentAdminAlerts.delete(first);
  }

  try {
    const title = escapeHtml(request.title.trim());
    const releaseYear = request.releaseYear ? ` (${escapeHtml(request.releaseYear)})` : '';
    const quality = request.quality ? escapeHtml(request.quality) : 'Any';
    const audio = request.audioLanguage ? escapeHtml(request.audioLanguage) : 'Any';
    const user = escapeHtml(request.userEmail || request.userName || 'Signed-in User');
    const notes = request.notes ? escapeHtml(request.notes) : '';
    const adminUrl = `${getSiteUrl()}/admin?tab=requests&id=${encodeURIComponent(request.id)}`;

    const text =
`🎬 <b>NEW USER REQUEST SUBMISSION</b>
─────────────────────────────
📌 <b>Title:</b> <b>${title}${releaseYear}</b>
💎 <b>Quality:</b> <code>${quality}</code>
🔊 <b>Audio:</b> <code>${audio}</code>
👤 <b>User:</b> ${user}
🆔 <code>${request.id}</code>
${notes ? `📝 <b>Notes:</b> <i>${notes}</i>\n` : ''}
⚡ <i>Open in Website Admin Panel to review, reply, or fulfill:</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔗 Open in Admin Panel', url: adminUrl },
        ],
      ],
    };

    for (const adminId of ADMIN_TELEGRAM_IDS) {
      await sendTelegramMessage(adminId, text, replyMarkup).catch((err) => {
        console.warn(`Admin telegram alert delivery note for request ${request.id}:`, err?.message);
      });
    }
  } catch (err: any) {
    console.warn('Failed to notify admin on Telegram for request:', err.message);
  }
}

/**
 * Notifies telegram admin(s) instantly when a user reports a broken link on the website.
 * Telegram is ONLY for alerting admins; all review, replies, fixes, and dismissal happen in the web admin panel.
 */
export async function notifyAdminOnTelegramNewReport(report: DefectiveLinkReport): Promise<void> {
  const alertKey = `rep:${report.id}`;
  if (sentAdminAlerts.has(alertKey)) {
    return;
  }
  sentAdminAlerts.add(alertKey);
  if (sentAdminAlerts.size > 1000) {
    const first = sentAdminAlerts.values().next().value;
    if (first) sentAdminAlerts.delete(first);
  }

  try {
    const mediaTitle = escapeHtml(report.mediaTitle || 'Unknown Title');
    const issueLabel = escapeHtml(report.issueLabel || report.issueType);
    const reportedUrl = escapeHtml(report.reportedUrl);
    const user = escapeHtml(report.userEmail || report.userName || 'Signed-in User');
    const notes = report.additionalNotes ? escapeHtml(report.additionalNotes) : '';
    const adminUrl = `${getSiteUrl()}/admin?tab=reports&id=${encodeURIComponent(report.id)}`;

    const text =
`🚨 <b>NEW DEFECTIVE LINK REPORT</b>
─────────────────────────────
🎬 <b>Title:</b> <b>${mediaTitle}</b>
⚠️ <b>Issue:</b> <code>${issueLabel}</code>
🔗 <b>Reported URL:</b> <code>${reportedUrl}</code>
👤 <b>Reporter:</b> ${user}
🆔 <code>${report.id}</code>
${notes ? `📝 <b>Notes:</b> <i>${notes}</i>\n` : ''}
⚡ <i>Open in Website Admin Panel to test, reply, or replace link:</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔗 Open in Admin Panel', url: adminUrl },
        ],
      ],
    };

    for (const adminId of ADMIN_TELEGRAM_IDS) {
      await sendTelegramMessage(adminId, text, replyMarkup).catch((err) => {
        console.warn(`Admin telegram alert delivery note for report ${report.id}:`, err?.message);
      });
    }
  } catch (err: any) {
    console.warn('Failed to notify admin on Telegram for report:', err.message);
  }
}

/**
 * Dispatches a Telegram message to a user when an admin replies to their submission
 */
export async function dispatchTelegramAdminReply(
  item: UserRequest | DefectiveLinkReport,
  type: 'request' | 'report',
  replyText: string,
  dbName?: string
): Promise<boolean> {
  const uid = (item.userId || '').trim();
  if (!uid || uid === 'guest-user-default') return false;

  try {
    const tgLink = await getTelegramLinkForUser(uid, dbName);
    if (!tgLink || tgLink.status !== 'active') return false;

    if (type === 'request' && tgLink.requestNotifications === false) return false;
    if (type === 'report' && tgLink.reportNotifications === false) return false;

    const siteUrl = getSiteUrl();
    const mediaTitle = escapeHtml(type === 'request' ? (item as UserRequest).title : (item as DefectiveLinkReport).mediaTitle);
    const msg = escapeHtml(replyText);

    const messageHtml =
`💬 <b>Admin Reply from CineFuel</b>
─────────────────────────────
Regarding your ${type === 'request' ? 'request' : 'report'} for:
<b>${mediaTitle}</b>

<i>"${msg}"</i>

🌐 <i>Check your profile notifications on CineFuel for details.</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🌐 View on CineFuel',
            url: `${siteUrl}/profile`,
          },
        ],
      ],
    };

    const res = await sendTelegramMessage(tgLink.telegramChatId, messageHtml, replyMarkup);
    return res.ok;
  } catch (err: any) {
    console.warn('Failed to dispatch telegram admin reply:', err.message);
    return false;
  }
}
