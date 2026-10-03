import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Safely resolves an environment variable or secret.
 * In Cloudflare Workers (via OpenNext), secrets bound via Wrangler live on getCloudflareContext().env.
 * In Node.js / Vercel / local, they live on process.env.
 */
export function getEnv(key: string, defaultValue: string = ''): string {
  try {
    const cf = getCloudflareContext();
    if (cf && cf.env && (cf.env as any)[key] !== undefined && (cf.env as any)[key] !== '') {
      return String((cf.env as any)[key]).trim();
    }
  } catch {
    // Expected outside Cloudflare request context
  }
  const val = process.env[key];
  return val !== undefined && val !== null ? String(val).trim() : defaultValue;
}
