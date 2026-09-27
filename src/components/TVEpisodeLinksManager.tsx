'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Plus,
  Trash2,
  Pencil,
  Tv,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';
import { CustomLink, TitleDetails } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';
import {
  updateGlobalCustomLink,
  deleteGlobalCustomLink,
} from '@/lib/curatedLinks';
import {
  detectSeasonNumber,
  detectEpisodeNumber,
  detectLinkType,
  detectQuality,
  detectAudio,
  detectSize,
  getQualityWeight,
  parseFullMediaTitle,
} from '@/lib/seasonParser';
import { detectServer } from '@/lib/serverDetector';
import RequestLinkModal from './RequestLinkModal';
import ReportBrokenLinkModal, { ReportModalData } from './ReportBrokenLinkModal';

interface TVEpisodeLinksManagerProps {
  titleDetails: TitleDetails;
  customLinks: CustomLink[];
  isAdmin: boolean;
  onLinkAdded?: () => void;
}

interface EnrichedLink extends CustomLink {
  seasonNumber: number;
  episodeNumber?: number;
  linkType: 'zip_pack' | 'single_episode';
  quality: string;
  audioLanguage: string;
  size?: string;
  resolution: string;
  source: string;
}

interface ReleaseOption {
  id: string;
  title: string;
  seasonNumber: number;
  episodeCountLabel: string;
  audioLanguages: string;
  packs: EnrichedLink[];
  episodes: EnrichedLink[];
}

interface FormatGroup {
  id: string;
  resolution: string;
  source: string;
  options: ReleaseOption[];
}

interface GroupedEpisode {
  episodeNumber: number;
  title: string;
  size: string;
  links: EnrichedLink[];
}

