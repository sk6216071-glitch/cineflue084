import React from 'react';
import Link from 'next/link';
import { Compass, ArrowRight, Film, Tv, Search } from 'lucide-react';
import { POPULAR_GENRES } from '@/lib/mockData';

export const revalidate = 60; // ISR cache 60s for immediate link updates

export default function HomePage() {
  return (
    <div className="min-h-screen pb-12 space-y-6">
      {/* Genre Fast Explorer Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-[#0f121a]/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Browse by Genre
            </span>
            <Link
              href="/search"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              Advanced Search <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {POPULAR_GENRES.map((genre) => (
              <Link
                key={genre.id}
                href={`/search?genre=${genre.id}&name=${encodeURIComponent(genre.name)}`}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-amber-400 hover:text-black border border-zinc-700/60 text-xs font-semibold text-zinc-300 whitespace-nowrap transition-all duration-200 hover:scale-105"
              >
                {genre.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Category Hub Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/movies"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121622] to-[#0c0e17] border border-zinc-800/80 p-6 hover:border-amber-400/60 transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Film className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
              Explore Movies
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Browse feature films, 4K HDR releases, BluRay REMUX, and Hindi dual audio downloads.
            </p>
          </Link>

          <Link
            href="/tv"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121622] to-[#0c0e17] border border-zinc-800/80 p-6 hover:border-sky-400/60 transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <Tv className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
              Explore Web Series
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Discover complete season zip packs, single episodes, and high-speed streaming links.
            </p>
          </Link>

          <Link
            href="/search"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121622] to-[#0c0e17] border border-zinc-800/80 p-6 hover:border-emerald-400/60 transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Search className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
              Advanced Search
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Search by quality (4K, REMUX, 1080p), genres, audio tracks, and custom uploaded tags.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
