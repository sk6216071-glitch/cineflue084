import React from 'react';
import Link from 'next/link';
import { Film, Download, Sparkles, Filter, CheckCircle2 } from 'lucide-react';
import { getPaginatedUploadedTitles } from '@/lib/redisDb';
import MovieCard from '@/components/MovieCard';
import Pagination from '@/components/Pagination';

export const revalidate = 60; // Fresh 60s updates

interface MoviesPageProps {
  searchParams: Promise<{
    page?: string;
    quality?: string;
    audio?: string;
    genre?: string;
    q?: string;
  }>;
}

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
  const resolvedParams = await searchParams;
  const page = typeof resolvedParams?.page === 'string' ? Math.max(1, parseInt(resolvedParams.page, 10)) : 1;
  const quality = resolvedParams?.quality || '';
  const audio = resolvedParams?.audio || '';
  const genre = resolvedParams?.genre || '';
  const q = resolvedParams?.q || '';

  const result = await getPaginatedUploadedTitles({
    type: 'movie',
    page,
    limit: 24,
    quality: quality || undefined,
    audio: audio || undefined,
    genre: genre || undefined,
    query: q || undefined,
  });

  const hasFilter = Boolean(quality || audio || genre || q);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 min-h-screen">
      {/* Page Header */}
      <div className="space-y-3 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <Film className="w-4 h-4" /> Feature Films Catalog
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Explore Movies
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl mt-1">
              Explore movie releases with direct high-speed download links in 4K UHD, 1080p, REMUX, and HDR.
            </p>
          </div>

          {result.total > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 self-start md:self-auto">
              <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-bold">
                {result.total} {result.total === 1 ? 'Movie' : 'Movies'} Available
              </span>
              <span>
                Page {result.page} of {result.totalPages}
              </span>
            </div>
          )}
        </div>

        {/* Quick Quality & Audio Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3">
          <Link
            href="/movies"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
              !hasFilter
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20 scale-105'
                : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            All Movies
          </Link>
          <Link
            href="/movies?quality=4k"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
              quality === '4k'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20 scale-105'
                : 'bg-zinc-900/90 text-amber-300 border-amber-400/30 hover:bg-amber-400/10'
            }`}
          >
            ⚡ 4K Ultra HD
          </Link>
          <Link
            href="/movies?quality=remux"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
              quality === 'remux'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20 scale-105'
                : 'bg-zinc-900/90 text-purple-300 border-purple-400/30 hover:bg-purple-400/10'
            }`}
          >
            💎 BluRay REMUX
          </Link>
          <Link
            href="/movies?quality=1080p"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
              quality === '1080p'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20 scale-105'
                : 'bg-zinc-900/90 text-sky-300 border-sky-400/30 hover:bg-sky-400/10'
            }`}
          >
            1080p Full HD
          </Link>
          <Link
            href="/movies?quality=hdr"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
              quality === 'hdr'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20 scale-105'
                : 'bg-zinc-900/90 text-rose-300 border-rose-400/30 hover:bg-rose-400/10'
            }`}
          >
            HDR / Dolby Vision
          </Link>
          <Link
            href="/movies?audio=hindi"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
              audio === 'hindi'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20 scale-105'
                : 'bg-zinc-900/90 text-emerald-300 border-emerald-400/30 hover:bg-emerald-400/10'
            }`}
          >
            Hindi / Dual Audio
          </Link>
        </div>
      </div>

      {/* Uploaded Movies Grid */}
      {result.items && result.items.length > 0 ? (
        <section className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {result.items.map((item, idx) => (
              <MovieCard
                key={`movie-${item.id}-${idx}`}
                item={item}
                priority={idx < 6}
                aspect="portrait"
              />
            ))}
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={result.page}
            totalPages={result.totalPages}
            basePath="/movies"
            extraParams={{ quality, audio, genre, q }}
          />
        </section>
      ) : (
        <div className="py-20 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-8 space-y-4 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {hasFilter ? 'No Movies Match This Filter' : 'No Uploaded Movies Found Yet'}
          </h2>
          <p className="text-sm text-zinc-400">
            {hasFilter
              ? 'Try resetting the filters or exploring all uploaded releases.'
              : 'Movies with custom download links will appear here as soon as they are added in the Admin panel.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {hasFilter ? (
              <Link
                href="/movies"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all"
              >
                Clear All Filters
              </Link>
            ) : null}
            <Link
              href="/tv"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all border border-zinc-700"
            >
              Explore Web Series →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
