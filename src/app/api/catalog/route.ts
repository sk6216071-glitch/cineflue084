import { NextRequest, NextResponse } from 'next/server';
import { getFilteredUploadedTitles } from '@/lib/redisDb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') as any) || 'all';
    const quality = searchParams.get('quality') || undefined;
    const category = searchParams.get('category') || undefined;
    const audio = searchParams.get('audio') || undefined;
    const ott = searchParams.get('ott') || undefined;
    const query = searchParams.get('q') || searchParams.get('query') || undefined;
    const limit = Number(searchParams.get('limit')) || 60;

    const result = await getFilteredUploadedTitles({
      type,
      quality,
      category,
      audio,
      ott,
      query,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Error in /api/catalog:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
