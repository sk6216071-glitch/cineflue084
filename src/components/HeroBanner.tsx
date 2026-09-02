'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Plus, Check, Star, Info, ChevronLeft, ChevronRight, Tv, Film, Sparkles } from 'lucide-react';
import { TitleDetails } from '@/types';
import { getBackdropURL } from '@/lib/tmdb';
import { useWatchlist } from '@/context/WatchlistContext';
import TrailerModal from './TrailerModal';

interface HeroBannerProps {
  items: TitleDetails[];
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ items }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();

  const currentItem = items[currentIndex] || items[0];

  useEffect(() => {
    if (!items || items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [items]);

  if (!currentItem) return null;

  const mediaType = currentItem.media_type || (currentItem.name ? 'tv' : 'movie');
  const title = currentItem.title || currentItem.name || 'Untitled';
  const releaseYear = (currentItem.release_date || currentItem.first_air_date || '').split('-')[0];
  const backdropUrl = getBackdropURL(currentItem.backdrop_path, 'original');

  const existing = watchlist.find((w) => w.id === currentItem.id);
  const isInWatchlist = !!existing;

  const trailer = currentItem.videos?.results?.find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );

  const handleWatchlistClick = () => {
    if (isInWatchlist) {
      removeFromWatchlist(currentItem.id);
    } else {
      addToWatchlist(currentItem, 'watchlist');
    }
  };

  return (
    <div className="relative w-full h-[75vh] min-h-[580px] max-h-[820px] overflow-hidden bg-black select-none">
      {/* Backdrop Image */}
      <div className="absolute inset-0">
        <Image
          src={backdropUrl}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center transition-opacity duration-1000 opacity-70 scale-105 animate-subtleZoom"
        />
        {/* Cinema Vignette Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090c] via-[#08090c]/40 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08090c] via-[#08090c]/70 to-transparent" />
      </div>

      {/* Content Container */}
      <div className="relative max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16 sm:pb-20">
        <div className="max-w-2xl space-y-4">
          {/* Badges / Meta Info */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-md bg-amber-500 text-black font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Featured Spotlight
            </span>

            <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10 uppercase">
              {mediaType === 'tv' ? 'TV Series' : 'Feature Film'}
            </span>

            {releaseYear && (
              <span className="text-zinc-300 font-medium">
                {releaseYear}
              </span>
            )}

            {currentItem.vote_average > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{currentItem.vote_average.toFixed(1)}</span>
                <span className="text-zinc-400 font-normal">/10</span>
              </div>
            )}

            {currentItem.runtime && (
              <span className="text-zinc-400">
                {Math.floor(currentItem.runtime / 60)}h {currentItem.runtime % 60}m
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
            {title}
          </h1>

          {/* Tagline */}
          {currentItem.tagline && (
            <p className="text-sm sm:text-base italic text-amber-300/90 font-medium">
              &quot;{currentItem.tagline}&quot;
            </p>
          )}

          {/* Overview */}
          <p className="text-sm sm:text-base text-zinc-300 line-clamp-3 leading-relaxed drop-shadow-md">
            {currentItem.overview}
          </p>

          {/* Genres */}
          {currentItem.genres && currentItem.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentItem.genres.map((g) => (
                <span key={g.id} className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            {trailer && (
              <button
                onClick={() => setTrailerKey(trailer.key)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm transition-all shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95"
                suppressHydrationWarning
              >
                <Play className="w-4 h-4 fill-black" />
                Watch Trailer
              </button>
            )}

            <button
              onClick={handleWatchlistClick}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${
                isInWatchlist
                  ? 'bg-emerald-600/90 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-white border-zinc-700'
              }`}
              suppressHydrationWarning
            >
              {isInWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
            </button>

            <Link
              href={`/${mediaType}/${currentItem.id}`}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 hover:text-white text-sm font-semibold transition-all border border-zinc-700/70"
            >
              <Info className="w-4 h-4" />
              More Details
            </Link>
          </div>
        </div>

        {/* Carousel Slide Indicators & Nav */}
        <div className="absolute right-4 sm:right-8 bottom-12 flex items-center gap-3">
          <div className="flex gap-1.5">
            {items.slice(0, 5).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === idx ? 'w-8 bg-amber-400' : 'w-2 bg-zinc-600 hover:bg-zinc-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
                suppressHydrationWarning
              />
            ))}
          </div>

          <div className="flex items-center gap-1 ml-3">
            <button
              onClick={() => setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1))}
              className="p-2 rounded-lg bg-black/60 hover:bg-black/90 text-zinc-300 border border-white/10 transition-colors"
              aria-label="Previous slide"
              suppressHydrationWarning
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)}
              className="p-2 rounded-lg bg-black/60 hover:bg-black/90 text-zinc-300 border border-white/10 transition-colors"
              aria-label="Next slide"
              suppressHydrationWarning
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Trailer Modal */}
      {trailerKey && (
        <TrailerModal
          videoKey={trailerKey}
          title={title}
          onClose={() => setTrailerKey(null)}
        />
      )}
    </div>
  );
};

export default HeroBanner;
