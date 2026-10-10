import { NextRequest, NextResponse } from 'next/server';
import { getPaginatedUploadedTitles } from '@/lib/redisDb';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Optional Rust / Axum high-performance acceleration layer
    const rustApiUrl = getEnv('RUST_API_URL');
    if (rustApiUrl) {
      try {
        const rustRes = await fetch(`${rustApiUrl}/api/catalog?${searchParams.toString()}`, {
          signal: AbortSignal.timeout(2000),
        });
        if (rustRes.ok) {
          const rustData = await rustRes.json();
          const response = NextResponse.json(rustData);
          response.headers.set('X-Backend-Engine', 'rust-axum');
          return response;
        }
      } catch {
        // Fallback transparently to direct MongoDB Atlas engine
      }
    }

    const type = (searchParams.get('type') as any) || 'all';
    const quality = searchParams.get('quality') || undefined;
    const category = searchParams.get('category') || undefined;
    const audio = searchParams.get('audio') || undefined;
    const ott = searchParams.get('ott') || undefined;
    const query = searchParams.get('q') || searchParams.get('query') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = Number(searchParams.get('limit')) || 24;
    const page = Number(searchParams.get('page')) || 1;

    const result = await getPaginatedUploadedTitles({
      cursor,
      type,
      quality,
      category,
      audio,
      ott,
      query,
      limit,
      page,
    });

    const isCacheHit = (result as any).source === 'cache';
    const response = NextResponse.json({
      success: true,
      ...result,
    });
    response.headers.set('X-Cache', isCacheHit ? 'HIT' : 'MISS');
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=86400');
    return response;
  } catch (err: any) {
    console.error('Error in /api/catalog:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
