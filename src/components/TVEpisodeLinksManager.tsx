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
  Info,
  Zap,
  AlertTriangle,
  ChevronDown,
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

  // Open state for individual accordions: e.g. "s1_packs": true, "s1_episodes": true
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
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
  const enrichedLinks = useMemo(() => {
    return customLinks.map((l) => {
      const detectedSeason = detectSeasonNumber(l);
      const detectedEp = detectEpisodeNumber(l);
      const detectedType = detectLinkType({ ...l, episodeNumber: detectedEp });
      const detectedQ = l.quality && l.quality !== 'HD' ? l.quality : detectQuality(l.title, l.quality);
      const detectedAud = l.audioLanguage && l.audioLanguage !== 'Original' ? l.audioLanguage : detectAudio(l.title, l.audioLanguage);
      const detectedSz = l.size || detectSize(l.title);

      return {
        ...l,
        seasonNumber: detectedSeason,
        episodeNumber: detectedEp,
        linkType: detectedType,
        quality: detectedQ,
        audioLanguage: detectedAud,
        size: detectedSz,
      };
    });
  }, [customLinks]);

  // Auto-expand the first season's packs or episodes that have links by default
  useEffect(() => {
    if (enrichedLinks.length > 0 && Object.keys(openAccordions).length === 0) {
      const firstSeasonWithLinks = seasonsList.find((s) =>
        enrichedLinks.some((l) => l.seasonNumber === s)
      ) || seasonsList[0] || 1;

      const hasPacks = enrichedLinks.some((l) => l.seasonNumber === firstSeasonWithLinks && l.linkType === 'zip_pack');
      const hasEpisodes = enrichedLinks.some((l) => l.seasonNumber === firstSeasonWithLinks && l.linkType === 'single_episode');

      const initialOpen: Record<string, boolean> = {};
      if (hasPacks) {
        initialOpen[`s${firstSeasonWithLinks}_packs`] = true;
      }
      if (hasEpisodes && !hasPacks) {
        initialOpen[`s${firstSeasonWithLinks}_episodes`] = true;
      }
      setOpenAccordions(initialOpen);
    }
  }, [enrichedLinks, seasonsList, openAccordions]);

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [key]: !prev[key],
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
            <h3 className="text-lg sm:text-xl font-bold text-white">Season & Episode Management</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Expand any season to view full batch zip packs and weekly single episode releases.
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

      {/* Season Accordion Groups (Matches Screenshot 1 Layout) */}
      <div className="space-y-4">
        {seasonsList.map((s) => {
          const currentSeasonLinks = enrichedLinks.filter((l) => l.seasonNumber === s);
          const packs = currentSeasonLinks
            .filter((l) => l.linkType === 'zip_pack')
            .sort((a, b) => {
              const weightB = getQualityWeight(b.quality);
              const weightA = getQualityWeight(a.quality);
              if (weightB !== weightA) return weightB - weightA;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

          const episodes = currentSeasonLinks
            .filter((l) => l.linkType === 'single_episode')
            .sort((a, b) => {
              const epA = a.episodeNumber || 0;
              const epB = b.episodeNumber || 0;
              if (epA !== epB) return epA - epB;
              return getQualityWeight(b.quality) - getQualityWeight(a.quality);
            });

          const isPacksOpen = !!openAccordions[`s${s}_packs`];
          const isEpisodesOpen = !!openAccordions[`s${s}_episodes`];

          return (
            <div key={s} className="space-y-2.5">
              {/* 1. Season X Packs/Zips Accordion Bar */}
              <div className="rounded-2xl overflow-hidden border border-zinc-800/80 bg-[#12151f] shadow-md transition-all">
                <button
                  type="button"
                  onClick={() => toggleAccordion(`s${s}_packs`)}
                  className="w-full flex items-center justify-between py-3.5 px-4 sm:px-5 bg-[#171a24] hover:bg-[#1e2230] text-zinc-200 transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 group-hover:text-amber-400 transition-transform duration-200 ${
                        isPacksOpen ? 'rotate-180 text-amber-400' : ''
                      }`}
                    />
                    {packs.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                        {packs.length} {packs.length === 1 ? 'Pack' : 'Packs'}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
                    Season {s} Packs/Zips
                  </span>
                </button>

                {isPacksOpen && (
                  <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-[#0e1017] space-y-3 animate-fadeIn">
                    {packs.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {packs.map((pack) => (
                          <div
                            key={pack.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-[#141824] border border-amber-500/20 hover:border-amber-400/50 hover:bg-[#1a1f30] transition-all gap-4 group shadow-md"
                          >
                            <div className="flex items-start sm:items-center gap-3.5 overflow-hidden">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
                                <FolderArchive className="w-5 h-5" />
                              </div>
                              <div className="overflow-hidden space-y-1">
                                <h5 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors leading-snug break-words">
                                  {pack.title}
                                </h5>
                                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                  <span className={`px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${detectServer(pack.url).badgeClass}`}>
                                    {detectServer(pack.url).badge}
                                  </span>
                                  {pack.quality && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                                      {pack.quality}
                                    </span>
                                  )}
                                  {pack.audioLanguage && (
                                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                                      {pack.audioLanguage}
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
                                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-zinc-700/60 hover:border-amber-500/40 transition-colors"
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
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-2">
                        <p className="text-xs text-zinc-400">
                          No full season zip packs uploaded yet for Season {s}.
                        </p>
                        {isEffectiveAdmin && (
                          <a
                            href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Upload Season {s} Zip Packs in Admin Panel ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Season X Episodes Accordion Bar */}
              <div className="rounded-2xl overflow-hidden border border-zinc-800/80 bg-[#12151f] shadow-md transition-all">
                <button
                  type="button"
                  onClick={() => toggleAccordion(`s${s}_episodes`)}
                  className="w-full flex items-center justify-between py-3.5 px-4 sm:px-5 bg-[#171a24] hover:bg-[#1e2230] text-zinc-200 transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 group-hover:text-sky-400 transition-transform duration-200 ${
                        isEpisodesOpen ? 'rotate-180 text-sky-400' : ''
                      }`}
                    />
                    {episodes.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30">
                        {episodes.length} {episodes.length === 1 ? 'Episode' : 'Episodes'}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-zinc-100 group-hover:text-sky-300 transition-colors">
                    Season {s} Episodes
                  </span>
                </button>

                {isEpisodesOpen && (
                  <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-[#0e1017] space-y-3 animate-fadeIn">
                    {episodes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {episodes.map((ep) => (
                          <div
                            key={ep.id}
                            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#141824] border border-zinc-800 hover:border-sky-500/50 hover:bg-[#1a1f30] transition-all gap-3 group shadow-sm"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 font-bold text-xs">
                                {ep.episodeNumber ? `E${ep.episodeNumber < 10 ? '0' + ep.episodeNumber : ep.episodeNumber}` : 'EP'}
                              </div>
                              <div className="overflow-hidden">
                                <h5 className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                                  {ep.title}
                                </h5>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                                  <span className={`px-1.5 py-0.5 rounded font-bold border flex items-center gap-1 ${detectServer(ep.url).badgeClass}`}>
                                    {detectServer(ep.url).badge}
                                  </span>
                                  {ep.quality && (
                                    <span className="text-sky-400 font-semibold">{ep.quality}</span>
                                  )}
                                  {ep.audioLanguage && (
                                    <>
                                      <span>•</span>
                                      <span className="text-zinc-300">{ep.audioLanguage}</span>
                                    </>
                                  )}
                                  {ep.size && (
                                    <>
                                      <span>•</span>
                                      <span className="text-zinc-500 font-mono">{ep.size}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={ep.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-black font-bold text-xs border border-sky-500/30 flex items-center gap-1 transition-all hover:scale-105"
                              >
                                <span>Get Link</span>
                                <ExternalLink className="w-3 h-3" />
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
                                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-zinc-700/60 hover:border-amber-500/40 transition-colors"
                                title="Report broken or defective episode link"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>

                              {isEffectiveAdmin && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleStartEdit(ep)}
                                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-zinc-700 transition-colors"
                                    title="Admin: Edit Episode Link"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(ep.id)}
                                    className="p-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                                    title="Admin: Delete Episode Link"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-2">
                        <p className="text-xs text-zinc-400">
                          No single episodes uploaded yet for Season {s}.
                        </p>
                        {isEffectiveAdmin && (
                          <a
                            href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-xs font-bold transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Upload Season {s} Episodes in Admin Panel ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Can't find the link you want? Request custom quality card */}
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

      {/* Admin Edit TV Link Modal */}
      {isAdmin && editingLink && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141d] border border-amber-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-400" />
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
