'use client';

import React, { useState, useMemo } from 'react';
import { Play, Plus, Check, Eye, Heart, Share2, CheckCheck, ListPlus, ExternalLink, Film, Tv } from 'lucide-react';
import { TitleDetails } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';
import { getRealAvailableStreamingProviders } from '@/lib/ottLinks';
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

  const title = titleDetails.title || titleDetails.name || 'Untitled';
  const imdbId = titleDetails.external_ids?.imdb_id;
  const mediaType = titleDetails.media_type || (titleDetails.name ? 'tv' : 'movie');

  const { availableList } = useMemo(() => {
    return getRealAvailableStreamingProviders(
      titleDetails.id,
      title,
      mediaType as any,
      titleDetails['watch/providers']?.results?.['IN']
    );
  }, [titleDetails.id, title, mediaType, titleDetails]);

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

  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback
      }
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 py-2">
        {/* Row 1: Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
          {/* Main Trailer Trigger */}
          {trailerKey && (
            <button
              onClick={() => setShowTrailer(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95"
              title="Watch Official Trailer"
              suppressHydrationWarning
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Watch Trailer</span>
            </button>
          )}

          {/* Watchlist toggle */}
          <button
            onClick={handleWatchlistClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
              isInWatchlist && !isWatched
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-zinc-700 hover:border-zinc-500'
            }`}
            title={isInWatchlist && !isWatched ? 'In your Watchlist' : 'Add to Watchlist'}
            suppressHydrationWarning
          >
            {isInWatchlist && !isWatched ? <Check className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4" />}
            <span>{isInWatchlist && !isWatched ? 'In Watchlist' : 'Watchlist'}</span>
          </button>

          {/* Watched toggle */}
          <button
            onClick={handleWatchedClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
              isWatched
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-zinc-700 hover:border-zinc-500'
            }`}
            title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
            suppressHydrationWarning
          >
            <Eye className="w-4 h-4" />
            <span>{isWatched ? 'Watched' : 'Mark Seen'}</span>
          </button>

          {/* Save to Custom List */}
          <button
            onClick={() => setShowListModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 text-xs sm:text-sm font-medium transition-colors"
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
                ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white'
            }`}
            title={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
            suppressHydrationWarning
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
            title="Share title link"
            suppressHydrationWarning
          >
            {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Row 2: Verified Direct Title Links */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
          {/* Active Verified Streaming Options */}
          {availableList.map((opt) => (
            <a
              key={opt.key}
              href={opt.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700 ${opt.accentBorder} text-xs font-semibold text-zinc-200 transition-all hover:scale-105 group`}
            >
              <div
                className="w-4 h-4 rounded flex items-center justify-center font-black text-white text-[9px]"
                style={{ backgroundColor: opt.logoBg }}
              >
                {opt.logoText}
              </div>
              <span className={`${opt.accentText} transition-colors`}>{opt.name}</span>
              <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </a>
          ))}

          {/* IMDb Direct Link */}
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

          {/* SIMKL Direct Link */}
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
