import React from 'react';
import { Film, Star, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { getPopularMovies, getTopRated, getUpcoming } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';
import { POPULAR_GENRES } from '@/lib/mockData';
import Link from 'next/link';

export const revalidate = 3600;

export default async function MoviesPage() {
  const [popular, topRated, upcoming] = await Promise.all([
    getPopularMovies(1),
    getTopRated('movie', 1),
    getUpcoming(1),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Page Header */}
      <div className="space-y-2 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Film className="w-4 h-4" /> Feature Films Catalog
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Explore Movies</h1>
        <p className="text-sm text-zinc-400 max-w-2xl">
          Discover box office hits, critically acclaimed masterpieces, and upcoming theatrical & OTT releases.
        </p>

        {/* Quick Genre Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3">
          {POPULAR_GENRES.map((genre) => (
            <Link
              key={genre.id}
              href={`/search?type=movie&genre=${genre.id}&name=${encodeURIComponent(genre.name)}`}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-400 text-xs text-zinc-300 transition-colors whitespace-nowrap"
            >
              {genre.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Movies Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Popular Movies</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {popular.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Top Rated Grid */}
      <section className="space-y-4 pt-6 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <h2 className="text-xl font-bold text-white">Top Rated Movies</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {topRated.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Upcoming Grid */}
      <section className="space-y-4 pt-6 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Upcoming Releases</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {upcoming.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
