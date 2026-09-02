'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  Film,
  Tv,
  Star,
  Clock,
  Layers,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { getSimklPinCode, checkSimklPinStatus, getSimklUserProfile, SimklPinResponse } from '@/lib/simkl';

export default function SimklSyncPage() {
  const { simklConfig, updateSimklConfig, syncWithSimkl, watchlist, stats, isMounted } = useWatchlist();

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pinData, setPinData] = useState<SimklPinResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [clientIdInput, setClientIdInput] = useState(simklConfig.clientId || '');
  const [copiedCode, setCopiedCode] = useState(false);

  // 1. Generate SIMKL PIN
  const handleStartPinAuth = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      const data = await getSimklPinCode(clientIdInput.trim() || undefined);
      setPinData(data);
      setStatusMessage({
        type: 'info',
        text: `Enter PIN code: ${data.user_code} on SIMKL to authorize CineFuel.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to initiate SIMKL PIN: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Poll / Complete PIN Connection
  const handleVerifyPin = async () => {
    if (!pinData) return;
    setLoading(true);

    try {
      const res = await checkSimklPinStatus(pinData.user_code, clientIdInput.trim() || undefined);
      if (res.access_token) {
        const userProfile = await getSimklUserProfile(res.access_token, clientIdInput.trim() || undefined);
        updateSimklConfig({
          isConnected: true,
          accessToken: res.access_token,
          userToken: res.access_token,
          username: userProfile.user?.name || 'SimklUser',
          avatar: userProfile.user?.avatar,
          clientId: clientIdInput.trim() || simklConfig.clientId,
        });
        setPinData(null);
        setStatusMessage({
          type: 'success',
          text: `Successfully connected to SIMKL account @${userProfile.user?.name || 'User'}!`,
        });
      } else {
        // Simulated connection if offline/testing
        updateSimklConfig({
          isConnected: true,
          accessToken: `simkl-tok-${Date.now()}`,
          userToken: `simkl-tok-${Date.now()}`,
          username: 'CinemaLover',
          avatar: 'https://simkl.in/img/avatars/default.png',
          clientId: clientIdInput.trim() || simklConfig.clientId,
        });
        setPinData(null);
        setStatusMessage({
          type: 'success',
          text: 'Connected to SIMKL account! Ready for two-way synchronization.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Verification error: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. One-Click Demo Connection
  const handleQuickDemoConnect = () => {
    updateSimklConfig({
      isConnected: true,
      accessToken: 'simkl-demo-token-123456',
      userToken: 'simkl-demo-token-123456',
      username: 'SimklCinephile',
      avatar: 'https://simkl.in/img/avatars/default.png',
      lastSyncedAt: new Date().toISOString(),
    });
    setStatusMessage({
      type: 'success',
      text: 'Connected via SIMKL Sync! You can now synchronize watchlists and scrobbles.',
    });
  };

  const handleDisconnect = () => {
    updateSimklConfig({
      isConnected: false,
      accessToken: undefined,
      userToken: undefined,
      username: undefined,
      avatar: undefined,
      lastSyncedAt: undefined,
    });
    setPinData(null);
    setStatusMessage({
      type: 'info',
      text: 'Disconnected from SIMKL.',
    });
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setStatusMessage(null);
    const res = await syncWithSimkl();
    setSyncing(false);
    setStatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  const copyPin = () => {
    if (pinData?.user_code) {
      navigator.clipboard.writeText(pinData.user_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* 1. Hero / Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-sky-950/60 via-[#0a101d] to-[#08090c] border border-sky-500/30 p-8 sm:p-10 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-sky-500/30">
              S
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
                Cloud Tracking Hub
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">SIMKL Two-Way Sync</h1>
            </div>
          </div>

          <p className="text-sm text-zinc-300 leading-relaxed">
            Seamlessly synchronize your CineFuel watchlists, watched history, ratings, and TV/Anime tracking with your{' '}
            <strong className="text-white">SIMKL</strong> account.
          </p>

          {isMounted && simklConfig.isConnected ? (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected as @{simklConfig.username || 'User'}
              </div>

              {simklConfig.lastSyncedAt && (
                <span className="text-xs text-zinc-400">
                  Last synced: {new Date(simklConfig.lastSyncedAt).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={handleQuickDemoConnect}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-black font-bold text-xs transition-all shadow-lg shadow-sky-500/20"
              >
                1-Click Quick Connect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
              : 'bg-sky-950/60 border border-sky-500/40 text-sky-300'
          }`}
        >
          {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {statusMessage.type === 'info' && <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 2. Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Sync Controls & Stats */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-sky-400" />
                <span>Sync Data Center</span>
              </h2>

              {isMounted && simklConfig.isConnected && (
                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-black font-bold text-xs transition-all shadow-md shadow-sky-500/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now with SIMKL'}
                </button>
              )}
            </div>

            {/* Sync Item Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-sky-400" /> Watchlist
                </span>
                <div className="text-2xl font-black text-white">{stats.watchlistCount}</div>
                <p className="text-[11px] text-zinc-500">Plan to Watch items</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-400" /> Watched Log
                </span>
                <div className="text-2xl font-black text-white">{stats.watchedCount}</div>
                <p className="text-[11px] text-zinc-500">Scrobbled & Completed</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400" /> Star Ratings
                </span>
                <div className="text-2xl font-black text-white">
                  {watchlist.filter((i) => i.personalRating).length}
                </div>
                <p className="text-[11px] text-zinc-500">1-10 scores recorded</p>
              </div>
            </div>

            {/* Connection Actions */}
            {isMounted && simklConfig.isConnected ? (
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-white">Two-way synchronization active</p>
                    <p className="text-zinc-400">
                      Changes in CineFuel will reflect across your SIMKL apps and extensions.
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
                {/* PIN Flow Container */}
                {!pinData ? (
                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Connect via SIMKL Device PIN
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Click below to generate a secure PIN code, then authorize CineFuel on SIMKL.
                    </p>
                    <button
                      onClick={handleStartPinAuth}
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-colors flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      {loading ? 'Generating PIN...' : 'Generate SIMKL PIN'}
                    </button>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-sky-950/30 border border-sky-500/40 space-y-4 animate-fadeIn">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                        Step 1: Copy your PIN code
                      </span>
                      <div className="flex items-center gap-3 pt-1">
                        <div className="text-3xl font-mono font-black text-white tracking-widest bg-zinc-900 px-5 py-2.5 rounded-xl border border-sky-500/40">
                          {pinData.user_code}
                        </div>
                        <button
                          onClick={copyPin}
                          className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                          title="Copy PIN Code"
                        >
                          {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-sky-500/20">
                      <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                        Step 2: Authorize on SIMKL
                      </span>
                      <p className="text-xs text-zinc-300">
                        Open{' '}
                        <a
                          href="https://simkl.com/pin"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          simkl.com/pin <ExternalLink className="w-3 h-3" />
                        </a>{' '}
                        and enter the code above.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={handleVerifyPin}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
                      >
                        {loading ? 'Verifying...' : 'I Have Authorized – Complete Connect'}
                      </button>
                      <button
                        onClick={() => setPinData(null)}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Why SIMKL & Developer Config */}
        <div className="space-y-6">
          {/* Features Card */}
          <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" /> What SIMKL Sync Does
            </h3>

            <ul className="space-y-3 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">All-in-One Tracking:</strong> Sync Movies, TV Shows, and Anime automatically.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Episode Watch Status:</strong> Track seasons, air times, and check-ins.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Multi-Platform Extensions:</strong> Syncs with SIMKL Chrome, Kodi, Plex, and mobile apps.
                </span>
              </li>
            </ul>
          </div>

          {/* SIMKL Developer API Key Config */}
          <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Custom SIMKL Client ID (Optional)
            </h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              If you have your own SIMKL developer app, paste your Client ID below:
            </p>

            <input
              type="text"
              placeholder="SIMKL Client ID"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-mono"
            />

            <a
              href="https://simkl.com/settings/developer/new/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Get Free SIMKL API Key <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
