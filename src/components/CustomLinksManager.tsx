'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Link2,
  ExternalLink,
  Trash2,
  Pencil,
  Tag,
  Globe,
  MessageSquare,
  Subtitles,
  Film,
  Download,
  Clock,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Flag,
  Sparkles,
} from 'lucide-react';
import { TitleDetails, CustomLink } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';
import {
  getConsolidatedCustomLinks,
  updateGlobalCustomLink,
  deleteGlobalCustomLink,
  getDeletedLinkIds,
} from '@/lib/curatedLinks';
import { parseFullMediaTitle, detectSize, stripWatermarks, getQualityWeight } from '@/lib/seasonParser';
import { detectServer } from '@/lib/serverDetector';
import TVEpisodeLinksManager from './TVEpisodeLinksManager';
import CollapsibleSection from './CollapsibleSection';
import RequestLinkModal from './RequestLinkModal';
import ReportBrokenLinkModal, { ReportModalData } from './ReportBrokenLinkModal';

interface CustomLinksManagerProps {
  titleDetails: TitleDetails;
}

const CATEGORIES: CustomLink['category'][] = [
  'Streaming',
  'Download',
  'Discussion',
  'Subtitles',
  'Official',
  'Review',
];

function detectResolution(quality?: string, title?: string): string {
  const cleanTitle = stripWatermarks(title || '');
  const cleanQuality = stripWatermarks(quality || '');

  // 1. Check title first (title is the true source of truth for the media file)
  if (/(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(cleanTitle)) return '1080p';
  if (/(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(cleanTitle)) return '720p';
  if (/(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(cleanTitle)) return '480p';
  if (/(?:^|[\s._\-[\]()])(?:2160p|2160i|\buhd\b|\b4k\b)(?:[\s._\-[\]()]|$)/i.test(cleanTitle)) return '2160p';

  // 2. Fallback to quality hint if title had no resolution tag
  if (/(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(cleanQuality)) return '1080p';
  if (/(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(cleanQuality)) return '720p';
  if (/(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(cleanQuality)) return '480p';
  if (/(?:^|[\s._\-[\]()])(?:2160p|2160i|\buhd\b|\b4k\b)(?:[\s._\-[\]()]|$)/i.test(cleanQuality)) return '2160p';

  return '1080p';
}


function detectSource(title?: string, quality?: string): string {
  const combined = `${title || ''} ${quality || ''}`.toLowerCase();
  if (/remux/i.test(combined)) return 'BluRay';
  if (/bluray|blu-ray|bdrip/i.test(combined)) return 'BluRay';
  if (/web-dl|webdl|webrip|web/i.test(combined)) return 'WEB-DL';
  if (/hdtv/i.test(combined)) return 'HDTV';
  if (/dvd|dvdrip/i.test(combined)) return 'DVD';
  return 'WEB-DL';
}

function getResolutionBadgeStyle(resolution: string): string {
  if (resolution.includes('2160p') || resolution.includes('4K') || resolution.includes('4k')) {
    return 'bg-[#f59e0b] text-black font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
  }
  if (resolution.includes('1080p')) {
    return 'bg-[#14223d] text-blue-400 border border-[#1e3a6a] font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
  }
  if (resolution.includes('720p')) {
    return 'bg-[#221838] text-purple-400 border border-[#3b2960] font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
  }
  return 'bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
}

function formatAudioLanguages(audio?: string, title?: string): string {
  const combined = `${audio || ''} ${title || ''}`.toLowerCase();
  const list: string[] = [];
  if (combined.includes('hindi') || combined.includes('hin')) list.push('Hindi');
  if (combined.includes('tamil') || combined.includes('tam')) list.push('Tamil');
  if (combined.includes('telugu') || combined.includes('tel')) list.push('Telugu');
  if (combined.includes('malayalam') || combined.includes('mal')) list.push('Malayalam');
  if (combined.includes('kannada') || combined.includes('kan')) list.push('Kannada');
  if (combined.includes('bengali') || combined.includes('ben')) list.push('Bengali');
  if (combined.includes('marathi') || combined.includes('mar')) list.push('Marathi');
  if (combined.includes('english') || combined.includes('eng')) list.push('English');
  if (combined.includes('japanese') || combined.includes('jap')) list.push('Japanese');
  if (combined.includes('korean') || combined.includes('kor')) list.push('Korean');
  if (combined.includes('spanish') || combined.includes('spa')) list.push('Spanish');
  if (combined.includes('french') || combined.includes('fre')) list.push('French');
  if (combined.includes('german') || combined.includes('ger')) list.push('German');

  // DUAL audio on Indian streaming scene indicates Hindi + English
  if (combined.includes('dual')) {
    if (!list.includes('Hindi')) list.unshift('Hindi');
    if (!list.includes('English')) list.push('English');
  }

  if (list.length > 0) {
    return list.join(', ');
  }

  if (audio && audio !== 'Original' && audio !== 'English') {
    return audio.replace(/\s*•\s*/g, ', ').replace(/\s*\+\s*/g, ', ');
  }

  return 'Hindi, English';
}


/**
 * Format movie download button label according to reference image:
 * e.g. "400mb 480p [HubCloud]", "1.5GB 720p [HubCloud]", "4GB 1080p [HubCloud]",
 * "3.5GB 1080p HEVC 10bit [HubCloud]", "8GB 1080p WebDL [HubCloud]",
 * "12GB 2160p SDR [HubCloud]", "16GB 2160p HDR [HubCloud]"
 * Renames GDTOT with HubCloud, GDFlix, or detected link server.
 */
export function formatMovieDownloadButtonTitle(link: CustomLink): string {
  const cleanTitle = stripWatermarks(link.title || '');
  const cleanQuality = stripWatermarks(link.quality || '');
  const combined = `${cleanTitle} ${cleanQuality} ${link.url || ''}`.toLowerCase();

  // 1. Detect Size:
  let size = link.size || detectSize(cleanTitle) || detectSize(link.url || '') || detectSize(cleanQuality) || '';
  if (size) {
    size = size.replace(/\s+/g, '').trim();
    if (/^\d+mb$/i.test(size)) {
      size = size.toLowerCase();
    } else {
      size = size.replace(/gb/i, 'GB').replace(/mb/i, 'MB');
    }
  }

  // 2. Detect Resolution:
  let resolution = '1080p';
  if (/(?:^|[\s._\-[\]()])(?:2160p|2160i|\buhd\b|\b4k\b)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '2160p';
  } else if (/(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '1080p';
  } else if (/(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '720p';
  } else if (/(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '480p';
  }

  // 3. Detect Dynamic Range / HDR / SDR / DV:
  const hasDV = /(?:^|[\s._\-[\]()])(?:dv|dovi|dolby[.\s_-]*vision)(?:[\s._\-[\]()]|$)/i.test(combined);
  const hasHDR = /(?:^|[\s._\-[\]()])(?:hdr10\+|hdr10|hdr)(?:[\s._\-[\]()]|$)/i.test(combined);
  const hasSDR = /(?:^|[\s._\-[\]()])sdr(?:[\s._\-[\]()]|$)/i.test(combined);

  // 4. Detect Codec (HEVC, 10bit):
  const is10Bit = /10bit|10-bit/i.test(combined);
  const isHEVC = /hevc|x265|h\.?265/i.test(combined);

  // 5. Detect Source (WebDL, BluRay, REMUX, HDTV):
  let source = '';
  if (/remux/i.test(combined)) source = 'REMUX';
  else if (/bluray|blu-ray|bdrip/i.test(combined)) source = 'BluRay';
  else if (/web-dl|webdl|webrip|web/i.test(combined)) source = 'WebDL';
  else if (/hdtv/i.test(combined)) source = 'HDTV';

  // 6. Build parts:
  const parts: string[] = [];
  if (size) parts.push(size);
  parts.push(resolution);

  if (resolution === '2160p') {
    if (hasDV && hasHDR) parts.push('DV HDR');
    else if (hasDV) parts.push('DV');
    else if (hasHDR) parts.push('HDR');
    else if (hasSDR) parts.push('SDR');
    else parts.push('SDR');

    if (source && source !== 'WebDL') parts.push(source);
  } else if (resolution === '1080p') {
    if (isHEVC && is10Bit) parts.push('HEVC 10bit');
    else if (isHEVC) parts.push('HEVC');
    else if (is10Bit) parts.push('10bit');
    else if (source) parts.push(source);
    else if (hasHDR) parts.push('HDR');
  } else if (resolution === '720p') {
    if (isHEVC && is10Bit) parts.push('HEVC 10bit');
    else if (isHEVC) parts.push('HEVC');
    else if (source && source !== 'WebDL') parts.push(source);
  }

  // 7. Server detection (Rename GDTOT with HubCloud or GDFlix according to link):
  const server = detectServer(link.url);
  let serverName = server.name || 'HubCloud';
  const urlLower = (link.url || '').toLowerCase();

  if (urlLower.includes('gdflix')) {
    serverName = 'GDFlix';
  } else if (urlLower.includes('hubcloud')) {
    serverName = 'HubCloud';
  } else if (urlLower.includes('hubdrive')) {
    serverName = 'HubDrive';
  } else if (urlLower.includes('katdrive')) {
    serverName = 'KatDrive';
  } else if (urlLower.includes('drivehub')) {
    serverName = 'DriveHub';
  } else if (urlLower.includes('drive.google') || urlLower.includes('google')) {
    serverName = 'GDrive';
  } else if (urlLower.includes('gdtot')) {
    serverName = 'GDTot';
  }

  if (!serverName || serverName === 'Cloud Server' || serverName === 'Direct Server') {
    serverName = 'HubCloud';
  }

  return `${parts.join(' ')} [${serverName}]`;
}

function formatReleaseTitle(custom: CustomLink, titleDetails: TitleDetails): string {
  const raw = (custom.title || '').trim();
  const movieName = titleDetails.title || titleDetails.name || '';
  const movieYear = (titleDetails.release_date || titleDetails.first_air_date || '').slice(0, 4);

  // If the title is already in authentic release format:
  const isAlreadyFullRelease =
    (movieName && raw.toLowerCase().includes(movieName.toLowerCase()) && /(?:1080p|2160p|720p|bluray|remux|hevc|web-dl|x265|x264|ddp|dd\s*5|dts|atmos|truehd)/i.test(raw)) ||
    /\.(?:mkv|mp4|avi)\b/i.test(raw) ||
    (/\b(19\d\d|20\d\d)\b/.test(raw) && /(?:bluray|remux|web-dl|hevc|x265|x264)/i.test(raw));

  if (isAlreadyFullRelease && raw.length >= 15) {
    return stripWatermarks(raw);
  }

  // Synthesize scene release format matching reference screenshot:
  // e.g. "Black Widow (2021) IMAX 1080p 10bit Bluray x265 HEVC [Org DD 5.1 Hindi + DD 5.1 English] MSubs ~ TombDoc.mkv"
  let cleanQuality = (custom.quality || '')
    .replace(/•/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuality || cleanQuality.length < 3) {
    cleanQuality = 'IMAX 1080p 10bit Bluray x265 HEVC';
  } else if (!/bluray|remux|web-dl|webrip|hdtv/i.test(cleanQuality)) {
    cleanQuality = `${cleanQuality} Bluray x265 HEVC`;
  }

  let cleanAudio = (custom.audioLanguage || '')
    .replace(/•/g, '+')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanAudio || cleanAudio.length < 3) {
    cleanAudio = 'Org DD 5.1 Hindi + DD 5.1 English';
  }

  const audioPart = cleanAudio.startsWith('[') && cleanAudio.endsWith(']') ? cleanAudio : `[${cleanAudio}]`;
  const yearPart = movieYear ? `(${movieYear})` : '';

  return `${movieName} ${yearPart} ${cleanQuality} ${audioPart} MSubs ~ CineFuel.mkv`.replace(/\s+/g, ' ').trim();
}

export const CustomLinksManager: React.FC<CustomLinksManagerProps> = ({ titleDetails }) => {
  const { watchlist, removeCustomLink, isMounted, settings } = useWatchlist();
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  const [linksRefresh, setLinksRefresh] = useState(0);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reportingLink, setReportingLink] = useState<ReportModalData | null>(null);

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
      const user = sessionStorage.getItem('cinefuel_admin_user');
      setIsAdmin(auth === 'true' && user === 'shyam');
    }
  }, [isMounted]);

  const [liveServerLinks, setLiveServerLinks] = useState<CustomLink[]>([]);

  // Listen to cross-app link updates to immediately refresh links
  React.useEffect(() => {
    let active = true;

    const fetchLiveLinks = async () => {
      try {
        const res = await fetch(`/api/curated-links?movieId=${titleDetails.id}&_t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.links)) {
            setLiveServerLinks(data.links);
            try {
              const stored = localStorage.getItem('cinefuel_custom_links');
              const parsed = stored ? JSON.parse(stored) : {};
              parsed[String(titleDetails.id)] = data.links;
              localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
            } catch {}
          }
        }
      } catch {}
    };

    fetchLiveLinks();
    const interval = setInterval(fetchLiveLinks, 3000);

    const handleLinksUpdated = () => {
      setLinksRefresh((v) => v + 1);
      fetchLiveLinks();
    };
    window.addEventListener('cinefuel_links_updated', handleLinksUpdated);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('cinefuel_links_updated', handleLinksUpdated);
    };
  }, [titleDetails.id]);

  // Consolidated Custom Links (Authoritative Live Cloud Server Links)
  const userCustomLinks = useMemo(() => {
    if (!isMounted) return [];
    const linkMap = new Map<string, CustomLink>();
    const deletedIds = getDeletedLinkIds();

    // 1. Live Server Links (authoritative source of truth)
    liveServerLinks.forEach((l) => {
      if (!deletedIds.has(l.id)) {
        linkMap.set(l.id || l.url, l);
      }
    });

    // 2. If live server links have not loaded yet, fallback to local storage
    if (liveServerLinks.length === 0) {
      const local = getConsolidatedCustomLinks(titleDetails.id);
      local.forEach((l) => {
        if (!deletedIds.has(l.id)) {
          linkMap.set(l.id || l.url, l);
        }
      });
    }

    return Array.from(linkMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [titleDetails.id, isMounted, linksRefresh, liveServerLinks]);

  const mediaType = titleDetails.media_type || (titleDetails.name ? 'tv' : 'movie');

  // Filter links: for TV shows, episode links are already organized in TVEpisodeLinksManager
  const nonEpisodeLinks = useMemo(() => {
    if (mediaType !== 'tv') return userCustomLinks;
    return userCustomLinks.filter(
      (l) => l.category !== 'SingleEpisode' && l.category !== 'ZipPack' && l.linkType !== 'single_episode' && l.linkType !== 'zip_pack'
    );
  }, [userCustomLinks, mediaType]);

  const displayLinks = mediaType === 'tv' ? nonEpisodeLinks : userCustomLinks;

  // Filter links by category
  const filteredCustomLinks = useMemo(() => {
    if (activeCategoryFilter === 'All') return displayLinks;
    if (activeCategoryFilter === 'Recent') {
      const now = new Date().getTime();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      return displayLinks.filter(
        (l) => new Date(l.createdAt).getTime() > threeDaysAgo
      );
    }
    return displayLinks.filter((l) => l.category === activeCategoryFilter);
  }, [displayLinks, activeCategoryFilter]);

  // Group links by quality to calculate mirror index (e.g. 1080p -> Server 1, Server 2)
  const qualityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredCustomLinks.forEach(link => {
      const key = detectResolution(link.quality, link.title);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [filteredCustomLinks]);

  // Sorted movie links: ascending resolution (480p -> 720p -> 1080p -> 2160p) and size
  // matching reference image media_1790851187635.jpg
  const sortedMovieLinks = useMemo(() => {
    const list = [...filteredCustomLinks];

    const getResRank = (l: CustomLink): number => {
      const c = `${stripWatermarks(l.title || '')} ${stripWatermarks(l.quality || '')}`.toLowerCase();
      if (/(?:2160p|2160i|\buhd\b|\b4k\b)/i.test(c)) return 4;
      if (/(?:1080p|1080i|fhd)/i.test(c)) return 3;
      if (/(?:720p|720i|hd)/i.test(c)) return 2;
      if (/(?:480p|480i|sd)/i.test(c)) return 1;
      return 3;
    };

    const getSizeMB = (l: CustomLink): number => {
      const raw = l.size || detectSize(l.title) || detectSize(l.url) || '';
      const m = raw.match(/([\d.]+)\s*(gb|mb)/i);
      if (!m) return 0;
      const v = parseFloat(m[1]);
      return m[2].toLowerCase() === 'gb' ? v * 1024 : v;
    };

    list.sort((a, b) => {
      const rankDiff = getResRank(a) - getResRank(b);
      if (rankDiff !== 0) return rankDiff;
      return getSizeMB(a) - getSizeMB(b);
    });

    return list;
  }, [filteredCustomLinks]);

  const existing = isMounted ? watchlist.find((w) => w.id === titleDetails.id) : undefined;
  const imdbId = titleDetails.external_ids?.imdb_id;
  const tmdbId = titleDetails.id;
  const titleName = titleDetails.title || titleDetails.name || 'Title';
  const releaseYear = (titleDetails.release_date || titleDetails.first_air_date || '').split('-')[0];
  const queryName = `${titleName} ${releaseYear}`.trim();

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

  const handleDelete = async (linkId: string) => {
    if (confirm('Delete this custom link permanently?')) {
      setLiveServerLinks((prev) => prev.filter((l) => l.id !== linkId));
      removeCustomLink(titleDetails.id, linkId);
      setLinksRefresh((v) => v + 1);
      await deleteGlobalCustomLink(titleDetails.id, linkId);
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

  const totalLinkCount = userCustomLinks.length;

  return (
    <CollapsibleSection
      title={mediaType === 'tv' ? 'TV Series Season & Episode Vault' : 'Movie Direct Download Links'}
      icon={mediaType === 'tv' ? <Link2 className="w-5 h-5 text-amber-400" /> : <Download className="w-5 h-5 text-blue-400" />}
      subtitle={
        mediaType === 'tv'
          ? 'Auto-arranged seasons, batch zip archives, and weekly single episode releases.'
          : 'High-speed cloud downloads across 480p, 720p, 1080p, and 2160p 4K qualities.'
      }
      badge={`${totalLinkCount} files`}
      defaultOpen={true}
    >
      {/* TV Series Season & Episode Vault */}
      {mediaType === 'tv' && (
        <TVEpisodeLinksManager
          titleDetails={titleDetails}
          customLinks={userCustomLinks}
          isAdmin={isAdmin}
          onLinkAdded={() => setLinksRefresh((v) => v + 1)}
        />
      )}

      {/* User Custom Attached Links with Category Filters & Admin Edit/Delete (Shown for movies, or TV series with extra general links) */}
      {(mediaType !== 'tv' || nonEpisodeLinks.length > 0) && (
        <div className={`space-y-4 ${mediaType === 'tv' ? 'pt-4 border-t border-zinc-800/70' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Custom Saved Links ({displayLinks.length})</span>
            </h4>

            {/* Category Filter Pills */}
            {displayLinks.length > 0 && (
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
                  All ({displayLinks.length})
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
                  const count = displayLinks.filter((l) => l.category === cat).length;
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

        {sortedMovieLinks.length > 0 ? (
          <div className="rounded-3xl bg-[#090b14] border border-white/5 p-4 sm:p-7 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
              <div className="space-y-0.5">
                <h4 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>Direct Download Links ({sortedMovieLinks.length})</span>
                </h4>
                <p className="text-xs text-zinc-400">
                  Select your preferred resolution and server below to download.
                </p>
              </div>
            </div>

            {/* Stack of Movie Download Buttons (Reference: media_1790851187635.jpg) */}
            <div className="space-y-4 pt-2">
              {sortedMovieLinks.map((link, idx) => {
                const buttonLabel = formatMovieDownloadButtonTitle(link);
                const audioInfo = formatAudioLanguages(link.audioLanguage, link.title);
                const serverInfo = detectServer(link.url);

                return (
                  <div key={link.id || idx} className="space-y-1.5 max-w-xl mx-auto w-full group">
                    <div className="flex items-center gap-2 sm:gap-3 w-full">
                      {/* Vibrant Blue Pill/Button with Neon Pink Border matching media_1790851187635.jpg */}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3.5 sm:py-4.5 px-4 sm:px-8 rounded-2xl bg-gradient-to-r from-[#0030eb] via-[#0038ff] to-[#0048ff] hover:from-[#0027c4] hover:to-[#0030eb] border-[2.5px] border-[#ff007f] shadow-[0_0_16px_rgba(255,0,127,0.35)] hover:shadow-[0_0_26px_rgba(255,0,127,0.6)] text-white font-black text-sm sm:text-base md:text-lg tracking-wide text-center transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] select-none cursor-pointer flex items-center justify-center gap-2 break-words"
                        title={`Download: ${buttonLabel}`}
                      >
                        <span>{buttonLabel}</span>
                      </a>

                      {/* Quick Action Buttons: Copy, Flag/Report, Admin */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(link.url);
                            alert('Download link copied to clipboard!');
                          }}
                          className="p-3 sm:p-3.5 rounded-2xl bg-[#141622] hover:bg-[#1f2336] text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                          title="Copy download link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setReportingLink({
                              linkId: link.id,
                              movieId: titleDetails.id,
                              mediaTitle: titleDetails.title || titleDetails.name || 'Movie',
                              mediaType: mediaType === 'tv' ? 'tv' : 'movie',
                              posterPath: titleDetails.poster_path,
                              linkTitle: buttonLabel,
                              reportedUrl: link.url,
                              quality: link.quality,
                              server: serverInfo.name,
                            })
                          }
                          className="p-3 sm:p-3.5 rounded-2xl bg-[#141622] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition-colors cursor-pointer"
                          title="Report broken or defective link"
                        >
                          <Flag className="w-4 h-4" />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(link)}
                              className="p-3 sm:p-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors cursor-pointer"
                              title="Admin: Edit link"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(link.id)}
                              className="p-3 sm:p-3.5 rounded-2xl bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-900/50 transition-colors cursor-pointer"
                              title="Admin: Delete link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Subtext: Scene title & audio language */}
                    {(audioInfo || link.title) && (
                      <div className="flex items-center justify-between px-2 text-[11px] text-zinc-400 font-medium">
                        <span className="truncate max-w-[70%] text-zinc-500 font-mono text-[10px]">
                          {stripWatermarks(link.title || '')}
                        </span>
                        {audioInfo && (
                          <span className="text-zinc-400 font-sans shrink-0">
                            🔊 {audioInfo}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-1.5">
            <p className="text-xs text-zinc-300 font-medium">No custom links available yet for this title.</p>
            <p className="text-[11px] text-zinc-500">Need a streaming or download link? Click &quot;Request Link&quot; below and our team will add it!</p>
          </div>
        )}

        {/* Can't find the link you want? Request custom quality card (matches reference design) */}
        <div className="mt-5 p-5 sm:p-6 rounded-2xl bg-[#0b0e17] border border-blue-500/25 shadow-xl text-center space-y-3.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400 shadow-md shadow-blue-500/10">
            <Info className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm text-zinc-200 font-medium max-w-md mx-auto leading-relaxed">
            Can&apos;t find the link you want? Request custom quality and we&apos;ll add it for you.
          </p>
          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            REQUEST LINK
          </button>
        </div>
      </div>
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

      {/* User Link Request Modal */}
      <RequestLinkModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        prefillTitle={titleName}
        prefillMediaType={mediaType === 'tv' ? 'tv' : 'movie'}
        prefillTmdbId={titleDetails.id}
        prefillPosterPath={titleDetails.poster_path}
        prefillYear={releaseYear}
      />

      {/* User Defective / Broken Link Report Modal */}
      <ReportBrokenLinkModal
        isOpen={!!reportingLink}
        onClose={() => setReportingLink(null)}
        data={reportingLink}
      />

    </CollapsibleSection>
  );
};

export default CustomLinksManager;
