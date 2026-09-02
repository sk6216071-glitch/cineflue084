import React from 'react';
import { Tv, Star, TrendingUp, Sparkles } from 'lucide-react';
import { getPopularTV, getTopRated } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';
import { POPULAR_GENRES } from '@/lib/mockData';
import Link from 'next/link';

export const revalidate = 3600;

export default async function TVShowsPage() {
  const [popular, topRated] = await Promise.all([
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
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Explore TV Shows</h1>
        <p className="text-sm text-zinc-400 max-w-2xl">
          Track top television shows, multi-season dramas, thrilling miniseries, and streaming sensations.
        </p>

        {/* Quick Genre Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3">
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
