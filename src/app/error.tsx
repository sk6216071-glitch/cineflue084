'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App-level error caught:', error);

    // Auto-recover from chunk load errors caused by new Vercel deployments
    const isChunkLoadError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Load failed');

    if (isChunkLoadError && typeof window !== 'undefined') {
      const key = `chunk_reload_${Date.now()}`;
      const lastReload = Number(sessionStorage.getItem('last_chunk_reload') || '0');
      // Throttle auto-reload to once per 10 seconds to avoid infinite loops
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-3xl bg-[#0e1118] border border-zinc-800 shadow-2xl text-center space-y-5 animate-in fade-in-50 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Something went wrong
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
            A temporary connection issue or new version update was detected. Please reload the page to refresh assets.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
