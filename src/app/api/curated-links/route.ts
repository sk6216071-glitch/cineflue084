import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  getLinksFromDatabase,
  saveLinkToDatabase,
  saveMultipleLinksToDatabase,
  deleteLinkFromDatabase,
  deleteMultipleLinksFromDatabase,
  seedLocalLinksToRedis,
  migrateDomainInDatabase,
} from '@/lib/redisDb';
import { validateAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const movieId = searchParams.get('movieId') || searchParams.get('id');
    const action = searchParams.get('action');

    // Admin seed action to sync local links to Upstash cloud
    if (action === 'seed') {
      if (!validateAdminAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized: admin access required' }, { status: 401 });
      }
      const seedResult = await seedLocalLinksToRedis();
      return NextResponse.json(seedResult);
    }

    if (movieId) {
      const result = await getLinksFromDatabase(movieId);
      return NextResponse.json({
        success: true,
        links: result.links || [],
        source: result.source,
      });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)));
    const result = await getLinksFromDatabase(undefined, { page, limit });
    return NextResponse.json({
      success: true,
      allLinks: result.allLinks || {},
      total: result.total,
      page,
      limit,
      source: result.source,
    });
  } catch (err: any) {
    console.error('Error in GET /api/curated-links:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized: admin access required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { movieId, link, links, action, oldDomain, newDomain } = body;

    // Handle domain migration action
    if (action === 'migrate_domain') {
      if (!oldDomain || !newDomain) {
        return NextResponse.json({ error: 'oldDomain and newDomain are required' }, { status: 400 });
      }
      const migrationRes = await migrateDomainInDatabase(oldDomain, newDomain);
      return NextResponse.json(migrationRes);
    }

    if (!movieId) {
      return NextResponse.json({ error: 'movieId is required' }, { status: 400 });
    }

    // Support batch saving multiple links at once
    if (Array.isArray(links) && links.length > 0) {
      const sanitizedLinks = links.map((l, index) => ({
        ...l,
        id: l.id || `bulk-admin-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: l.createdAt || new Date(Date.now() - index * 1000).toISOString(),
      }));
      await saveMultipleLinksToDatabase(movieId, sanitizedLinks);
      try { revalidatePath('/'); } catch {}
      return NextResponse.json({ success: true, count: sanitizedLinks.length, links: sanitizedLinks });
    }

    if (!link || !link.url) {
      return NextResponse.json({ error: 'movieId and link.url are required' }, { status: 400 });
    }

    const linkId = link.id || `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const linkObj = {
      ...link,
      id: linkId,
      createdAt: link.createdAt || new Date().toISOString(),
    };

    await saveLinkToDatabase(movieId, linkObj);
    try { revalidatePath('/'); } catch {}

    return NextResponse.json({ success: true, link: linkObj });
  } catch (err: any) {
    console.error('Error in POST /api/curated-links:', err);
    const isPersistenceErr = err.message && err.message.includes('persistence unavailable');
    return NextResponse.json(
      { error: err.message },
      { status: isPersistenceErr ? 503 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!validateAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized: admin access required' }, { status: 401 });
  }

  try {
    // 1. Check for JSON body batch deletion
    let body: any = null;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch {}
    }

    if (body && Array.isArray(body.items) && body.items.length > 0) {
      await deleteMultipleLinksFromDatabase(body.items);
      try { revalidatePath('/'); } catch {}
      return NextResponse.json({ success: true, count: body.items.length });
    }

    // 2. Query param deletion
    const { searchParams } = new URL(request.url);
    const movieId = searchParams.get('movieId') || searchParams.get('id');
    const linkId = searchParams.get('linkId');
    const linkIds = searchParams.get('linkIds');

    if (movieId && linkIds) {
      const ids = linkIds.split(',').map((s) => s.trim()).filter(Boolean);
      await deleteMultipleLinksFromDatabase(ids.map((id) => ({ movieId, linkId: id })));
      try { revalidatePath('/'); } catch {}
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (movieId && linkId) {
      await deleteLinkFromDatabase(movieId, linkId);
      try { revalidatePath('/'); } catch {}
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'movieId and linkId required' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in DELETE /api/curated-links:', err);
    const isPersistenceErr = err.message && err.message.includes('persistence unavailable');
    return NextResponse.json(
      { error: err.message },
      { status: isPersistenceErr ? 503 : 500 }
    );
  }
}
