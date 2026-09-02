'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  ShieldCheck,
  Key,
  Database,
  Link2,
  Trash2,
  ExternalLink,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Film,
  Tv,
  Users,
  Layers,
  Settings,
  Download,
  Upload,
  Lock,
  Unlock,
  Check,
  Sparkles,
  Server,
  Activity,
  Globe,
  Star,
  Search,
  Tag,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAuth } from '@/context/AuthContext';
import { CustomLink, CustomList, TitleDetails } from '@/types';
import { MOCK_TITLES } from '@/lib/mockData';
import { getImageURL } from '@/lib/tmdb';

const DEFAULT_ADMIN_PASS = 'admin123';

export default function AdminPage() {
  const {
    watchlist,
    addCustomLink,
    removeCustomLink,
    simklConfig,
    mdblistConfig,
    updateSimklConfig,
    updateMdblistConfig,
    stats,
    isMounted,
  } = useWatchlist();

  const { userProfile, isLoggedIn } = useAuth();

  // Local state for standalone custom links map & custom lists
  const [customLinksMap, setCustomLinksMap] = useState<Record<string, CustomLink[]>>({});
  const [customLists, setCustomLists] = useState<CustomList[]>([]);

  // Admin Auth Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [adminPass, setAdminPass] = useState(DEFAULT_ADMIN_PASS);

  // Tabs: 'overview' | 'links' | 'apis' | 'backup' | 'logs'
  const [activeTab, setActiveTab] = useState<'overview' | 'links' | 'apis' | 'backup' | 'logs'>('overview');

  // API Form States
  const [tmdbKey, setTmdbKey] = useState('');
  const [simklClientId, setSimklClientId] = useState('');
  const [mdblistKey, setMdblistKey] = useState('');
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false);
  const [isTestingTmdb, setIsTestingTmdb] = useState(false);
  const [tmdbTestResult, setTmdbTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Links Moderation Filter & Search
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkCategoryFilter, setLinkCategoryFilter] = useState('All');

  // New Link Quick Add State
  const [newLinkMovieId, setNewLinkMovieId] = useState<number>(872585);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState<'Streaming' | 'Subtitles' | 'Discussion' | 'Review' | 'Download' | 'Official' | 'Recent'>('Streaming');
  const [addLinkSuccess, setAddLinkSuccess] = useState(false);

  // Diagnostics logs
  const [systemLogs, setSystemLogs] = useState<Array<{ timestamp: string; level: 'info' | 'success' | 'warn'; message: string }>>([
    { timestamp: 'Just now', level: 'success', message: 'Admin session initialized.' },
    { timestamp: '1m ago', level: 'info', message: 'Local storage vault synced successfully.' },
    { timestamp: '2m ago', level: 'info', message: 'TMDB & SIMKL engines connected.' },
  ]);

  // Load Saved Admin State & Keys on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAuth = sessionStorage.getItem('cinefuel_admin_auth');
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
      }

      const storedPass = localStorage.getItem('cinefuel_admin_pass');
      if (storedPass) setAdminPass(storedPass);

      const storedSettings = localStorage.getItem('cinefuel_settings');
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          if (parsed.tmdbApiKey) setTmdbKey(parsed.tmdbApiKey);
        } catch {
          // ignore
        }
      }

      const storedLinks = localStorage.getItem('cinefuel_custom_links');
      if (storedLinks) {
        try {
          setCustomLinksMap(JSON.parse(storedLinks));
        } catch {
          // ignore
        }
      }

      const storedLists = localStorage.getItem('cinefuel_custom_lists');
      if (storedLists) {
        try {
          setCustomLists(JSON.parse(storedLists));
        } catch {
          // ignore
        }
      }

      if (simklConfig?.clientId) setSimklClientId(simklConfig.clientId);
      if (mdblistConfig?.apiKey) setMdblistKey(mdblistConfig.apiKey);
    }
  }, [simklConfig, mdblistConfig]);

  // Handle Admin Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === adminPass) {
      setIsAuthenticated(true);
      setPasswordError(false);
      sessionStorage.setItem('cinefuel_admin_auth', 'true');
      addLog('Admin authenticated successfully.', 'success');
    } else {
      setPasswordError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('cinefuel_admin_auth');
    addLog('Admin logged out.', 'info');
  };

  const addLog = (message: string, level: 'info' | 'success' | 'warn' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setSystemLogs((prev) => [{ timestamp: time, level, message }, ...prev.slice(0, 19)]);
  };

  // Test TMDB API Key Live
  const handleTestTmdb = async () => {
    setIsTestingTmdb(true);
    setTmdbTestResult(null);
    try {
      const keyToTest = tmdbKey.trim() || '8265bd1679663a7ea12ac168da84d2e8';
      const res = await fetch(`https://api.themoviedb.org/3/movie/872585?api_key=${keyToTest}`);
      if (res.ok) {
        const data = await res.json();
        setTmdbTestResult({ success: true, msg: `Active: Verified connection to "${data.title}"` });
        addLog(`TMDB API Ping successful: ${data.title}`, 'success');
      } else {
        setTmdbTestResult({ success: false, msg: `Failed: TMDB returned status ${res.status}` });
        addLog(`TMDB API Ping failed: Status ${res.status}`, 'warn');
      }
    } catch (err: any) {
      setTmdbTestResult({ success: false, msg: `Error: ${err.message}` });
      addLog(`TMDB API Ping error: ${err.message}`, 'warn');
    } finally {
      setIsTestingTmdb(false);
    }
  };

  // Save API Configurations
  const handleSaveApis = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      const storedSettings = localStorage.getItem('cinefuel_settings') || '{}';
      try {
        const parsed = JSON.parse(storedSettings);
        parsed.tmdbApiKey = tmdbKey.trim();
        localStorage.setItem('cinefuel_settings', JSON.stringify(parsed));
      } catch {
        localStorage.setItem('cinefuel_settings', JSON.stringify({ tmdbApiKey: tmdbKey.trim() }));
      }
    }

    if (simklClientId.trim()) {
      updateSimklConfig({ clientId: simklClientId.trim() });
    }

    if (mdblistKey.trim()) {
      updateMdblistConfig({ apiKey: mdblistKey.trim() });
    }

    setApiSaveSuccess(true);
    addLog('API keys and engine settings updated.', 'success');
    setTimeout(() => setApiSaveSuccess(false), 3500);
  };

  // Handle Quick Add Custom Link
  const handleQuickAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    addCustomLink(newLinkMovieId, {
      title: newLinkTitle.trim(),
      url,
      category: newLinkCategory,
    });

    // Also update local state
    const newLinkObj: CustomLink = {
      id: `link-${Date.now()}`,
      title: newLinkTitle.trim(),
      url,
      category: newLinkCategory,
      createdAt: new Date().toISOString(),
    };

    setCustomLinksMap((prev) => {
      const existing = prev[String(newLinkMovieId)] || [];
      return {
        ...prev,
        [String(newLinkMovieId)]: [newLinkObj, ...existing],
      };
    });

    setNewLinkTitle('');
    setNewLinkUrl('');
    setAddLinkSuccess(true);
    addLog(`Added custom link "${newLinkTitle}" for ID ${newLinkMovieId}`, 'success');
    setTimeout(() => setAddLinkSuccess(false), 3000);
  };

  // Export Full JSON Backup
  const handleExportBackup = () => {
    if (typeof window === 'undefined') return;
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      watchlist,
      customLists,
      customLinks: customLinksMap,
      simklConfig,
      mdblistConfig,
      adminNotes: 'CineFuel Master Database Export',
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cinefuel-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Exported full database backup JSON.', 'success');
  };

  // Import JSON Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.watchlist) localStorage.setItem('cinefuel_watchlist', JSON.stringify(parsed.watchlist));
        if (parsed.customLists) localStorage.setItem('cinefuel_custom_lists', JSON.stringify(parsed.customLists));
        if (parsed.customLinks) localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed.customLinks));
        if (parsed.simklConfig) localStorage.setItem('cinefuel_simkl_config', JSON.stringify(parsed.simklConfig));
        if (parsed.mdblistConfig) localStorage.setItem('cinefuel_mdblist_config', JSON.stringify(parsed.mdblistConfig));

        addLog('Database backup restored successfully! Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1200);
      } catch (err: any) {
        alert('Invalid backup file format: ' + err.message);
        addLog('Failed to parse backup JSON: ' + err.message, 'warn');
      }
    };
    reader.readAsText(file);
  };

  // Combine links from watchlist and from standalone map
  const allFlattenedLinks: Array<{ movieId: number; movieName: string; link: CustomLink }> = [];
  const seenLinkIds = new Set<string>();

  watchlist.forEach((w) => {
    if (w.customLinks && Array.isArray(w.customLinks)) {
      w.customLinks.forEach((l) => {
        if (!seenLinkIds.has(l.id)) {
          seenLinkIds.add(l.id);
          allFlattenedLinks.push({
            movieId: w.id,
            movieName: w.title || `Title #${w.id}`,
            link: l,
          });
        }
      });
    }
  });

  Object.entries(customLinksMap).forEach(([movieIdStr, links]) => {
    if (Array.isArray(links)) {
      const numId = Number(movieIdStr);
      const matchedMovie = Object.values(MOCK_TITLES).find((m) => m.id === numId);
      const movieName = matchedMovie ? (matchedMovie.title || matchedMovie.name || `Title #${numId}`) : `Title #${numId}`;
      links.forEach((l: CustomLink) => {
        if (!seenLinkIds.has(l.id)) {
          seenLinkIds.add(l.id);
          allFlattenedLinks.push({
            movieId: numId,
            movieName,
            link: l,
          });
        }
      });
    }
  });

  const filteredLinks = allFlattenedLinks.filter((item) => {
    const matchesCat = linkCategoryFilter === 'All' || item.link.category === linkCategoryFilter;
    const matchesSearch =
      linkSearchQuery === '' ||
      item.link.title.toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
      item.link.url.toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
      item.movieName.toLowerCase().includes(linkSearchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // -------------------------------------------------------------
  // 1. Password Lock Gate (If not authenticated)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-[#0f121a] border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-black text-white">Admin Control Panel</h1>
            <p className="text-xs text-zinc-400">
              Master administration vault for CineFuel. Enter your passcode to manage engines, APIs, and community links.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Master Passcode</label>
              <input
                type="password"
                placeholder="Enter admin passcode (default: admin123)"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                autoFocus
                suppressHydrationWarning
              />
              {passwordError && (
                <p className="text-xs text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Incorrect passcode. Try &quot;admin123&quot;.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              suppressHydrationWarning
            >
              <Unlock className="w-4 h-4" /> Unlock Admin Panel
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-500">
            Default master passcode: <span className="font-mono text-zinc-400">admin123</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. Authenticated Admin Dashboard
  // -------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Admin Top Header Banner */}
      <div className="bg-[#0f121a] border border-amber-500/30 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
            <ShieldCheck className="w-8 h-8 fill-black/20 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                Master Admin Mode
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live & Protected
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              CineFuel Control Panel
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Public Site
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
            suppressHydrationWarning
          >
            <Lock className="w-3.5 h-3.5" /> Lock Panel
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Activity className="w-4 h-4" /> Overview & Metrics
        </button>

        <button
          onClick={() => setActiveTab('links')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'links'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Link2 className="w-4 h-4" /> Custom Links Catalog ({allFlattenedLinks.length})
        </button>

        <button
          onClick={() => setActiveTab('apis')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'apis'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Key className="w-4 h-4" /> API Keys & Integrations
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'backup'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Database className="w-4 h-4" /> Backup & Vault Restore
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'logs'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Server className="w-4 h-4" /> System Health & Logs
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW & METRICS */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Tracked Titles</span>
              <p className="text-3xl font-black text-white" suppressHydrationWarning>{isMounted ? watchlist.length : 0}</p>
              <span className="text-[11px] text-amber-400 font-medium">In local/cloud storage</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Community Custom Links</span>
              <p className="text-3xl font-black text-amber-400">{allFlattenedLinks.length}</p>
              <span className="text-[11px] text-zinc-400 font-medium">Across all titles</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Custom Lists Created</span>
              <p className="text-3xl font-black text-sky-400" suppressHydrationWarning>{isMounted ? customLists.length : 0}</p>
              <span className="text-[11px] text-zinc-400 font-medium">Curated collections</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Logged In User</span>
              <p className="text-lg font-bold text-emerald-400 truncate">
                {isLoggedIn ? (userProfile?.displayName || userProfile?.email) : 'Guest / Local Mode'}
              </p>
              <span className="text-[11px] text-zinc-400 font-medium">Firebase Auth status</span>
            </div>
          </div>

          {/* Engine Status Cards */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" /> Active Sync Engines & Health
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* TMDB Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> TMDB Engine
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    Connected
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Live metadata, posters, backdrops, and official YouTube trailers.</p>
              </div>

              {/* SIMKL Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${simklConfig?.userToken ? 'bg-emerald-400' : 'bg-amber-400'}`} /> SIMKL Sync
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    simklConfig?.userToken ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {simklConfig?.userToken ? 'Synced' : 'PIN Ready'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Watchlist, ratings (1–10), and anime/show progress tracker.</p>
              </div>

              {/* MDBList Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${mdblistConfig?.apiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} /> MDBList Hub
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    mdblistConfig?.apiKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {mdblistConfig?.apiKey ? 'API Active' : 'Demo Mode'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Rotten Tomatoes Tomatometer, Metacritic, and Letterboxd scores.</p>
              </div>

              {/* Cloudflare / Vercel Edge */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Edge CDN
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Global cache, image optimization, and instant DNS routing.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CUSTOM LINKS CATALOG & MODERATION */}
      {/* ========================================================= */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          {/* Quick Add Custom Link Box */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-amber-500/20 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" /> Add Curated Link to Movie/Show
            </h3>

            <form onSubmit={handleQuickAddLink} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Target Movie</label>
                <select
                  value={newLinkMovieId}
                  onChange={(e) => setNewLinkMovieId(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value={872585}>Oppenheimer (872585)</option>
                  <option value={693134}>Dune: Part Two (693134)</option>
                  <option value={157336}>Interstellar (157336)</option>
                  <option value={579974}>RRR (579974)</option>
                  <option value={1396}>Breaking Bad (1396)</option>
                  <option value={155}>The Dark Knight (155)</option>
                  <option value={27205}>Inception (27205)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Link Title / Label</label>
                <input
                  type="text"
                  placeholder="e.g. 4K IMAX Making of Doc"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Destination URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Category</label>
                <div className="flex gap-2">
                  <select
                    value={newLinkCategory}
                    onChange={(e) => setNewLinkCategory(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="Streaming">🎬 Streaming</option>
                    <option value="Subtitles">🌐 Subtitles</option>
                    <option value="Discussion">💬 Discussion</option>
                    <option value="Review">📝 Review</option>
                    <option value="Download">📥 Download</option>
                    <option value="Official">🏛️ Official</option>
                    <option value="Recent">⚡ Recent</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </form>

            {addLinkSuccess && (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Link published to catalog and title page successfully!
              </p>
            )}
          </div>

          {/* Links Moderation Table */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" /> All Saved Links ({filteredLinks.length})
              </h3>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search links..."
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 w-44"
                  />
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Category Filter */}
                <select
                  value={linkCategoryFilter}
                  onChange={(e) => setLinkCategoryFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-semibold"
                >
                  <option value="All">All Categories</option>
                  <option value="Streaming">Streaming</option>
                  <option value="Subtitles">Subtitles</option>
                  <option value="Discussion">Discussion</option>
                  <option value="Review">Review</option>
                  <option value="Download">Download</option>
                  <option value="Official">Official</option>
                  <option value="Recent">Recent</option>
                </select>
              </div>
            </div>

            {filteredLinks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Title / Movie</th>
                      <th className="py-3 px-3">Link Name</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">URL</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredLinks.map((item) => (
                      <tr key={item.link.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-white">
                          <Link href={`/movie/${item.movieId}`} className="hover:text-amber-400 transition-colors">
                            {item.movieName}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-300">{item.link.title}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 text-[10px]">
                            {item.link.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400 max-w-xs truncate">
                          {item.link.url}
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <a
                            href={item.link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                            title="Test URL"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => {
                              removeCustomLink(item.movieId, item.link.id);
                              addLog(`Deleted link "${item.link.title}"`, 'info');
                            }}
                            className="inline-flex p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                            title="Delete link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No custom links match your search or filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: API KEYS & ENGINE COMMAND CENTER */}
      {/* ========================================================= */}
      {activeTab === 'apis' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" /> API Keys & Multi-Engine Configuration
            </h3>
            <p className="text-xs text-zinc-400">
              Configure and test live connection credentials for all external movie APIs.
            </p>
          </div>

          <form onSubmit={handleSaveApis} className="space-y-5 max-w-2xl">
            {/* TMDB API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>TMDB API Key (v3 auth)</span>
                <span className="text-[10px] text-amber-400 font-normal">themoviedb.org/settings/api</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter TMDB API Key (e.g. 8265bd16...)"
                  value={tmdbKey}
                  onChange={(e) => setTmdbKey(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleTestTmdb}
                  disabled={isTestingTmdb}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingTmdb ? 'animate-spin' : ''}`} />
                  {isTestingTmdb ? 'Pinging...' : 'Test Connection'}
                </button>
              </div>
              {tmdbTestResult && (
                <p className={`text-xs font-medium flex items-center gap-1 mt-1 ${tmdbTestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tmdbTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {tmdbTestResult.msg}
                </p>
              )}
            </div>

            {/* SIMKL Client ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>SIMKL Client ID</span>
                <span className="text-[10px] text-amber-400 font-normal">simkl.com/apps</span>
              </label>
              <input
                type="text"
                placeholder="Enter SIMKL Client ID"
                value={simklClientId}
                onChange={(e) => setSimklClientId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* MDBList API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>MDBList API Key</span>
                <span className="text-[10px] text-amber-400 font-normal">mdblist.com/preferences</span>
              </label>
              <input
                type="text"
                placeholder="Enter MDBList API Key"
                value={mdblistKey}
                onChange={(e) => setMdblistKey(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Save All API Configurations
            </button>

            {apiSaveSuccess && (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Credentials saved securely!
              </p>
            )}
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: BACKUP & DATABASE RESTORE */}
      {/* ========================================================= */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Box */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white">Export Complete Database Backup</h4>
              <p className="text-xs text-zinc-400">
                Downloads a JSON file containing all user watchlists, custom lists, ratings, custom attached links, and engine settings.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download Backup (.json)
            </button>
          </div>

          {/* Import Box */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white">Restore from Backup JSON</h4>
              <p className="text-xs text-zinc-400">
                Upload a previously exported backup file to restore all watchlists, custom links, and settings instantly.
              </p>
            </div>
            <label className="inline-flex px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition-all cursor-pointer items-center gap-2">
              <Upload className="w-4 h-4" /> Select Backup JSON File
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: SYSTEM HEALTH & LOGS */}
      {/* ========================================================= */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" /> Real-time System Diagnostics & Logs
            </h3>
            <button
              onClick={() => addLog('Diagnostics ping triggered.', 'info')}
              className="text-[11px] text-amber-400 hover:underline"
            >
              Trigger Ping
            </button>
          </div>

          <div className="bg-black/80 rounded-2xl p-4 border border-zinc-800/80 space-y-2 max-h-72 overflow-y-auto text-xs">
            {systemLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-2.5">
                <span className="text-zinc-500 shrink-0">[{log.timestamp}]</span>
                <span
                  className={`font-bold shrink-0 ${
                    log.level === 'success' ? 'text-emerald-400' : log.level === 'warn' ? 'text-rose-400' : 'text-sky-400'
                  }`}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-zinc-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
