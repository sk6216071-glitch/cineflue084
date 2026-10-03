import { NextRequest } from 'next/server';

/**
 * Validates whether the incoming request is authorized to perform admin mutations.
 * Reads server-side secret only (ADMIN_SECRET_KEY or ADMIN_PASSWORD).
 *
 * Checks:
 * 1. `x-admin-key` header
 * 2. `Authorization: Bearer <key>` header
 */
export function validateAdminAuth(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD;
  
  if (!adminSecret) {
    // Fail-safe: if no secret is configured on the server, reject all admin mutations
    return false;
  }

  const headerKey = req.headers.get('x-admin-key');
  const authHeader = req.headers.get('authorization');
  let providedKey = headerKey;

  if (!providedKey && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7).trim();
    } else {
      providedKey = authHeader.trim();
    }
  }

  if (!providedKey) {
    return false;
  }

  // Safe string comparison
  return providedKey.trim() === adminSecret.trim();
}
