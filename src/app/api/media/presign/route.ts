import { NextRequest, NextResponse } from 'next/server';
import { getR2Config, isR2Configured, getR2PublicUrl } from '@/lib/r2';
import { validateAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const action = typeof body.action === 'string' ? body.action.toLowerCase() : 'get';

    if (!key) {
      return NextResponse.json({ success: false, error: 'Asset key is required' }, { status: 400 });
    }

    // Mutating actions require admin authorization
    if (action === 'put' || action === 'delete') {
      const auth = await validateAdminAuth(request);
      if (!auth) {
        return NextResponse.json({ success: false, error: 'Admin authorization required' }, { status: 401 });
      }
    }

    if (!isR2Configured()) {
      return NextResponse.json({
        success: false,
        error: 'Cloudflare R2 is not configured in environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)',
      }, { status: 503 });
    }

    const cfg = getR2Config();
    const publicUrl = getR2PublicUrl(key);

    return NextResponse.json({
      success: true,
      key,
      action,
      bucket: cfg.bucket,
      url: publicUrl || `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key.replace(/^\/+/, '')}`,
      isPublicCdn: Boolean(publicUrl),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
