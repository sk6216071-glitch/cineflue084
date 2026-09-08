import React from 'react';
import { Tv, Star, TrendingUp, Sparkles, Download } from 'lucide-react';
import { getPopularTV, getTopRated } from '@/lib/tmdb';
import { getFilteredUploadedTitles } from '@/lib/redisDb';
import MovieCard from '@/components/MovieCard';
import { POPULAR_GENRES } from '@/lib/mockData';
import Link from 'next/link';

export const revalidate = 60; // Fresh 60s updates

export default async function TVShowsPage() {
  const [uploadedSeries, popular, topRated] = await Promise.all([
    getFilteredUploadedTitles({ type: 'tv', limit: 20 }),
    getPopularTV(1),
    getTopRated('tv', 1),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Page Header */}
      <div className="space-y-2 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
          <Tv className="w-4 h-4" /> Television Series Hub
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Explore Web Series</h1>
        <p className="text-sm text-zinc-400 max-w-2xl">
          Browse uploaded television seasons, complete zip packs, single episodes, and high-speed streaming links.
        </p>

        {/* Quick Quality & Genre Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3">
          <Link
            href="/search?type=tv&category=zippack"
            className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs font-bold text-emerald-300 transition-colors whitespace-nowrap"
          >
            📦 Complete Season Packs (Zip)
          </Link>
          <Link
            href="/search?type=tv&quality=1080p"
            className="px-3 py-1 rounded-lg bg-sky-500/15 border border-sky-400/40 text-xs font-bold text-sky-300 transition-colors whitespace-nowrap"
          >
            1080p & 4K Series
          </Link>
          <Link
            href="/search?type=tv&audio=hindi"
            className="px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-xs font-bold text-amber-300 transition-colors whitespace-nowrap"
          >
            Hindi Dubbed Series
          </Link>
          {POPULAR_GENRES.map((genre) => (
            <Link
              key={genre.id}
              href={`/search?type=tv&genre=${genre.id}&name=${encodeURIComponent(genre.name)}`}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-sky-400 text-xs text-zinc-300 transition-colors whitespace-nowrap"
            >
              {genre.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Uploaded Web Series Section */}
      {uploadedSeries.items && uploadedSeries.items.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-sky-400" />
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Available Web Series Downloads
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-400 border border-sky-400/20 font-bold">
                  {uploadedSeries.items.length} Ready
                </span>
              </h2>
            </div>
            <Link
              href="/search?type=tv"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              View All Series ({uploadedSeries.total}) →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {uploadedSeries.items.map((item) => (
              <MovieCard key={`uploaded-tv-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Popular TV Shows */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <h2 className="text-xl font-bold text-white">Trending TV Shows</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {popular.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Top Rated TV Shows */}
      <section className="space-y-4 pt-6 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <h2 className="text-xl font-bold text-white">All-Time Top Rated Series</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {topRated.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
