import React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Clock, Calendar, Film, Tv, Play, Plus, Check, Eye, Heart, Share2, Sparkles, User, Clapperboard } from 'lucide-react';
import { getTitleDetails } from '@/lib/tmdb';
import { getImageURL, getBackdropURL } from '@/lib/tmdb';
import RatingComparator from '@/components/RatingComparator';
import WhereToWatch from '@/components/WhereToWatch';
import CustomLinksManager from '@/components/CustomLinksManager';
import DigitalReleaseTracker from '@/components/DigitalReleaseTracker';
import SectionCarousel from '@/components/SectionCarousel';
import DetailActions from './DetailActions';

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

  const mainTrailer = titleDetails.videos?.results?.find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );

  const castList = titleDetails.credits?.cast?.slice(0, 12) || [];
  const director = titleDetails.credits?.crew?.find((c) => c.job === 'Director' || c.department === 'Directing');
  const similarItems = titleDetails.similar?.results || titleDetails.recommendations?.results || [];

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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10 flex flex-col md:flex-row gap-8 items-start md:items-end min-h-[500px]">
          {/* High-res Poster */}
          <div className="relative w-44 sm:w-56 md:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 shrink-0 bg-zinc-900 mx-auto md:mx-0">
            <Image
              src={posterUrl}
              alt={title}
              fill
              priority
              sizes="(max-width: 768px) 220px, 260px"
              className="object-cover"
            />
          </div>

          {/* Details & Action Header */}
          <div className="flex-1 space-y-4 text-center md:text-left">
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

            {/* Client Interactive Action Buttons */}
            <DetailActions titleDetails={titleDetails} trailerKey={mainTrailer?.key} />
          </div>
        </div>
      </div>

      {/* 2. Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Story, Cast, Ratings, Custom Links */}
        <div className="lg:col-span-2 space-y-8">
          {/* Story Overview */}
          <div className="bg-[#0f121a] border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-amber-400" /> Storyline & Overview
            </h3>
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
              {titleDetails.overview || 'No synopsis available for this title.'}
            </p>
            {director && (
              <div className="pt-3 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">Directed by:</span>
                <span className="text-amber-400 font-medium">{director.name}</span>
              </div>
            )}
          </div>

          {/* Rating Comparison Component */}
          <RatingComparator titleDetails={titleDetails} />

          {/* Cast & Crew Reel */}
          {castList.length > 0 && (
            <div className="bg-[#0f121a] border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-400" /> Cast & Characters
                </h3>
                <span className="text-xs text-zinc-400">Top Billed</span>
              </div>

              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {castList.map((actor) => {
                  const actorPhoto = getImageURL(actor.profile_path, 'w200');
                  return (
                    <Link
                      key={actor.id}
                      href={`/person/${actor.id}`}
                      className="w-24 sm:w-28 shrink-0 group flex flex-col items-center text-center space-y-1.5"
                    >
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-zinc-900 border-2 border-zinc-700 group-hover:border-amber-400 transition-colors">
                        <Image
                          src={actorPhoto}
                          alt={actor.name}
                          fill
                          sizes="96px"
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <span className="text-xs font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                        {actor.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 line-clamp-1">
                        {actor.character}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Digital & OTT Release Schedule Tracker */}
          <DigitalReleaseTracker
            titleId={titleDetails.id}
            releaseDate={releaseDate}
            titleName={title}
          />

          {/* Custom Links Management Section */}
          <CustomLinksManager titleDetails={titleDetails} />
        </div>

        {/* Right 1 Column: Where to Watch & Media Info */}
        <div className="space-y-8">
          {/* Where to Watch Component */}
          <WhereToWatch titleDetails={titleDetails} />

          {/* Additional Metadata Box */}
          <div className="bg-[#0f121a] border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-3">
              Title Information
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between py-1 border-b border-zinc-800/50">
                <span className="text-zinc-400">Original Title</span>
                <span className="text-zinc-200 font-medium">{titleDetails.original_title || titleDetails.original_name || title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/50">
                <span className="text-zinc-400">Status</span>
                <span className="text-zinc-200 font-medium">{titleDetails.status || 'Released'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/50">
                <span className="text-zinc-400">Release Date</span>
                <span className="text-zinc-200 font-medium">{releaseDate || 'N/A'}</span>
              </div>
              {titleDetails.budget ? (
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">Budget</span>
                  <span className="text-zinc-200 font-medium">${(titleDetails.budget / 1000000).toFixed(0)}M</span>
                </div>
              ) : null}
              {titleDetails.revenue ? (
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">Box Office Revenue</span>
                  <span className="text-emerald-400 font-semibold">${(titleDetails.revenue / 1000000).toFixed(0)}M</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Similar & Recommendations Reel */}
      {similarItems.length > 0 && (
        <div className="pt-8">
          <SectionCarousel
            title="More Like This"
            subtitle="Recommended titles based on mood, genre, and audience ratings"
            items={similarItems}
          />
        </div>
      )}
    </div>
  );
}
