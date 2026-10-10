import { getEnv } from '@/lib/env';

// Cloudflare R2 Storage Client Helper (Server-side only)
// S3-compatible zero-egress media storage

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  endpoint?: string;
  publicUrl?: string;
}

export function getR2Config(): R2Config {
  return {
    accountId: getEnv('R2_ACCOUNT_ID'),
    accessKeyId: getEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: getEnv('R2_SECRET_ACCESS_KEY'),
    bucket: getEnv('R2_BUCKET') || 'cinephile-media',
    endpoint: getEnv('R2_ENDPOINT'),
    publicUrl: getEnv('R2_PUBLIC_URL'),
  };
}

export function isR2Configured(): boolean {
  const cfg = getR2Config();
  return Boolean((cfg.accountId || cfg.endpoint) && cfg.accessKeyId && cfg.secretAccessKey);
}

export function getR2PublicUrl(key: string): string | null {
  const cfg = getR2Config();
  if (!cfg.publicUrl) return null;
  const cleanKey = key.replace(/^\/+/, '');
  return `${cfg.publicUrl.replace(/\/+$/, '')}/${cleanKey}`;
}
