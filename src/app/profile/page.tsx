'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User as UserIcon,
  Mail,
  Edit3,
  Check,
  Star,
  Clock,
  Eye,
  Bookmark,
  Heart,
  Layers,
  Sparkles,
  ShieldCheck,
  LogOut,
  LogIn,
  Film,
  Tv,
  CheckCircle2,
  XCircle,
  Clock3,
  Play,
  RefreshCw,
  Send,
  Bell,
  Wrench,
  ExternalLink,
  Copy,
  Check as CheckIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWatchlist } from '@/context/WatchlistContext';
import AuthModal from '@/components/AuthModal';
import { UserRequest, DefectiveLinkReport, TelegramLink } from '@/types';

export default function ProfilePage() {
  const { userProfile, updateProfileData, isLoggedIn, logout, getIdToken } = useAuth();
  const { stats, watchlist } = useWatchlist();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(userProfile.displayName || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // My Requests state
  const [myRequests, setMyRequests] = useState<UserRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected'>('all');

  // Telegram Notifications state
  const [telegramStatus, setTelegramStatus] = useState<{
    isLinked: boolean;
    link: TelegramLink | null;
    botUsername: string;
  }>({
    isLinked: false,
    link: null,
    botUsername: 'CineFlue_bot',
  });
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(false);
  const [linkingData, setLinkingData] = useState<{
    token: string;
    expiresAt: string;
    botUsername: string;
    telegramUrl: string;
  } | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);

  // My Reports state
  const [myReports, setMyReports] = useState<DefectiveLinkReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'fixed' | 'dismissed'>('all');

  const fetchTelegramStatus = async () => {
    if (!isLoggedIn) return;
    setIsLoadingTelegram(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setIsLoadingTelegram(false);
        return;
      }
      const res = await fetch(`/api/telegram/link-token?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramStatus({
          isLinked: !!data.isLinked,
          link: data.link || null,
          botUsername: data.botUsername || 'CineFlue_bot',
        });
        if (data.isLinked) {
          setLinkingData(null);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Telegram status:', err);
    } finally {
      setIsLoadingTelegram(false);
    }
  };

  const handleGenerateTelegramLink = async () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    setIsGeneratingToken(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/telegram/link-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setLinkingData({
            token: data.token,
            expiresAt: data.expiresAt,
            botUsername: data.botUsername,
            telegramUrl: data.telegramUrl,
          });
        }
      }
    } catch (err) {
      console.warn('Failed to generate Telegram linking token:', err);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleTogglePreference = async (pref: 'requestNotifications' | 'reportNotifications', value: boolean) => {
    if (!isLoggedIn || !telegramStatus.link) return;
    setIsUpdatingPrefs(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      // Optimistic update
      setTelegramStatus((prev) => ({
        ...prev,
        link: prev.link ? { ...prev.link, [pref]: value } : null,
      }));

      await fetch('/api/telegram/link-token', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [pref]: value }),
      });
    } catch (err) {
      console.warn('Failed to update Telegram preferences:', err);
      fetchTelegramStatus();
    } finally {
      setIsUpdatingPrefs(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!isLoggedIn) return;
    setIsLoadingTelegram(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/telegram/link-token', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTelegramStatus((prev) => ({ ...prev, isLinked: false, link: null }));
        setLinkingData(null);
      }
    } catch (err) {
      console.warn('Failed to disconnect Telegram:', err);
    } finally {
      setIsLoadingTelegram(false);
    }
  };

  const fetchMyReports = async () => {
    if (!isLoggedIn) {
      setMyReports([]);
      return;
    }
    setIsLoadingReports(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setIsLoadingReports(false);
        return;
      }
      const res = await fetch(`/api/reports?my=true&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          setMyReports(data.reports);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch personal reports:', err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const fetchMyRequests = async () => {
    if (!isLoggedIn) {
      setMyRequests([]);
      return;
    }
    setIsLoadingRequests(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setIsLoadingRequests(false);
        return;
      }
      const res = await fetch(`/api/requests?my=true&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          setMyRequests(data.requests);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch personal requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchMyRequests();
      fetchMyReports();
      fetchTelegramStatus();
    } else {
      setMyRequests([]);
      setMyReports([]);
      setTelegramStatus({ isLinked: false, link: null, botUsername: 'CineFlue_bot' });
      setLinkingData(null);
    }
  }, [isLoggedIn]);

  // Sync state whenever userProfile changes
  React.useEffect(() => {
    setDisplayName(userProfile.displayName || '');
    setBio(userProfile.bio || '');
  }, [userProfile]);

  // Compute Rating Distribution (1★ to 10★)
  const ratingDistribution = Array.from({ length: 10 }, (_, i) => i + 1).map((star) => {
    const count = watchlist.filter((item) => Math.round(item.personalRating || 0) === star).length;
    return { star, count };
  });

  const maxRatingCount = Math.max(...ratingDistribution.map((r) => r.count), 1);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileData({
      displayName: displayName.trim(),
      bio: bio.trim(),
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* 1. Profile Header Card */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 via-orange-500 to-red-600 p-1 shadow-xl shadow-amber-500/20 shrink-0">
              <div className="w-full h-full bg-[#090b0e] rounded-full overflow-hidden flex items-center justify-center text-white font-black text-3xl">
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'Profile'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  userProfile.displayName ? userProfile.displayName[0].toUpperCase() : 'U'
                )}
              </div>
            </div>

            {/* Name & Bio */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Welcome, {userProfile.displayName || userProfile.name || 'Cinema Explorer'}
                </h1>
                {isLoggedIn ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Cloud Synced
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
                      {userProfile.provider === 'google' || userProfile.provider === 'google.com' ? 'Google Account' : 'Verified Identity'}
                    </span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold">
                    Guest Mode
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-zinc-500" /> {userProfile.email}
              </p>

              <p className="text-xs sm:text-sm text-zinc-300 max-w-xl pt-1 leading-relaxed">
                {userProfile.bio || 'Cinema enthusiast tracking films and discovering stories on CiNEPHiLE.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>

            {!isLoggedIn ? (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In / Sync
              </button>
            ) : (
              <button
                onClick={logout}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="pt-4 border-t border-zinc-800 space-y-4 animate-fadeIn">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Update Profile Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Bio / Slogan</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Lifetime Cinema Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-zinc-400">Total Logged</span>
          <div className="my-1.5 text-3xl font-black text-white">{stats.totalItems}</div>
          <span className="text-[11px] text-zinc-500">Movies & shows</span>
        </div>

        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Watched Count
          </span>
          <div className="my-1.5 text-3xl font-black text-emerald-400">{stats.watchedCount}</div>
          <span className="text-[11px] text-zinc-500">Completed titles</span>
        </div>

        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Screen Time
          </span>
          <div className="my-1.5 text-3xl font-black text-amber-400">
            {Math.floor(stats.totalRuntimeMinutes / 60)}h {stats.totalRuntimeMinutes % 60}m
          </div>
          <span className="text-[11px] text-zinc-500">Logged viewing duration</span>
        </div>

        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" /> Favorites
          </span>
          <div className="my-1.5 text-3xl font-black text-rose-400">{stats.favoritesCount}</div>
          <span className="text-[11px] text-zinc-500">Avg score: {stats.averageRating > 0 ? `${stats.averageRating}★` : '—'}</span>
        </div>
      </div>

      {/* 3. Star Rating Distribution Histogram */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="text-lg font-bold text-white">Your Star Rating Distribution</h2>
          </div>
          <span className="text-xs text-zinc-400 font-semibold">1★ to 10★ Scores</span>
        </div>

        <div className="space-y-2.5">
          {ratingDistribution.map(({ star, count }) => {
            const percentage = Math.round((count / maxRatingCount) * 100);
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-right font-bold text-zinc-300">{star}★</span>
                <div className="flex-1 bg-zinc-900 rounded-full h-3 overflow-hidden border border-zinc-800">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${count > 0 ? Math.max(8, percentage) : 0}%` }}
                  />
                </div>
                <span className="w-8 text-left font-semibold text-zinc-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Telegram Notifications Section */}
      <section id="telegram-notifications" className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl scroll-mt-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Send className="w-4 h-4 -rotate-12" />
              </div>
              <h2 className="text-lg font-bold text-white">Telegram Instant Alerts</h2>
              {telegramStatus.isLinked && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Receive direct Telegram messages the second your requested titles are uploaded or reported links are resolved.
            </p>
          </div>

          {isLoggedIn && (
            <button
              type="button"
              onClick={fetchTelegramStatus}
              disabled={isLoadingTelegram}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 text-xs transition-colors disabled:opacity-50"
              title="Refresh Telegram Status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTelegram ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          )}
        </div>

        {!isLoggedIn ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-xs text-zinc-400">
              Sign in to connect your Telegram account and receive instant request fulfillment alerts.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In Now
            </button>
          </div>
        ) : telegramStatus.isLinked ? (
          /* Connected State */
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-bold text-zinc-100">
                    Linked to @{telegramStatus.botUsername}
                  </span>
                  {telegramStatus.link?.telegramUsername && (
                    <span className="text-xs text-zinc-400 font-medium">
                      (@{telegramStatus.link.telegramUsername})
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Your CiNEPHiLE account is receiving real-time alerts on Telegram.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDisconnectTelegram}
                disabled={isLoadingTelegram}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/60 text-xs font-semibold transition-all disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>

            {/* Notification Preference Toggles */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Notification Preferences
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Movie & TV Requests
                    </span>
                    <span className="text-[11px] text-zinc-400 block">
                      Notify me when my requested titles are added
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={telegramStatus.link?.requestNotifications !== false}
                    onChange={(e) => handleTogglePreference('requestNotifications', e.target.checked)}
                    disabled={isUpdatingPrefs}
                    className="w-4 h-4 rounded text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Broken Link Reports
                    </span>
                    <span className="text-[11px] text-zinc-400 block">
                      Notify me when reported links are fixed
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={telegramStatus.link?.reportNotifications !== false}
                    onChange={(e) => handleTogglePreference('reportNotifications', e.target.checked)}
                    disabled={isUpdatingPrefs}
                    className="w-4 h-4 rounded text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-amber-500"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          /* Not Connected State */
          <div className="space-y-5">
            {!linkingData ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <div className="space-y-1 max-w-lg">
                  <h4 className="text-sm font-bold text-white">Connect Your Telegram</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Link your Telegram to get notified as soon as a movie or TV request is fulfilled or a reported broken link is fixed. No bots will spam you.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateTelegramLink}
                  disabled={isGeneratingToken}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3.5 h-3.5 -rotate-12" />
                  {isGeneratingToken ? 'Generating Link...' : 'Connect Telegram'}
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-zinc-950/80 border border-sky-500/30 space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                      One-Time Secure Telegram Connection
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Expires in 10 minutes
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  Open the official CiNEPHiLE bot in Telegram and start it with your secure link code:
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={linkingData.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all"
                  >
                    <Send className="w-3.5 h-3.5 -rotate-12" />
                    Open @{linkingData.botUsername} in Telegram
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`/start ${linkingData.token}`);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-semibold transition-colors"
                  >
                    {copiedToken ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied Command</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Command
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={fetchTelegramStatus}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    I Connected, Verify Now
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 font-mono text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>/start {linkingData.token}</span>
                  <span className="text-[10px] text-zinc-600">Send to @{linkingData.botUsername}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. My Movie & TV Requests Section */}
      <section id="my-requests" className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl scroll-mt-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">My Movie & TV Requests</h2>
              {myRequests.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-semibold">
                  {myRequests.length}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Track the live fulfillment status of movies and web series you requested on CiNEPHiLE.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <button
                type="button"
                onClick={fetchMyRequests}
                disabled={isLoadingRequests}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 text-xs transition-colors disabled:opacity-50"
                title="Refresh Requests"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRequests ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            )}

            {/* Status Filter Tabs */}
            <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
              {(['all', 'pending', 'fulfilled', 'rejected'] as const).map((filter) => {
                const count =
                  filter === 'all'
                    ? myRequests.length
                    : myRequests.filter((r) => r.status === filter).length;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setRequestFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                      requestFilter === filter
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {filter} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Request List Content */}
        {!isLoggedIn ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-xs text-zinc-400">
              Sign in with your account to view and track all your movie and TV requests.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In Now
            </button>
          </div>
        ) : isLoadingRequests && myRequests.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
            <div className="inline-block w-5 h-5 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <p>Loading your requests...</p>
          </div>
        ) : myRequests.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 mx-auto flex items-center justify-center text-zinc-500">
              <Film className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-zinc-300">No requests submitted yet</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Looking for a movie or TV show not yet in our catalog? Submit a request and our curators will add it.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 text-xs font-semibold transition-colors"
            >
              Explore Titles & Request
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests
              .filter((req) => (requestFilter === 'all' ? true : req.status === requestFilter))
              .map((req) => {
                const isFulfilled = req.status === 'fulfilled';
                const isPending = req.status === 'pending';
                const isRejected = req.status === 'rejected';

                const targetWatchUrl = req.tmdbId
                  ? `/${req.mediaType === 'tv' ? 'tv' : 'movie'}/${req.tmdbId}`
                  : req.fulfilledLinkUrl || null;

                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Poster / Thumbnail */}
                      <div className="relative w-12 h-16 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center">
                        {req.posterPath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${req.posterPath}`}
                            alt={req.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : req.mediaType === 'tv' ? (
                          <Tv className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Film className="w-5 h-5 text-amber-400" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                            {req.title}
                          </h4>
                          {req.releaseYear && (
                            <span className="text-[11px] text-zinc-500 font-medium">
                              ({req.releaseYear})
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-800 text-zinc-400">
                            {req.mediaType}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                          {req.quality && <span>Quality: <span className="text-zinc-300 font-medium">{req.quality}</span></span>}
                          {req.audioLanguage && <span>Audio: <span className="text-zinc-300 font-medium">{req.audioLanguage}</span></span>}
                          <span className="text-zinc-500 flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {req.adminNote && (
                          <p className="text-[11px] text-zinc-400 italic pt-0.5">
                            Admin Note: &ldquo;{req.adminNote}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {isFulfilled && (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Available Now
                          </span>

                          {targetWatchUrl && (
                            <Link
                              href={targetWatchUrl}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
                            >
                              <Play className="w-3.5 h-3.5 fill-black" />
                              Watch Now
                            </Link>
                          )}
                        </div>
                      )}

                      {isPending && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Under Review
                        </span>
                      )}

                      {isRejected && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Closed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* 6. My Broken Link Reports Section */}
      <section id="my-reports" className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl scroll-mt-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">My Broken Link Reports</h2>
              {myReports.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-semibold">
                  {myReports.length}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Track the review and repair status of broken or defective stream/download links you reported.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <button
                type="button"
                onClick={fetchMyReports}
                disabled={isLoadingReports}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 text-xs transition-colors disabled:opacity-50"
                title="Refresh Reports"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}

            {/* Status Filter Tabs */}
            <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
              {(['all', 'pending', 'fixed', 'dismissed'] as const).map((filter) => {
                const count =
                  filter === 'all'
                    ? myReports.length
                    : myReports.filter((r) => r.status === filter).length;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setReportFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                      reportFilter === filter
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {filter === 'fixed' ? 'Resolved' : filter} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reports List Content */}
        {!isLoggedIn ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-xs text-zinc-400">
              Sign in with your account to view and track all your submitted link defect reports.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In Now
            </button>
          </div>
        ) : isLoadingReports && myReports.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
            <div className="inline-block w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <p>Loading your reports...</p>
          </div>
        ) : myReports.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800/60 mx-auto flex items-center justify-center text-zinc-500">
              <Wrench className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-zinc-300">No link reports submitted</p>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              If you encounter a dead link, audio desync, or playback error while watching, use the Report button on that title.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myReports
              .filter((rep) => (reportFilter === 'all' ? true : rep.status === reportFilter))
              .map((rep) => {
                const isFixed = rep.status === 'fixed';
                const isPending = rep.status === 'pending';
                const isDismissed = rep.status === 'dismissed';

                const targetWatchUrl = rep.movieId
                  ? `/${rep.mediaType === 'tv' ? 'tv' : 'movie'}/${rep.movieId}`
                  : null;

                return (
                  <div
                    key={rep.id}
                    className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Poster / Thumbnail */}
                      <div className="relative w-12 h-16 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center">
                        {rep.posterPath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${rep.posterPath}`}
                            alt={rep.mediaTitle}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Wrench className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                            {rep.mediaTitle}
                          </h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            {rep.issueLabel || 'Defective Link'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                          {rep.quality && <span>Quality: <span className="text-zinc-300 font-medium">{rep.quality}</span></span>}
                          {rep.server && <span>Server: <span className="text-zinc-300 font-medium">{rep.server}</span></span>}
                          <span className="text-zinc-500 flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {new Date(rep.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {rep.adminNote && (
                          <p className="text-[11px] text-zinc-400 italic pt-0.5">
                            Curator Response: &ldquo;{rep.adminNote}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {isFixed && (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved / Fixed
                          </span>

                          {targetWatchUrl && (
                            <Link
                              href={targetWatchUrl}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
                            >
                              <Play className="w-3.5 h-3.5 fill-black" />
                              Open Title
                            </Link>
                          )}
                        </div>
                      )}

                      {isPending && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Investigating
                        </span>
                      )}

                      {isDismissed && (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> Reviewed
                          </span>

                          {targetWatchUrl && (
                            <Link
                              href={targetWatchUrl}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open Title
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
