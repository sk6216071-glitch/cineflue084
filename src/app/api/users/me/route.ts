import { NextRequest, NextResponse } from 'next/server';
import { getUserByFirebaseUid, saveFirebaseUserToDatabase } from '@/lib/usersDb';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebaseTokenVerifier';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/me
 * Authenticated user profile retrieval.
 * Returns only the requesting user's own profile based on verified Firebase token claims.
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication token is required' },
        { status: 401 }
      );
    }

    let verifiedClaims;
    try {
      verifiedClaims = await verifyFirebaseIdToken(token);
    } catch (err: any) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token', details: err.message },
        { status: 401 }
      );
    }

    // Lookup existing profile or auto-sync with verified claims
    let user = await getUserByFirebaseUid(verifiedClaims.firebaseUid);
    if (!user) {
      user = await saveFirebaseUserToDatabase({
        firebaseUid: verifiedClaims.firebaseUid,
        name: verifiedClaims.name,
        email: verifiedClaims.email,
        photoURL: verifiedClaims.photoURL,
        provider: verifiedClaims.provider,
        createdAt: verifiedClaims.createdAt,
        lastLoginAt: verifiedClaims.lastLoginAt,
        status: verifiedClaims.status,
      });
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('API /api/users/me GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve profile', details: error.message },
      { status: 500 }
    );
  }
}
