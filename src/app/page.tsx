import React from 'react';
import { getPaginatedUploadedTitles } from '@/lib/redisDb';
import LatestUploadsGrid from '@/components/LatestUploadsGrid';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const result = await getPaginatedUploadedTitles({
    type: 'all',
    page: 1,
    limit: 24,
    skipCount: true,
  });

  const allTitles = result.items || [];
  const movieTitles = allTitles.filter((item) => item.media_type === 'movie');
  const seriesTitles = allTitles.filter((item) => item.media_type === 'tv');

  return (
    <div className="min-h-screen pb-16 space-y-8 pt-6">
      {/* Latest Uploads Section with 16:9 Landscape Poster Grid and Pagination */}
      <section id="latest-uploads-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <LatestUploadsGrid
          allTitles={allTitles}
          movieTitles={movieTitles}
          seriesTitles={seriesTitles}
        />
      </section>
    </div>
  );
}
