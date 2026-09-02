'use client';

import React, { useState } from 'react';
import { Play, Plus, Check, Eye, Heart, Share2, CheckCheck, ListPlus, ExternalLink, Film, Tv } from 'lucide-react';
import { TitleDetails } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';
import TrailerModal from '@/components/TrailerModal';
import AddToListModal from '@/components/AddToListModal';

interface DetailActionsProps {
  titleDetails: TitleDetails;
  trailerKey?: string;
}

export const DetailActions: React.FC<DetailActionsProps> = ({ titleDetails, trailerKey }) => {
  const { watchlist, addToWatchlist, removeFromWatchlist, toggleStatus, toggleFavorite, isMounted } = useWatchlist();
  const [showTrailer, setShowTrailer] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const existing = isMounted ? watchlist.find((w) => w.id === titleDetails.id) : undefined;
  const isInWatchlist = !!existing;
  const isWatched = existing?.status === 'watched';
  const isFavorite = existing?.isFavorite || false;

  const handleWatchlistClick = () => {
    if (isInWatchlist && !isWatched) {
      removeFromWatchlist(titleDetails.id);
    } else {
      addToWatchlist(titleDetails, 'watchlist');
    }
  };

  const handleWatchedClick = () => {
    if (isWatched) {
      toggleStatus(titleDetails.id, 'watchlist');
    } else {
      addToWatchlist(titleDetails, 'watched');
    }
  };

  const handleFavoriteClick = () => {
    if (!isInWatchlist) {
      addToWatchlist(titleDetails, 'watchlist');
    }
    toggleFavorite(titleDetails.id);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const title = titleDetails.title || titleDetails.name || 'Untitled';
  const imdbId = titleDetails.external_ids?.imdb_id;
  const tmdbId = titleDetails.id;
  const mediaType = titleDetails.media_type || (titleDetails.name ? 'tv' : 'movie');

  return (
    <>
      <div className="space-y-3 pt-3">
        {/* Row 1: Primary Actions (Trailer, Watchlist, Watched, Save to List, Fav, Share) */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
          {trailerKey && (
            <button
              onClick={() => setShowTrailer(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95"
              suppressHydrationWarning
            >
              <Play className="w-4 h-4 fill-black" />
              Watch Trailer
            </button>
          )}

          {/* Watchlist button */}
          <button
            onClick={handleWatchlistClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
              isInWatchlist && !isWatched
                ? 'bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
            }`}
            suppressHydrationWarning
          >
            {isInWatchlist && !isWatched ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
            {isInWatchlist && !isWatched ? 'In Watchlist' : 'Add to Watchlist'}
          </button>

          {/* Watched toggle */}
          <button
            onClick={handleWatchedClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
              isWatched
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/20'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
            }`}
            suppressHydrationWarning
          >
            <Eye className="w-4 h-4" />
            {isWatched ? 'Watched' : 'Mark as Watched'}
          </button>

          {/* Custom Lists button */}
          <button
            onClick={() => setShowListModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs sm:text-sm font-semibold transition-colors"
            title="Add to Custom List"
            suppressHydrationWarning
          >
            <ListPlus className="w-4 h-4 text-amber-400" />
            <span>Save to List</span>
          </button>

          {/* Favorite toggle */}
          <button
            onClick={handleFavoriteClick}
            className={`p-2.5 rounded-xl border transition-all ${
              isFavorite
                ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/20'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
            }`}
            title={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
            suppressHydrationWarning
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors"
            title="Share title link"
            suppressHydrationWarning
          >
            {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Row 2: Multiple Direct External Link Buttons */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
          {/* Netflix Quick Link */}
          <a
            href={`https://www.netflix.com/search?q=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/25 text-red-400 border border-red-500/30 text-xs font-semibold transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-[#E50914]" />
            <span>Netflix</span>
            <ExternalLink className="w-3 h-3 text-red-400/80" />
          </a>

          {/* Prime Video Quick Link */}
          <a
            href={`https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-[#00A8E1]" />
            <span>Prime Video</span>
            <ExternalLink className="w-3 h-3 text-sky-400/80" />
          </a>

          {/* IMDb Quick Link */}
          {imdbId && (
            <a
              href={`https://www.imdb.com/title/${imdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all hover:scale-105"
            >
              <span className="px-1 py-0.2 bg-[#f5c518] text-black text-[9px] font-black rounded">IMDb</span>
              <ExternalLink className="w-3 h-3 text-amber-300/80" />
            </a>
          )}

          {/* SIMKL Quick Link */}
          <a
            href={`https://simkl.com/search/?q=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>SIMKL</span>
            <ExternalLink className="w-3 h-3 text-sky-400/80" />
          </a>

          {/* MDBList Quick Link */}
          <a
            href={`https://mdblist.com/search/?q=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>MDBList</span>
            <ExternalLink className="w-3 h-3 text-emerald-400/80" />
          </a>

          {/* Letterboxd Quick Link */}
          <a
            href={`https://letterboxd.com/search/${encodeURIComponent(title)}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Letterboxd</span>
            <ExternalLink className="w-3 h-3 text-emerald-400/80" />
          </a>
        </div>
      </div>

      {showTrailer && trailerKey && (
        <TrailerModal
          videoKey={trailerKey}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}

      {showListModal && (
        <AddToListModal
          titleDetails={titleDetails}
          onClose={() => setShowListModal(false)}
        />
      )}
    </>
  );
};

export default DetailActions;
