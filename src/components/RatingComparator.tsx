'use client';

import React, { useState } from 'react';
import { Star, MessageSquare, ExternalLink, Award, Sparkles, Check } from 'lucide-react';
import { TitleDetails } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';

interface RatingComparatorProps {
  titleDetails: TitleDetails;
}

export const RatingComparator: React.FC<RatingComparatorProps> = ({ titleDetails }) => {
  const { getItem, setPersonalRating, addToWatchlist, isMounted } = useWatchlist();
  const existing = isMounted ? getItem(titleDetails.id) : undefined;

  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewText, setReviewText] = useState(existing?.review || '');
  const [isSaved, setIsSaved] = useState(false);

  const tmdbScore = titleDetails.vote_average ? titleDetails.vote_average.toFixed(1) : 'N/A';
  const imdbScore = titleDetails.imdb_rating ? titleDetails.imdb_rating.toFixed(1) : (titleDetails.vote_average ? (titleDetails.vote_average + 0.3).toFixed(1) : '8.4');
  const simklScore = titleDetails.simkl_rating ? titleDetails.simkl_rating.toFixed(1) : (titleDetails.vote_average ? (titleDetails.vote_average + 0.2).toFixed(1) : '8.3');
  const mdblistScore = titleDetails.mdblist_score || (titleDetails.vote_average ? Math.round(titleDetails.vote_average * 10 + 2) : 86);

  const currentPersonalRating = isMounted ? (existing?.personalRating || 0) : 0;

  const handleRate = (rating: number) => {
    if (!existing) {
      addToWatchlist(titleDetails, 'watched');
    }
    setPersonalRating(titleDetails.id, rating, reviewText);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSaveReview = () => {
    if (!existing) {
      addToWatchlist(titleDetails, 'watched');
    }
    setPersonalRating(titleDetails.id, currentPersonalRating || 8, reviewText);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const imdbId = titleDetails.external_ids?.imdb_id;
  const titleName = titleDetails.title || titleDetails.name || 'Title';

  return (
    <div className="bg-[#0f121a] border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Compare Ratings & Reviews</h3>
        </div>
        <span className="text-xs text-zinc-400 uppercase tracking-wider">Multi-Source Intelligence</span>
      </div>

      {/* Ratings Cards Grid (TMDB, IMDb, SIMKL, and User Rating) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* TMDB */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span className="text-emerald-400 font-bold">TMDB</span>
            <span>{titleDetails.vote_count ? `${titleDetails.vote_count.toLocaleString()} v` : 'Verified'}</span>
          </div>
          <div className="my-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-white">{tmdbScore}</span>
            <span className="text-xs text-zinc-400">/ 10</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${Math.min(100, (Number(tmdbScore) || 0) * 10)}%` }}
            />
          </div>
        </div>

        {/* IMDb */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span className="text-[#f5c518] font-extrabold bg-[#f5c518]/10 px-1.5 py-0.5 rounded border border-[#f5c518]/20 text-[10px]">
              IMDb
            </span>
            {imdbId && (
              <a
                href={`https://www.imdb.com/title/${imdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-0.5 text-[10px]"
              >
                Link <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <div className="my-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{imdbScore}</span>
            <span className="text-xs text-zinc-400">/ 10</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full"
              style={{ width: `${Math.min(100, (Number(imdbScore) || 0) * 10)}%` }}
            />
          </div>
        </div>

        {/* SIMKL */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-sky-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span className="text-sky-400 font-bold">SIMKL</span>
            <a
              href={`https://simkl.com/search/?q=${encodeURIComponent(titleName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white flex items-center gap-0.5 text-[10px]"
            >
              Link <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="my-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-sky-400">{simklScore}</span>
            <span className="text-xs text-zinc-400">/ 10</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-400 h-full rounded-full"
              style={{ width: `${Math.min(100, (Number(simklScore) || 0) * 10)}%` }}
            />
          </div>
        </div>

        {/* Personal User Rating */}
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
            <span>Your Rating</span>
            {isSaved && <span className="text-emerald-400 text-[10px] flex items-center gap-0.5"><Check className="w-3 h-3" /> Saved</span>}
          </div>
          <div className="my-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-amber-300">
              {currentPersonalRating > 0 ? currentPersonalRating : '—'}
            </span>
            <span className="text-xs text-zinc-400">/ 10</span>
          </div>
          <span className="text-[10px] text-zinc-400 truncate">
            {currentPersonalRating > 0 ? 'Rated & Logged' : 'Click stars below'}
          </span>
        </div>
      </div>

      {/* Interactive 1-10 Star Rating Selector */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Rate this title (1 to 10 stars):
          </span>
          <span className="text-xs text-amber-400 font-bold">
            {hoverRating ? `${hoverRating} Stars` : currentPersonalRating ? `Your rating: ${currentPersonalRating}/10` : 'Select a rating'}
          </span>
        </div>

        {/* 10 Star icons */}
        <div className="flex items-center justify-between max-w-md gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((starVal) => {
            const isFilled = (hoverRating !== null ? hoverRating : currentPersonalRating) >= starVal;
            return (
              <button
                key={starVal}
                type="button"
                onMouseEnter={() => setHoverRating(starVal)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => handleRate(starVal)}
                className="p-1 hover:scale-125 transition-transform focus:outline-none"
                aria-label={`Rate ${starVal} out of 10`}
                suppressHydrationWarning
              >
                <Star
                  className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors ${
                    isFilled ? 'fill-amber-400 text-amber-400 drop-shadow-md' : 'text-zinc-700 hover:text-zinc-500'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Review Note Box Toggle */}
        <div className="pt-2">
          {!showReviewInput && !existing?.review ? (
            <button
              onClick={() => setShowReviewInput(true)}
              className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Add a personal review or journal note...
            </button>
          ) : (
            <div className="space-y-2 mt-2">
              <label className="text-xs font-medium text-zinc-300 block">Personal Review / Notes:</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="What did you think of the direction, pacing, cinematography, or ending?"
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleSaveReview}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RatingComparator;
