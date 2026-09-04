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
  Layers,
  Sparkles,
  Info,
  SlidersHorizontal,
  Zap,
  CheckCircle2,
  X,
  FileText,
  ListPlus,
} from 'lucide-react';
import { CustomLink, TitleDetails } from '@/types';
import {
  saveGlobalCustomLink,
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
  parseBulkLinksInput,
  ParsedBulkItem,
} from '@/lib/seasonParser';

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
  const [activeMode, setActiveMode] = useState<'zip_pack' | 'single_episodes'>('zip_pack');
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isOpenAddModal, setIsOpenAddModal] = useState<boolean>(false);
  const [isOpenBulkContainer, setIsOpenBulkContainer] = useState<boolean>(false);

  // Form states for Admin adding single episode / zip link
  const [formSeason, setFormSeason] = useState<number>(1);
  const [formType, setFormType] = useState<'zip_pack' | 'single_episode'>('zip_pack');
  const [formEpisode, setFormEpisode] = useState<number>(1);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [formQuality, setFormQuality] = useState<string>('1080p WEB-DL');
  const [formAudio, setFormAudio] = useState<string>('English (Original)');
  const [formSize, setFormSize] = useState<string>('1.2 GB');

  // Bulk Multi-Link Importer States
  const [bulkRawText, setBulkRawText] = useState<string>('');
  const [bulkParsedItems, setBulkParsedItems] = useState<ParsedBulkItem[]>([]);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string>('');

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

  // If selectedSeason is not in seasonsList, adjust it
  useEffect(() => {
    if (seasonsList.length > 0 && !seasonsList.includes(selectedSeason)) {
      setSelectedSeason(seasonsList[0]);
    }
  }, [seasonsList, selectedSeason]);

  // Auto-parse bulk text whenever user types/pastes
  useEffect(() => {
    if (!bulkRawText.trim()) {
      setBulkParsedItems([]);
      return;
    }
    const parsed = parseBulkLinksInput(bulkRawText, selectedSeason);
    setBulkParsedItems(parsed);
  }, [bulkRawText, selectedSeason]);

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

  // Filter links strictly for currently selected season (Auto-separated S01 vs S02)
  const seasonLinks = useMemo(() => {
    return enrichedLinks.filter((l) => l.seasonNumber === selectedSeason);
  }, [enrichedLinks, selectedSeason]);

  // Zip / Batch Packs for this season (Sorted by quality weight: 4K 2160p at top)
  const zipPackLinks = useMemo(() => {
    return seasonLinks
      .filter((l) => l.linkType === 'zip_pack')
      .sort((a, b) => {
        const weightB = getQualityWeight(b.quality);
        const weightA = getQualityWeight(a.quality);
        if (weightB !== weightA) return weightB - weightA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [seasonLinks]);

  // Single Episodes for this season (Sorted by Episode 1, 2, 3...)
  const singleEpisodeLinks = useMemo(() => {
    return seasonLinks
      .filter((l) => l.linkType === 'single_episode')
      .sort((a, b) => {
        const epA = a.episodeNumber || 0;
        const epB = b.episodeNumber || 0;
        if (epA !== epB) return epA - epB;
        return getQualityWeight(b.quality) - getQualityWeight(a.quality);
      });
  }, [seasonLinks]);

  // Handle title input change with Auto-Classification intelligence
  const handleTitleInputChange = (val: string) => {
    setFormTitle(val);
    if (val.trim().length > 3) {
      const parsed = parseFullMediaTitle(val);
      if (parsed.seasonNumber) setFormSeason(parsed.seasonNumber);
      if (parsed.episodeNumber) {
        setFormEpisode(parsed.episodeNumber);
        setFormType('single_episode');
      } else if (parsed.linkType) {
        setFormType(parsed.linkType);
      }
      if (parsed.quality) setFormQuality(parsed.quality);
      if (parsed.audioLanguage) setFormAudio(parsed.audioLanguage);
      if (parsed.size) setFormSize(parsed.size);
    }
  };

  const handleAdminAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) return;

    let finalUrl = formUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    const newLink: CustomLink = {
      id: `tv-link-${Date.now()}`,
      title: formTitle.trim(),
      url: finalUrl,
      category: formType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
      createdAt: new Date().toISOString(),
      seasonNumber: formSeason,
      episodeNumber: formType === 'single_episode' ? formEpisode : undefined,
      quality: formQuality.trim() || 'HD',
      audioLanguage: formAudio.trim() || 'Original',
      size: formSize.trim() || undefined,
      linkType: formType,
    };

    saveGlobalCustomLink(titleDetails.id, newLink);
    setIsOpenAddModal(false);
    setFormTitle('');
    setFormUrl('');
    if (onLinkAdded) onLinkAdded();
  };

  // Handle Bulk Import Action
  const handleImportBulkLinks = () => {
    if (bulkParsedItems.length === 0) return;

    bulkParsedItems.forEach((item, index) => {
      const newLink: CustomLink = {
        id: `tv-bulk-${Date.now()}-${index}`,
        title: item.title,
        url: item.url,
        category: item.category,
        createdAt: new Date(Date.now() - index * 1000).toISOString(),
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        quality: item.quality,
        audioLanguage: item.audioLanguage,
        size: item.size,
        linkType: item.linkType,
      };
      saveGlobalCustomLink(titleDetails.id, newLink);
    });

    const count = bulkParsedItems.length;
    setBulkSuccessMsg(`🎉 Successfully imported and auto-arranged ${count} link${count > 1 ? 's' : ''}!`);
    setBulkRawText('');
    setBulkParsedItems([]);
    if (onLinkAdded) onLinkAdded();

    setTimeout(() => {
      setBulkSuccessMsg('');
      setIsOpenBulkContainer(false);
    }, 2800);
  };

  // Toggle type of individual item in bulk preview
  const handleToggleBulkItemType = (id: string) => {
    setBulkParsedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isSingle = item.linkType === 'single_episode';
          return {
            ...item,
            linkType: isSingle ? 'zip_pack' : 'single_episode',
            category: isSingle ? 'ZipPack' : 'SingleEpisode',
            episodeNumber: isSingle ? undefined : item.episodeNumber || 1,
          };
        }
        return item;
      })
    );
  };

  // Convert all items in bulk preview to single episodes or zip packs
  const handleSetAllBulkType = (type: 'single_episode' | 'zip_pack') => {
    setBulkParsedItems((prev) =>
      prev.map((item, index) => ({
        ...item,
        linkType: type,
        category: type === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
        episodeNumber: type === 'single_episode' ? (item.episodeNumber || index + 1) : undefined,
      }))
    );
  };

  // Remove single item from parsed bulk preview before saving
  const handleRemoveParsedItem = (id: string) => {
    setBulkParsedItems((prev) => prev.filter((item) => item.id !== id));
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

  const handleDelete = (linkId: string) => {
    if (confirm('Delete this TV link permanently?')) {
      deleteGlobalCustomLink(titleDetails.id, linkId);
      if (onLinkAdded) onLinkAdded();
    }
  };

  return (
    <div className="bg-[#0f121a] border border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
      {/* Top Header & Admin Triggers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white">TV Series Season & Episode Vault</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Auto-arranged seasons (S01, S02...), full batch zip archives, and weekly single episode releases.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsOpenBulkContainer(!isOpenBulkContainer)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-md hover:scale-105"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>Bulk Multi-Link Importer</span>
            </button>

            <button
              onClick={() => {
                setFormSeason(selectedSeason);
                setIsOpenAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-white font-bold text-xs transition-all hover:bg-zinc-800"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>+ Add Single Link</span>
            </button>
          </div>
        )}
      </div>

      {/* --- NEW: BULK MULTI-LINK AUTO-DETECTOR CONTAINER (ADMIN ONLY) --- */}
      {isAdmin && isOpenBulkContainer && (
        <div className="bg-gradient-to-b from-[#131722] to-[#0d1017] border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  Bulk Multi-Link Auto-Detector Container
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Paste multiple release filenames and links at once — auto-detects S01/S02, Zip Packs vs Single Episodes, Qualities, and Dubs!
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpenBulkContainer(false)}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1"
            >
              ✕ Close
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 block">
              Paste Raw Multi-Link Release Text:
            </label>
            <textarea
              rows={5}
              placeholder={`Paste any number of episode/zip links at once, for example:\nLoki S02E01 1080p WEB-DL Hindi DDP 5.1 - https://drive.google.com/file/d/1...\nLoki S02E02 1080p WEB-DL Hindi DDP 5.1 - https://drive.google.com/file/d/2...\nLoki S02 2160p UHD BluRay DV HDR [Hindi DDP 5.1 + English Atmos].zip https://mega.nz/file/3...`}
              value={bulkRawText}
              onChange={(e) => setBulkRawText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500 leading-relaxed shadow-inner"
              autoFocus
            />
          </div>

          {/* Live Auto-Detection Preview */}
          {bulkParsedItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {bulkParsedItems.length} Links Auto-Detected:
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 font-bold">
                      📥 {bulkParsedItems.filter((i) => i.linkType === 'single_episode').length} Single Episodes
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
                      🗜️ {bulkParsedItems.filter((i) => i.linkType === 'zip_pack').length} Zip Packs
                    </span>
                  </div>
                </div>

                {/* Quick Batch Controls & Import Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetAllBulkType('single_episode')}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[10px] font-bold transition-colors"
                    title="Convert all items to Single Episodes"
                  >
                    📥 Set All as Episodes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllBulkType('zip_pack')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold transition-colors"
                    title="Convert all items to Zip Packs"
                  >
                    🗜️ Set All as Zip Packs
                  </button>

                  <button
                    onClick={handleImportBulkLinks}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-lg hover:scale-105 flex items-center gap-1.5 ml-2"
                  >
                    <ListPlus className="w-4 h-4" />
                    <span>🚀 Import All ({bulkParsedItems.length}) Links</span>
                  </button>
                </div>
              </div>

              {/* Detected Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {bulkParsedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="overflow-hidden space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-black text-[9px] font-mono">
                          SEASON {item.seasonNumber}
                        </span>

                        {/* Interactive Clickable Badge to toggle between Episode and Zip Pack */}
                        <button
                          type="button"
                          onClick={() => handleToggleBulkItemType(item.id)}
                          className={`px-2 py-0.5 rounded font-black text-[9px] font-mono transition-all hover:scale-105 ${
                            item.linkType === 'zip_pack'
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                              : 'bg-sky-500/30 text-sky-200 border border-sky-500/40'
                          }`}
                          title="Click to toggle between Episode and Zip Pack"
                        >
                          {item.linkType === 'zip_pack'
                            ? '🗜️ ZIP PACK (Click to switch)'
                            : `📥 EP ${item.episodeNumber ? (item.episodeNumber < 10 ? '0' + item.episodeNumber : item.episodeNumber) : '?'} (Click to switch)`}
                        </button>
                      </div>
                      <p className="font-bold text-white truncate text-[11px]">{item.title}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span>{item.quality}</span>
                        {item.audioLanguage && <span>• {item.audioLanguage}</span>}
                        {item.size && <span className="text-zinc-500 font-mono">• {item.size}</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveParsedItem(item.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      title="Remove from batch"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bulkSuccessMsg && (
            <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" /> {bulkSuccessMsg}
            </p>
          )}
        </div>
      )}

      {/* Season Selector Bar (S01, S02, S03...) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            Select Season:
          </label>
          <span className="text-[10px] text-amber-400 font-mono font-bold">
            Season {selectedSeason} Active
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seasonsList.map((s) => {
            const countForSeason = enrichedLinks.filter((l) => l.seasonNumber === s).length;
            return (
              <button
                key={s}
                onClick={() => setSelectedSeason(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedSeason === s
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                    : 'bg-zinc-900 border border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>Season {s}</span>
                {countForSeason > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      selectedSeason === s ? 'bg-black text-amber-400' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {countForSeason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dual Mode Toggle Button (Zip/Pack vs Single EP's) */}
      <div className="grid grid-cols-2 rounded-2xl overflow-hidden p-1 bg-zinc-950 border border-zinc-800 shadow-inner">
        <button
          onClick={() => setActiveMode('zip_pack')}
          className={`py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeMode === 'zip_pack'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>Zip/Pack 🗜️ ({zipPackLinks.length})</span>
        </button>

        <button
          onClick={() => setActiveMode('single_episodes')}
          className={`py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeMode === 'single_episodes'
              ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg border border-sky-500'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Single EP&apos;s 📥 ({singleEpisodeLinks.length})</span>
        </button>
      </div>

      {/* Content View 1: Zip/Pack Mode */}
      {activeMode === 'zip_pack' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderArchive className="w-4 h-4 text-amber-400" /> Season {selectedSeason} Complete Zip & Batch Packs
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono">
              {zipPackLinks.length} Pack{zipPackLinks.length !== 1 ? 's' : ''} for Season {selectedSeason}
            </span>
          </div>

          {zipPackLinks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {zipPackLinks.map((pack) => (
                <div
                  key={pack.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/25 hover:border-amber-400/60 hover:bg-zinc-800/80 transition-all gap-4 group shadow-md"
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

                    {isAdmin && (
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
            <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-500">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-300">
                  No Zip / Batch Packs Uploaded Yet for Season {selectedSeason}
                </p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  {isAdmin
                    ? `As an Admin, use the Bulk Importer or click below to add Season ${selectedSeason} zip batch links.`
                    : `Download packs for Season ${selectedSeason} will appear here once published by the admin.`}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setIsOpenBulkContainer(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs transition-transform hover:scale-105"
                  >
                    <Zap className="w-3.5 h-3.5 fill-black" /> Bulk Multi-Link Importer
                  </button>
                  <button
                    onClick={() => {
                      setFormSeason(selectedSeason);
                      setFormType('zip_pack');
                      setIsOpenAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Single Pack
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content View 2: Single EP's Weekly Mode */}
      {activeMode === 'single_episodes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-sky-400" /> Season {selectedSeason} Weekly Single Episodes
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono">
              {singleEpisodeLinks.length} Episode{singleEpisodeLinks.length !== 1 ? 's' : ''} Ready
            </span>
          </div>

          {singleEpisodeLinks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {singleEpisodeLinks.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-sky-500/50 hover:bg-zinc-800/80 transition-all gap-3 group shadow-sm"
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

                    {isAdmin && (
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
            <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-500">
                <Download className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-300">
                  No Single Episode Links Uploaded Yet for Season {selectedSeason}
                </p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  {isAdmin
                    ? `As an Admin, paste multiple links at once using the Bulk Importer or add one by one.`
                    : `Episode links for Season ${selectedSeason} will appear here as soon as published by the admin.`}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setIsOpenBulkContainer(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs transition-transform hover:scale-105"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" /> Bulk Import Multiple Episodes
                  </button>
                  <button
                    onClick={() => {
                      setFormSeason(selectedSeason);
                      setFormType('single_episode');
                      setIsOpenAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Single Episode
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin Add Single Custom Episode / Zip Link Modal */}
      {isAdmin && isOpenAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141d] border border-amber-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Add TV Episode or Zip Pack Link
                </h4>
              </div>
              <button
                onClick={() => setIsOpenAddModal(false)}
                className="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleAdminAdd} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Title / Release Name <span className="text-amber-400 text-[10px]">(Auto-detects S01, S02, Ep, Quality & Audio)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Loki S02 2160p UHD BluRay DV HDR [Hindi DDP 5.1 + English Atmos].zip"
                  value={formTitle}
                  onChange={(e) => handleTitleInputChange(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Season #</label>
                  <select
                    value={formSeason}
                    onChange={(e) => setFormSeason(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {seasonsList.map((s) => (
                      <option key={s} value={s}>
                        Season {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Link Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="zip_pack">🗜️ Zip / Batch Pack</option>
                    <option value="single_episode">📥 Single Episode (Weekly)</option>
                  </select>
                </div>
              </div>

              {formType === 'single_episode' && (
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Episode #</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formEpisode}
                    onChange={(e) => setFormEpisode(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Download / Stream Destination URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Quality / Format</label>
                  <input
                    type="text"
                    placeholder="e.g. 2160p 4K, 1080p"
                    value={formQuality}
                    onChange={(e) => setFormQuality(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Audio / Language</label>
                  <input
                    type="text"
                    placeholder="e.g. Hindi + English"
                    value={formAudio}
                    onChange={(e) => setFormAudio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">File Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 16.8 GB, 7.4 GB"
                    value={formSize}
                    onChange={(e) => setFormSize(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsOpenAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-md hover:scale-105"
                >
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                className="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Title / Release Name
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Season #</label>
                  <select
                    value={editSeason}
                    onChange={(e) => setEditSeason(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {seasonsList.map((s) => (
                      <option key={s} value={s}>
                        Season {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Link Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="zip_pack">🗜️ Zip / Batch Pack</option>
                    <option value="single_episode">📥 Single Episode (Weekly)</option>
                  </select>
                </div>
              </div>

              {editType === 'single_episode' && (
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Episode #</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={editEpisode}
                    onChange={(e) => setEditEpisode(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Download / Stream Destination URL</label>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Quality / Format</label>
                  <input
                    type="text"
                    value={editQuality}
                    onChange={(e) => setEditQuality(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Audio / Language</label>
                  <input
                    type="text"
                    value={editAudio}
                    onChange={(e) => setEditAudio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">File Size</label>
                  <input
                    type="text"
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
    </div>
  );
};

export default TVEpisodeLinksManager;
