'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { TitleDetails } from '@/types';
import MovieCard from './MovieCard';

interface SectionCarouselProps {
  title: string;
  subtitle?: string;
  items: TitleDetails[];
  viewAllLink?: string;
  icon?: React.ReactNode;
}

export const SectionCarousel: React.FC<SectionCarouselProps> = ({
  title,
  subtitle,
  items,
  viewAllLink,
  icon,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              {icon && <span className="text-amber-400">{icon}</span>}
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h2>
            </div>
            {subtitle && <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">
            {viewAllLink && (
              <Link
                href={viewAllLink}
                className="hidden sm:flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors mr-2"
              >
                Explore All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            {/* Scroll Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleScroll('left')}
                className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
                aria-label="Scroll left"
                suppressHydrationWarning
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleScroll('right')}
                className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
                aria-label="Scroll right"
                suppressHydrationWarning
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 no-scrollbar snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, idx) => (
            <div
              key={`${item.media_type}-${item.id}-${idx}`}
              className="w-[160px] sm:w-[190px] md:w-[210px] shrink-0 snap-start"
            >
              <MovieCard item={item} priority={idx < 4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SectionCarousel;
