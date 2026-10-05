import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebaseTokenVerifier';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/notificationsDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Returns paginated notifications for the authenticated user only.
 * Client-supplied userId overrides are strictly rejected/ignored.
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: valid authentication token required' },
        { status: 401 }
      );
    }

    let verifiedClaims;
    try {
      verifiedClaims = await verifyFirebaseIdToken(token);
    } catch (authErr: any) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired token', details: authErr.message },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const countOnly = searchParams.get('countOnly') === 'true';

    // If client only needs unread badge count
    if (countOnly) {
      const unreadCount = await getUnreadNotificationCount(verifiedClaims.firebaseUid);
      return NextResponse.json({
        success: true,
        unreadCount,
      });
    }

    const page = searchParams.get('page') ? Math.max(1, parseInt(searchParams.get('page')!, 10)) : 1;
    const limit = searchParams.get('limit') ? Math.max(1, Math.min(50, parseInt(searchParams.get('limit')!, 10))) : 20;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const result = await getUserNotifications(verifiedClaims.firebaseUid, {
      page,
      limit,
      unreadOnly,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('API /api/notifications GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error fetching notifications', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Allows authenticated user to mark their own notification as read or mark all as read.
 */
export async function PATCH(req: NextRequest) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: valid authentication token required' },
        { status: 401 }
      );
    }

    let verifiedClaims;
    try {
      verifiedClaims = await verifyFirebaseIdToken(token);
    } catch (authErr: any) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired token', details: authErr.message },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { id, markAllRead } = body;

    if (markAllRead) {
      const res = await markAllNotificationsAsRead(verifiedClaims.firebaseUid);
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
        modifiedCount: res.count,
      });
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Notification ID or markAllRead: true is required' },
        { status: 400 }
      );
    }

    const res = await markNotificationAsRead(id.trim(), verifiedClaims.firebaseUid);
    if (!res.found) {
      return NextResponse.json(
        { error: 'Notification not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('API /api/notifications PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error updating notification', details: error.message },
      { status: 500 }
    );
  }
}
