'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Link2,
  Plus,
  ExternalLink,
  Trash2,
  Pencil,
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
  X,
} from 'lucide-react';
import { TitleDetails, CustomLink, WatchProviderInfo } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';
import { getImageURL } from '@/lib/tmdb';
import {
  getConsolidatedCustomLinks,
  saveGlobalCustomLink,
  updateGlobalCustomLink,
  deleteGlobalCustomLink,
} from '@/lib/curatedLinks';
import { getRealAvailableStreamingProviders } from '@/lib/ottLinks';
import { parseFullMediaTitle } from '@/lib/seasonParser';
import TVEpisodeLinksManager from './TVEpisodeLinksManager';
import TrailerModal from './TrailerModal';

interface CustomLinksManagerProps {
  titleDetails: TitleDetails;
}

const CATEGORIES: CustomLink['category'][] = [
  'Recent',
  'Streaming',
  'Download',
  'Discussion',
  'Subtitles',
  'Official',
  'Review',
];

export const CustomLinksManager: React.FC<CustomLinksManagerProps> = ({ titleDetails }) => {
  const { watchlist, addCustomLink, removeCustomLink, isMounted, settings, addToWatchlist } = useWatchlist();
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<CustomLink['category']>('Streaming');
  const [error, setError] = useState('');
  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(null);
  const [linksRefresh, setLinksRefresh] = useState(0);

  // Edit Modal State
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editCategory, setEditCategory] = useState<CustomLink['category']>('Streaming');
  const [editQuality, setEditQuality] = useState('');
  const [editAudio, setEditAudio] = useState('');
  const [editSize, setEditSize] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('cinefuel_admin_auth');
      if (auth) {
        try {
          const parsed = JSON.parse(auth);
          setIsAdmin(parsed?.isLoggedIn && parsed?.user === 'shyam');
        } catch {
          setIsAdmin(false);
        }
      }
    }
  }, [isMounted]);

  // Consolidated Custom Links (Global Admin Storage + User LocalStorage)
  const userCustomLinks = useMemo(() => {
    if (!isMounted) return [];
    return getConsolidatedCustomLinks(titleDetails.id);
  }, [titleDetails.id, isMounted, linksRefresh]);

  // Filter links by category
  const filteredCustomLinks = useMemo(() => {
    if (activeCategoryFilter === 'All') return userCustomLinks;
    if (activeCategoryFilter === 'Recent') {
      const now = new Date().getTime();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      return userCustomLinks.filter(
        (l) => new Date(l.createdAt).getTime() > threeDaysAgo
      );
    }
    return userCustomLinks.filter((l) => l.category === activeCategoryFilter);
  }, [userCustomLinks, activeCategoryFilter]);

  const existing = isMounted ? watchlist.find((w) => w.id === titleDetails.id) : undefined;
  const imdbId = titleDetails.external_ids?.imdb_id;
  const tmdbId = titleDetails.id;
  const mediaType = titleDetails.media_type || (titleDetails.name ? 'tv' : 'movie');
  const titleName = titleDetails.title || titleDetails.name || 'Title';
  const releaseYear = (titleDetails.release_date || titleDetails.first_air_date || '').split('-')[0];
  const queryName = `${titleName} ${releaseYear}`.trim();

  // Gather Built-in Links
  const region = settings.defaultRegion || 'IN';

  const { availableList, justwatchUrl, hasSubscription } = useMemo(() => {
    return getRealAvailableStreamingProviders(
      titleDetails.id,
      titleName,
      mediaType as any,
      titleDetails['watch/providers']?.results?.[region] || titleDetails['watch/providers']?.results?.['IN'],
      region
    );
  }, [titleDetails.id, titleName, mediaType, region, titleDetails]);

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

    const parsed = parseFullMediaTitle(title.trim());

    const newLinkObj: CustomLink = {
      id: `link-${Date.now()}`,
      title: title.trim(),
      url: finalUrl,
      category,
      createdAt: new Date().toISOString(),
      seasonNumber: parsed.seasonNumber,
      episodeNumber: parsed.episodeNumber,
      linkType: parsed.linkType,
      quality: parsed.quality,
      audioLanguage: parsed.audioLanguage,
      size: parsed.size,
    };

    saveGlobalCustomLink(titleDetails.id, newLinkObj);

    addCustomLink(titleDetails.id, {
      title: title.trim(),
      url: finalUrl,
      category,
    });

    setTitle('');
    setUrl('');
    setError('');
    setIsOpenForm(false);
    setLinksRefresh((v) => v + 1);
  };

  const handleStartEdit = (link: CustomLink) => {
    setEditingLink(link);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditCategory(link.category || 'Streaming');
    setEditQuality(link.quality || '');
    setEditAudio(link.audioLanguage || '');
    setEditSize(link.size || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editTitle.trim() || !editUrl.trim()) return;

    let finalUrl = editUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    const parsed = parseFullMediaTitle(editTitle.trim());

    const updatedLink: CustomLink = {
      ...editingLink,
      title: editTitle.trim(),
      url: finalUrl,
      category: editCategory,
      seasonNumber: parsed.seasonNumber || editingLink.seasonNumber,
      episodeNumber: parsed.episodeNumber !== undefined ? parsed.episodeNumber : editingLink.episodeNumber,
      linkType: parsed.linkType || editingLink.linkType,
      quality: editQuality.trim() || parsed.quality || editingLink.quality,
      audioLanguage: editAudio.trim() || parsed.audioLanguage || editingLink.audioLanguage,
      size: editSize.trim() || parsed.size || editingLink.size,
    };

    updateGlobalCustomLink(titleDetails.id, updatedLink);
    setEditingLink(null);
    setLinksRefresh((v) => v + 1);
  };

  const handleDelete = (linkId: string) => {
    if (confirm('Delete this custom link permanently?')) {
      deleteGlobalCustomLink(titleDetails.id, linkId);
      removeCustomLink(titleDetails.id, linkId);
      setLinksRefresh((v) => v + 1);
    }
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
        return <Globe className="w-4 h-4 text-sky-400" />;
      default:
        return <Link2 className="w-4 h-4 text-amber-400" />;
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    try {
      const now = new Date().getTime();
      const diff = now - new Date(dateStr).getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) return 'Just now';
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Added';
    }
  };

  return (
    <div className="bg-[#0f121a] border border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white">Title Links & Destinations</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Streaming platforms, trailers, review portals, and verified admin custom links.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsOpenForm(!isOpenForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs transition-all shadow-md shadow-amber-500/10 hover:scale-105 active:scale-95 self-start sm:self-auto"
            suppressHydrationWarning
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Custom Link</span>
          </button>
        )}
      </div>

      {/* 1. Streaming Links Section (Only Show Actually Available Platforms) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-red-400" /> Streaming & OTT Services (India)
          </h4>
          <span className="text-[10px] text-zinc-500 font-medium">
            {availableList.length > 0 ? `${availableList.length} verified platform${availableList.length > 1 ? 's' : ''}` : 'Digital / Rent Only'}
          </span>
        </div>

        {availableList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availableList.map((item) => (
              <a
                key={item.key}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 ${item.accentBorder} hover:bg-zinc-800/90 transition-all group shadow-sm`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-md shrink-0"
                    style={{ backgroundColor: item.logoBg }}
                  >
                    {item.logoText}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold text-white ${item.accentText} transition-colors block truncate`}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span
                        className={`font-semibold px-1 rounded text-[9px] ${
                          item.tier === 'Subscription'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.tier === 'Rent'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {item.tier}
                      </span>
                      <span className="text-zinc-500 truncate">{item.subtext}</span>
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
              </a>
            ))}

            {/* JustWatch Live Finder */}
            <a
              href={justwatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 transition-all group shadow-sm sm:col-span-2"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-black flex items-center justify-center font-black text-xs shadow-md shrink-0">
                  JW
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 transition-colors block flex items-center gap-1.5">
                    JustWatch Streaming & Price Guide
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] uppercase tracking-wider font-extrabold">Live</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">Live 4K streaming availability, rental prices & OTT plan tracker</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300 transition-colors shrink-0" />
            </a>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-dashed border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="text-xs font-semibold text-zinc-300">
                Not currently streaming on major subscription platforms in India
              </p>
              <p className="text-[11px] text-zinc-500">
                Check digital rent/purchase options or see custom community links below.
              </p>
            </div>
            <a
              href={justwatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-xs border border-amber-500/30 transition-all shrink-0 flex items-center gap-1.5"
            >
              <span>Check on JustWatch</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* 1.5 TV Series Season & Episode Vault */}
      {mediaType === 'tv' && (
        <TVEpisodeLinksManager
          titleDetails={titleDetails}
          customLinks={userCustomLinks}
          isAdmin={isAdmin}
          onLinkAdded={() => setLinksRefresh((v) => v + 1)}
        />
      )}

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
                    Search YouTube Trailer
                  </span>
                  <span className="text-[10px] text-zinc-400">Video Search</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400 transition-colors" />
            </a>
          )}

          {/* Spotify Soundtrack */}
          <a
            href={`https://open.spotify.com/search/${encodeURIComponent(titleName + ' soundtrack')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-emerald-500/60 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 flex items-center justify-center shadow-md font-black text-xs">
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

      {/* 3. Official Databases & Reviews (IMDb, TMDB, SIMKL) */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Databases & Reviews (IMDb • TMDB • SIMKL)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* IMDb */}
          <a
            href={imdbId ? `https://www.imdb.com/title/${imdbId}` : `https://www.imdb.com/find?q=${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-400/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#f5c518] text-black flex items-center justify-center font-black text-xs shadow-md">
                IMDb
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors block">
                  IMDb Database
                </span>
                <span className="text-[10px] text-zinc-400">Official Cast, Trivia & Ratings</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
          </a>

          {/* TMDB */}
          <a
            href={`https://www.themoviedb.org/${mediaType}/${tmdbId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-emerald-400/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#01d277] text-black flex items-center justify-center font-black text-[10px] shadow-md">
                TMDB
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors block">
                  TMDB Database
                </span>
                <span className="text-[10px] text-zinc-400">Community Metadata & Crew</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </a>

          {/* SIMKL */}
          <a
            href={`https://simkl.com/search/?q=${encodeURIComponent(queryName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-sky-500/70 hover:bg-zinc-800/90 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00A3FF] text-black flex items-center justify-center font-black text-xs shadow-md">
                SIMKL
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors block">
                  SIMKL Vault
                </span>
                <span className="text-[10px] text-zinc-400">Watchlist Sync & Scrobbler</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400 transition-colors" />
          </a>
        </div>
      </div>

      {/* 4. User Custom Attached Links with Category Filters & Admin Edit/Delete */}
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
                className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/30 hover:border-amber-400/60 hover:bg-zinc-800/80 transition-all gap-3 group shadow-md"
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
                    <>
                      <button
                        onClick={() => handleStartEdit(custom)}
                        className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="Admin: Edit link"
                        suppressHydrationWarning
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(custom.id)}
                        className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Admin: Delete link permanently"
                        suppressHydrationWarning
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-1.5">
            <p className="text-xs text-zinc-400">
              {isAdmin
                ? 'No custom links added yet for this title.'
                : 'No custom links published by Admin for this title yet.'}
            </p>
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

      {/* Add Custom Link Interactive Form (Admin Only) */}
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

      {/* Edit Custom Link Modal (Admin Only) */}
      {isAdmin && editingLink && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141d] border border-amber-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Edit Custom Link
                </h4>
              </div>
              <button
                onClick={() => setEditingLink(null)}
                className="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Title / Label
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Destination URL
                </label>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                  Category Tag
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        editCategory === cat
                          ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Quality</label>
                  <input
                    type="text"
                    placeholder="e.g. 1080p, 4K"
                    value={editQuality}
                    onChange={(e) => setEditQuality(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Audio</label>
                  <input
                    type="text"
                    placeholder="e.g. Hindi, English"
                    value={editAudio}
                    onChange={(e) => setEditAudio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.2 GB"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-md hover:scale-105"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
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
