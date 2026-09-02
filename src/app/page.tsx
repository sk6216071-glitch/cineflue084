import React from 'react';
import Link from 'next/link';
import { Flame, Star, Tv, Film, Calendar, Compass, Sparkles, ArrowRight } from 'lucide-react';
import { getTrending, getPopularMovies, getPopularTV, getTopRated, getUpcoming } from '@/lib/tmdb';
import { POPULAR_GENRES } from '@/lib/mockData';
import HeroBanner from '@/components/HeroBanner';
import SectionCarousel from '@/components/SectionCarousel';
import PersonalizedRecommendations from '@/components/PersonalizedRecommendations';
import RecentlyAddedLinksCatalog from '@/components/RecentlyAddedLinksCatalog';

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
      {/* Hero Banner Section */}
      <HeroBanner items={trending.slice(0, 6)} />

      {/* Personalized AI Recommendations Feed */}
      <PersonalizedRecommendations />

      {/* Recently Added Custom Links Showcase Catalog */}
      <RecentlyAddedLinksCatalog />

      {/* Genre Fast Explorer Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2">
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

      {/* Discovery Feature Highlight Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/20 p-8 sm:p-10 shadow-2xl">
          <div className="max-w-xl space-y-4">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> India Streaming Availability
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Know where to watch before you click.
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              CineFuel directly tracks regional streaming platforms across Disney+ Hotstar, JioCinema, Netflix, Amazon Prime Video, Zee5, SonyLIV, and Apple TV+ for Indian viewers.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href="/watchlist"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
              >
                Go to My Watchlist
              </Link>
              <Link
                href="/simkl"
                className="px-5 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold text-xs transition-colors"
              >
                Connect SIMKL Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
