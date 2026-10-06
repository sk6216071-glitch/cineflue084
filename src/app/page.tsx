import React from 'react';
import { getPaginatedUploadedTitles } from '@/lib/redisDb';
import LatestUploadsGrid from '@/components/LatestUploadsGrid';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const page = typeof resolvedParams?.page === 'string' ? Math.max(1, parseInt(resolvedParams.page, 10)) : 1;
  const typeParam = resolvedParams?.type;
  const activeType: 'all' | 'movie' | 'tv' =
    typeParam === 'movie' || typeParam === 'tv' ? typeParam : 'all';

  const result = await getPaginatedUploadedTitles({
    type: activeType,
    page,
    limit: 24,
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
          activeType={activeType}
          basePath="/"
        />
      </section>
    </div>
  );
}
