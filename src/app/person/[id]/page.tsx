import React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { User, Film, Calendar, MapPin, Star, Sparkles } from 'lucide-react';
import { getPersonDetails, getImageURL } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';

interface PersonPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const revalidate = 3600;

export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params;
  const person = await getPersonDetails(id);

  const photoUrl = getImageURL(person.profile_path, 'w500');
  const filmography = [
    ...(person.combined_credits?.cast || []),
    ...(person.combined_credits?.crew || []),
  ];

  // Remove duplicates by id
  const uniqueCredits = Array.from(new Map(filmography.map((item) => [item.id, item])).values());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Profile Header */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-start shadow-xl">
        {/* Photo */}
        <div className="relative w-44 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border-2 border-zinc-700 shrink-0 mx-auto md:mx-0 shadow-2xl">
          <Image
            src={photoUrl}
            alt={person.name}
            fill
            priority
            sizes="(max-width: 768px) 180px, 240px"
            className="object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4 text-left">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              {person.known_for_department || 'Artist / Cast'}
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white">{person.name}</h1>
          </div>

          {/* Quick Meta */}
          <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
            {person.birthday && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Born: {person.birthday}
              </span>
            )}
            {person.place_of_birth && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                {person.place_of_birth}
              </span>
            )}
            {person.popularity > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Popularity Score: {person.popularity.toFixed(1)}
              </span>
            )}
          </div>

          {/* Biography */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">Biography</h3>
            <p className="text-sm text-zinc-300 leading-relaxed max-h-60 overflow-y-auto pr-2">
              {person.biography || `${person.name} is an acclaimed contributor in the entertainment industry.`}
            </p>
          </div>
        </div>
      </div>

      {/* Filmography Reel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-amber-400" />
            Known For & Filmography
          </h2>
          <span className="text-xs text-zinc-400 font-medium">({uniqueCredits.length} titles)</span>
        </div>

        {uniqueCredits.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {uniqueCredits.map((item) => (
              <MovieCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400 py-10 text-center">No filmography listed for this person.</p>
        )}
      </div>
    </div>
  );
}
