import { NextRequest, NextResponse } from 'next/server';
import {
  getLinksFromDatabase,
  saveLinkToDatabase,
  deleteLinkFromDatabase,
  seedLocalLinksToRedis,
} from '@/lib/redisDb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const movieId = searchParams.get('movieId') || searchParams.get('id');
    const action = searchParams.get('action');

    // Admin seed action to sync local links to Upstash cloud
    if (action === 'seed') {
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

    const result = await getLinksFromDatabase();
    return NextResponse.json({
      success: true,
      allLinks: result.allLinks || {},
      source: result.source,
    });
  } catch (err: any) {
    console.error('Error in GET /api/curated-links:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { movieId, link } = body;

    if (!movieId || !link || !link.url) {
      return NextResponse.json({ error: 'movieId and link.url are required' }, { status: 400 });
    }

    const linkId = link.id || `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const linkObj = {
      ...link,
      id: linkId,
      createdAt: link.createdAt || new Date().toISOString(),
    };

    await saveLinkToDatabase(movieId, linkObj);

    return NextResponse.json({ success: true, link: linkObj });
  } catch (err: any) {
    console.error('Error in POST /api/curated-links:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const movieId = searchParams.get('movieId') || searchParams.get('id');
    const linkId = searchParams.get('linkId');

    if (!movieId || !linkId) {
      return NextResponse.json({ error: 'movieId and linkId required' }, { status: 400 });
    }

    await deleteLinkFromDatabase(movieId, linkId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in DELETE /api/curated-links:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
