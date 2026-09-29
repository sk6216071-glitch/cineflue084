import React from 'react';
import { getRecentlyAddedTitles } from '@/lib/redisDb';
import LatestUploadsGrid from '@/components/LatestUploadsGrid';

export const revalidate = 60; // ISR cache 60s for immediate link updates

export default async function HomePage() {
  const [
    recentAll,
    recentMovies,
    recentSeries,
  ] = await Promise.all([
    getRecentlyAddedTitles(96, 'all'),
    getRecentlyAddedTitles(72, 'movie'),
    getRecentlyAddedTitles(72, 'tv'),
  ]);

  return (
    <div className="min-h-screen pb-16 space-y-8 pt-6">
      {/* Latest Uploads Section with 16:9 Landscape Poster Grid and Pagination */}
      <section id="latest-uploads-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <LatestUploadsGrid
          allTitles={recentAll}
          movieTitles={recentMovies}
          seriesTitles={recentSeries}
        />
      </section>
    </div>
  );
}
