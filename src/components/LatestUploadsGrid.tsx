'use client';

import React, { useState, useMemo } from 'react';
import { Flame, Film, Tv, Sparkles } from 'lucide-react';
import { TitleDetails } from '@/types';
import MovieCard from './MovieCard';
import Pagination from './Pagination';

interface LatestUploadsGridProps {
  allTitles: TitleDetails[];
  movieTitles: TitleDetails[];
  seriesTitles: TitleDetails[];
}

export const LatestUploadsGrid: React.FC<LatestUploadsGridProps> = ({
  allTitles,
  movieTitles,
  seriesTitles,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 24;

  const handleTabChange = (tab: 'all' | 'movie' | 'tv') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const displayedTitles = useMemo(() => {
    if (activeTab === 'movie') return movieTitles;
    if (activeTab === 'tv') return seriesTitles;
    return allTitles;
  }, [activeTab, allTitles, movieTitles, seriesTitles]);

  const totalPages = Math.max(1, Math.ceil(displayedTitles.length / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);

  const pagedTitles = useMemo(() => {
    const start = (validPage - 1) * ITEMS_PER_PAGE;
    return displayedTitles.slice(start, start + ITEMS_PER_PAGE);
  }, [displayedTitles, validPage]);

  return (
    <div className="space-y-6">
      {/* Header with Title and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Flame className="w-5 h-5 fill-amber-400/30" />
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Latest uploads
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 font-medium">
            Recent high-speed direct downloads in 4K UHD, 1080p and 720p with multi-audio
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#14121f] border border-[#2b2542] self-start sm:self-auto">
          <button
            onClick={() => handleTabChange('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            All ({allTitles.length})
          </button>
          <button
            onClick={() => handleTabChange('movie')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'movie'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Movies ({movieTitles.length})
          </button>
          <button
            onClick={() => handleTabChange('tv')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tv'
                ? 'bg-sky-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            TV Series ({seriesTitles.length})
          </button>
        </div>
      </div>

      {/* 4-Column Responsive Grid matching Reference Screenshot */}
      {pagedTitles.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {pagedTitles.map((item, idx) => (
              <MovieCard
                key={`${item.media_type}-${item.id}-${idx}`}
                item={item}
                aspect="landscape"
                priority={idx < 4}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Pagination
              currentPage={validPage}
              totalPages={totalPages}
              onPageChange={(p) => {
                setCurrentPage(p);
                const el = document.getElementById('latest-uploads-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
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
