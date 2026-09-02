'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Star,
  Layers,
  Key,
  Database,
  BarChart3,
  Award,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { testMdblistApiKey } from '@/lib/mdblist';

export default function MdblistPage() {
  const { mdblistConfig, updateMdblistConfig, syncWithMdblist, isMounted } = useWatchlist();

  const [apiKeyInput, setApiKeyInput] = useState(mdblistConfig.apiKey || '');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  const handleSaveAndTest = async () => {
    if (!apiKeyInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your MDBList API key.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const res = await testMdblistApiKey(apiKeyInput.trim());
    setLoading(false);

    if (res.success) {
      updateMdblistConfig({
        apiKey: apiKeyInput.trim(),
        isConnected: true,
        username: res.user?.name || 'MDBList Member',
        lastSyncedAt: new Date().toISOString(),
      });
      setStatusMessage({
        type: 'success',
        text: 'Connected to MDBList API! Multi-source aggregated ratings are now active.',
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to validate MDBList API Key.',
      });
    }
  };

  const handleQuickDemoConnect = () => {
    updateMdblistConfig({
      apiKey: 'mdblist-demo-access-key',
      isConnected: true,
      username: 'MDBList VIP Explorer',
      lastSyncedAt: new Date().toISOString(),
    });
    setStatusMessage({
      type: 'success',
      text: 'Connected to MDBList Aggregator! All rating sources & scores enabled.',
    });
  };

  const handleDisconnect = () => {
    updateMdblistConfig({
      apiKey: '',
      isConnected: false,
      username: undefined,
      lastSyncedAt: undefined,
    });
    setApiKeyInput('');
    setStatusMessage({
      type: 'info',
      text: 'Disconnected from MDBList.',
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* 1. Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-950/60 via-[#0a1815] to-[#08090c] border border-emerald-500/30 p-8 sm:p-10 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-emerald-500/30">
              M
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Multi-Source Ratings & List Engine
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">MDBList Integration</h1>
            </div>
          </div>

          <p className="text-sm text-zinc-300 leading-relaxed">
            MDBList aggregates rating intelligence across{' '}
            <strong className="text-white">
              IMDb, TMDB, Rotten Tomatoes (Critics & Audience), Metacritic, Letterboxd, Trakt, and Anime Databases
            </strong>{' '}
            into a unified weighted score.
          </p>

          {isMounted && mdblistConfig.isConnected ? (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected as @{mdblistConfig.username || 'MDBList Member'}
              </div>

              {mdblistConfig.lastSyncedAt && (
                <span className="text-xs text-zinc-400">
                  Last verified: {new Date(mdblistConfig.lastSyncedAt).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={handleQuickDemoConnect}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-black font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
              >
                1-Click Quick Connect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Feedback Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
              : 'bg-zinc-900 border border-zinc-700 text-zinc-300'
          }`}
        >
          {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 2. Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: API Configuration */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <span>MDBList API Connection</span>
              </h2>

              <span className="text-xs text-zinc-500 font-semibold">mdblist.com/api</span>
            </div>

            {isMounted && mdblistConfig.isConnected ? (
              <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-white">MDBList Multi-Source Active</p>
                    <p className="text-zinc-400">
                      Ratings from Rotten Tomatoes, Metacritic, Letterboxd, and IMDb are actively combined.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 border border-zinc-700 hover:border-rose-500/40 text-xs font-semibold transition-all shrink-0"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    Your MDBList API Key
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your MDBList API key (e.g. k9f8e7d6c5...)"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Get your free API key from your{' '}
                    <a
                      href="https://mdblist.com/preferences/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 underline font-semibold inline-flex items-center gap-0.5"
                    >
                      MDBList Preferences <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    .
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={handleSaveAndTest}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {loading ? 'Validating Key...' : 'Connect MDBList Key'}
                  </button>

                  <button
                    onClick={handleQuickDemoConnect}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold text-xs transition-colors"
                  >
                    Use Built-in Simulator
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Aggregator Preview Card */}
          <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <span>Aggregated Sources Breakdown</span>
              </h3>
              <span className="text-xs text-emerald-400 font-bold">8+ Ratings Combined</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <span className="text-[11px] font-bold text-[#f5c518]">IMDb</span>
                <div className="text-lg font-black text-white mt-1">8.5 / 10</div>
                <span className="text-[10px] text-zinc-500">420k user votes</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <span className="text-[11px] font-bold text-red-400">🍅 RT Critics</span>
                <div className="text-lg font-black text-white mt-1">93%</div>
                <span className="text-[10px] text-zinc-500">380 reviews</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <span className="text-[11px] font-bold text-emerald-400">🍿 RT Audience</span>
                <div className="text-lg font-black text-white mt-1">91%</div>
                <span className="text-[10px] text-zinc-500">10k+ ratings</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <span className="text-[11px] font-bold text-[#00e054]">Letterboxd</span>
                <div className="text-lg font-black text-white mt-1">4.2 / 5</div>
                <span className="text-[10px] text-zinc-500">290k members</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <span className="text-[11px] font-bold text-yellow-400">Metacritic</span>
                <div className="text-lg font-black text-white mt-1">88 / 100</div>
                <span className="text-[10px] text-zinc-500">Metascore</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <span className="text-[11px] font-bold text-[#01d277]">TMDB</span>
                <div className="text-lg font-black text-white mt-1">8.2 / 10</div>
                <span className="text-[10px] text-zinc-500">12.5k votes</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <span className="text-[11px] font-bold text-sky-400">Trakt</span>
                <div className="text-lg font-black text-white mt-1">83%</div>
                <span className="text-[10px] text-zinc-500">45k scrobbles</span>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/60 to-zinc-900 border border-emerald-500/40">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <Award className="w-3 h-3" /> MDBList Score
                </span>
                <div className="text-lg font-black text-emerald-300 mt-1">86 / 100</div>
                <span className="text-[10px] text-zinc-400">Weighted Average</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Why MDBList */}
        <div className="space-y-6">
          <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Key Benefits
            </h3>

            <ul className="space-y-3 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Unified Score:</strong> Combines ratings from 8+ platforms into an accurate consensus score.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Tomatometer & Metascore:</strong> Instant access to Rotten Tomatoes and Metacritic reviews.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Plex & Dynamic Lists:</strong> Compatible with MDBList user-created auto-updating lists.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
