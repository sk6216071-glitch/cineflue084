import { NextRequest, NextResponse } from 'next/server';
import { getAllRequests, saveNewRequest, updateRequestStatus, deleteRequest } from '@/lib/requestsDb';
import { saveLinkToDatabase } from '@/lib/redisDb';
import { UserRequest, CustomLink } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/requests
 * Fetch requests with optional filtering by status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';

    const result = await getAllRequests(status);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/requests GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/requests
 * User submits a new link or quality request
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      mediaType = 'movie',
      tmdbId,
      posterPath,
      releaseYear,
      seasonNumber,
      episodeNumber,
      quality = '1080p Full HD',
      audioLanguage = 'Hindi + English Dual Audio',
      notes = '',
      userContact = '',
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const newRequest: UserRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      title: title.trim(),
      mediaType: mediaType === 'tv' ? 'tv' : 'movie',
      tmdbId: tmdbId ? Number(tmdbId) : undefined,
      posterPath: posterPath || null,
      releaseYear: releaseYear ? String(releaseYear) : undefined,
      seasonNumber: seasonNumber ? Number(seasonNumber) : undefined,
      episodeNumber: episodeNumber ? Number(episodeNumber) : undefined,
      quality: quality.trim(),
      audioLanguage: audioLanguage.trim(),
      notes: notes.trim(),
      userContact: userContact.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await saveNewRequest(newRequest);

    return NextResponse.json({
      success: true,
      message: 'Request submitted successfully! Our team will add this link soon.',
      request: newRequest,
    });
  } catch (error: any) {
    console.error('API /api/requests POST error:', error);
    return NextResponse.json(
      { error: 'Failed to submit request', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/requests
 * Admin fulfills, rejects, or updates a request
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      fulfilledLinkId,
      fulfilledLinkUrl,
      adminNote,
      // Optional fulfillment link creation
      createLink,
      titleId,
      linkPayload,
    } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Request ID and status are required' }, { status: 400 });
    }

    let createdCustomLinkId = fulfilledLinkId;

    // If admin is publishing the link directly from the fulfill modal
    if (createLink && titleId && linkPayload) {
      const generatedId = `link-${Date.now()}`;
      const newCustomLink: CustomLink = {
        id: generatedId,
        title: linkPayload.title || 'Custom Download Link',
        url: linkPayload.url,
        category: linkPayload.category || 'Download',
        createdAt: new Date().toISOString(),
        quality: linkPayload.quality || '1080p',
        audioLanguage: linkPayload.audioLanguage || 'Dual Audio',
        size: linkPayload.size || '',
        linkType: linkPayload.linkType || 'general',
        seasonNumber: linkPayload.seasonNumber,
        episodeNumber: linkPayload.episodeNumber,
      };

      await saveLinkToDatabase(titleId, newCustomLink);
      createdCustomLinkId = generatedId;
    }

    await updateRequestStatus(id, status, {
      fulfilledLinkId: createdCustomLinkId,
      fulfilledLinkUrl: fulfilledLinkUrl || linkPayload?.url,
      adminNote,
    });

    return NextResponse.json({
      success: true,
      message: `Request status updated to ${status}`,
    });
  } catch (error: any) {
    console.error('API /api/requests PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update request', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/requests
 * Admin removes a request
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    await deleteRequest(id);

    return NextResponse.json({
      success: true,
      message: 'Request deleted successfully',
    });
  } catch (error: any) {
    console.error('API /api/requests DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete request', details: error.message },
      { status: 500 }
    );
  }
}
