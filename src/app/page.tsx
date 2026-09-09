import React from 'react';
import Link from 'next/link';
import { Calendar, Compass, ArrowRight, Clock } from 'lucide-react';
import { getUpcoming } from '@/lib/tmdb';
import { getRecentlyAddedTitles } from '@/lib/redisDb';
import { POPULAR_GENRES } from '@/lib/mockData';
import SectionCarousel from '@/components/SectionCarousel';

export const revalidate = 60; // ISR cache 60s for immediate link updates

export default async function HomePage() {
  const [recentlyAdded, upcoming] = await Promise.all([
    getRecentlyAddedTitles(18),
    getUpcoming(1),
  ]);

  return (
    <div className="min-h-screen pb-12 space-y-4">
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

      {/* 0. Recent Carousel (Populated automatically whenever links are published) */}
      {recentlyAdded && recentlyAdded.length > 0 && (
        <SectionCarousel
          title="Recent"
          items={recentlyAdded}
          icon={
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-800/90 border border-zinc-700/80 flex items-center justify-center shadow-sm">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" strokeWidth={2.4} />
            </div>
          }
        />
      )}

      {/* 1. Upcoming Releases */}
      <SectionCarousel
        title="Upcoming & Anticipated"
        subtitle="Coming soon to OTT and theaters"
        items={upcoming}
        viewAllLink="/search?sort=upcoming"
        icon={<Calendar className="w-5 h-5 text-emerald-400" />}
      />
    </div>
  );
}
