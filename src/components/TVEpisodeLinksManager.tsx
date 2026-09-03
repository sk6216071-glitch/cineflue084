'use client';

import React, { useState, useMemo } from 'react';
import {
  FolderArchive,
  Film,
  Download,
  Play,
  Layers,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  Tv,
  Check,
  Globe,
  Radio,
} from 'lucide-react';
import { CustomLink, TitleDetails } from '@/types';
import { saveGlobalCustomLink } from '@/lib/curatedLinks';

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

  // Form states for Admin adding episode / zip links
  const [formSeason, setFormSeason] = useState<number>(1);
  const [formType, setFormType] = useState<'zip_pack' | 'single_episode'>('zip_pack');
  const [formEpisode, setFormEpisode] = useState<number>(1);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [formQuality, setFormQuality] = useState<string>('1080p WEB-DL');
  const [formAudio, setFormAudio] = useState<string>('Hindi + English (Dual)');
  const [formSize, setFormSize] = useState<string>('1.2 GB');

  const numberOfSeasons = titleDetails.number_of_seasons || 3;
  const seasonsList = Array.from({ length: Math.max(1, numberOfSeasons) }, (_, i) => i + 1);

  // Filter links for this TV show by season and mode
  const seasonLinks = useMemo(() => {
    return customLinks.filter((l) => {
      const linkSeason = l.seasonNumber || 1;
      return linkSeason === selectedSeason;
    });
  }, [customLinks, selectedSeason]);

  const zipPackLinks = useMemo(() => {
    return seasonLinks.filter((l) => l.linkType === 'zip_pack' || l.category === 'ZipPack' || l.title.toLowerCase().includes('zip') || l.title.toLowerCase().includes('complete') || l.title.toLowerCase().includes('pack'));
  }, [seasonLinks]);

  const singleEpisodeLinks = useMemo(() => {
    return seasonLinks.filter((l) => l.linkType === 'single_episode' || l.category === 'SingleEpisode' || (l.episodeNumber !== undefined && l.episodeNumber > 0));
  }, [seasonLinks]);

  // Default synthetic fallback links if show has no custom links yet
  const displayZipPacks = useMemo(() => {
    if (zipPackLinks.length > 0) return zipPackLinks;

    // Generated default zip packs for this season
    return [
      {
        id: `auto-zip-4k-s${selectedSeason}`,
        title: `Season ${selectedSeason} Complete Batch [4K 2160p HDR • 10bit HEVC • Dual Audio]`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${titleDetails.name || titleDetails.title} Season ${selectedSeason} 4k zip download`)}`,
        category: 'ZipPack' as const,
        createdAt: new Date().toISOString(),
        seasonNumber: selectedSeason,
        quality: '2160p 4K HDR',
        audioLanguage: 'Hindi + English',
        size: '16.8 GB',
        linkType: 'zip_pack' as const,
      },
      {
        id: `auto-zip-1080p-s${selectedSeason}`,
        title: `Season ${selectedSeason} Complete Zip Pack [1080p WEB-DL • x264 • Dual Audio]`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${titleDetails.name || titleDetails.title} Season ${selectedSeason} 1080p complete pack`)}`,
        category: 'ZipPack' as const,
        createdAt: new Date().toISOString(),
        seasonNumber: selectedSeason,
        quality: '1080p FHD',
        audioLanguage: 'Hindi + English',
        size: '7.4 GB',
        linkType: 'zip_pack' as const,
      },
      {
        id: `auto-zip-720p-s${selectedSeason}`,
        title: `Season ${selectedSeason} Complete Batch [720p HD • x265 HEVC • Hindi Dubbed]`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${titleDetails.name || titleDetails.title} Season ${selectedSeason} 720p hevc pack`)}`,
        category: 'ZipPack' as const,
        createdAt: new Date().toISOString(),
        seasonNumber: selectedSeason,
        quality: '720p HD',
        audioLanguage: 'Hindi + English',
        size: '3.2 GB',
        linkType: 'zip_pack' as const,
      },
    ];
  }, [zipPackLinks, selectedSeason, titleDetails]);

  const displaySingleEpisodes = useMemo(() => {
    if (singleEpisodeLinks.length > 0) return singleEpisodeLinks;

    // Generated default weekly 8 episodes for this season
    const epCount = titleDetails.number_of_episodes ? Math.min(10, Math.ceil(titleDetails.number_of_episodes / numberOfSeasons)) : 8;
    return Array.from({ length: epCount }, (_, i) => {
      const epNum = i + 1;
      const padNum = epNum < 10 ? `0${epNum}` : `${epNum}`;
      return {
        id: `auto-ep-${selectedSeason}-${epNum}`,
        title: `S${selectedSeason < 10 ? '0' + selectedSeason : selectedSeason}E${padNum} - Episode ${epNum}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${titleDetails.name || titleDetails.title} S0${selectedSeason}E${padNum} download 1080p`)}`,
        category: 'SingleEpisode' as const,
        createdAt: new Date().toISOString(),
        seasonNumber: selectedSeason,
        episodeNumber: epNum,
        quality: '1080p & 720p',
        audioLanguage: 'Hindi + English',
        size: '850 MB',
        linkType: 'single_episode' as const,
      };
    });
  }, [singleEpisodeLinks, selectedSeason, titleDetails, numberOfSeasons]);

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
      quality: formQuality,
      audioLanguage: formAudio,
      size: formSize,
      linkType: formType,
    };

    saveGlobalCustomLink(titleDetails.id, newLink);
    setIsOpenAddModal(false);
    setFormTitle('');
    setFormUrl('');
    if (onLinkAdded) onLinkAdded();
  };

  return (
    <div className="bg-[#0f121a] border border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
      {/* Top Header & Admin Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white">TV Series Season & Episode Vault</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Download or stream complete season zip/batch packs and weekly individual episodes.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsOpenAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-md shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add TV Episode / Zip Link
          </button>
        )}
      </div>

      {/* Media Format Specifications & Audio Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Formats:</span>
          {['2160p 4K', '1080p', '720p', 'WEB-DL', 'BluRay', 'REMUX', 'DV HDR', '10bit HEVC'].map((fmt) => (
            <span key={fmt} className="px-2 py-0.5 rounded-md bg-black/60 text-zinc-300 border border-white/10 text-[10px] font-semibold">
              {fmt}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Audios:</span>
          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
            Hindi
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
            English
          </span>
        </div>
      </div>

      {/* Season Selector Bar */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
          Select Season:
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {seasonsList.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeason(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedSeason === s
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                  : 'bg-zinc-900 border border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
            >
              Season {s}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Mode Toggle Button (Matching 4KHDHUB Screenshot) */}
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
          <span>Zip/Pack 🗜️</span>
        </button>

        <button
          onClick={() => setActiveMode('single_episodes')}
          className={`py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeMode === 'single_episodes'
              ? 'bg-gradient-to-r from-zinc-700 to-zinc-800 text-white shadow-lg border border-zinc-600'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Single EP&apos;s 📥</span>
        </button>
      </div>

      {/* Content View 1: Zip/Pack Mode */}
      {activeMode === 'zip_pack' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderArchive className="w-4 h-4 text-amber-400" /> Season {selectedSeason} Complete Zip & Batch Packs
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono">{displayZipPacks.length} Complete Packs Available</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {displayZipPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/25 hover:border-amber-400/60 hover:bg-zinc-800/80 transition-all gap-4 group shadow-md"
              >
                <div className="flex items-start sm:items-center gap-3.5 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden space-y-1">
                    <h5 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors leading-snug">
                      {pack.title}
                    </h5>
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                        {pack.quality || '1080p WEB-DL'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                        {pack.audioLanguage || 'Dual Audio'}
                      </span>
                      <span className="text-zinc-500 font-mono">Size: {pack.size || '7.5 GB'}</span>
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content View 2: Single EP's Weekly Mode */}
      {activeMode === 'single_episodes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-sky-400" /> Season {selectedSeason} Weekly Episodes (Episode-by-Episode)
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono">{displaySingleEpisodes.length} Episodes Ready</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displaySingleEpisodes.map((ep) => (
              <div
                key={ep.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-sky-500/50 hover:bg-zinc-800/80 transition-all gap-3 group shadow-sm"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    EP
                  </div>
                  <div className="overflow-hidden">
                    <h5 className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                      {ep.title}
                    </h5>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span className="text-sky-400 font-semibold">{ep.quality || '1080p / 720p'}</span>
                      <span>•</span>
                      <span className="text-zinc-500 font-mono">{ep.size || '800 MB'}</span>
                    </div>
                  </div>
                </div>

                <a
                  href={ep.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-black font-bold text-xs border border-sky-500/30 flex items-center gap-1 shrink-0 transition-all hover:scale-105"
                >
                  <span>Get Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Add Custom Episode / Zip Link Modal */}
      {isAdmin && isOpenAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141d] border border-amber-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" /> Add TV Episode or Zip Pack Link
              </h4>
              <button
                onClick={() => setIsOpenAddModal(false)}
                className="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleAdminAdd} className="space-y-3">
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
                    max={50}
                    value={formEpisode}
                    onChange={(e) => setFormEpisode(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Title / Label</label>
                <input
                  type="text"
                  placeholder={formType === 'zip_pack' ? 'Season 1 Complete Zip (4K HDR)' : 'Episode 01 - 1080p Web-DL'}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Download / Stream URL</label>
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
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Quality</label>
                  <input
                    type="text"
                    value={formQuality}
                    onChange={(e) => setFormQuality(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Audio</label>
                  <input
                    type="text"
                    value={formAudio}
                    onChange={(e) => setFormAudio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Size</label>
                  <input
                    type="text"
                    value={formSize}
                    onChange={(e) => setFormSize(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-md"
                >
                  Save Link
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
