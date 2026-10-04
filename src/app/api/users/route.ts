import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, saveFirebaseUserToDatabase, deleteUserFromDatabase } from '@/lib/usersDb';
import { validateAdminAuth } from '@/lib/adminAuth';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebaseTokenVerifier';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * Restricted strictly to administrators.
 * Returns 401 unauthenticated, 403 forbidden for normal non-admin users.
 * NEVER exposes passwordHash or passwordSalt.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Check admin authorization
    if (validateAdminAuth(req)) {
      const { searchParams } = new URL(req.url);
      const page = searchParams.get('page') ? Math.max(1, parseInt(searchParams.get('page')!, 10)) : undefined;
      const limit = searchParams.get('limit') ? Math.max(1, Math.min(100, parseInt(searchParams.get('limit')!, 10))) : undefined;
      const result = await getAllUsers({ page, limit });
      return NextResponse.json({
        ...result,
      });
    }

    // 2. If not admin, check if caller supplied a user Bearer token
    const userToken = extractBearerToken(req);
    if (userToken) {
      try {
        await verifyFirebaseIdToken(userToken);
        // Valid user token, but lacking admin privileges
        return NextResponse.json(
          { error: 'Forbidden: Admin authorization required to view registered users directory' },
          { status: 403 }
        );
      } catch {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid authentication credentials' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Unauthorized: Admin authentication required' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('API /api/users GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Synchronizes user profile to persistent database using verified Firebase ID token.
 * Rejects unverified client-supplied name/email.
 */
export async function POST(req: NextRequest) {
  try {
    let token = extractBearerToken(req);
    let body: any = null;
    try {
      body = await req.json();
      if (!token && body && typeof body.idToken === 'string') {
        token = body.idToken;
      }
    } catch {
      // Body may be empty if token passed in Authorization header
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Firebase ID token is required to synchronize user profile' },
        { status: 401 }
      );
    }

    // Server-side cryptographic token verification
    let verifiedClaims;
    try {
      verifiedClaims = await verifyFirebaseIdToken(token);
    } catch (tokenErr: any) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid Firebase ID token', details: tokenErr.message },
        { status: 401 }
      );
    }

    // Save strictly using verified token claims
    try {
      const savedUser = await saveFirebaseUserToDatabase({
        firebaseUid: verifiedClaims.firebaseUid,
        name: verifiedClaims.name,
        email: verifiedClaims.email,
        photoURL: verifiedClaims.photoURL,
        provider: verifiedClaims.provider,
        createdAt: verifiedClaims.createdAt,
        lastLoginAt: verifiedClaims.lastLoginAt,
        status: verifiedClaims.status,
      });

      return NextResponse.json({
        success: true,
        message: 'User profile synchronized in database successfully',
        user: savedUser,
      });
    } catch (saveErr: any) {
      console.error('Failed to save user to storage:', saveErr);
      return NextResponse.json(
        { error: 'Database persistence unavailable: could not save user', details: saveErr.message },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('API /api/users POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save user', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users?uid=...
 * Admin deletes a user account (Protected: admin secret required)
 */
export async function DELETE(req: NextRequest) {
  if (!validateAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized: admin access required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'User UID is required' }, { status: 400 });
    }

    await deleteUserFromDatabase(uid);
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('API /api/users DELETE error:', error);
    const isPersistenceErr = error.message && error.message.includes('persistence unavailable');
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: isPersistenceErr ? 503 : 500 }
    );
  }
}
