'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Plus, Check, Eye, Heart, Film, Tv, Play } from 'lucide-react';
import { TitleDetails } from '@/types';
import { getImageURL } from '@/lib/tmdb';
import { useWatchlist } from '@/context/WatchlistContext';

interface MovieCardProps {
  item: TitleDetails;
  priority?: boolean;
}

export const MovieCard: React.FC<MovieCardProps> = ({ item, priority = false }) => {
  const { watchlist, addToWatchlist, removeFromWatchlist, toggleStatus, toggleFavorite, isMounted } = useWatchlist();

  const mediaType = item.media_type || (item.name ? 'tv' : 'movie');
  const title = item.title || item.name || 'Untitled';
  const releaseDate = item.release_date || item.first_air_date || '';
  const year = releaseDate ? releaseDate.split('-')[0] : '';
  const posterUrl = getImageURL(item.poster_path, 'w500');

  const existing = isMounted ? watchlist.find((w) => w.id === item.id) : undefined;
  const isInWatchlist = !!existing;
  const isWatched = existing?.status === 'watched';
  const isFavorite = existing?.isFavorite || false;

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInWatchlist && !isWatched) {
      removeFromWatchlist(item.id);
    } else {
      addToWatchlist(item, 'watchlist');
    }
  };

  const handleWatchedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWatched) {
      toggleStatus(item.id, 'watchlist');
    } else {
      addToWatchlist(item, 'watched');
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInWatchlist) {
      addToWatchlist(item, 'watchlist');
    }
    toggleFavorite(item.id);
  };

  return (
    <div className="group cine-card-glow relative flex flex-col rounded-2xl bg-[#10131b] border border-white/10 overflow-hidden cursor-pointer select-none">
      {/* Poster Image Container with Shimmer and Zoom */}
      <Link href={`/${mediaType}/${item.id}`} className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950 block">
        {/* Poster Image with 700ms Smooth Cinema Zoom */}
        <Image
          src={posterUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={priority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />

        {/* Diagonal Light Shimmer Sweep on Hover */}
        <div className="cine-shimmer" />

        {/* Ambient Dark Gradient Vignette Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3.5 pointer-events-none" />

        {/* Badges Top Left (Media Type) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-bold text-zinc-200 border border-white/15 uppercase tracking-wider shadow-lg group-hover:border-amber-400/40 transition-colors">
            {mediaType === 'tv' ? <Tv className="w-3 h-3 text-sky-400" /> : <Film className="w-3 h-3 text-amber-400" />}
            {mediaType === 'tv' ? 'TV' : 'Movie'}
          </span>
        </div>

        {/* Badges Top Right (Rating) */}
        {item.vote_average > 0 && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md text-xs font-black text-amber-300 border border-amber-400/40 shadow-lg group-hover:scale-105 group-hover:border-amber-400 transition-all z-20">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{item.vote_average.toFixed(1)}</span>
          </div>
        )}

        {/* Center Play Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full bg-amber-500/90 text-black flex items-center justify-center shadow-xl shadow-amber-500/40 backdrop-blur-sm border border-amber-300/50">
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </div>
        </div>

        {/* Bottom Quick-Action Buttons (Staggered Spring Entrance on Hover) */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-3 group-hover:translate-y-0 z-30 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            {/* Watchlist toggle */}
            <button
              onClick={handleWatchlistClick}
              title={isInWatchlist && !isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
              className={`p-2 rounded-xl backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 ${
                isInWatchlist && !isWatched
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/40 border border-amber-400'
                  : 'bg-black/80 text-white hover:bg-amber-500 hover:text-black border border-white/20'
              }`}
              suppressHydrationWarning
            >
              {isInWatchlist && !isWatched ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
            </button>

            {/* Watched toggle */}
            <button
              onClick={handleWatchedClick}
              title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
              className={`p-2 rounded-xl backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 ${
                isWatched
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/40 border border-emerald-400'
                  : 'bg-black/80 text-white hover:bg-emerald-500 hover:text-black border border-white/20'
              }`}
              suppressHydrationWarning
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Favorite toggle */}
          <button
            onClick={handleFavoriteClick}
            title={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
            className={`p-2 rounded-xl backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 ${
              isFavorite
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 border border-rose-400'
                : 'bg-black/80 text-white hover:bg-rose-500 hover:text-white border border-white/20'
            }`}
            suppressHydrationWarning
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current text-white' : ''}`} />
          </button>
        </div>
      </Link>

      {/* Info Section Below Poster */}
      <div className="p-3.5 flex flex-col justify-between flex-1 bg-gradient-to-b from-[#10131b] to-[#0c0f16]">
        <Link href={`/${mediaType}/${item.id}`} className="block">
          <h3 className="text-sm font-bold text-zinc-100 line-clamp-1 group-hover:text-amber-400 transition-colors duration-200">
            {title}
          </h3>
        </Link>
        <div className="flex items-center justify-between text-xs text-zinc-400 mt-1.5 font-medium">
          <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">{year || 'TBA'}</span>
          {isMounted && existing?.personalRating ? (
            <span className="flex items-center gap-0.5 text-amber-400 text-[11px] font-black">
              ★ {existing.personalRating}/10
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">HD • 4K</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
