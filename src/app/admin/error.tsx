'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Home, ShieldAlert, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('Admin page error caught:', error);

    // Auto-recover from chunk load errors caused by new deployments
    const isChunkLoadError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Load failed');

    if (isChunkLoadError && typeof window !== 'undefined') {
      const lastReload = Number(sessionStorage.getItem('last_admin_chunk_reload') || '0');
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem('last_admin_chunk_reload', String(Date.now()));
        window.location.reload();
      }
    }

    // Auto-recover from QuotaExceededError caused by bloated localStorage
    const isQuotaError =
      error?.name === 'QuotaExceededError' ||
      error?.message?.toLowerCase().includes('quota') ||
      error?.message?.toLowerCase().includes('storage');

    if (isQuotaError && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('cinefuel_custom_links');
        localStorage.removeItem('cinefuel_known_titles_cache');
      } catch {}
      const lastQuotaReload = Number(sessionStorage.getItem('last_admin_quota_reload') || '0');
      if (Date.now() - lastQuotaReload > 6000) {
        sessionStorage.setItem('last_admin_quota_reload', String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  const handleClearCacheAndReload = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('cinefuel_deleted_curated_links');
        localStorage.removeItem('cinefuel_known_titles_cache');
        localStorage.removeItem('cinefuel_custom_links');
        localStorage.removeItem('cinefuel_custom_lists');
      } catch (e) {
        console.error('Failed to clear storage:', e);
      }
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[85vh] w-full flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-3xl bg-[#0f121a] border border-amber-500/30 shadow-2xl text-center space-y-5 animate-in fade-in-50 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Admin Panel Recovery
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
            The administrator dashboard encountered an issue. You can retry rendering or clear your local cache to restore standard operations.
          </p>
        </div>

        {error?.message && (
          <div className="text-left bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Error Cause:</span>
            <p className="text-xs text-rose-300 font-mono break-words">{error.message}</p>
            {error.stack && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{showDetails ? 'Hide Stack' : 'View Stack Trace'}</span>
                </button>
                {showDetails && (
                  <pre className="text-[9px] text-zinc-500 overflow-x-auto max-h-36 pt-1 font-mono">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Rendering</span>
            </button>

            <button
              type="button"
              onClick={handleClearCacheAndReload}
              className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Clears corrupted client storage and reloads clean state"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Clear Cache & Reload</span>
            </button>
          </div>

          <Link
            href="/"
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to CineFuel Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
