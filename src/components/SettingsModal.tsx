'use client';

import React, { useState } from 'react';
import { X, Key, Globe, Download, Upload, Trash2, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    settings,
    updateSettings,
    simklConfig,
    updateSimklConfig,
    mdblistConfig,
    updateMdblistConfig,
    watchlist,
  } = useWatchlist();
  const [tmdbKey, setTmdbKey] = useState(settings.tmdbApiKey);
  const [region, setRegion] = useState(settings.defaultRegion);
  const [simklClientId, setSimklClientId] = useState(simklConfig.clientId);
  const [mdblistApiKey, setMdblistApiKey] = useState(mdblistConfig.apiKey);
  const [savedMessage, setSavedMessage] = useState('');

  const handleSave = () => {
    updateSettings({
      tmdbApiKey: tmdbKey.trim(),
      mdblistApiKey: mdblistApiKey.trim(),
      defaultRegion: region,
    });
    updateSimklConfig({
      clientId: simklClientId.trim(),
    });
    updateMdblistConfig({
      apiKey: mdblistApiKey.trim(),
    });
    setSavedMessage('Settings saved successfully!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(watchlist, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cinefuel-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          localStorage.setItem('cinefuel_watchlist', JSON.stringify(imported));
          window.location.reload();
        } else {
          alert('Invalid backup file format.');
        }
      } catch {
        alert('Could not parse JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#0e1117] border border-zinc-700/70 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">CineFuel Settings & APIs</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {savedMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{savedMessage}</span>
            </div>
          )}

          {/* TMDB API Key */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-medium text-zinc-200">
              <Key className="w-4 h-4 text-amber-400" />
              TMDB API Key (v3 auth)
            </label>
            <input
              type="text"
              placeholder="e.g. 3a7b8c... (Leave empty to use built-in rich catalog)"
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <p className="text-xs text-zinc-400">
              Optional. If not provided, CineFuel runs seamlessly using the built-in curated catalog and Indian OTT streaming info.
            </p>
          </div>

          {/* Default Watch Region */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-medium text-zinc-200">
              <Globe className="w-4 h-4 text-amber-400" />
              Default Streaming Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option value="IN">India (🇮🇳 Netflix, Hotstar, Prime, JioCinema, Zee5, SonyLIV)</option>
              <option value="US">United States (🇺🇸 Netflix, Max, Hulu, Prime)</option>
              <option value="GB">United Kingdom (🇬🇧 BBC iPlayer, Sky, Netflix)</option>
              <option value="CA">Canada (🇨🇦 Crave, Netflix, Prime)</option>
            </select>
          </div>

          {/* SIMKL API Client ID */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-medium text-zinc-200">
              <span className="w-4 h-4 rounded bg-sky-500 text-[10px] text-black font-black flex items-center justify-center">
                S
              </span>
              SIMKL API Client ID (Optional)
            </label>
            <input
              type="text"
              placeholder="Optional SIMKL Client ID"
              value={simklClientId}
              onChange={(e) => setSimklClientId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* MDBList API Key */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-medium text-zinc-200">
              <span className="w-4 h-4 rounded bg-emerald-500 text-[10px] text-black font-black flex items-center justify-center">
                M
              </span>
              MDBList API Key (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. k9f8e7d6c5... (mdblist.com/preferences)"
              value={mdblistApiKey}
              onChange={(e) => setMdblistApiKey(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono text-xs"
            />
            <p className="text-[11px] text-zinc-400">
              Enables multi-source aggregated ratings from Rotten Tomatoes, Metacritic, Letterboxd, IMDb, and AniList.
            </p>
          </div>

          {/* Data Backup & Export */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <h3 className="font-semibold text-zinc-200">Backup & Storage</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors border border-zinc-700"
              >
                <Download className="w-3.5 h-3.5" />
                Export Watchlist JSON
              </button>
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors border border-zinc-700 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Import Backup JSON
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-semibold text-sm transition-all shadow-lg shadow-amber-500/20"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
