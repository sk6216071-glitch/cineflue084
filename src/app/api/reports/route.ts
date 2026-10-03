import { NextRequest, NextResponse } from 'next/server';
import { getAllReports, saveNewReport, updateReportStatus, deleteReport } from '@/lib/reportsDb';
import { saveUserToDatabase } from '@/lib/usersDb';
import { saveLinkToDatabase, deleteLinkFromDatabase } from '@/lib/redisDb';
import { DefectiveLinkReport, CustomLink } from '@/types';
import { validateAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports
 * Fetch defective link reports with optional filtering by status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';

    const result = await getAllReports(status);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/reports GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch defective link reports', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports
 * User or visitor reports a defective/broken link
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      linkId,
      movieId,
      mediaTitle,
      mediaType = 'movie',
      posterPath,
      linkTitle,
      reportedUrl,
      issueType = 'dead_link',
      issueLabel = 'Dead Link / 404',
      quality = '',
      server = '',
      additionalNotes = '',
      userEmail = '',
      userId,
      userName,
    } = body;

    // Authentication Guard: Ensure user is authenticated (not guest)
    if (!userId || userId === 'guest-user-default' || !userEmail) {
      return NextResponse.json(
        { error: 'Sign in required. You must be signed in with an active account to report defective or broken links.' },
        { status: 401 }
      );
    }

    if (!reportedUrl || !reportedUrl.trim()) {
      return NextResponse.json({ error: 'Reported URL is required' }, { status: 400 });
    }

    const newReport: DefectiveLinkReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      userId: userId.trim(),
      userName: userName ? userName.trim() : undefined,
      linkId: linkId ? String(linkId) : undefined,
      movieId: Number(movieId) || 0,
      mediaTitle: (mediaTitle || 'Untitled Movie / Series').trim(),
      mediaType: mediaType === 'tv' ? 'tv' : 'movie',
      posterPath: posterPath || null,
      linkTitle: (linkTitle || reportedUrl).trim(),
      reportedUrl: reportedUrl.trim(),
      issueType,
      issueLabel: issueLabel || 'Dead Link / 404',
      quality: quality ? quality.trim() : undefined,
      server: server ? server.trim() : undefined,
      additionalNotes: additionalNotes ? additionalNotes.trim() : undefined,
      userEmail: userEmail ? userEmail.trim() : undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      await saveNewReport(newReport);
    } catch (saveErr: any) {
      console.error('Failed to save defective report to persistent storage:', saveErr);
      return NextResponse.json(
        { error: 'Database persistence unavailable: could not save report', details: saveErr.message },
        { status: 503 }
      );
    }

    // Auto-register / update reporter account in Central Users Directory
    try {
      if (userEmail && userEmail.includes('@')) {
        await saveUserToDatabase({
          uid: userId.trim(),
          email: userEmail.trim(),
          displayName: (userName || userEmail.split('@')[0] || 'Cinephile').trim(),
          provider: 'report_submitter',
        });
      }
    } catch (uErr) {
      console.warn('Failed to auto-sync reporter to usersDb:', uErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Report submitted! Our team will verify and resolve this link shortly.',
      report: newReport,
    });
  } catch (error: any) {
    console.error('API /api/reports POST error:', error);
    return NextResponse.json(
      { error: 'Failed to submit defective link report', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reports
 * Admin updates report status (fixed, dismissed, pending), optionally replaces or deletes defective link
 */
export async function PATCH(req: NextRequest) {
  if (!validateAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized: admin access required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      id,
      status,
      replacementUrl,
      adminNote,
      // Optional: replace or delete link directly
      replaceInDatabase,
      deleteInDatabase,
      movieId,
      linkId,
      updatedLinkTitle,
      updatedQuality,
      updatedAudio,
      updatedSize,
      oldMovieId,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    // 0. If link was reassigned to a different movie/TV ID, purge it from the old ID
    if (oldMovieId && linkId && String(oldMovieId) !== String(movieId)) {
      await deleteLinkFromDatabase(oldMovieId, linkId);
    }

    // 1. If admin provided a replacement link, update the live database
    if (replaceInDatabase && movieId && replacementUrl) {
      const fixedLink: CustomLink = {
        id: linkId || `link-${Date.now()}`,
        title: updatedLinkTitle?.trim() || 'Working Verified Link',
        url: replacementUrl.trim(),
        category: 'Download',
        createdAt: new Date().toISOString(),
        quality: updatedQuality?.trim(),
        audioLanguage: updatedAudio?.trim(),
        size: updatedSize?.trim(),
      };
      await saveLinkToDatabase(movieId, fixedLink);
    }

    // 2. If admin opted to permanently remove the dead link from the database
    if (deleteInDatabase && movieId && linkId) {
      await deleteLinkFromDatabase(movieId, linkId);
    }

    // 3. Update report status in storage
    await updateReportStatus(id, status, {
      replacementUrl,
      adminNote,
    });

    return NextResponse.json({
      success: true,
      message: `Report status updated to ${status}.`,
    });
  } catch (error: any) {
    console.error('API /api/reports PATCH error:', error);
    const isPersistenceErr = error.message && error.message.includes('persistence unavailable');
    return NextResponse.json(
      { error: error.message || 'Failed to update report status' },
      { status: isPersistenceErr ? 503 : 500 }
    );
  }
}

/**
 * DELETE /api/reports
 * Admin deletes a report record
 */
export async function DELETE(req: NextRequest) {
  if (!validateAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized: admin access required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    await deleteReport(id);

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully.',
    });
  } catch (error: any) {
    console.error('API /api/reports DELETE error:', error);
    const isPersistenceErr = error.message && error.message.includes('persistence unavailable');
    return NextResponse.json(
      { error: error.message || 'Failed to delete report' },
      { status: isPersistenceErr ? 503 : 500 }
    );
  }
}
