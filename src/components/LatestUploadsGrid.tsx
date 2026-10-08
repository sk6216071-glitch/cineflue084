'use client';

import React from 'react';
import Link from 'next/link';
import { Flame, Film, Tv, Sparkles } from 'lucide-react';
import { TitleDetails } from '@/types';
import MovieCard from './MovieCard';
import Pagination from './Pagination';

interface LatestUploadsGridProps {
  items: TitleDetails[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  activeType: 'all' | 'movie' | 'tv';
  basePath?: string;
}

export const LatestUploadsGrid: React.FC<LatestUploadsGridProps> = ({
  items,
  currentPage,
  totalPages,
  totalCount,
  activeType,
  basePath = '/',
}) => {
  return (
    <div className="space-y-6">
      {/* Header with Title and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
            <Flame className="w-5 h-5 fill-amber-400/30" />
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white uppercase tracking-wider leading-none">
            Latest Uploads
          </h2>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#14121f] border border-[#2b2542] self-start sm:self-auto">
          <Link
            href="/"
            className={`font-ui px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeType === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            All
          </Link>
          <Link
            href="/?type=movie"
            className={`font-ui flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeType === 'movie'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Movies
          </Link>
          <Link
            href="/?type=tv"
            className={`font-ui flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeType === 'tv'
                ? 'bg-sky-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            TV Series
          </Link>
        </div>
      </div>

      {/* 4-Column Responsive Grid matching Reference Screenshot */}
      {items.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {items.map((item, idx) => (
              <MovieCard
                key={`${item.media_type || activeType}-${item.id}-${idx}`}
                item={item}
                aspect="landscape"
                priority={idx === 0}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={basePath}
              extraParams={{
                type: activeType !== 'all' ? activeType : undefined,
              }}
            />
          )}
        </div>
      ) : (
        <div className="py-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 space-y-3">
          <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-zinc-300 font-semibold text-sm">
            No uploads found under this category.
          </p>
          <p className="text-xs text-zinc-500">
            Check other tabs or upload links through the Admin portal.
          </p>
        </div>
      )}
    </div>
  );
};

export default LatestUploadsGrid;
