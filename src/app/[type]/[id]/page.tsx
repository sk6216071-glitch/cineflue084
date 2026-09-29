import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, Film, Tv } from 'lucide-react';
import { getTitleDetails } from '@/lib/tmdb';
import { getImageURL, getBackdropURL } from '@/lib/tmdb';
import RatingComparator from '@/components/RatingComparator';
import CustomLinksManager from '@/components/CustomLinksManager';

interface PageProps {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

export const revalidate = 3600;

export default async function TitleDetailPage({ params }: PageProps) {
  const { type, id } = await params;
  const normalizedType: 'movie' | 'tv' = type?.toLowerCase() === 'tv' ? 'tv' : 'movie';

  const titleDetails = await getTitleDetails(normalizedType, id);

  const title = titleDetails.title || titleDetails.name || 'Untitled';
  const releaseDate = titleDetails.release_date || titleDetails.first_air_date || '';
  const releaseYear = releaseDate.split('-')[0];
  const posterUrl = getImageURL(titleDetails.poster_path, 'w780');
  const backdropUrl = getBackdropURL(titleDetails.backdrop_path, 'original');

  return (
    <div className="min-h-screen pb-20 space-y-10">
      {/* 1. Hero Backdrop Header */}
      <div className="relative w-full min-h-[500px] lg:min-h-[580px] bg-black">
        {/* Backdrop Image */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={backdropUrl}
            alt={title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-40 scale-105"
          />
          {/* Vignette Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090c] via-[#08090c]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#08090c] via-[#08090c]/80 to-transparent" />
        </div>

        {/* Content Box */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start pt-12">
          {/* Poster Card */}
          <div className="w-44 sm:w-56 md:w-64 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 bg-zinc-900 group relative">
            <Image
              src={posterUrl}
              alt={title}
              width={300}
              height={450}
              priority
              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Text & Meta */}
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-3 w-full">
            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-md bg-amber-500 text-black uppercase font-bold tracking-wider flex items-center gap-1">
                {type === 'tv' ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                {type === 'tv' ? 'TV Series' : 'Movie'}
              </span>

              {releaseYear && (
                <span className="px-2.5 py-1 rounded-md bg-zinc-900/90 text-zinc-300 border border-zinc-700">
                  {releaseYear}
                </span>
              )}

              {titleDetails.runtime ? (
                <span className="px-2.5 py-1 rounded-md bg-zinc-900/90 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  {Math.floor(titleDetails.runtime / 60)}h {titleDetails.runtime % 60}m
                </span>
              ) : titleDetails.number_of_seasons ? (
                <span className="px-2.5 py-1 rounded-md bg-zinc-900/90 text-zinc-300 border border-zinc-700">
                  {titleDetails.number_of_seasons} Season{titleDetails.number_of_seasons > 1 ? 's' : ''} ({titleDetails.number_of_episodes || 0} eps)
                </span>
              ) : null}

              {titleDetails.status && (
                <span className="px-2.5 py-1 rounded-md bg-zinc-900/90 text-zinc-400 border border-zinc-800 text-[11px]">
                  {titleDetails.status}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-md">
              {title}
            </h1>

            {/* Tagline */}
            {titleDetails.tagline && (
              <p className="text-sm sm:text-base italic text-amber-300/90 font-medium">
                &quot;{titleDetails.tagline}&quot;
              </p>
            )}

            {/* Genres */}
            {titleDetails.genres && titleDetails.genres.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-1">
                {titleDetails.genres.map((g) => (
                  <Link
                    key={g.id}
                    href={`/search?type=${type}&genre=${g.id}&name=${encodeURIComponent(g.name)}`}
                    className="text-xs px-3 py-1 rounded-full bg-zinc-800/90 text-zinc-200 border border-zinc-700 hover:border-amber-400 transition-colors"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Rating Comparison Detail */}
            <div className="w-full pt-2">
              <RatingComparator titleDetails={titleDetails} />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Content Area: Download & Streaming Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CustomLinksManager titleDetails={titleDetails} />
      </div>
    </div>
  );
}
