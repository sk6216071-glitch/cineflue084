'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Plus, Check, Eye, Heart, Film, Tv } from 'lucide-react';
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
    <div className="group relative flex flex-col rounded-2xl bg-[#11141c] border border-white/5 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-400/40 hover:shadow-2xl hover:shadow-amber-500/10">
      {/* Poster Image Container */}
      <Link href={`/${mediaType}/${item.id}`} className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900 block">
        <Image
          src={posterUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3" />

        {/* Badges Top Left & Right */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-semibold text-zinc-300 border border-white/10 uppercase tracking-wider">
            {mediaType === 'tv' ? <Tv className="w-3 h-3 text-sky-400" /> : <Film className="w-3 h-3 text-amber-400" />}
            {mediaType === 'tv' ? 'TV' : 'Movie'}
          </span>
        </div>

        {item.vote_average > 0 && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-xs font-bold text-amber-300 border border-amber-400/30 shadow-md">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{item.vote_average.toFixed(1)}</span>
          </div>
        )}

        {/* Action Overlay Buttons (Appears on Hover) */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0">
          <div className="flex items-center gap-1.5">
            {/* Watchlist toggle */}
            <button
              onClick={handleWatchlistClick}
              title={isInWatchlist && !isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
              className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                isInWatchlist && !isWatched
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                  : 'bg-black/70 text-white hover:bg-amber-500 hover:text-black border border-white/20'
              }`}
              suppressHydrationWarning
            >
              {isInWatchlist && !isWatched ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
            </button>

            {/* Watched toggle */}
            <button
              onClick={handleWatchedClick}
              title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
              className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                isWatched
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                  : 'bg-black/70 text-white hover:bg-emerald-500 hover:text-black border border-white/20'
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
            className={`p-2 rounded-xl backdrop-blur-md transition-all ${
              isFavorite
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-black/70 text-white hover:bg-rose-500 hover:text-white border border-white/20'
            }`}
            suppressHydrationWarning
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
      </Link>

      {/* Info Section Below Poster */}
      <div className="p-3.5 flex flex-col justify-between flex-1">
        <Link href={`/${mediaType}/${item.id}`} className="block">
          <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-amber-400 transition-colors">
            {title}
          </h3>
        </Link>
        <div className="flex items-center justify-between text-xs text-zinc-400 mt-1.5 font-medium">
          <span>{year || 'TBA'}</span>
          {isMounted && existing?.personalRating ? (
            <span className="flex items-center gap-0.5 text-amber-400 text-[11px] font-bold">
              ★ {existing.personalRating}/10
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
