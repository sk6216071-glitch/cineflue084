/**
 * Security utilities: URL validation, sanitization, and constant-time string comparison.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const MAX_URL_LENGTH = 2048;

/**
 * Validates that a string is a safe, valid HTTP or HTTPS URL.
 * Strictly rejects:
 * - javascript:
 * - data:
 * - vbscript:
 * - blob:
 * - file:
 * - overly long URLs (> 2048 chars)
 * - malformed URLs
 */
export function isValidHttpUrl(urlString: unknown): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return false;

  // Quick check for dangerous pseudo-protocols before parsing
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL for safe rendering in HTML href attributes.
 * If the URL is invalid or uses a dangerous scheme, returns the safe fallback (default '#').
 */
export function sanitizeSafeUrl(urlString: unknown, fallback: string = '#'): string {
  if (!urlString || typeof urlString !== 'string') return fallback;
  const trimmed = urlString.trim();

  // Allow safe relative paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  if (isValidHttpUrl(trimmed)) {
    return trimmed;
  }

  return fallback;
}

/**
 * Constant-time string comparison to mitigate timing attacks against secrets and tokens.
 */
export function timingSafeEqualStrings(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aLen = a.length;
  const bLen = b.length;
  let mismatch = aLen ^ bLen;
  for (let i = 0; i < Math.min(aLen, bLen); i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Sanitizes an arbitrary string by stripping control characters and trimming.
 */
export function sanitizeInputString(val: unknown, maxLength: number = 500): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return str.slice(0, maxLength);
}