// Extract rich release profiles including 4K SDR vs 4K DV HDR vs 1080p
function extractReleaseProfile(title: string, quality?: string) {
  const combinedRaw = `${quality || ''} ${title || ''}`;
  // Strip website domain watermarks (e.g. 4kHdHub.Com, Vegamovies.NL, etc.) before checking resolution
  const combined = combinedRaw
    .replace(/[-_.\s]*4k[a-z0-9-_.]*(?:\.com|\.org|\.net|\.in|\.cx|\.to|\.nl|\.app|\.site|\.vip)\b/gi, ' ')
    .replace(/\b(?:4khdhub|vegamovies|bollyflix|hdhub4u|katmoviehd|cinemaluxe|skymovieshd|uhdmovies)[a-z0-9-_.]*/gi, ' ')
    .toLowerCase();

  // Resolution detection
  let resolution = '1080p';
  let resTag = '1080p';

  // Explicit 1080p / FHD check first if present in title
  if (/(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '1080p';
    resTag = '1080p';
  } else if (/(?:^|[\s._\-[\]()])(?:2160p|2160i|uhd|\b4k(?:\s*uhd|\s*hdr|\s*sdr|\s*hevc|\s*remux|\s*web|\s*bluray)?\b)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '2160p / 4K';
    resTag = '2160p';
  } else if (/(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '720p';
    resTag = '720p';
  } else if (/(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(combined)) {
    resolution = '480p';
    resTag = '480p';
  }

  // Source
  let source = 'WEB-DL';
  if (combined.includes('remux')) source = 'REMUX';
  else if (combined.includes('bluray') || combined.includes('blu-ray') || combined.includes('bdrip')) source = 'BluRay';
  else if (combined.includes('web-dl') || combined.includes('webdl') || combined.includes('webrip') || combined.includes('web') || combined.includes('nf') || combined.includes('dsnp') || combined.includes('amzn')) source = 'WEB-DL';
  else if (combined.includes('hdtv')) source = 'HDTV';
  else if (combined.includes('hdrip')) source = 'HDRip';

  // Dynamic Range (Separate 4K DV HDR vs 4K SDR)
  let dynamicRange = '';
  if (
    combined.includes('dv hdr') ||
    combined.includes('dv-hdr') ||
    combined.includes('dv.hdr') ||
    (combined.includes('dv') && combined.includes('hdr')) ||
    combined.includes('dolby vision')
  ) {
    dynamicRange = 'DV HDR';
  } else if (combined.includes('hdr10+') || combined.includes('hdr10') || combined.includes('hdr')) {
    dynamicRange = 'HDR';
  } else if (combined.includes('sdr')) {
    dynamicRange = 'SDR';
  }

  // Codec
  let codec = '';
  if (combined.includes('h.265') || combined.includes('h265') || combined.includes('x265') || combined.includes('hevc')) {
    codec = 'H.265';
  } else if (combined.includes('h.264') || combined.includes('h264') || combined.includes('x264') || combined.includes('avc')) {
    codec = 'H.264';
  }

  // Platform
  let platform = 'NF';
  if (combined.includes('dsnp') || combined.includes('disney') || combined.includes('hotstar')) platform = 'DSNP';
  else if (combined.includes('amzn') || combined.includes('prime')) platform = 'AMZN';
  else if (combined.includes('hbo') || combined.includes('max')) platform = 'MAX';
  else if (combined.includes('nf') || combined.includes('netflix')) platform = 'NF';

  return {
    resolution,
    source,
    dynamicRange,
    codec: codec || (resTag === '2160p' ? 'H.265' : 'H.264'),
    platform,
    cleanDisplayTitle: (showName: string, seasonNum: number) => {
      const sTag = `S${String(seasonNum).padStart(2, '0')}`;
      const parts = [
        platform,
        resTag,
        dynamicRange,
        codec || (resTag === '2160p' ? 'H.265' : 'H.264'),
      ].filter(Boolean);
      return `${showName} ${sTag} (${parts.join(' ')})`;
    },
  };
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
  if (combined.includes('english') || combined.includes('eng')) list.push('English');
  if (combined.includes('spanish') || combined.includes('spa')) list.push('Spanish');
  if (combined.includes('tamil') || combined.includes('tam')) list.push('Tamil');
  if (combined.includes('telugu') || combined.includes('tel')) list.push('Telugu');
  if (combined.includes('korean') || combined.includes('kor')) list.push('Korean');
  if (combined.includes('japanese') || combined.includes('jap')) list.push('Japanese');

  if (list.length > 0) {
    return list.join(', ');
  }

  if (audio && audio !== 'Original' && audio !== 'English') {
    return audio.replace(/\s*•\s*/g, ', ').replace(/\s*\+\s*/g, ', ');
  }

  return 'Hindi, English, Spanish';
}

export const TVEpisodeLinksManager: React.FC<TVEpisodeLinksManagerProps> = ({
  titleDetails,
  customLinks,
  isAdmin,
  onLinkAdded,
}) => {
  const { removeCustomLink } = useWatchlist();
  const [sessionAdmin, setSessionAdmin] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('cinefuel_admin_auth');
      const user = sessionStorage.getItem('cinefuel_admin_user');
      setSessionAdmin(auth === 'true' && user === 'shyam');
    }
  }, []);

  const isEffectiveAdmin = isAdmin && sessionAdmin;

  // Open state for individual seasons: e.g. 5: true
  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});
  // Open state for individual release options: e.g. "s5_opt_0": true
  const [openReleaseOptions, setOpenReleaseOptions] = useState<Record<string, boolean>>({});

  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [reportingLink, setReportingLink] = useState<ReportModalData | null>(null);

  // Form states for Admin editing an existing link
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const [editSeason, setEditSeason] = useState<number>(1);
  const [editType, setEditType] = useState<'zip_pack' | 'single_episode'>('zip_pack');
  const [editEpisode, setEditEpisode] = useState<number>(1);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editUrl, setEditUrl] = useState<string>('');
  const [editQuality, setEditQuality] = useState<string>('');
  const [editAudio, setEditAudio] = useState<string>('');
  const [editSize, setEditSize] = useState<string>('');

  // Dynamically calculate all seasons in descending order (e.g. Season 5, Season 4, Season 3...)
  const seasonsList = useMemo(() => {
    const detectedSeasons = new Set<number>();
    const tmdbSeasons = titleDetails.number_of_seasons || 1;
    for (let i = 1; i <= tmdbSeasons; i++) {
      detectedSeasons.add(i);
    }

    customLinks.forEach((link) => {
      const s = detectSeasonNumber(link);
      if (s > 0) detectedSeasons.add(s);
    });

    // Sort descending (Season 5, Season 4, Season 3...) matching screenshot
    return Array.from(detectedSeasons).sort((a, b) => b - a);
  }, [titleDetails.number_of_seasons, customLinks]);

  // Enrich each custom link with smart auto-detected metadata
  const enrichedLinks: EnrichedLink[] = useMemo(() => {
    return customLinks.map((l) => {
      const detectedSeason = detectSeasonNumber(l);
      const detectedEp = detectEpisodeNumber(l);
      const detectedType = detectLinkType({ ...l, episodeNumber: detectedEp });
      const detectedQ = l.quality && l.quality !== 'HD' ? l.quality : detectQuality(l.title, l.quality);
      const detectedAud = l.audioLanguage && l.audioLanguage !== 'Original' ? l.audioLanguage : detectAudio(l.title, l.audioLanguage);
      const detectedSz = l.size || detectSize(l.title);
      const prof = extractReleaseProfile(l.title, detectedQ);

      return {
        ...l,
        seasonNumber: detectedSeason,
        episodeNumber: detectedEp,
        linkType: detectedType,
        quality: detectedQ,
        audioLanguage: detectedAud,
        size: detectedSz,
        resolution: prof.resolution,
        source: prof.source,
      };
    });
  }, [customLinks]);

  // Group enriched links by Season -> Format Groups (2160p / 4K, 1080p...) -> Release Options (DV HDR, SDR...)
  const seasonGroupsMap = useMemo(() => {
    const map = new Map<number, FormatGroup[]>();
    const showName = titleDetails.name || titleDetails.title || 'Series';

    seasonsList.forEach((s) => {
      const currentSeasonLinks = enrichedLinks.filter((l) => l.seasonNumber === s);
      if (currentSeasonLinks.length === 0) {
        map.set(s, []);
        return;
      }

      // Group by format key: resolution + source (e.g. "2160p / 4K_WEB-DL", "1080p_WEB-DL")
      const formatMap = new Map<string, { resolution: string; source: string; links: EnrichedLink[] }>();

      currentSeasonLinks.forEach((link) => {
        const key = `${link.resolution}_${link.source}`;
        if (!formatMap.has(key)) {
          formatMap.set(key, {
            resolution: link.resolution,
            source: link.source,
            links: [],
          });
        }
        formatMap.get(key)!.links.push(link);
      });

      const formats: FormatGroup[] = [];

      formatMap.forEach((fVal, fKey) => {
        // Group links inside this format by release profile (Separate 4K DV HDR vs 4K SDR)
        const optionsMap = new Map<
          string,
          {
            id: string;
            title: string;
            seasonNumber: number;
            audioLanguages: string;
            packs: EnrichedLink[];
            episodes: EnrichedLink[];
          }
        >();

        fVal.links.forEach((link) => {
          const prof = extractReleaseProfile(link.title, link.quality);
          const optKey = `s${s}_${fKey}_${prof.dynamicRange || 'std'}_${prof.codec || 'codec'}`;

          if (!optionsMap.has(optKey)) {
            let optTitle = link.title;
            if (optTitle.includes('.mkv') || optTitle.includes('.zip') || !optTitle.includes('(')) {
              optTitle = prof.cleanDisplayTitle(showName, s);
            }

            optionsMap.set(optKey, {
              id: optKey,
              title: optTitle,
              seasonNumber: s,
              audioLanguages: formatAudioLanguages(link.audioLanguage, link.title),
              packs: [],
              episodes: [],
            });
          }

          const opt = optionsMap.get(optKey)!;
          if (link.linkType === 'zip_pack') {
            opt.packs.push(link);
          } else {
            opt.episodes.push(link);
          }
        });

        const options: ReleaseOption[] = [];

        optionsMap.forEach((optVal) => {
          let epCount = '10';
          if (optVal.episodes.length > 0) {
            epCount = `${optVal.episodes.length}`;
          } else if (optVal.packs.length > 0) {
            const firstPack = optVal.packs[0];
            const epMatch = firstPack.title.match(/(?:episodes?\s*|e\d{1,2}\s*-\s*e?|total\s*)(\d{1,3})/i);
            epCount = epMatch
              ? epMatch[1]
              : titleDetails.number_of_episodes
              ? `${titleDetails.number_of_episodes}`
              : '10';
          }

          options.push({
            id: optVal.id,
            title: optVal.title,
            seasonNumber: s,
            episodeCountLabel: `Episodes ${epCount}`,
            audioLanguages: optVal.audioLanguages,
            packs: optVal.packs,
            episodes: optVal.episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0)),
          });
        });

        // Sort options: DV HDR first, then SDR, then others
        options.sort((a, b) => {
          const orderA = a.title.includes('DV') || a.title.includes('HDR') ? 2 : a.title.includes('SDR') ? 1 : 0;
          const orderB = b.title.includes('DV') || b.title.includes('HDR') ? 2 : b.title.includes('SDR') ? 1 : 0;
          return orderB - orderA;
        });

        formats.push({
          id: `s${s}_${fKey}`,
          resolution: fVal.resolution,
          source: fVal.source,
          options,
        });
      });

      // Sort formats: 2160p / 4K > 1080p > 720p > 480p
      formats.sort((a, b) => getQualityWeight(b.resolution) - getQualityWeight(a.resolution));
      map.set(s, formats);
    });

    return map;
  }, [seasonsList, enrichedLinks, titleDetails]);

  // Auto-expand the newest season with links on initial load
  useEffect(() => {
    if (Object.keys(openSeasons).length === 0 && seasonsList.length > 0) {
      const firstSeasonWithLinks =
        seasonsList.find((s) => {
          const fmts = seasonGroupsMap.get(s);
          return fmts && fmts.length > 0;
        }) || seasonsList[0];

      setOpenSeasons({ [firstSeasonWithLinks]: true });

      const fmts = seasonGroupsMap.get(firstSeasonWithLinks);
      if (fmts && fmts.length > 0 && fmts[0].options.length > 0) {
        setOpenReleaseOptions({ [fmts[0].options[0].id]: true });
      }
    }
  }, [seasonsList, seasonGroupsMap, openSeasons]);

  const toggleSeason = (seasonNum: number) => {
    setOpenSeasons((prev) => ({
      ...prev,
      [seasonNum]: !prev[seasonNum],
    }));
  };

  const toggleOption = (optionId: string) => {
    setOpenReleaseOptions((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  const handleStartEdit = (link: CustomLink) => {
    setEditingLink(link);
    setEditSeason(link.seasonNumber || 1);
    setEditType(link.linkType === 'single_episode' ? 'single_episode' : 'zip_pack');
    setEditEpisode(link.episodeNumber || 1);
    setEditTitle(link.title);
    setEditUrl(link.url);
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
      category: editType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
      seasonNumber: editSeason,
      episodeNumber: editType === 'single_episode' ? editEpisode : undefined,
      quality: editQuality.trim() || parsed.quality || editingLink.quality,
      audioLanguage: editAudio.trim() || parsed.audioLanguage || editingLink.audioLanguage,
      size: editSize.trim() || parsed.size || editingLink.size,
      linkType: editType,
    };

    updateGlobalCustomLink(titleDetails.id, updatedLink);
    setEditingLink(null);
    if (onLinkAdded) onLinkAdded();
  };

  const handleDelete = async (linkId: string) => {
    if (confirm('Delete this TV link permanently?')) {
      removeCustomLink(titleDetails.id, linkId);
      if (onLinkAdded) onLinkAdded();
      await deleteGlobalCustomLink(titleDetails.id, linkId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Admin Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg sm:text-xl font-bold text-white">Season & Episode Vault</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Select format (4K DV HDR, 4K SDR, 1080p, 720p) and release packages to access direct episode & zip downloads.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-amber-200 font-bold text-xs transition-all shadow-sm cursor-pointer group"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Request Link</span>
          </button>

          {isEffectiveAdmin && (
            <a
              href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 font-bold text-xs transition-all hover:bg-zinc-800 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
              <span>Admin File Uploader ↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Season Container Accordions (Descending Season 5, Season 4, etc.) */}
      <div className="space-y-5">
        {seasonsList.map((s) => {
          const formatGroups = seasonGroupsMap.get(s) || [];
          const isSeasonOpen = !!openSeasons[s];

          return (
            <div
              key={s}
              className="rounded-2xl bg-[#0f0d16] border border-[#211f2c] overflow-hidden p-4 sm:p-5 transition-all shadow-lg"
            >
              {/* Season Header Bar */}
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-base sm:text-lg tracking-tight">
                  Season {s}
                </h3>
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold text-zinc-300 bg-[#1c1a27] border border-[#2d2a3d]">
                    {formatGroups.length} {formatGroups.length === 1 ? 'format' : 'formats'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSeason(s)}
                    className="w-7 h-7 rounded-full bg-[#1c1a27] border border-[#2d2a3d] flex items-center justify-center text-zinc-300 hover:text-white hover:bg-[#252333] transition-colors cursor-pointer"
                    title={isSeasonOpen ? 'Collapse Season' : 'Expand Season'}
                  >
                    {isSeasonOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Inside Season (When Expanded) */}
              {isSeasonOpen && (
                <div className="mt-4 space-y-4 animate-fadeIn">
                  {formatGroups.length > 0 ? (
                    formatGroups.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-xl bg-[#14121e] border border-[#222030] p-3 sm:p-4 space-y-3 relative shadow-inner"
                      >
                        {/* Format Bar with Left Orange Accent */}
                        <div className="flex items-center justify-between pl-3 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3.5px] before:bg-amber-500 before:rounded-full">
                          <div className="flex items-center gap-2">
                            {/* Resolution Badge (Solid amber for 4K, blue for 1080p, purple for 720p) */}
                            <span className={getResolutionBadgeStyle(group.resolution)}>
                              {group.resolution}
                            </span>
                            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#0d281e] text-emerald-400 border border-[#154634] shadow-sm">
                              {group.source}
                            </span>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-medium text-zinc-300 bg-[#1c1a27] border border-[#2d2a3d]">
                            {group.options.length} {group.options.length === 1 ? 'option' : 'options'}
                          </span>
                        </div>

                        {/* Release Options List (e.g. 4K DV HDR vs 4K SDR vs 1080p H.264) */}
                        <div className="space-y-2.5">
                          {group.options.map((option) => {
                            const isOptionOpen = !!openReleaseOptions[option.id];

                            // Group individual episodes by episodeNumber so mirrors appear as side-by-side buttons
                            const groupedEpisodesMap = new Map<number, GroupedEpisode>();
                            option.episodes.forEach((ep) => {
                              const num = ep.episodeNumber || 1;
                              if (!groupedEpisodesMap.has(num)) {
                                const epNumStr = String(num).padStart(2, '0');
                                let displayTitle = ep.title;
                                if (!displayTitle.includes('.')) {
                                  displayTitle = `${(titleDetails.name || titleDetails.title || 'Series').replace(/\s+/g, '.')}.S${String(s).padStart(2, '0')}E${epNumStr}.${group.resolution.replace(/\s*\/\s*/g, '.')}.${group.source}.Multi.mkv`;
                                }
                                groupedEpisodesMap.set(num, {
                                  episodeNumber: num,
                                  title: displayTitle,
                                  size: ep.size || '2.3 GB',
                                  links: [],
                                });
                              }
                              const g = groupedEpisodesMap.get(num)!;
                              g.links.push(ep);
                              if (ep.size) g.size = ep.size;
                            });

                            const groupedEpisodes = Array.from(groupedEpisodesMap.values()).sort(
                              (a, b) => a.episodeNumber - b.episodeNumber
                            );

                            return (
                              <div
                                key={option.id}
                                className="rounded-xl bg-[#0c0a13] border border-[#211f30] hover:border-[#35324b] transition-all overflow-hidden shadow-sm"
                              >
                                {/* Release Option Header Row (Clickable) */}
                                <div
                                  onClick={() => toggleOption(option.id)}
                                  className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer group hover:bg-[#12101c] transition-colors"
                                >
                                  <div className="flex items-center gap-3.5 overflow-hidden">
                                    {/* S05 / S04 Orange Tag */}
                                    <div className="text-amber-500 font-bold text-sm sm:text-base tracking-wider pr-3.5 border-r border-[#211f30] shrink-0">
                                      S{String(s).padStart(2, '0')}
                                    </div>

                                    {/* Title & Badges */}
                                    <div className="overflow-hidden space-y-1.5">
                                      <h4 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-amber-300 transition-colors truncate">
                                        {option.title}
                                      </h4>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1c1a27] text-zinc-300 border border-[#2d2a3d]">
                                          {option.episodeCountLabel}
                                        </span>
                                        {option.audioLanguages && (
                                          <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#032626] text-teal-300 border border-[#084d4d]">
                                            {option.audioLanguages}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Chevron Down/Up */}
                                  <div className="shrink-0 pl-2">
                                    <ChevronDown
                                      className={`w-4 h-4 text-zinc-400 group-hover:text-amber-400 transition-transform duration-200 ${
                                        isOptionOpen ? 'rotate-180 text-amber-400' : ''
                                      }`}
                                    />
                                  </div>
                                </div>

                                {/* Expanded Episodes & Zip Download List */}
                                {isOptionOpen && (
                                  <div className="border-t border-[#1a1728] bg-[#0c0a13] divide-y divide-[#1b1928] overflow-hidden p-4 sm:p-5 animate-fadeIn">
                                    {/* 1. Complete Zip Packs */}
                                    {option.packs.map((pack) => {
                                      const server = detectServer(pack.url);
                                      const serverName = server.name || 'HubCloud';
                                      let packTitle = pack.title;
                                      if (!packTitle.includes('.')) {
                                        packTitle = `${(titleDetails.name || titleDetails.title || 'Series').replace(/\s+/g, '.')}.S${String(s).padStart(2, '0')}.Complete.${group.resolution.replace(/\s*\/\s*/g, '.')}.${group.source}.Multi.zip`;
                                      }
                                      const packSize = pack.size || '16.8 GB';

                                      return (
                                        <div key={pack.id} className="py-4 space-y-3 first:pt-0 last:pb-0">
                                          {/* Cyan / Light blue release filename */}
                                          <div className="text-sky-400 font-mono text-xs sm:text-[13px] font-medium tracking-tight break-all">
                                            {packTitle}
                                          </div>

                                          {/* Badges: Season Zip Pack & Size */}
                                          <div className="flex items-center gap-2">
                                            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#1c202a] text-zinc-300 border border-zinc-700/60">
                                              Season-{String(s).padStart(2, '0')} Zip Pack
                                            </span>
                                            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#ea580c] text-white shadow-sm">
                                              {packSize}
                                            </span>
                                          </div>

                                          {/* Download Buttons Row */}
                                          <div className="flex flex-wrap items-center gap-3 pt-1">
                                            <a
                                              href={pack.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-4 py-2 rounded-lg bg-[#ea580c] hover:bg-[#c2410c] text-black font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95"
                                            >
                                              <span>Download {serverName}</span>
                                              <Download className="w-4 h-4" />
                                            </a>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                setReportingLink({
                                                  linkId: pack.id,
                                                  movieId: titleDetails.id,
                                                  mediaTitle: titleDetails.title || titleDetails.name || 'Untitled Show',
                                                  mediaType: 'tv',
                                                  posterPath: titleDetails.poster_path,
                                                  linkTitle: packTitle,
                                                  reportedUrl: pack.url,
                                                  quality: group.resolution,
                                                  server: server.name,
                                                })
                                              }
                                              className="p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-amber-400 border border-zinc-700/60 transition-colors"
                                              title="Report broken or defective zip link"
                                            >
                                              <AlertTriangle className="w-3.5 h-3.5" />
                                            </button>

                                            {isEffectiveAdmin && (
                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => handleStartEdit(pack)}
                                                  className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-700 transition-colors"
                                                  title="Admin: Edit TV Link"
                                                >
                                                  <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={() => handleDelete(pack.id)}
                                                  className="p-2 rounded-lg bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                                                  title="Admin: Delete TV Link"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* 2. Single Episodes Grouped with Multi-Server Buttons */}
                                    {groupedEpisodes.map((epGroup) => {
                                      const epNumStr = String(epGroup.episodeNumber).padStart(2, '0');

                                      return (
                                        <div
                                          key={`ep_${epGroup.episodeNumber}`}
                                          className="py-4 space-y-3 first:pt-0 last:pb-0"
                                        >
                                          {/* Cyan / Light blue release filename */}
                                          <div className="text-sky-400 font-mono text-xs sm:text-[13px] font-medium tracking-tight break-all">
                                            {epGroup.title}
                                          </div>

                                          {/* Badges: Episode-01 & Size */}
                                          <div className="flex items-center gap-2">
                                            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#1c202a] text-zinc-300 border border-zinc-700/60">
                                              Episode-{epNumStr}
                                            </span>
                                            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#ea580c] text-white shadow-sm">
                                              {epGroup.size}
                                            </span>
                                          </div>

                                          {/* Download Buttons Row (Side-by-side Server Buttons) */}
                                          <div className="flex flex-wrap items-center gap-3 pt-1">
                                            {epGroup.links.map((link) => {
                                              const server = detectServer(link.url);
                                              const serverName = server.name || 'HubCloud';

                                              return (
                                                <a
                                                  key={link.id}
                                                  href={link.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-4 py-2 rounded-lg bg-[#ea580c] hover:bg-[#c2410c] text-black font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95"
                                                >
                                                  <span>Download {serverName}</span>
                                                  <Download className="w-4 h-4" />
                                                </a>
                                              );
                                            })}

                                            {/* Report broken link */}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setReportingLink({
                                                  linkId: epGroup.links[0]?.id,
                                                  movieId: titleDetails.id,
                                                  mediaTitle: titleDetails.title || titleDetails.name || 'Untitled Show',
                                                  mediaType: 'tv',
                                                  posterPath: titleDetails.poster_path,
                                                  linkTitle: epGroup.title,
                                                  reportedUrl: epGroup.links[0]?.url || '',
                                                  quality: group.resolution,
                                                  server: detectServer(epGroup.links[0]?.url || '').name,
                                                })
                                              }
                                              className="p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-amber-400 border border-zinc-700/60 transition-colors"
                                              title="Report broken or defective episode link"
                                            >
                                              <AlertTriangle className="w-3.5 h-3.5" />
                                            </button>

                                            {isEffectiveAdmin &&
                                              epGroup.links.map((link) => (
                                                <div key={`admin_${link.id}`} className="flex items-center gap-1">
                                                  <button
                                                    onClick={() => handleStartEdit(link)}
                                                    className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-700 transition-colors"
                                                    title={`Admin: Edit ${detectServer(link.url).name} Link`}
                                                  >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDelete(link.id)}
                                                    className="p-2 rounded-lg bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                                                    title={`Admin: Delete ${detectServer(link.url).name} Link`}
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-3">
                      <p className="text-xs sm:text-sm text-zinc-300 font-medium">
                        No formats or download links uploaded yet for Season {s}.
                      </p>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        Need 4K HDR, 1080p, or batch zip downloads for Season {s}? Request it below!
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsRequestModalOpen(true)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:scale-105 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 fill-black" />
                          <span>Request Season {s} Links</span>
                        </button>
                        {isEffectiveAdmin && (
                          <a
                            href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Upload in Admin ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Request Custom Quality Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0b0e17] border border-blue-500/25 shadow-xl text-center space-y-3.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400 shadow-md shadow-blue-500/10">
          <Info className="w-5 h-5" />
        </div>
        <p className="text-xs sm:text-sm text-zinc-200 font-medium max-w-md mx-auto leading-relaxed">
          Can&apos;t find the episode or quality you want? Request custom format (4K DV HDR, 1080p, Dual Audio) and our team will add it!
        </p>
        <button
          type="button"
          onClick={() => setIsRequestModalOpen(true)}
          className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          REQUEST LINK
        </button>
      </div>

      {/* Admin Quick Edit Modal */}
      {editingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Pencil className="w-4 h-4" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Edit TV Link
                </h4>
              </div>
              <button
                onClick={() => setEditingLink(null)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Season Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editSeason}
                    onChange={(e) => setEditSeason(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Link Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="zip_pack">🗜️ Complete Season Zip/Pack</option>
                    <option value="single_episode">📥 Single Episode (Weekly)</option>
                  </select>
                </div>
              </div>

              {editType === 'single_episode' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Episode Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editEpisode}
                    onChange={(e) => setEditEpisode(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Display Title / Release Tag
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Destination URL
                </label>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Quality</label>
                  <input
                    type="text"
                    value={editQuality}
                    onChange={(e) => setEditQuality(e.target.value)}
                    placeholder="1080p, 4K..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Audio</label>
                  <input
                    type="text"
                    value={editAudio}
                    onChange={(e) => setEditAudio(e.target.value)}
                    placeholder="Hindi DDP..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Size</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    placeholder="1.2 GB..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs hover:scale-105 transition-transform"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Modal */}
      <RequestLinkModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        prefillTitle={titleDetails.name || titleDetails.title}
        prefillMediaType="tv"
        prefillTmdbId={titleDetails.id}
        prefillPosterPath={titleDetails.poster_path}
        prefillYear={titleDetails.first_air_date ? new Date(titleDetails.first_air_date).getFullYear().toString() : undefined}
      />

      {/* Report Broken Link Modal */}
      <ReportBrokenLinkModal
        isOpen={!!reportingLink}
        data={reportingLink}
        onClose={() => setReportingLink(null)}
      />
    </div>
  );
};

export default TVEpisodeLinksManager;
