import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, saveUserToDatabase, hashPassword, verifyPassword } from '@/lib/usersDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/auth?email=...
 * Fetch user profile data by email
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email query parameter is required' }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { passwordHash, passwordSalt, ...safeProfile } = user;
    return NextResponse.json({ success: true, user: safeProfile });
  } catch (error: any) {
    console.error('API /api/users/auth GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/users/auth
 * Handles login, registration, fast-login, and google-sync
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password, displayName, photoURL, provider } = body;

    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    // 1. REGISTER
    if (action === 'register') {
      if (!password || password.length < 4) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 4 characters long.' },
          { status: 400 }
        );
      }

      const existingUser = await getUserByEmail(cleanEmail);
      if (existingUser && existingUser.passwordHash) {
        return NextResponse.json(
          {
            success: false,
            alreadyExists: true,
            error: 'An account with this email already exists. Please Sign In with your password.',
          },
          { status: 409 }
        );
      }

      const { hash, salt } = hashPassword(password);
      const name = (displayName || '').trim() || existingUser?.displayName || cleanEmail.split('@')[0] || 'Cinephile';

      const savedUser = await saveUserToDatabase({
        uid: existingUser?.uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        displayName: name,
        photoURL: photoURL || null,
        provider: provider || 'email_password',
        passwordHash: hash,
        passwordSalt: salt,
      });

      return NextResponse.json({
        success: true,
        message: 'Account created successfully!',
        user: {
          uid: savedUser.uid,
          email: savedUser.email,
          displayName: savedUser.displayName,
          photoURL: savedUser.photoURL,
          bio: savedUser.bio,
          favoriteGenres: savedUser.favoriteGenres,
          createdAt: savedUser.createdAt,
          isGuest: false,
        },
      });
    }

    // 2. LOGIN
    if (action === 'login') {
      if (!password) {
        return NextResponse.json(
          { success: false, error: 'Please enter your password.' },
          { status: 400 }
        );
      }

      const user = await getUserByEmail(cleanEmail);
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            notFound: true,
            error: 'No account found with this email. Click "Create one" below to register.',
          },
          { status: 404 }
        );
      }

      // If user has a password set, verify it
      if (user.passwordHash && user.passwordSalt) {
        const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
        if (!isValid) {
          return NextResponse.json(
            { success: false, error: 'Incorrect password. Please verify and try again.' },
            { status: 401 }
          );
        }
      } else {
        // User exists (e.g. from previous request or legacy migration) without a password hash
        const { hash, salt } = hashPassword(password);
        await saveUserToDatabase({
          uid: user.uid,
          email: cleanEmail,
          displayName: user.displayName,
          passwordHash: hash,
          passwordSalt: salt,
          provider: 'email_password',
        });
      }

      // Update lastLoginAt
      const updatedUser = await saveUserToDatabase({
        uid: user.uid,
        email: cleanEmail,
        displayName: user.displayName,
      });

      return NextResponse.json({
        success: true,
        message: 'Signed in successfully!',
        user: {
          uid: updatedUser.uid,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          photoURL: updatedUser.photoURL,
          bio: updatedUser.bio,
          favoriteGenres: updatedUser.favoriteGenres,
          createdAt: updatedUser.createdAt,
          isGuest: false,
        },
      });
    }

    // 3. FAST LOGIN OR GOOGLE SYNC
    if (action === 'fast_login' || action === 'google_sync') {
      const name = (displayName || '').trim() || cleanEmail.split('@')[0] || 'Cinephile';
      const existingUser = await getUserByEmail(cleanEmail);

      const savedUser = await saveUserToDatabase({
        uid: body.uid || existingUser?.uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        displayName: existingUser?.displayName || name,
        photoURL: photoURL || existingUser?.photoURL || null,
        provider: provider || (action === 'google_sync' ? 'google' : 'fast_login'),
      });

      return NextResponse.json({
        success: true,
        message: 'Signed in successfully!',
        user: {
          uid: savedUser.uid,
          email: savedUser.email,
          displayName: savedUser.displayName,
          photoURL: savedUser.photoURL,
          bio: savedUser.bio,
          favoriteGenres: savedUser.favoriteGenres,
          createdAt: savedUser.createdAt,
          isGuest: false,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid authentication action.' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/users/auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication service temporarily unavailable', details: error.message },
      { status: 500 }
    );
  }
}
