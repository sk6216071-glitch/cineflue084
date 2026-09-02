'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Link2,
  Plus,
  ExternalLink,
  Trash2,
  Tag,
  Globe,
  MessageSquare,
  Subtitles,
  Film,
  Download,
  Play,
  Tv,
  Check,
  Share2,
  Sparkles,
  BookOpen,
  Search,
  Clock,
} from 'lucide-react';
import { TitleDetails, CustomLink, WatchProviderInfo } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';
import { getImageURL } from '@/lib/tmdb';
import TrailerModal from './TrailerModal';

interface CustomLinksManagerProps {
  titleDetails: TitleDetails;
}

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

export const CustomLinksManager: React.FC<CustomLinksManagerProps> = ({ titleDetails }) => {
  const { getItem, addCustomLink, removeCustomLink, addToWatchlist, settings, isMounted } = useWatchlist();
  const existing = isMounted ? getItem(titleDetails.id) : undefined;
  const userCustomLinks = existing?.customLinks || [];

  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<CustomLink['category']>('Recent');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'All' | CustomLink['category']>('All');
  const [error, setError] = useState('');
  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('cinefuel_admin_auth');
      setIsAdmin(auth === 'true');
    }
  }, []);

  // 1. Title Metadata & IDs
  const imdbId = titleDetails.external_ids?.imdb_id;
  const tmdbId = titleDetails.id;
  const mediaType = titleDetails.media_type || (titleDetails.name ? 'tv' : 'movie');
  const titleName = titleDetails.title || titleDetails.name || 'Title';
  const releaseYear = (titleDetails.release_date || titleDetails.first_air_date || '').split('-')[0];
  const queryName = `${titleName} ${releaseYear}`.trim();

  // 2. Gather Built-in Links
  const region = settings.defaultRegion || 'IN';
  const watchProviders = titleDetails['watch/providers']?.results?.[region] ||
    titleDetails['watch/providers']?.results?.['IN'] || {
      flatrate: [
        { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
        { provider_id: 119, provider_name: 'Prime Video', logo_path: '/emthp39XA2zhcoYLhp9ow8056vB.jpg' },
        { provider_id: 122, provider_name: 'Disney+ Hotstar', logo_path: '/7rwgEsUBqf26m67nO8f9kky11.jpg' },
        { provider_id: 220, provider_name: 'JioCinema', logo_path: '/pTnn5JwWr4p3.jpg' },
      ],
    };

  const streamingProviders: WatchProviderInfo[] = [
    ...(watchProviders.flatrate || []),
    ...(watchProviders.free || []),
    ...(watchProviders.rent || []),
  ];

  const mainTrailer = titleDetails.videos?.results?.find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      setError('Please provide both a label and a valid URL.');
      return;
    }

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    if (!existing) {
      addToWatchlist(titleDetails, 'watchlist');
    }

    addCustomLink(titleDetails.id, {
      title: title.trim(),
      url: finalUrl,
      category,
    });

    setTitle('');
    setUrl('');
    setError('');
    setIsOpenForm(false);
  };

  const getCategoryIcon = (cat: CustomLink['category']) => {
    switch (cat) {
      case 'Recent':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'Streaming':
        return <Film className="w-4 h-4 text-red-400" />;
      case 'Subtitles':
        return <Subtitles className="w-4 h-4 text-sky-400" />;
      case 'Discussion':
        return <MessageSquare className="w-4 h-4 text-amber-400" />;
      case 'Download':
        return <Download className="w-4 h-4 text-emerald-400" />;
      case 'Review':
        return <Tag className="w-4 h-4 text-purple-400" />;
      case 'Official':
        return <Globe className="w-4 h-4 text-indigo-400" />;
      default:
        return <Link2 className="w-4 h-4 text-zinc-400" />;
    }
  };

  // Filtered and sorted custom links
  const filteredCustomLinks = useMemo(() => {
    // Sort newest first
    const sorted = [...userCustomLinks].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (activeCategoryFilter === 'All') return sorted;
    if (activeCategoryFilter === 'Recent') {
      // Recent category includes either category === 'Recent' or added in last 14 days
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      return sorted.filter(
        (l) => l.category === 'Recent' || new Date(l.createdAt).getTime() > twoWeeksAgo
      );
    }
    return sorted.filter((l) => l.category === activeCategoryFilter);
  }, [userCustomLinks, activeCategoryFilter]);

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
      return 'Recent';
    }
  };

  return (
    <div className="bg-[#0f121a] border border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-xl space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white">Title Links & Destinations</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Streaming platforms, trailers, review portals, subtitle sources, and custom user-saved links.
          </p>
        </div>

        <button
          onClick={() => setIsOpenForm(!isOpenForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/10 hover:scale-105 active:scale-95 self-start sm:self-auto"
          suppressHydrationWarning
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Custom Link</span>
        </button>
      </div>

      {/* 1. Streaming Links Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Tv className="w-3.5 h-3.5 text-red-400" /> Streaming & OTT Services
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Netflix */}
          <a
            href={`https://www.netflix.com/search?q=${encodeURIComponent(titleName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-red-600 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#E50914] flex items-center justify-center font-black text-white text-xs shadow-md">
                N
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-red-400 transition-colors block">
                  Netflix
                </span>
                <span className="text-[10px] text-zinc-400">Watch on Netflix</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400 transition-colors" />
          </a>

          {/* Prime Video */}
          <a
            href={`https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(titleName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-sky-500 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#00A8E1] flex items-center justify-center font-black text-white text-[11px] shadow-md">
                PV
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors block">
                  Prime Video
                </span>
                <span className="text-[10px] text-zinc-400">Stream on Prime</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400 transition-colors" />
          </a>

          {/* Disney+ Hotstar */}
          <a
            href={`https://www.hotstar.com/in/explore?search_query=${encodeURIComponent(titleName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-blue-500 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#00147B] flex items-center justify-center font-black text-blue-400 text-xs shadow-md">
                D+
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors block">
                  Disney+ Hotstar
                </span>
                <span className="text-[10px] text-zinc-400">Hotstar India</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
          </a>

          {/* JioCinema */}
          <a
            href={`https://www.jiocinema.com/search/${encodeURIComponent(titleName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-pink-500 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#D3007B] flex items-center justify-center font-black text-white text-xs shadow-md">
                Jio
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-pink-400 transition-colors block">
                  JioCinema
                </span>
                <span className="text-[10px] text-zinc-400">JioCinema OTT</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-pink-400 transition-colors" />
          </a>

          {/* Apple TV+ */}
          <a
            href={`https://tv.apple.com/search?term=${encodeURIComponent(titleName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center font-bold text-white text-xs shadow-md">
                tv+
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-zinc-200 transition-colors block">
                  Apple TV+
                </span>
                <span className="text-[10px] text-zinc-400">Stream / Rent</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
          </a>

          {/* YouTube Movies */}
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(queryName)}+full+movie`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-red-500 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
                <Play className="w-3.5 h-3.5 fill-white" />
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-red-400 transition-colors block">
                  YouTube Movies
                </span>
                <span className="text-[10px] text-zinc-400">Rent / Purchase</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400 transition-colors" />
          </a>
        </div>
      </div>

      {/* 2. Official Trailer & Video Launchers */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Play className="w-3.5 h-3.5 text-red-500" /> Trailers & Media
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {mainTrailer ? (
            <button
              onClick={() => setActiveTrailerKey(mainTrailer.key)}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-400/60 hover:bg-zinc-800/90 transition-all group shadow-sm text-left"
              suppressHydrationWarning
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-500 border border-red-500/40 flex items-center justify-center shadow-md">
                  <Play className="w-3.5 h-3.5 fill-red-500" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors block">
                    Official Main Trailer
                  </span>
                  <span className="text-[10px] text-amber-400">Instant Player Modal</span>
                </div>
              </div>
              <Play className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </button>
          ) : (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(queryName)}+official+trailer`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-red-500 hover:bg-zinc-800/90 transition-all group shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-500 border border-red-500/40 flex items-center justify-center shadow-md">
                  <Play className="w-3.5 h-3.5 fill-red-500" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white group-hover:text-red-400 transition-colors block">
                    YouTube Trailer Search
                  </span>
                  <span className="text-[10px] text-zinc-400">Official Channels</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400 transition-colors" />
            </a>
          )}

          {/* Soundtrack Search */}
          <a
            href={`https://open.spotify.com/search/${encodeURIComponent(queryName)}+soundtrack`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-emerald-500 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shadow-md">
                ♫
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors block">
                  Original Soundtrack (OST)
                </span>
                <span className="text-[10px] text-zinc-400">Spotify Music</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </a>
        </div>
      </div>

      {/* 3. Databases, Reviews & Wikipedia Links */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Databases & Reviews
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* IMDb */}
          <a
            href={imdbId ? `https://www.imdb.com/title/${imdbId}` : `https://www.imdb.com/find?q=${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-400/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#f5c518] text-black flex items-center justify-center font-black text-[10px] shadow-md">
                IMDb
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors block">
                  IMDb Title
                </span>
                <span className="text-[10px] text-zinc-400">Ratings & Trivia</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
          </a>

          {/* TMDB */}
          <a
            href={`https://www.themoviedb.org/${mediaType}/${tmdbId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-sky-400/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#01d277] text-black flex items-center justify-center font-black text-[9px] shadow-md">
                TMDB
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors block">
                  TMDB Database
                </span>
                <span className="text-[10px] text-zinc-400">Cast & Metadata</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400 transition-colors" />
          </a>

          {/* SIMKL */}
          <a
            href={`https://simkl.com/search/?q=${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-sky-500/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#00A3FF] text-black flex items-center justify-center font-black text-xs shadow-md">
                S
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors block">
                  SIMKL
                </span>
                <span className="text-[10px] text-zinc-400">Track & Scrobble</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400 transition-colors" />
          </a>

          {/* MDBList */}
          <a
            href={`https://mdblist.com/search/?q=${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-emerald-400/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 text-black flex items-center justify-center font-black text-xs shadow-md">
                M
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors block">
                  MDBList
                </span>
                <span className="text-[10px] text-zinc-400">Aggregated Ratings</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </a>

          {/* Letterboxd */}
          <a
            href={`https://letterboxd.com/search/${encodeURIComponent(titleName)}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-emerald-400/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#00e054] text-black flex items-center justify-center font-black text-xs shadow-md">
                L
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors block">
                  Letterboxd
                </span>
                <span className="text-[10px] text-zinc-400">Community Reviews</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </a>

          {/* Rotten Tomatoes */}
          <a
            href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(titleName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-red-500/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#FA320A] text-white flex items-center justify-center font-black text-xs shadow-md">
                🍅
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-red-400 transition-colors block">
                  Rotten Tomatoes
                </span>
                <span className="text-[10px] text-zinc-400">Tomatometer Score</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400 transition-colors" />
          </a>

          {/* Wikipedia */}
          <a
            href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-400 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-700 text-white flex items-center justify-center font-bold text-xs shadow-md">
                W
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-zinc-200 transition-colors block">
                  Wikipedia
                </span>
                <span className="text-[10px] text-zinc-400">Encyclopedia Entry</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
          </a>

          {/* Subtitles (OpenSubtitles) */}
          <a
            href={`https://www.opensubtitles.org/en/search2/sublanguageid-all/moviename-${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-sky-400/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-600/30 text-sky-400 border border-sky-500/40 flex items-center justify-center font-bold text-xs shadow-md">
                <Subtitles className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors block">
                  Subtitles
                </span>
                <span className="text-[10px] text-zinc-400">OpenSubtitles</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400 transition-colors" />
          </a>

          {/* Reddit Discussion */}
          <a
            href={`https://www.reddit.com/r/movies/search/?q=${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-orange-500/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#FF4500] text-white flex items-center justify-center font-black text-xs shadow-md">
                r/
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors block">
                  Reddit Discussions
                </span>
                <span className="text-[10px] text-zinc-400">r/movies & theories</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400 transition-colors" />
          </a>
        </div>
      </div>

      {/* 4. User Custom Attached Links with Category Filters */}
      <div className="space-y-4 pt-2 border-t border-zinc-800/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Custom Saved Links ({userCustomLinks.length})</span>
          </h4>

          {/* Category Filter Pills */}
          {userCustomLinks.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              <button
                onClick={() => setActiveCategoryFilter('All')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  activeCategoryFilter === 'All'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
                suppressHydrationWarning
              >
                All ({userCustomLinks.length})
              </button>

              <button
                onClick={() => setActiveCategoryFilter('Recent')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                  activeCategoryFilter === 'Recent'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-zinc-900 text-amber-400/90 hover:text-amber-300 border border-amber-500/20'
                }`}
                suppressHydrationWarning
              >
                <Clock className="w-3 h-3" /> Recent
              </button>

              {CATEGORIES.filter((c) => c !== 'Recent').map((cat) => {
                const count = userCustomLinks.filter((l) => l.category === cat).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      activeCategoryFilter === cat
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                    suppressHydrationWarning
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {filteredCustomLinks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCustomLinks.map((custom) => (
              <div
                key={custom.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/30 hover:border-amber-400/60 hover:bg-zinc-800/80 transition-all group shadow-md"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    {getCategoryIcon(custom.category)}
                  </div>
                  <div className="overflow-hidden">
                    <a
                      href={custom.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-white hover:text-amber-400 transition-colors block truncate"
                      title={custom.title}
                    >
                      {custom.title}
                    </a>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate">
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                        {custom.category}
                      </span>
                      <span>•</span>
                      <span className="text-zinc-500">{formatRelativeTime(custom.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <a
                    href={custom.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                    title="Open link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => removeCustomLink(titleDetails.id, custom.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Admin: Remove link"
                      suppressHydrationWarning
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-1">
            <p className="text-xs text-zinc-400">No custom links in this category yet.</p>
            {isAdmin && (
              <button
                onClick={() => setIsOpenForm(true)}
                className="text-xs text-amber-400 font-bold hover:underline"
                suppressHydrationWarning
              >
                + Add First Custom Link (Admin)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add More Links Interactive Form (Admin Only) */}
      {isAdmin && isOpenForm && (
        <form
          onSubmit={handleAddLink}
          className="bg-zinc-900/95 border border-amber-500/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Attach Custom Link to &quot;{titleName}&quot;
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpenForm(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                Link Title / Label
              </label>
              <input
                type="text"
                placeholder="e.g. 4K Web Stream, OpenSubtitles English, Reddit Discussion"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                Destination URL
              </label>
              <input
                type="text"
                placeholder="https://example.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category Selection Pills */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
              Category Tag
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    category === cat
                      ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80'
                  }`}
                >
                  {cat === 'Recent' && <Clock className="w-3 h-3" />}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsOpenForm(false)}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
            >
              Save Link
            </button>
          </div>
        </form>
      )}

      {/* Trailer Modal Trigger */}
      {activeTrailerKey && (
        <TrailerModal
          videoKey={activeTrailerKey}
          title={titleName}
          onClose={() => setActiveTrailerKey(null)}
        />
      )}
    </div>
  );
};

export default CustomLinksManager;
