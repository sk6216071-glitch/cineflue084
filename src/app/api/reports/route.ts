import { NextRequest, NextResponse } from 'next/server';
import { getAllReports, saveNewReport, updateReportStatus, deleteReport } from '@/lib/reportsDb';
import { saveLinkToDatabase, deleteLinkFromDatabase } from '@/lib/redisDb';
import { DefectiveLinkReport, CustomLink } from '@/types';

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
    } = body;

    if (!reportedUrl || !reportedUrl.trim()) {
      return NextResponse.json({ error: 'Reported URL is required' }, { status: 400 });
    }

    const newReport: DefectiveLinkReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
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

    await saveNewReport(newReport);

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
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
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
    return NextResponse.json(
      { error: 'Failed to update report status', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports
 * Admin deletes a report record
 */
export async function DELETE(req: NextRequest) {
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
    return NextResponse.json(
      { error: 'Failed to delete report', details: error.message },
      { status: 500 }
    );
  }
}
