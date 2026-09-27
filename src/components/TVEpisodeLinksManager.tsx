'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderArchive,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Pencil,
  Tv,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
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

// Helpers for resolution & source detection
function extractResolution(title: string, quality?: string): string {
  const combined = `${quality || ''} ${title || ''}`.toLowerCase();
  if (combined.includes('2160p') || combined.includes('4k') || combined.includes('uhd')) return '2160p';
  if (combined.includes('1080p') || combined.includes('fhd')) return '1080p';
  if (combined.includes('720p') || combined.includes('hd')) return '720p';
  if (combined.includes('480p') || combined.includes('sd')) return '480p';
  return '1080p';
}

function extractSource(title: string, quality?: string): string {
  const combined = `${quality || ''} ${title || ''}`.toLowerCase();
  if (combined.includes('remux')) return 'REMUX';
  if (combined.includes('bluray') || combined.includes('blu-ray') || combined.includes('bdrip')) return 'BluRay';
  if (combined.includes('web-dl') || combined.includes('webdl') || combined.includes('webrip') || combined.includes('web') || combined.includes('nf') || combined.includes('dsnp') || combined.includes('amzn')) return 'WEB-DL';
  if (combined.includes('hdtv')) return 'HDTV';
  if (combined.includes('hdrip')) return 'HDRip';
  return 'WEB-DL';
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

  // Open state for individual seasons: e.g. 1: true
  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});
  // Open state for individual release options: e.g. "s1_opt_0": true
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

  // Dynamically calculate all seasons present in TMDB metadata AND uploaded custom links (Auto S01, S02, S03...)
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

    return Array.from(detectedSeasons).sort((a, b) => a - b);
  }, [titleDetails.number_of_seasons, customLinks]);

  // Enrich each custom link with smart auto-detected season, episode, quality, audio, and type
  const enrichedLinks: EnrichedLink[] = useMemo(() => {
    return customLinks.map((l) => {
      const detectedSeason = detectSeasonNumber(l);
      const detectedEp = detectEpisodeNumber(l);
      const detectedType = detectLinkType({ ...l, episodeNumber: detectedEp });
      const detectedQ = l.quality && l.quality !== 'HD' ? l.quality : detectQuality(l.title, l.quality);
      const detectedAud = l.audioLanguage && l.audioLanguage !== 'Original' ? l.audioLanguage : detectAudio(l.title, l.audioLanguage);
      const detectedSz = l.size || detectSize(l.title);
      const res = extractResolution(l.title, detectedQ);
      const src = extractSource(l.title, detectedQ);

      return {
        ...l,
        seasonNumber: detectedSeason,
        episodeNumber: detectedEp,
        linkType: detectedType,
        quality: detectedQ,
        audioLanguage: detectedAud,
        size: detectedSz,
        resolution: res,
        source: src,
      };
    });
  }, [customLinks]);

  // Group enriched links by Season -> Format Groups -> Release Options
  const seasonGroupsMap = useMemo(() => {
    const map = new Map<number, FormatGroup[]>();

    seasonsList.forEach((s) => {
      const currentSeasonLinks = enrichedLinks.filter((l) => l.seasonNumber === s);
      if (currentSeasonLinks.length === 0) {
        map.set(s, []);
        return;
      }

      // Group by format key: resolution + source (e.g. 1080p_WEB-DL)
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
        // Build release options within this format
        const packs = fVal.links.filter((l) => l.linkType === 'zip_pack');
        const episodes = fVal.links.filter((l) => l.linkType === 'single_episode');

        const options: ReleaseOption[] = [];

        if (packs.length > 0) {
          packs.forEach((pack, idx) => {
            const aud = formatAudioLanguages(pack.audioLanguage, pack.title);
            // Detect episode count from title or TMDB
            const epMatch = pack.title.match(/(?:episodes?\s*|e\d{1,2}\s*-\s*e?|total\s*)(\d{1,3})/i);
            const epCount = epMatch ? epMatch[1] : (titleDetails.number_of_episodes ? `${titleDetails.number_of_episodes}` : '13');

            options.push({
              id: `s${s}_${fKey}_pack_${pack.id || idx}`,
              title: pack.title,
              seasonNumber: s,
              episodeCountLabel: `Episodes ${epCount}`,
              audioLanguages: aud,
              packs: [pack],
              episodes: [],
            });
          });
        }

        if (episodes.length > 0) {
          const firstEp = episodes[0];
          const aud = formatAudioLanguages(firstEp.audioLanguage, firstEp.title);
          const baseTitle = `${titleDetails.name || titleDetails.title || 'Series'} S${String(s).padStart(2, '0')} (${fVal.resolution} ${fVal.source})`;

          options.push({
            id: `s${s}_${fKey}_episodes`,
            title: baseTitle,
            seasonNumber: s,
            episodeCountLabel: `Episodes ${episodes.length}`,
            audioLanguages: aud,
            packs: [],
            episodes: episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0)),
          });
        }

        // If no packs and no episodes matched explicitly, add all as a release option
        if (options.length === 0 && fVal.links.length > 0) {
          const first = fVal.links[0];
          options.push({
            id: `s${s}_${fKey}_gen`,
            title: first.title,
            seasonNumber: s,
            episodeCountLabel: `Episodes ${fVal.links.length}`,
            audioLanguages: formatAudioLanguages(first.audioLanguage, first.title),
            packs: fVal.links,
            episodes: [],
          });
        }

        formats.push({
          id: `s${s}_${fKey}`,
          resolution: fVal.resolution,
          source: fVal.source,
          options,
        });
      });

      // Sort formats by resolution quality
      formats.sort((a, b) => getQualityWeight(b.resolution) - getQualityWeight(a.resolution));
      map.set(s, formats);
    });

    return map;
  }, [seasonsList, enrichedLinks, titleDetails]);

  // Auto-expand Season 1 and the first release option on initial load
  useEffect(() => {
    if (Object.keys(openSeasons).length === 0 && seasonsList.length > 0) {
      const firstSeasonWithLinks = seasonsList.find((s) => {
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
            Select format and release packages to access full batch zip archives and single episodes.
          </p>
        </div>

        {isEffectiveAdmin && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <a
              href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 font-bold text-xs transition-all hover:bg-zinc-800 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
              <span>Admin File Uploader ↗</span>
            </a>
          </div>
        )}
      </div>

      {/* Season Container Accordions (Matching Screenshot Exactly) */}
      <div className="space-y-4">
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
                            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#14223d] text-blue-400 border border-[#1e3a6a] shadow-sm">
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

                        {/* Release Options List */}
                        <div className="space-y-2.5">
                          {group.options.map((option) => {
                            const isOptionOpen = !!openReleaseOptions[option.id];

                            return (
                              <div
                                key={option.id}
                                className="rounded-xl bg-[#0c0a13] border border-[#211f30] hover:border-[#35324b] transition-all overflow-hidden shadow-sm"
                              >
                                {/* Release Option Header Row */}
                                <div
                                  onClick={() => toggleOption(option.id)}
                                  className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer group hover:bg-[#12101c] transition-colors"
                                >
                                  <div className="flex items-center gap-3.5 overflow-hidden">
                                    {/* S01 Orange Tag */}
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

                                {/* Expanded Download Items Area */}
                                {isOptionOpen && (
                                  <div className="p-4 border-t border-[#211f30] bg-[#09080e] space-y-3 animate-fadeIn">
                                    {/* 1. Complete Zip Packs */}
                                    {option.packs.map((pack) => (
                                      <div
                                        key={pack.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#13111d] border border-amber-500/20 hover:border-amber-400/50 hover:bg-[#181524] transition-all gap-3 group/item"
                                      >
                                        <div className="flex items-start sm:items-center gap-3 overflow-hidden">
                                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                                            <FolderArchive className="w-4 h-4" />
                                          </div>
                                          <div className="overflow-hidden space-y-1">
                                            <h5 className="text-xs sm:text-sm font-bold text-white group-hover/item:text-amber-300 transition-colors truncate">
                                              {pack.title}
                                            </h5>
                                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                              <span className={`px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${detectServer(pack.url).badgeClass}`}>
                                                {detectServer(pack.url).badge}
                                              </span>
                                              {pack.quality && (
                                                <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 font-bold border border-blue-500/30">
                                                  {pack.quality}
                                                </span>
                                              )}
                                              {pack.size && (
                                                <span className="text-zinc-400 font-mono">Size: {pack.size}</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                          <a
                                            href={pack.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-105 transition-all"
                                          >
                                            <span>Download Full Zip</span>
                                            <ExternalLink className="w-3.5 h-3.5" />
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
                                                linkTitle: pack.title,
                                                reportedUrl: pack.url,
                                                quality: pack.quality,
                                                server: detectServer(pack.url).name,
                                              })
                                            }
                                            className="p-2 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-zinc-700/60 transition-colors"
                                            title="Report broken or defective zip link"
                                          >
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                          </button>

                                          {isEffectiveAdmin && (
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => handleStartEdit(pack)}
                                                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-zinc-700 transition-colors"
                                                title="Admin: Edit TV Link"
                                              >
                                                <Pencil className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleDelete(pack.id)}
                                                className="p-2 rounded-xl bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                                                title="Admin: Delete TV Link"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}

                                    {/* 2. Single Episodes Grid */}
                                    {option.episodes.length > 0 && (
                                      <div className="space-y-2.5 pt-1">
                                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                          <Tv className="w-3.5 h-3.5 text-amber-400" />
                                          <span>Episode Downloads ({option.episodes.length})</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                          {option.episodes.map((ep) => (
                                            <div
                                              key={ep.id}
                                              className="flex items-center justify-between p-3 rounded-xl bg-[#13111d] border border-zinc-800/80 hover:border-zinc-700 hover:bg-[#181524] transition-all gap-2"
                                            >
                                              <div className="overflow-hidden space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs font-bold text-amber-400 shrink-0">
                                                    EP {ep.episodeNumber || '1'}
                                                  </span>
                                                  <h6 className="text-xs font-semibold text-zinc-200 truncate">
                                                    {ep.title}
                                                  </h6>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                                  <span className={detectServer(ep.url).badgeClass}>
                                                    {detectServer(ep.url).badge}
                                                  </span>
                                                  {ep.size && <span>• {ep.size}</span>}
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <a
                                                  href={ep.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1 transition-all"
                                                >
                                                  <span>Get Link</span>
                                                  <Download className="w-3 h-3" />
                                                </a>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setReportingLink({
                                                      linkId: ep.id,
                                                      movieId: titleDetails.id,
                                                      mediaTitle: titleDetails.title || titleDetails.name || 'Untitled Show',
                                                      mediaType: 'tv',
                                                      posterPath: titleDetails.poster_path,
                                                      linkTitle: ep.title,
                                                      reportedUrl: ep.url,
                                                      quality: ep.quality,
                                                      server: detectServer(ep.url).name,
                                                    })
                                                  }
                                                  className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-amber-400 border border-zinc-700/60"
                                                  title="Report link"
                                                >
                                                  <AlertTriangle className="w-3 h-3" />
                                                </button>
                                                {isEffectiveAdmin && (
                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      onClick={() => handleStartEdit(ep)}
                                                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-700"
                                                      title="Edit Link"
                                                    >
                                                      <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDelete(ep.id)}
                                                      className="p-1.5 rounded-lg bg-rose-900/30 text-rose-400 border border-rose-800/40"
                                                      title="Delete Link"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-2">
                      <p className="text-xs text-zinc-400">
                        No formats or download links uploaded yet for Season {s}.
                      </p>
                      {isEffectiveAdmin && (
                        <a
                          href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Upload Season {s} Links in Admin Panel ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
