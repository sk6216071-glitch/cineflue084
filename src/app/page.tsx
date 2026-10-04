import React from 'react';
import { getRecentlyAddedTitles } from '@/lib/redisDb';
import LatestUploadsGrid from '@/components/LatestUploadsGrid';

export const revalidate = 60; // ISR cache 60s for immediate link updates

export default async function HomePage() {
  const recentMovies = await getRecentlyAddedTitles(12, 'movie');
  const recentSeries = await getRecentlyAddedTitles(12, 'tv');
  const recentAll = [...recentMovies, ...recentSeries].sort((a, b) => {
    const dateA = new Date(a.uploadMeta?.createdAt || a.release_date || 0).getTime();
    const dateB = new Date(b.uploadMeta?.createdAt || b.release_date || 0).getTime();
    return dateB - dateA;
  });

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
