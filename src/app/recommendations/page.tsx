'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Star, Film, Flame, Award, Compass, ArrowRight, RefreshCw } from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { getPersonalizedRecommendations, PersonalizedRecommendationsResult } from '@/lib/recommendations';
import MovieCard from '@/components/MovieCard';

export default function RecommendationsPage() {
  const { watchlist, isMounted } = useWatchlist();
  const [data, setData] = useState<PersonalizedRecommendationsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await getPersonalizedRecommendations(watchlist);
      setData(res);
    } catch (e) {
      console.error('Error fetching recommendations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMounted) {
      fetchRecommendations();
    }
  }, [watchlist, isMounted]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Smart Recommendation Engine
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">Recommended For You</h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Tailored suggestions driven by your ratings, watch history, favorite genres, and preferred directors.
          </p>
        </div>

        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Recommendations
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">Analyzing your cinema vault and computing affinities...</p>
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <div className="space-y-12">
          {/* 1. For You Top Matches */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-xl font-bold text-white">Top Personalized Matches</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {data.forYou.map((rec) => (
                <div key={rec.item.id} className="flex flex-col space-y-2">
                  <MovieCard item={rec.item} />
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg truncate text-center">
                    {rec.reason}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Top Genre Affinity */}
          {data.topGenrePicks.items.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-zinc-800/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-sky-400" />
                  <h2 className="text-xl font-bold text-white">
                    Unwatched Hits in Your #1 Genre: {data.topGenrePicks.genreName}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {data.topGenrePicks.items.map((rec) => (
                  <MovieCard key={rec.item.id} item={rec.item} />
                ))}
              </div>
            </section>
          )}

          {/* 3. Director & Cast Picks */}
          {data.actorDirectorPicks.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-zinc-800/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">From Visionary Creators You Love</h2>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {data.actorDirectorPicks.map((rec) => (
                  <MovieCard key={rec.item.id} item={rec.item} />
                ))}
              </div>
            </section>
          )}

          {/* 4. Top Rated Masterpieces */}
          {data.topUnwatchedMasterpieces.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-zinc-800/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-bold text-white">Top-Rated Masterpieces You Haven&apos;t Seen</h2>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {data.topUnwatchedMasterpieces.map((rec) => (
                  <MovieCard key={rec.item.id} item={rec.item} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
