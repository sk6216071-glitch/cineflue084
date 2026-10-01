import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, saveUserToDatabase, deleteUserFromDatabase } from '@/lib/usersDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * Fetch all registered users with request & report activity metrics
 */
export async function GET() {
  try {
    const result = await getAllUsers();
    return NextResponse.json(result);
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

    await saveUserToDatabase({
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      photoURL,
      bio,
      favoriteGenres,
      provider: provider || 'auth',
    });

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
 * Admin deletes a user account
 */
export async function DELETE(req: NextRequest) {
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
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 500 }
    );
  }
}
