'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Bookmark,
  Eye,
  Heart,
  Star,
  Clock,
  Flame,
  Search,
  SlidersHorizontal,
  Trash2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Layers,
  ArrowUpDown,
  Share2,
  Link2,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { getImageURL } from '@/lib/tmdb';
import { WatchlistItem } from '@/types';
import RecentlyAddedLinksCatalog from '@/components/RecentlyAddedLinksCatalog';

function WatchlistContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'all' | 'watchlist' | 'watched' | 'favorites' | 'links') || 'all';

  const { watchlist, removeFromWatchlist, toggleStatus, toggleFavorite, setPersonalRating, stats, isMounted } = useWatchlist();

  const [activeTab, setActiveTab] = useState<'all' | 'watchlist' | 'watched' | 'favorites' | 'links'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'added_desc' | 'rating_desc' | 'year_desc' | 'title_asc'>('added_desc');
  const [editingRatingId, setEditingRatingId] = useState<number | null>(null);
  const [tempRating, setTempRating] = useState<number>(10);
  const [tempReview, setTempReview] = useState<string>('');

  // Filter & Sort
  const filteredList = useMemo(() => {
    if (!isMounted) return [];
    return watchlist
      .filter((item) => {
        if (activeTab === 'watchlist' && item.status !== 'watchlist') return false;
        if (activeTab === 'watched' && item.status !== 'watched') return false;
        if (activeTab === 'favorites' && !item.isFavorite) return false;

        if (mediaFilter !== 'all' && item.mediaType !== mediaFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchReview = item.review?.toLowerCase().includes(q);
          const matchGenres = item.genres?.some((g) => g.toLowerCase().includes(q));
          if (!matchTitle && !matchReview && !matchGenres) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'added_desc') {
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        }
        if (sortBy === 'rating_desc') {
          return (b.personalRating || 0) - (a.personalRating || 0);
        }
        if (sortBy === 'year_desc') {
          return (b.release_date || '').localeCompare(a.release_date || '');
        }
        if (sortBy === 'title_asc') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [watchlist, activeTab, mediaFilter, searchQuery, sortBy]);

  const handleOpenRating = (item: WatchlistItem) => {
    setEditingRatingId(item.id);
    setTempRating(item.personalRating || 8);
    setTempReview(item.review || '');
  };

  const handleSaveRating = (id: number) => {
    setPersonalRating(id, tempRating, tempReview);
    setEditingRatingId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header & Quick Analytics Dashboard */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Bookmark className="w-4 h-4" /> Personal Library & Tracking
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">My Cinema Vault</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/simkl"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold text-xs transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              SIMKL Sync
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400">Total Saved</span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-white" suppressHydrationWarning>
              {isMounted ? stats.totalItems : 0}
            </div>
            <span className="text-[11px] text-zinc-500">In your personal collection</span>
          </div>

          <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Watched Log
            </span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-emerald-400" suppressHydrationWarning>
              {isMounted ? stats.watchedCount : 0}
            </div>
            <span className="text-[11px] text-zinc-500">Completed titles</span>
          </div>

          <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Hours Logged
            </span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-amber-400" suppressHydrationWarning>
              {isMounted ? `${Math.floor(stats.totalRuntimeMinutes / 60)}h ${stats.totalRuntimeMinutes % 60}m` : '0h 0m'}
            </div>
            <span className="text-[11px] text-zinc-500">Screen time logged</span>
          </div>

          <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" /> Favorites
            </span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-rose-400" suppressHydrationWarning>
              {isMounted ? stats.favoritesCount : 0}
            </div>
            <span className="text-[11px] text-zinc-500" suppressHydrationWarning>
              Star average: {isMounted && stats.averageRating > 0 ? `${stats.averageRating}★` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Navigation Bar */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          {/* Main Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'all' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
              suppressHydrationWarning
            >
              All ({isMounted ? watchlist.length : 0})
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'watchlist' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
              suppressHydrationWarning
            >
              <Bookmark className="w-3 h-3" /> Watchlist ({isMounted ? stats.watchlistCount : 0})
            </button>
            <button
              onClick={() => setActiveTab('watched')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'watched' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
              suppressHydrationWarning
            >
              <Eye className="w-3 h-3" /> Watched ({isMounted ? stats.watchedCount : 0})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'favorites' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
              suppressHydrationWarning
            >
              <Heart className="w-3 h-3" /> Favorites ({isMounted ? stats.favoritesCount : 0})
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'links' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
              suppressHydrationWarning
            >
              <Link2 className="w-3 h-3" /> Custom Links Catalog
            </button>
          </div>

          {/* Search within Watchlist */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search your watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              suppressHydrationWarning
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs text-zinc-300 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500 font-semibold"
              suppressHydrationWarning
            >
              <option value="added_desc">Recently Added</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="year_desc">Release Year</option>
              <option value="title_asc">Title (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Custom Links Catalog View or Watchlist Grid */}
      {activeTab === 'links' ? (
        <RecentlyAddedLinksCatalog />
      ) : filteredList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const posterUrl = getImageURL(item.poster_path, 'w500');
            const isWatched = item.status === 'watched';
            const year = (item.release_date || '').split('-')[0];

            return (
              <div
                key={item.id}
                className="bg-[#0f121a] border border-zinc-800/90 rounded-2xl p-4 flex gap-4 hover:border-amber-400/40 transition-all shadow-md group"
              >
                {/* Poster */}
                <Link
                  href={`/${item.mediaType}/${item.id}`}
                  className="relative w-24 sm:w-28 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 block"
                >
                  <Image
                    src={posterUrl}
                    alt={item.title}
                    fill
                    sizes="112px"
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 uppercase">
                    {item.mediaType}
                  </div>
                </Link>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/${item.mediaType}/${item.id}`}
                        className="font-bold text-white text-sm sm:text-base hover:text-amber-400 transition-colors line-clamp-1"
                      >
                        {item.title}
                      </Link>

                      <button
                        onClick={() => removeFromWatchlist(item.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                        title="Remove from list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                      <span>{year}</span>
                      {item.runtime && (
                        <span>• {Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span>
                      )}
                      {item.genres && item.genres.length > 0 && (
                        <span className="text-zinc-500 truncate">• {item.genres.slice(0, 2).join(', ')}</span>
                      )}
                    </div>

                    {/* Personal Rating / Review Snippet */}
                    {item.personalRating ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold pt-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{item.personalRating}/10</span>
                        {item.review && (
                          <span className="text-zinc-400 font-normal italic text-[11px] truncate max-w-[220px]">
                            &quot;{item.review}&quot;
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenRating(item)}
                        className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 pt-1 transition-colors"
                      >
                        <Star className="w-3 h-3" /> Add personal rating & review
                      </button>
                    )}

                    {/* Custom Links count */}
                    {item.customLinks && item.customLinks.length > 0 && (
                      <div className="text-[10px] text-zinc-400 pt-0.5">
                        🔗 {item.customLinks.length} custom link{item.customLinks.length > 1 ? 's' : ''} saved
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(item.id, isWatched ? 'watchlist' : 'watched')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border ${
                          isWatched
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        {isWatched ? 'Watched' : 'Mark Watched'}
                      </button>

                      <button
                        onClick={() => toggleFavorite(item.id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          item.isFavorite
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                        }`}
                        title="Toggle Favorite"
                      >
                        <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenRating(item)}
                      className="text-xs text-amber-400 hover:underline font-medium"
                    >
                      {item.personalRating ? 'Edit Rating' : 'Rate Title'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Bookmark className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-zinc-200">No items in this section</h3>
          <p className="text-xs text-zinc-400">
            Discover movies & shows on the home page and click &quot;Add to Watchlist&quot; or &quot;Mark as Watched&quot; to build your personal cinema library.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
          >
            Discover Titles Now
          </Link>
        </div>
      )}

      {/* Edit Rating Modal */}
      {editingRatingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0e1117] border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              Rate & Review Title
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">
                Your Star Rating: <span className="text-amber-400 text-sm font-bold">{tempRating} / 10</span>
              </label>
              <div className="flex items-center justify-between gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTempRating(val)}
                    className="p-1 hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        val <= tempRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">Review Notes (Optional):</label>
              <textarea
                value={tempReview}
                onChange={(e) => setTempReview(e.target.value)}
                placeholder="Write your impressions, favorite scenes, or rating explanation..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingRatingId(null)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveRating(editingRatingId)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors"
              >
                Save Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      }
    >
      <WatchlistContent />
    </Suspense>
  );
}
