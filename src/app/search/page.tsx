'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Filter, Star, Film, Tv, User, X, SlidersHorizontal, Sparkles } from 'lucide-react';
import { TitleDetails, PersonDetails } from '@/types';
import { searchMulti, getDiscover, getImageURL } from '@/lib/tmdb';
import { POPULAR_GENRES } from '@/lib/mockData';
import MovieCard from '@/components/MovieCard';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get('q') || '';
  const initialGenre = searchParams.get('genre') || '';
  const initialGenreName = searchParams.get('name') || '';
  const initialType = searchParams.get('type') || 'all';

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv' | 'person'>(
    (initialType as 'all' | 'movie' | 'tv' | 'person') || 'all'
  );
  const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);
  const [minRating, setMinRating] = useState<number>(0);
  const [results, setResults] = useState<(TitleDetails | PersonDetails)[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isCancelled = false;

    async function performSearch() {
      setLoading(true);
      try {
        if (query.trim().length > 0) {
          const res = await searchMulti(query.trim());
          if (!isCancelled) {
            setResults(res.results || []);
          }
        } else if (selectedGenre) {
          const genreId = Number(selectedGenre);
          const [movies, tvs] = await Promise.all([
            getDiscover('movie', { genreId }),
            getDiscover('tv', { genreId }),
          ]);
          if (!isCancelled) {
            setResults([...movies, ...tvs]);
          }
        } else {
          // Default discover
          const [movies, tvs] = await Promise.all([
            getDiscover('movie'),
            getDiscover('tv'),
          ]);
          if (!isCancelled) {
            setResults([...movies, ...tvs]);
          }
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    performSearch();

    return () => {
      isCancelled = true;
    };
  }, [query, selectedGenre]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    startTransition(() => {
      if (val) {
        router.replace(`/search?q=${encodeURIComponent(val)}`, { scroll: false });
      } else {
        router.replace('/search', { scroll: false });
      }
    });
  };

  // Filter results by tab and minRating
  const filteredResults = results.filter((item) => {
    const isPerson = 'known_for_department' in item || (item as any).media_type === 'person';
    const isMovie = !isPerson && ((item as any).media_type === 'movie' || (item as any).release_date);
    const isTV = !isPerson && ((item as any).media_type === 'tv' || (item as any).first_air_date);

    if (activeTab === 'movie' && !isMovie) return false;
    if (activeTab === 'tv' && !isTV) return false;
    if (activeTab === 'person' && !isPerson) return false;

    if (!isPerson && minRating > 0) {
      const vote = (item as TitleDetails).vote_average || 0;
      if (vote < minRating) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Search & Filter Bar */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by movie title, TV series, actor, director..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl pl-11 pr-10 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
              suppressHydrationWarning
            />
            <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            {query && (
              <button
                onClick={() => handleQueryChange('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                suppressHydrationWarning
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Genre Dropdown */}
          <div className="sm:w-56">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-4 py-3 text-sm font-medium text-zinc-200 focus:outline-none focus:border-amber-500"
              suppressHydrationWarning
            >
              <option value="">All Genres</option>
              {POPULAR_GENRES.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters and Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'all' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setActiveTab('movie')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'movie' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" /> Movies
            </button>
            <button
              onClick={() => setActiveTab('tv')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'tv' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" /> TV Shows
            </button>
            <button
              onClick={() => setActiveTab('person')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'person' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Cast & People
            </button>
          </div>

          {/* Min Rating Filter */}
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Min Rating:</span>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-amber-500 font-semibold"
            >
              <option value={0}>Any Score</option>
              <option value={6}>6.0+ Good</option>
              <option value={7}>7.0+ Great</option>
              <option value={8}>8.0+ Masterpiece</option>
              <option value={9}>9.0+ Elite</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          {query ? `Results for "${query}"` : selectedGenre ? `Genre Results` : 'Browse Catalog'}
          <span className="text-xs font-normal text-zinc-400">({filteredResults.length} found)</span>
        </h2>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Searching CineFuel catalog...</p>
        </div>
      )}

      {/* Results Grid */}
      {!loading && filteredResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {filteredResults.map((item, idx) => {
            const isPerson = 'known_for_department' in item || (item as any).media_type === 'person';

            if (isPerson) {
              const person = item as PersonDetails;
              const photoUrl = getImageURL(person.profile_path, 'w500');
              return (
                <Link
                  key={`person-${person.id}-${idx}`}
                  href={`/person/${person.id}`}
                  className="group rounded-2xl bg-[#11141c] border border-white/5 overflow-hidden hover:border-amber-400/40 transition-all p-3 flex flex-col items-center text-center space-y-2 hover:-translate-y-1"
                >
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-zinc-900 border-2 border-zinc-700 group-hover:border-amber-400 transition-colors">
                    <Image
                      src={photoUrl}
                      alt={person.name}
                      fill
                      sizes="128px"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                    {person.name}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {person.known_for_department || 'Actor / Cast'}
                  </span>
                </Link>
              );
            }

            return <MovieCard key={`title-${item.id}-${idx}`} item={item as TitleDetails} />;
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredResults.length === 0 && (
        <div className="py-20 text-center max-w-md mx-auto space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-zinc-200">No titles or people found</h3>
          <p className="text-xs text-zinc-400">
            Try adjusting your search query, selecting another genre, or clearing rating filters.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
