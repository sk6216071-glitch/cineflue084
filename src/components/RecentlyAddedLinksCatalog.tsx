'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Link2,
  Clock,
  ExternalLink,
  Film,
  Subtitles,
  MessageSquare,
  Download,
  Tag,
  Globe,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { CustomLink, WatchlistItem } from '@/types';
import { getImageURL } from '@/lib/tmdb';

interface FlattenedCustomLinkItem {
  link: CustomLink;
  movie: {
    id: number;
    title: string;
    mediaType: 'movie' | 'tv';
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
  };
}

// Fallback curated community links if user has none
const COMMUNITY_RECENT_LINKS: FlattenedCustomLinkItem[] = [
  {
    movie: {
      id: 872585,
      title: 'Oppenheimer',
      mediaType: 'movie',
      poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
      backdrop_path: '/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
      release_date: '2023-07-21',
      vote_average: 8.1,
    },
    link: {
      id: 'demo-link-1',
      title: 'Making of Oppenheimer (60-Min IMAX Doc)',
      url: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
      category: 'Official',
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
    },
  },
  {
    movie: {
      id: 693134,
      title: 'Dune: Part Two',
      mediaType: 'movie',
      poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
      backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s520QIq.jpg',
      release_date: '2024-03-01',
      vote_average: 8.3,
    },
    link: {
      id: 'demo-link-2',
      title: 'Frank Herbert Lore & Novel Breakdown',
      url: 'https://www.youtube.com/results?search_query=dune+part+2+book+breakdown',
      category: 'Review',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    },
  },
  {
    movie: {
      id: 157336,
      title: 'Interstellar',
      mediaType: 'movie',
      poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      backdrop_path: '/rAiYTAppmDnUTBnv87RiZHagM9H.jpg',
      release_date: '2014-11-07',
      vote_average: 8.4,
    },
    link: {
      id: 'demo-link-3',
      title: 'Kip Thorne Theoretical Physics Whitepaper',
      url: 'https://en.wikipedia.org/wiki/Interstellar_(film)#Scientific_accuracy',
      category: 'Discussion',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
    },
  },
  {
    movie: {
      id: 1396,
      title: 'Breaking Bad',
      mediaType: 'tv',
      poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
      backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
      release_date: '2008-01-20',
      vote_average: 8.9,
    },
    link: {
      id: 'demo-link-4',
      title: 'Series Retrospective & Ozymandias Script',
      url: 'https://reddit.com/r/breakingbad',
      category: 'Discussion',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(), // 22 hours ago
    },
  },
  {
    movie: {
      id: 27205,
      title: 'Inception',
      mediaType: 'movie',
      poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
      backdrop_path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
      release_date: '2010-07-16',
      vote_average: 8.4,
    },
    link: {
      id: 'demo-link-5',
      title: 'Hans Zimmer - Time (Orchestral Live in Prague)',
      url: 'https://open.spotify.com/search/Inception%20Time%20Hans%20Zimmer',
      category: 'Streaming',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 1.5 days ago
    },
  },
  {
    movie: {
      id: 575264,
      title: 'Mission: Impossible - Dead Reckoning',
      mediaType: 'movie',
      poster_path: '/NNxYkU70HPurnNCSiCjYAmacwm.jpg',
      backdrop_path: '/628Dep6AxEtDxjZoGP78TsOxYbK.jpg',
      release_date: '2023-07-12',
      vote_average: 7.7,
    },
    link: {
      id: 'demo-link-6',
      title: 'Motorcycle Cliff Jump Stunt Featurette',
      url: 'https://www.youtube.com/results?search_query=mission+impossible+dead+reckoning+stunt',
      category: 'Official',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), // 2 days ago
    },
  },
];

const CATEGORIES: CustomLink['category'][] = [
  'Recent',
  'Streaming',
  'Subtitles',
  'Discussion',
  'Review',
  'Download',
  'Official',
  'Other',
];

