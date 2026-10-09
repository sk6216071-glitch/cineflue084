import React from 'react';
import { getPaginatedUploadedTitles } from '@/lib/redisDb';
import LatestUploadsGrid from '@/components/LatestUploadsGrid';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
    tab?: string;
    ott?: string;
    quality?: string;
    sort?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const page = typeof resolvedParams?.page === 'string' ? Math.max(1, parseInt(resolvedParams.page, 10)) : 1;
  const rawTab = (resolvedParams?.tab || '').toLowerCase().trim();
  const rawType = (resolvedParams?.type || '').toLowerCase().trim();
  const rawOtt = (resolvedParams?.ott || '').toLowerCase().trim();
  const rawQuality = (resolvedParams?.quality || '').toLowerCase().trim();
  const rawSort = (resolvedParams?.sort || '').toLowerCase().trim();

  // Determine active tab
  let activeTab: 'home' | 'movie' | 'tv' | 'ott' | 'top_imdb' | 'anime' | 'quality' = 'home';
  if (rawTab === 'movie' || rawType === 'movie') activeTab = 'movie';
  else if (rawTab === 'tv' || rawType === 'tv') activeTab = 'tv';
  else if (rawTab === 'ott' || rawOtt) activeTab = 'ott';
  else if (rawTab === 'top_imdb' || rawSort === 'top_rated') activeTab = 'top_imdb';
  else if (rawTab === 'anime') activeTab = 'anime';
  else if (rawTab === 'quality' || rawQuality) activeTab = 'quality';
  else activeTab = 'home';

  // Map active tab to query options
  let typeOption: 'all' | 'movie' | 'tv' = 'all';
  if (activeTab === 'movie') typeOption = 'movie';
  else if (activeTab === 'tv') typeOption = 'tv';

  let ottOption: string | undefined = undefined;
  if (activeTab === 'ott') {
    ottOption = rawOtt || 'all';
  }

  let qualityOption: string | undefined = undefined;
  if (activeTab === 'quality') {
    qualityOption = rawQuality || '4k';
  }

  let genreOption: string | undefined = undefined;
  if (activeTab === 'anime') {
    genreOption = 'anime';
  }

  let sortOption: 'latest' | 'top_rated' | 'rating' | 'popular' | undefined = undefined;
  if (activeTab === 'top_imdb' || rawSort === 'top_rated') {
    sortOption = 'top_rated';
  }

  const result = await getPaginatedUploadedTitles({
    type: typeOption,
    page,
    limit: 16,
    ott: ottOption,
    quality: qualityOption,
    genre: genreOption,
    sort: sortOption,
  });

  return (
    <div className="min-h-screen pb-16 space-y-8 pt-6">
      {/* Latest Uploads Section with 16:9 Landscape Poster Grid and Full Pagination */}
      <section id="latest-uploads-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <LatestUploadsGrid
          items={result.items || []}
          currentPage={result.page}
          totalPages={result.totalPages}
          totalCount={result.total}
          activeType={typeOption}
          activeTab={activeTab}
          activeOtt={rawOtt}
          activeQuality={rawQuality}
          basePath="/"
        />
      </section>
    </div>
  );
}
