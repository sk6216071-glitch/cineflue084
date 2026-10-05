import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebaseTokenVerifier';
import {
  generateTelegramLinkingToken,
  getTelegramLinkForUser,
  updateTelegramPreferences,
  disconnectTelegramAccount,
  getBotUsername,
} from '@/lib/telegramNotifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telegram/link-token
 * Returns current Telegram link status and preferences for the authenticated user
 */
export async function GET(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  try {
    const claims = await verifyFirebaseIdToken(token);
    const link = await getTelegramLinkForUser(claims.firebaseUid);

    return NextResponse.json({
      isLinked: !!(link && link.status === 'active'),
      link: link || null,
      botUsername: getBotUsername(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Authentication failed', details: err.message },
      { status: 401 }
    );
  }
}

/**
 * POST /api/telegram/link-token
 * Generates a short-lived, single-use one-time linking token for connecting Telegram
 */
export async function POST(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  try {
    const claims = await verifyFirebaseIdToken(token);
    const result = await generateTelegramLinkingToken(claims.firebaseUid);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to generate linking token', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/telegram/link-token
 * Updates notification preferences for the connected Telegram account
 */
export async function PATCH(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  try {
    const claims = await verifyFirebaseIdToken(token);
    const body = await req.json();
    const { requestNotifications, reportNotifications } = body;

    const result = await updateTelegramPreferences(claims.firebaseUid, {
      requestNotifications,
      reportNotifications,
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Preferences updated' : 'User has no active Telegram link',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to update preferences', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/telegram/link-token
 * Disconnects Telegram from the authenticated CineFuel account
 */
export async function DELETE(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  try {
    const claims = await verifyFirebaseIdToken(token);
    const result = await disconnectTelegramAccount(claims.firebaseUid);

    return NextResponse.json({
      success: result.success,
      message: 'Telegram account disconnected',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to disconnect Telegram account', details: err.message },
      { status: 500 }
    );
  }
}