export const RecentlyAddedLinksCatalog: React.FC = () => {
  const { watchlist, isMounted } = useWatchlist();
  const [activeCategory, setActiveCategory] = useState<'All' | CustomLink['category']>('All');

  // Extract all custom links across the user's watchlist
  const allLinks = useMemo(() => {
    if (!isMounted) return COMMUNITY_RECENT_LINKS;

    const extracted: FlattenedCustomLinkItem[] = [];

    watchlist.forEach((item) => {
      if (item.customLinks && item.customLinks.length > 0) {
        item.customLinks.forEach((link) => {
          extracted.push({
            link,
            movie: {
              id: item.id,
              title: item.title,
              mediaType: item.mediaType,
              poster_path: item.poster_path,
              backdrop_path: item.backdrop_path,
              release_date: item.release_date,
              vote_average: item.vote_average,
            },
          });
        });
      }
    });

    // If user has saved custom links, sort them newest first. If none yet, merge with community catalog!
    if (extracted.length > 0) {
      return extracted.sort(
        (a, b) => new Date(b.link.createdAt).getTime() - new Date(a.link.createdAt).getTime()
      );
    }

    return COMMUNITY_RECENT_LINKS;
  }, [watchlist, isMounted]);

  // Filtered links
  const filteredLinks = useMemo(() => {
    if (activeCategory === 'All') return allLinks;
    if (activeCategory === 'Recent') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return allLinks.filter(
        (item) =>
          item.link.category === 'Recent' ||
          new Date(item.link.createdAt).getTime() > sevenDaysAgo
      );
    }
    return allLinks.filter((item) => item.link.category === activeCategory);
  }, [allLinks, activeCategory]);

  const getCategoryBadgeColor = (cat: CustomLink['category']) => {
    switch (cat) {
      case 'Recent':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      case 'Streaming':
        return 'bg-red-500/15 text-red-300 border-red-500/40';
      case 'Subtitles':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
      case 'Discussion':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      case 'Download':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'Review':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
      case 'Official':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getCategoryIcon = (cat: CustomLink['category']) => {
    switch (cat) {
      case 'Recent':
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case 'Streaming':
        return <Film className="w-3.5 h-3.5 text-red-400" />;
      case 'Subtitles':
        return <Subtitles className="w-3.5 h-3.5 text-sky-400" />;
      case 'Discussion':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;
      case 'Download':
        return <Download className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Review':
        return <Tag className="w-3.5 h-3.5 text-purple-400" />;
      case 'Official':
        return <Globe className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Link2 className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString();
    } catch {
      return 'Recently added';
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="bg-gradient-to-r from-[#0d141e] via-[#0f121a] to-[#0d1217] border border-amber-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Catalog Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-md">
                <Clock className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                Curated Destinations & Links
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Recently Added Custom Links
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Instant access to community & user-attached external links across streaming, 4K video sources, subtitles, Reddit theories, and making-of specials.
            </p>
          </div>

          <Link
            href="/watchlist"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-amber-500/30 font-semibold text-xs transition-colors self-start md:self-auto"
          >
            <span>My Cinema Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
          <button
            onClick={() => setActiveCategory('All')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              activeCategory === 'All'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 scale-105'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            All Links ({allLinks.length})
          </button>

          <button
            onClick={() => setActiveCategory('Recent')}
            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              activeCategory === 'Recent'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 scale-105'
                : 'bg-zinc-900 text-amber-400/90 hover:text-amber-300 border border-amber-500/30'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recent</span>
          </button>

          {CATEGORIES.filter((c) => c !== 'Recent').map((cat) => {
            const count = allLinks.filter((l) => l.link.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 scale-105'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {getCategoryIcon(cat)}
                <span>{cat}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Catalog Showcase Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.slice(0, 9).map((item) => (
            <div
              key={item.link.id}
              className="group relative bg-[#10131b]/95 hover:bg-[#151924] border border-white/10 hover:border-amber-400/60 rounded-2xl p-4 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1.5 flex flex-col justify-between"
            >
              {/* Top Row: Movie Thumbnail + Title + Link */}
              <div className="flex items-start gap-3.5">
                <Link
                  href={`/${item.movie.mediaType}/${item.movie.id}`}
                  className="relative w-12 h-16 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10 group-hover:scale-105 transition-transform"
                >
                  <Image
                    src={getImageURL(item.movie.poster_path, 'w200')}
                    alt={item.movie.title}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </Link>

                <div className="space-y-1 overflow-hidden">
                  <Link
                    href={`/${item.movie.mediaType}/${item.movie.id}`}
                    className="text-xs font-bold text-zinc-300 hover:text-amber-400 transition-colors block truncate"
                  >
                    {item.movie.title}
                  </Link>

                  <a
                    href={item.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-extrabold text-white group-hover:text-amber-300 transition-colors block line-clamp-2 leading-snug"
                    title={item.link.title}
                  >
                    {item.link.title}
                  </a>
                </div>
              </div>

              {/* Bottom Row: Category Pill + Relative Time + Launch Button */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${getCategoryBadgeColor(
                      item.link.category
                    )}`}
                  >
                    {getCategoryIcon(item.link.category)}
                    {item.link.category}
                  </span>

                  <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {formatRelativeTime(item.link.createdAt)}
                  </span>
                </div>

                <a
                  href={item.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-[11px] border border-amber-500/30 transition-all hover:scale-105"
                  title="Open destination"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecentlyAddedLinksCatalog;
