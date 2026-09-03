'use client';

import React, { useState, useMemo } from 'react';
import {
  FolderArchive,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Tv,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { CustomLink, TitleDetails } from '@/types';
import { saveGlobalCustomLink, deleteGlobalCustomLink } from '@/lib/curatedLinks';

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
  const [formAudio, setFormAudio] = useState<string>('English (Original)');
  const [formSize, setFormSize] = useState<string>('1.2 GB');

  const numberOfSeasons = titleDetails.number_of_seasons || 1;
  const seasonsList = Array.from({ length: Math.max(1, numberOfSeasons) }, (_, i) => i + 1);

  // Filter links for this TV show by season and mode (ONLY Admin uploaded links)
  const seasonLinks = useMemo(() => {
    return customLinks.filter((l) => {
      const linkSeason = l.seasonNumber || 1;
      return linkSeason === selectedSeason;
    });
  }, [customLinks, selectedSeason]);

  const zipPackLinks = useMemo(() => {
    return seasonLinks.filter(
      (l) =>
        l.linkType === 'zip_pack' ||
        l.category === 'ZipPack' ||
        l.title.toLowerCase().includes('zip') ||
        l.title.toLowerCase().includes('complete') ||
        l.title.toLowerCase().includes('pack')
    );
  }, [seasonLinks]);

  const singleEpisodeLinks = useMemo(() => {
    return seasonLinks
      .filter(
        (l) =>
          l.linkType === 'single_episode' ||
          l.category === 'SingleEpisode' ||
          (l.episodeNumber !== undefined && l.episodeNumber > 0)
      )
      .sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
  }, [seasonLinks]);

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

  const handleDelete = (linkId: string) => {
    if (confirm('Delete this TV link permanently?')) {
      deleteGlobalCustomLink(titleDetails.id, linkId);
      if (onLinkAdded) onLinkAdded();
    }
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
            Admin-managed season zip batch archives and weekly single episode releases.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setFormSeason(selectedSeason);
              setIsOpenAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs transition-all shadow-md shrink-0 self-start sm:self-auto hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Add TV Season / Episode Link
          </button>
        )}
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

      {/* Dual Mode Toggle Button */}
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
              {zipPackLinks.length} Pack{zipPackLinks.length !== 1 ? 's' : ''} Available
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
                      <h5 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors leading-snug">
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
                          <span className="text-zinc-500 font-mono">Size: {pack.size}</span>
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
                      <button
                        onClick={() => handleDelete(pack.id)}
                        className="p-2 rounded-xl bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                        title="Delete Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                    ? 'As an Admin, you can add verified full season zip packs with specific resolutions, audio dubs, and file sizes.'
                    : 'Download packs for this season will be published by the admin soon.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setFormSeason(selectedSeason);
                    setFormType('zip_pack');
                    setIsOpenAddModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" /> Add Season {selectedSeason} Zip Pack
                </button>
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
                      <button
                        onClick={() => handleDelete(ep.id)}
                        className="p-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                        title="Delete Link"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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
                    ? 'As an Admin, you can add weekly individual episodes as they air with custom audio, quality, and download links.'
                    : 'Episode links for this season will appear here as soon as published by the admin.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setFormSeason(selectedSeason);
                    setFormType('single_episode');
                    setIsOpenAddModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" /> Add Episode for Season {selectedSeason}
                </button>
              )}
            </div>
          )}
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
                    max={100}
                    value={formEpisode}
                    onChange={(e) => setFormEpisode(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Title / Release Name</label>
                <input
                  type="text"
                  placeholder={
                    formType === 'zip_pack'
                      ? 'e.g., Season 1 Complete [1080p WEB-DL • English]'
                      : 'e.g., S01E01 - Episode 1 [1080p English]'
                  }
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
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Quality / Format</label>
                  <input
                    type="text"
                    placeholder="e.g. 1080p WEB-DL, 4K HDR, 720p"
                    value={formQuality}
                    onChange={(e) => setFormQuality(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Audio / Language</label>
                  <input
                    type="text"
                    placeholder="e.g. English, Hindi, Dual Audio, etc."
                    value={formAudio}
                    onChange={(e) => setFormAudio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">File Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.2 GB, 800 MB, 14 GB"
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
