import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, saveUserToDatabase, deleteUserFromDatabase } from '@/lib/usersDb';
import { validateAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * Fetch all registered users with request & report activity metrics
 * NEVER exposes passwordHash or passwordSalt
 */
export async function GET() {
  try {
    const result = await getAllUsers();
    // Defense-in-depth sanitization: ensure no password fields ever leak to public API
    const sanitizedUsers = (result.users || []).map((u: any) => {
      const { passwordHash, passwordSalt, ...safeUser } = u;
      return safeUser;
    });

    return NextResponse.json({
      ...result,
      users: sanitizedUsers,
    });
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
 * Register or sync a user profile to persistent database
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, displayName, photoURL, bio, favoriteGenres, provider } = body;

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'User UID and Email are required' },
        { status: 400 }
      );
    }

    if (uid === 'guest-user-default' || email === 'cinephile@cinefuel.app') {
      return NextResponse.json(
        { error: 'Guest session profiles are not stored in registered users directory' },
        { status: 400 }
      );
    }

    try {
      await saveUserToDatabase({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        photoURL,
        bio,
        favoriteGenres,
        provider: provider || 'auth',
      });
    } catch (saveErr: any) {
      console.error('Failed to save user to storage:', saveErr);
      return NextResponse.json(
        { error: 'Database persistence unavailable: could not save user', details: saveErr.message },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User registered in central database successfully',
    });
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
