import React from 'react';
import Link from 'next/link';
import { Flame, Star, Tv, Film, Calendar, Compass, ArrowRight } from 'lucide-react';
import { getTrending, getPopularMovies, getPopularTV, getTopRated, getUpcoming } from '@/lib/tmdb';
import { POPULAR_GENRES } from '@/lib/mockData';
import SectionCarousel from '@/components/SectionCarousel';

export const revalidate = 3600; // ISR cache 1 hour

export default async function HomePage() {
  const [trending, popularMovies, popularTV, topRated, upcoming] = await Promise.all([
    getTrending('all', 'day'),
    getPopularMovies(1),
    getPopularTV(1),
    getTopRated('movie', 1),
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

      {/* 1. Trending Now Carousel */}
      <SectionCarousel
        title="Trending Today"
        subtitle="The most popular movies and TV shows worldwide right now"
        items={trending}
        viewAllLink="/search?sort=trending"
        icon={<Flame className="w-5 h-5 text-red-500 fill-red-500/20" />}
      />

      {/* 2. Popular Movies */}
      <SectionCarousel
        title="Popular Movies"
        subtitle="Blockbuster releases loved by audiences"
        items={popularMovies}
        viewAllLink="/movies"
        icon={<Film className="w-5 h-5 text-amber-400" />}
      />

      {/* 3. Popular TV Series */}
      <SectionCarousel
        title="Top Trending TV Shows"
        subtitle="Binge-worthy drama, thriller, and sci-fi series"
        items={popularTV}
        viewAllLink="/tv"
        icon={<Tv className="w-5 h-5 text-sky-400" />}
      />

      {/* 4. Top Rated Masterpieces */}
      <SectionCarousel
        title="Top Rated Masterpieces"
        subtitle="Highest scoring cinema classics on TMDB & IMDb"
        items={topRated}
        viewAllLink="/search?sort=top_rated"
        icon={<Star className="w-5 h-5 text-amber-400 fill-amber-400/20" />}
      />

      {/* 5. Upcoming Releases */}
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
