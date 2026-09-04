'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Shield,
  ShieldCheck,
  Key,
  Database,
  Link2,
  Trash2,
  Edit,
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
  Eye,
  UserCheck,
  X,
  ChevronDown,
  Clock,
  Zap,
  ListPlus,
  LayoutGrid,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAuth } from '@/context/AuthContext';
import { CustomLink, CustomList, TitleDetails } from '@/types';
import { MOCK_TITLES, TRENDING_LIST } from '@/lib/mockData';
import { getImageURL, searchMulti, getTitleDetails } from '@/lib/tmdb';
import { BUILTIN_CURATED_LINKS, saveGlobalCustomLink } from '@/lib/curatedLinks';
import { parseFullMediaTitle, parseBulkLinksInput, ParsedBulkItem } from '@/lib/seasonParser';

const DEFAULT_ADMIN_USER = 'shyam';
const DEFAULT_ADMIN_PASS = 'shyam081';

interface PinnedTitle {
  id: number;
  title: string;
  media_type: 'movie' | 'tv';
  year: string;
  poster_path?: string | null;
}

// Initial Quick-Select Titles for 1-Click Access
const PINNED_TITLES: PinnedTitle[] = [
  { id: 872585, title: 'Oppenheimer', media_type: 'movie', year: '2023', poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg' },
  { id: 693134, title: 'Dune: Part Two', media_type: 'movie', year: '2024', poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg' },
  { id: 61889, title: "Marvel's Daredevil", media_type: 'tv', year: '2015', poster_path: '/QWbPaDxiB6LW2xq5Xx1z7v2qG3.jpg' },
  { id: 88396, title: 'Loki', media_type: 'tv', year: '2021', poster_path: '/voHUmluzUP599026n3nJzW3P7I9.jpg' },
  { id: 108978, title: 'Reacher', media_type: 'tv', year: '2022', poster_path: '/j1m34Zq85XkMh1Z3L21fG4L9wR9.jpg' },
  { id: 113962, title: 'Special Ops: Lioness', media_type: 'tv', year: '2023', poster_path: '/r2J02Z2OpNTctfOSN1Ydg3xA5IW.jpg' },
  { id: 1396, title: 'Breaking Bad', media_type: 'tv', year: '2008', poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg' },
  { id: 157336, title: 'Interstellar', media_type: 'movie', year: '2014', poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
  { id: 155, title: 'The Dark Knight', media_type: 'movie', year: '2008', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
  { id: 27205, title: 'Inception', media_type: 'movie', year: '2010', poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg' },
  { id: 579974, title: 'RRR', media_type: 'movie', year: '2022', poster_path: '/nEufeZlyAOLqO2brrs0ye210m0m.jpg' },
];

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

  // Known title metadata cache (maps TMDB ID to Title Info)
  const [knownTitlesCache, setKnownTitlesCache] = useState<Record<number, { title: string; poster_path?: string | null; media_type?: 'movie' | 'tv'; year?: string }>>({});

  // Admin Auth Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [adminUser, setAdminUser] = useState(DEFAULT_ADMIN_USER);
  const [adminPass, setAdminPass] = useState(DEFAULT_ADMIN_PASS);

  // Tabs: 'overview' | 'links' | 'titles' | 'users' | 'apis' | 'backup' | 'logs'
  const [activeTab, setActiveTab] = useState<'overview' | 'links' | 'titles' | 'users' | 'apis' | 'backup' | 'logs'>('overview');

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

  // Mode in Manage Links: 'single' vs 'bulk' vs 'grid'
  const [addLinkMode, setAddLinkMode] = useState<'single' | 'bulk' | 'grid'>('single');

  // Universal Target Title Live Search & Selection State
  const [selectedTargetTitle, setSelectedTargetTitle] = useState<{
    id: number;
    title: string;
    media_type: 'movie' | 'tv';
    poster_path?: string | null;
    year?: string;
  }>(PINNED_TITLES[0]);

  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [targetSearchResults, setTargetSearchResults] = useState<TitleDetails[]>([]);
  const [isSearchingTarget, setIsSearchingTarget] = useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // New Link Quick Add State
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState<CustomLink['category']>('SingleEpisode');
  const [newLinkSeason, setNewLinkSeason] = useState(1);
  const [newLinkEpisode, setNewLinkEpisode] = useState(1);
  const [newLinkType, setNewLinkType] = useState<'zip_pack' | 'single_episode' | 'general'>('single_episode');
  const [newLinkQuality, setNewLinkQuality] = useState('');
  const [newLinkAudio, setNewLinkAudio] = useState('');
  const [newLinkSize, setNewLinkSize] = useState('');
  const [addLinkSuccess, setAddLinkSuccess] = useState(false);

  // Bulk Multi-Link Importer State
  const [adminBulkRawText, setAdminBulkRawText] = useState('');
  const [adminBulkParsedItems, setAdminBulkParsedItems] = useState<ParsedBulkItem[]>([]);
  const [adminBulkSuccessMsg, setAdminBulkSuccessMsg] = useState('');

  // Admin Dynamic Episode Grid State (N Containers)
  const [adminGridSeason, setAdminGridSeason] = useState(1);
  const [adminGridEpisodeCount, setAdminGridEpisodeCount] = useState(8);
  const [adminGridBasePattern, setAdminGridBasePattern] = useState('');
  const [adminGridQuality, setAdminGridQuality] = useState('2160p 4K');
  const [adminGridAudio, setAdminGridAudio] = useState('Hindi + English 5.1');
  const [adminGridSize, setAdminGridSize] = useState('');
  const [adminGridBulkLinksText, setAdminGridBulkLinksText] = useState('');
  const [adminGridEpisodes, setAdminGridEpisodes] = useState<
    Array<{
      episodeNumber: number;
      title: string;
      url: string;
      quality: string;
      audio: string;
      size: string;
    }>
  >([]);
  const [adminGridSuccessMsg, setAdminGridSuccessMsg] = useState('');

  // Edit Link Modal State
  const [editingLink, setEditingLink] = useState<{ movieId: number; link: CustomLink } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editCategory, setEditCategory] = useState<CustomLink['category']>('Streaming');
  const [editSeason, setEditSeason] = useState<number>(1);
  const [editEpisode, setEditEpisode] = useState<number>(1);
  const [editType, setEditType] = useState<'zip_pack' | 'single_episode' | 'general'>('general');
  const [editQuality, setEditQuality] = useState('');
  const [editAudio, setEditAudio] = useState('');
  const [editSize, setEditSize] = useState('');

  // Manage Titles Tab Live Search State
  const [titleSearchQuery, setTitleSearchQuery] = useState('');
  const [manageTitlesResults, setManageTitlesResults] = useState<TitleDetails[]>([]);
  const [isSearchingManageTitles, setIsSearchingManageTitles] = useState(false);

  // Diagnostics logs
  const [systemLogs, setSystemLogs] = useState<Array<{ timestamp: string; level: 'info' | 'success' | 'warn'; message: string }>>([
    { timestamp: 'Just now', level: 'success', message: 'Admin session initialized for Shyam.' },
    { timestamp: '1m ago', level: 'info', message: 'Bulk Multi-Link Auto-Detector Engine ready for batch episodes & zip packs.' },
    { timestamp: '2m ago', level: 'info', message: 'TMDB, SIMKL & MDBList engines operational.' },
  ]);

  // Load Saved Admin State & Keys on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAuth = sessionStorage.getItem('cinefuel_admin_auth');
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
      }

      const storedUser = localStorage.getItem('cinefuel_admin_user');
      if (storedUser) setAdminUser(storedUser);

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

      const storedTitlesCache = localStorage.getItem('cinefuel_known_titles_cache');
      if (storedTitlesCache) {
        try {
          setKnownTitlesCache(JSON.parse(storedTitlesCache));
        } catch {
          // ignore
        }
      }

      if (simklConfig?.clientId) setSimklClientId(simklConfig.clientId);
      if (mdblistConfig?.apiKey) setMdblistKey(mdblistConfig.apiKey);
    }
  }, [simklConfig, mdblistConfig]);

  // Pre-seed known titles cache with pinned titles and mock titles
  useEffect(() => {
    const initialMap: Record<number, { title: string; poster_path?: string | null; media_type?: 'movie' | 'tv'; year?: string }> = { ...knownTitlesCache };
    PINNED_TITLES.forEach((pt) => {
      if (!initialMap[pt.id]) {
        initialMap[pt.id] = { title: pt.title, poster_path: pt.poster_path, media_type: pt.media_type, year: pt.year };
      }
    });
    Object.values(MOCK_TITLES).forEach((m) => {
      if (!initialMap[m.id]) {
        const year = (m.release_date || m.first_air_date || '').split('-')[0];
        initialMap[m.id] = { title: m.title || m.name || `Title #${m.id}`, poster_path: m.poster_path, media_type: ((m.media_type as any) || (m.name ? 'tv' : 'movie')) as 'movie' | 'tv', year };
      }
    });
    setKnownTitlesCache(initialMap);
  }, []);

  // Save cache helper
  const cacheTitle = (id: number, data: { title: string; poster_path?: string | null; media_type?: 'movie' | 'tv'; year?: string }) => {
    setKnownTitlesCache((prev) => {
      const updated = { ...prev, [id]: data };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_known_titles_cache', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setIsTargetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced TMDB Live Search for Target Title Picker in "Add Custom Link"
  useEffect(() => {
    const query = targetSearchQuery.trim();
    if (!query) {
      setTargetSearchResults([]);
      setIsSearchingTarget(false);
      return;
    }

    const numericMatch = query.match(/^\d+$/) || query.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
    if (numericMatch) {
      const detectedId = Number(numericMatch[2] || numericMatch[0]);
      const detectedType = (numericMatch[1] as 'movie' | 'tv') || 'movie';
      setIsSearchingTarget(true);
      getTitleDetails(detectedType, detectedId).then((res) => {
        setIsSearchingTarget(false);
        if (res && (res.title || res.name)) {
          setTargetSearchResults([res]);
        }
      });
      return;
    }

    setIsSearchingTarget(true);
    const handler = setTimeout(async () => {
      try {
        const data = await searchMulti(query, 1);
        if (data && data.results) {
          const filtered = data.results.filter(
            (item): item is TitleDetails =>
              (item as any).media_type === 'movie' || (item as any).media_type === 'tv'
          );
          setTargetSearchResults(filtered);
        } else {
          setTargetSearchResults([]);
        }
      } catch (err) {
        console.error('Target search failed:', err);
      } finally {
        setIsSearchingTarget(false);
      }
    }, 280);

    return () => clearTimeout(handler);
  }, [targetSearchQuery]);

  // Debounced TMDB Live Search for "Manage Titles" Tab
  useEffect(() => {
    const query = titleSearchQuery.trim();
    if (!query) {
      setManageTitlesResults([]);
      setIsSearchingManageTitles(false);
      return;
    }

    setIsSearchingManageTitles(true);
    const handler = setTimeout(async () => {
      try {
        const data = await searchMulti(query, 1);
        if (data && data.results) {
          const filtered = data.results.filter(
            (item): item is TitleDetails =>
              (item as any).media_type === 'movie' || (item as any).media_type === 'tv'
          );
          setManageTitlesResults(filtered);
        } else {
          setManageTitlesResults([]);
        }
      } catch (err) {
        console.error('Manage titles search failed:', err);
      } finally {
        setIsSearchingManageTitles(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [titleSearchQuery]);

  // Real-time bulk parsing on admin textarea change
  useEffect(() => {
    if (!adminBulkRawText.trim()) {
      setAdminBulkParsedItems([]);
      return;
    }
    const parsed = parseBulkLinksInput(adminBulkRawText, 1);
    setAdminBulkParsedItems(parsed);
  }, [adminBulkRawText]);

  // Handle Target Title Selection
  const handleSelectTargetTitle = (item: {
    id: number;
    title?: string;
    name?: string;
    media_type?: string;
    poster_path?: string | null;
    release_date?: string;
    first_air_date?: string;
  }) => {
    const resolvedTitle = item.title || item.name || `Title #${item.id}`;
    const resolvedType = (item.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
    const resolvedYear = (item.release_date || item.first_air_date || '').split('-')[0];

    const targetObj = {
      id: item.id,
      title: resolvedTitle,
      media_type: resolvedType,
      poster_path: item.poster_path || null,
      year: resolvedYear,
    };

    setSelectedTargetTitle(targetObj);
    cacheTitle(item.id, targetObj);
    setIsTargetDropdownOpen(false);
    setTargetSearchQuery('');

    // Set intelligent default category based on media type
    if (resolvedType === 'tv') {
      setNewLinkCategory('SingleEpisode');
      setNewLinkType('single_episode');
      syncAdminGridSlots(adminGridEpisodeCount, adminGridSeason, adminGridBasePattern, adminGridQuality, adminGridAudio, adminGridSize, resolvedTitle);
    } else {
      setNewLinkCategory('Streaming');
      setNewLinkType('general');
    }

    addLog(`Target title switched to "${resolvedTitle}" (ID: ${item.id})`, 'info');
  };

  // Auto-parse release title for quick link add
  const handleNewLinkTitleChange = (val: string) => {
    setNewLinkTitle(val);
    if (val.trim().length > 2) {
      const parsed = parseFullMediaTitle(val);
      if (parsed.seasonNumber) setNewLinkSeason(parsed.seasonNumber);

      if (parsed.episodeNumber) {
        setNewLinkEpisode(parsed.episodeNumber);
        setNewLinkCategory('SingleEpisode');
        setNewLinkType('single_episode');
      } else if (parsed.linkType === 'zip_pack') {
        if (selectedTargetTitle?.media_type === 'tv' || /(?:zip|pack|complete|season)/i.test(val)) {
          setNewLinkCategory('ZipPack');
          setNewLinkType('zip_pack');
        }
      }

      if (parsed.quality) setNewLinkQuality(parsed.quality);
      if (parsed.audioLanguage) setNewLinkAudio(parsed.audioLanguage);
      if (parsed.size) setNewLinkSize(parsed.size);
    }
  };

  // Handle Admin Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const isUserValid = usernameInput.trim().toLowerCase() === adminUser.toLowerCase();
    const isPassValid = passwordInput === adminPass;

    if (isUserValid && isPassValid) {
      setIsAuthenticated(true);
      setAuthError(false);
      sessionStorage.setItem('cinefuel_admin_auth', 'true');
      sessionStorage.setItem('cinefuel_admin_user', 'shyam');
      addLog('Master Admin (Shyam) authenticated successfully.', 'success');
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('cinefuel_admin_auth');
    sessionStorage.removeItem('cinefuel_admin_user');
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

  // Handle Quick Add Single Custom Link
  const handleQuickAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim() || !selectedTargetTitle) return;

    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const parsed = parseFullMediaTitle(newLinkTitle.trim());

    let finalCategory = newLinkCategory;
    let finalType: 'zip_pack' | 'single_episode' | 'general' = newLinkType;

    if (newLinkCategory === 'SingleEpisode') {
      finalType = 'single_episode';
    } else if (newLinkCategory === 'ZipPack') {
      finalType = 'zip_pack';
    } else if (selectedTargetTitle.media_type === 'tv') {
      finalType = parsed.linkType;
      if (parsed.linkType === 'single_episode') finalCategory = 'SingleEpisode';
      else if (parsed.linkType === 'zip_pack') finalCategory = 'ZipPack';
    }

    const isTVLink = finalCategory === 'SingleEpisode' || finalCategory === 'ZipPack' || selectedTargetTitle.media_type === 'tv';

    const newLinkObj: CustomLink = {
      id: `link-${Date.now()}`,
      title: newLinkTitle.trim(),
      url,
      category: finalCategory,
      createdAt: new Date().toISOString(),
      seasonNumber: isTVLink ? newLinkSeason : parsed.seasonNumber,
      episodeNumber: finalCategory === 'SingleEpisode' ? newLinkEpisode : parsed.episodeNumber,
      linkType: finalType,
      quality: newLinkQuality.trim() || parsed.quality,
      audioLanguage: newLinkAudio.trim() || parsed.audioLanguage,
      size: newLinkSize.trim() || parsed.size,
    };

    saveGlobalCustomLink(selectedTargetTitle.id, newLinkObj);

    addCustomLink(selectedTargetTitle.id, {
      title: newLinkTitle.trim(),
      url,
      category: finalCategory,
    });

    setCustomLinksMap((prev) => {
      const existing = prev[String(selectedTargetTitle.id)] || [];
      const updated = {
        ...prev,
        [String(selectedTargetTitle.id)]: [newLinkObj, ...existing],
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(updated));
      }
      return updated;
    });

    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkQuality('');
    setNewLinkAudio('');
    setNewLinkSize('');
    setAddLinkSuccess(true);
    addLog(`Admin added custom link "${newLinkTitle}" for "${selectedTargetTitle.title}" (ID: ${selectedTargetTitle.id})`, 'success');
    setTimeout(() => setAddLinkSuccess(false), 3000);
  };

  // Toggle type of individual item in bulk preview
  const handleToggleBulkItemType = (id: string) => {
    setAdminBulkParsedItems((prev) =>
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
    setAdminBulkParsedItems((prev) =>
      prev.map((item, index) => ({
        ...item,
        linkType: type,
        category: type === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
        episodeNumber: type === 'single_episode' ? (item.episodeNumber || index + 1) : undefined,
      }))
    );
  };

  // Update season of item in bulk preview
  const handleUpdateBulkItemSeason = (id: string, s: number) => {
    setAdminBulkParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, seasonNumber: s } : item))
    );
  };

  // Update episode of item in bulk preview
  const handleUpdateBulkItemEpisode = (id: string, ep: number) => {
    setAdminBulkParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, episodeNumber: ep, linkType: 'single_episode', category: 'SingleEpisode' } : item))
    );
  };

  // Handle Bulk Links Import
  const handleAdminImportBulk = () => {
    if (adminBulkParsedItems.length === 0 || !selectedTargetTitle) return;

    const createdObjs: CustomLink[] = [];
    adminBulkParsedItems.forEach((item, index) => {
      const newObj: CustomLink = {
        id: `bulk-admin-${Date.now()}-${index}`,
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
      saveGlobalCustomLink(selectedTargetTitle.id, newObj);
      createdObjs.push(newObj);
    });

    setCustomLinksMap((prev) => {
      const existing = prev[String(selectedTargetTitle.id)] || [];
      const updated = {
        ...prev,
        [String(selectedTargetTitle.id)]: [...createdObjs, ...existing],
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(updated));
      }
      return updated;
    });

    const count = adminBulkParsedItems.length;
    const epCount = adminBulkParsedItems.filter((i) => i.linkType === 'single_episode').length;
    const zipCount = adminBulkParsedItems.filter((i) => i.linkType === 'zip_pack').length;

    setAdminBulkSuccessMsg(`🎉 Successfully imported ${count} links (${epCount} Episodes, ${zipCount} Zip Packs) for "${selectedTargetTitle.title}"!`);
    addLog(`Admin bulk imported ${count} links for "${selectedTargetTitle.title}"`, 'success');
    setAdminBulkRawText('');
    setAdminBulkParsedItems([]);

    setTimeout(() => setAdminBulkSuccessMsg(''), 3500);
  };

  // Helper to format admin episode title
  const formatAdminGridEpTitle = (
    epNum: number,
    pattern: string,
    season: number,
    targetTitle: string,
    quality: string,
    audio: string
  ) => {
    const epStr = epNum < 10 ? `0${epNum}` : `${epNum}`;
    const sStr = season < 10 ? `0${season}` : `${season}`;
    if (pattern && pattern.trim()) {
      return pattern
        .replace(/{title}/gi, targetTitle || 'Series')
        .replace(/{season}/gi, sStr)
        .replace(/{s}/gi, sStr)
        .replace(/{episode}/gi, epStr)
        .replace(/{ep}/gi, epStr)
        .replace(/{quality}/gi, quality || '')
        .replace(/{audio}/gi, audio || '')
        .trim();
    }
    return `${targetTitle || 'Series'} S${sStr}E${epStr} ${quality || '2160p WEB-DL'} [${audio || 'Hindi + English'}]`;
  };

  // Sync grid episode slots whenever count, season, or title changes
  const syncAdminGridSlots = (
    count: number,
    season: number,
    pattern: string,
    quality: string,
    audio: string,
    size: string,
    titleName?: string
  ) => {
    const seriesTitle = titleName || selectedTargetTitle?.title || 'Series';
    setAdminGridEpisodes((prev) => {
      const newSlots = [];
      for (let i = 1; i <= count; i++) {
        const existing = prev.find((p) => p.episodeNumber === i);
        newSlots.push({
          episodeNumber: i,
          title:
            existing?.title && existing.title.trim().length > 3
              ? existing.title
              : formatAdminGridEpTitle(i, pattern, season, seriesTitle, quality, audio),
          url: existing?.url || '',
          quality: existing?.quality || quality || '2160p 4K',
          audio: existing?.audio || audio || 'Hindi + English 5.1',
          size: existing?.size || size || '',
        });
      }
      return newSlots;
    });
  };

  // Initialize or open admin grid
  const handleOpenAdminGrid = (targetCount?: number, targetSeason?: number, titleName?: string) => {
    const count = targetCount || adminGridEpisodeCount || 8;
    const season = targetSeason || adminGridSeason || 1;
    setAdminGridEpisodeCount(count);
    setAdminGridSeason(season);
    syncAdminGridSlots(count, season, adminGridBasePattern, adminGridQuality, adminGridAudio, adminGridSize, titleName);
  };

  // Distribute links pasted into admin grid
  const handleDistributeAdminGridUrls = (text: string) => {
    setAdminGridBulkLinksText(text);
    const urls = text.match(/(https?:\/\/[^\s<>"']+)/gi) || [];
    if (urls.length > 0) {
      setAdminGridEpisodes((prev) =>
        prev.map((slot, index) => {
          if (urls[index]) {
            return { ...slot, url: urls[index] };
          }
          return slot;
        })
      );
    }
  };

  // Update a single episode slot in admin grid
  const handleUpdateAdminGridSlot = (
    epNum: number,
    field: 'title' | 'url' | 'quality' | 'audio' | 'size',
    value: string
  ) => {
    setAdminGridEpisodes((prev) =>
      prev.map((slot) => (slot.episodeNumber === epNum ? { ...slot, [field]: value } : slot))
    );
  };

  // Apply pattern to all titles in admin grid
  const handleApplyAdminPatternToAll = () => {
    const seriesTitle = selectedTargetTitle?.title || 'Series';
    setAdminGridEpisodes((prev) =>
      prev.map((slot) => ({
        ...slot,
        title: formatAdminGridEpTitle(
          slot.episodeNumber,
          adminGridBasePattern,
          adminGridSeason,
          seriesTitle,
          adminGridQuality,
          adminGridAudio
        ),
      }))
    );
  };

  // Save all admin grid episode containers
  const handleSaveAllAdminGridEpisodes = () => {
    if (!selectedTargetTitle) {
      alert('Please select a target title first.');
      return;
    }

    const valid = adminGridEpisodes.filter((e) => e.url.trim() && e.title.trim());
    if (valid.length === 0) {
      alert('Please fill in at least one episode container link before saving.');
      return;
    }

    const createdObjs: CustomLink[] = [];
    valid.forEach((ep, index) => {
      let finalUrl = ep.url.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `https://${finalUrl}`;
      }

      const newLink: CustomLink = {
        id: `admin-grid-${Date.now()}-${ep.episodeNumber}-${index}`,
        title: ep.title.trim(),
        url: finalUrl,
        category: 'SingleEpisode',
        createdAt: new Date(Date.now() - index * 1000).toISOString(),
        seasonNumber: adminGridSeason,
        episodeNumber: ep.episodeNumber,
        quality: ep.quality.trim() || adminGridQuality || '2160p 4K',
        audioLanguage: ep.audio.trim() || adminGridAudio || 'Hindi + English 5.1',
        size: ep.size.trim() || adminGridSize || undefined,
        linkType: 'single_episode',
      };

      saveGlobalCustomLink(selectedTargetTitle.id, newLink);
      createdObjs.push(newLink);
    });

    setCustomLinksMap((prev) => {
      const existing = prev[String(selectedTargetTitle.id)] || [];
      const updated = {
        ...prev,
        [String(selectedTargetTitle.id)]: [...createdObjs, ...existing],
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(updated));
      }
      return updated;
    });

    const count = valid.length;
    setAdminGridSuccessMsg(`🎉 Successfully saved ${count} episode container${count > 1 ? 's' : ''} to Season ${adminGridSeason} for "${selectedTargetTitle.title}"!`);
    addLog(`Admin saved ${count} episode grid containers for "${selectedTargetTitle.title}" (Season ${adminGridSeason})`, 'success');

    setTimeout(() => {
      setAdminGridSuccessMsg('');
    }, 3500);
  };

  // Open Edit Link Modal
  const openEditModal = (movieId: number, link: CustomLink) => {
    setEditingLink({ movieId, link });
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditCategory(link.category);
    setEditSeason(link.seasonNumber || 1);
    setEditEpisode(link.episodeNumber || 1);
    setEditType(link.linkType || (link.category === 'ZipPack' ? 'zip_pack' : link.category === 'SingleEpisode' ? 'single_episode' : 'general'));
    setEditQuality(link.quality || '');
    setEditAudio(link.audioLanguage || '');
    setEditSize(link.size || '');
  };

  // Save Edited Link
  const handleSaveEditLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editTitle.trim() || !editUrl.trim()) return;

    let url = editUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const parsed = parseFullMediaTitle(editTitle.trim());

    const updatedLinkObj: CustomLink = {
      ...editingLink.link,
      title: editTitle.trim(),
      url,
      category: editCategory,
      seasonNumber: editSeason,
      episodeNumber: editCategory === 'SingleEpisode' || editType === 'single_episode' ? editEpisode : undefined,
      linkType: editType === 'single_episode' || editCategory === 'SingleEpisode' ? 'single_episode' : editType === 'zip_pack' || editCategory === 'ZipPack' ? 'zip_pack' : 'general',
      quality: editQuality.trim() || parsed.quality || editingLink.link.quality,
      audioLanguage: editAudio.trim() || parsed.audioLanguage || editingLink.link.audioLanguage,
      size: editSize.trim() || parsed.size || editingLink.link.size,
    };

    saveGlobalCustomLink(editingLink.movieId, updatedLinkObj);

    removeCustomLink(editingLink.movieId, editingLink.link.id);

    addCustomLink(editingLink.movieId, {
      title: editTitle.trim(),
      url,
      category: editCategory,
    });

    setCustomLinksMap((prev) => {
      const movieIdStr = String(editingLink.movieId);
      const existing = prev[movieIdStr] || [];
      const filtered = existing.filter((l) => l.id !== editingLink.link.id);
      const updatedList = [updatedLinkObj, ...filtered];
      const updatedMap = { ...prev, [movieIdStr]: updatedList };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(updatedMap));
      }
      return updatedMap;
    });

    addLog(`Admin updated link "${editTitle}" for ID ${editingLink.movieId}`, 'success');
    setEditingLink(null);
  };

  // Delete Link
  const handleDeleteLink = (movieId: number, linkId: string, linkTitle: string) => {
    if (!confirm(`Delete link "${linkTitle}" permanently?`)) return;
    removeCustomLink(movieId, linkId);
    setCustomLinksMap((prev) => {
      const movieIdStr = String(movieId);
      const existing = prev[movieIdStr] || [];
      const updatedList = existing.filter((l) => l.id !== linkId);
      const updatedMap = { ...prev, [movieIdStr]: updatedList };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(updatedMap));
        window.dispatchEvent(new Event('cinefuel_links_updated'));
      }
      return updatedMap;
    });
    addLog(`Admin deleted link "${linkTitle}"`, 'warn');
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
      knownTitles: knownTitlesCache,
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
        if (parsed.knownTitles) localStorage.setItem('cinefuel_known_titles_cache', JSON.stringify(parsed.knownTitles));
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

  // Helper to resolve title name from cache, watchlist, or fallback
  const resolveTitleInfo = (movieId: number) => {
    if (knownTitlesCache[movieId]) return knownTitlesCache[movieId];
    const inWatchlist = watchlist.find((w) => w.id === movieId);
    if (inWatchlist) {
      return {
        title: inWatchlist.title || `Title #${movieId}`,
        poster_path: inWatchlist.poster_path,
        media_type: inWatchlist.mediaType,
      };
    }
    const inMock = Object.values(MOCK_TITLES).find((m) => m.id === movieId);
    if (inMock) {
      return {
        title: inMock.title || inMock.name || `Title #${movieId}`,
        poster_path: inMock.poster_path,
        media_type: ((inMock.media_type as any) || (inMock.name ? 'tv' : 'movie')) as 'movie' | 'tv',
      };
    }
    return { title: `Title #${movieId}` };
  };

  // Flatten all custom links across all movie IDs for the moderation table
  const allFlattenedLinks: Array<{ movieId: number; movieName: string; mediaType: 'movie' | 'tv'; link: CustomLink }> = [];
  const seenLinkIds = new Set<string>();

  // 1. Built-in Curated Links
  Object.entries(BUILTIN_CURATED_LINKS).forEach(([movieIdStr, links]) => {
    const numId = Number(movieIdStr);
    const info = resolveTitleInfo(numId);
    links.forEach((l) => {
      if (!seenLinkIds.has(l.id)) {
        seenLinkIds.add(l.id);
        allFlattenedLinks.push({
          movieId: numId,
          movieName: info.title,
          mediaType: info.media_type || 'movie',
          link: l,
        });
      }
    });
  });

  // 2. Watchlist Links
  watchlist.forEach((w) => {
    if (w.customLinks && Array.isArray(w.customLinks)) {
      w.customLinks.forEach((l) => {
        if (!seenLinkIds.has(l.id)) {
          seenLinkIds.add(l.id);
          allFlattenedLinks.push({
            movieId: w.id,
            movieName: w.title || `Title #${w.id}`,
            mediaType: w.mediaType || 'movie',
            link: l,
          });
        }
      });
    }
  });

  // 3. Dynamic LocalStorage Custom Links
  Object.entries(customLinksMap).forEach(([movieIdStr, links]) => {
    if (Array.isArray(links)) {
      const numId = Number(movieIdStr);
      const info = resolveTitleInfo(numId);
      links.forEach((l: CustomLink) => {
        if (!seenLinkIds.has(l.id)) {
          seenLinkIds.add(l.id);
          allFlattenedLinks.push({
            movieId: numId,
            movieName: info.title,
            mediaType: info.media_type || 'movie',
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

  // Displayed titles for Manage Titles tab (combines live search or catalog)
  const displayedCatalogTitles = useMemo(() => {
    if (titleSearchQuery.trim() && manageTitlesResults.length > 0) {
      return manageTitlesResults;
    }
    const combined: PinnedTitle[] = [...PINNED_TITLES];
    Object.values(MOCK_TITLES).forEach((m) => {
      if (!combined.some((c) => c.id === m.id)) {
        combined.push({
          id: m.id,
          title: m.title || m.name || 'Untitled',
          media_type: ((m.media_type as any) || (m.name ? 'tv' : 'movie')) as 'movie' | 'tv',
          year: (m.release_date || m.first_air_date || '').split('-')[0],
          poster_path: m.poster_path,
        });
      }
    });
    return combined;
  }, [titleSearchQuery, manageTitlesResults]);

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

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight">CineFuel Master Control</h2>
            <p className="text-xs text-zinc-400">
              Enter Administrator Credentials to access backend catalog, links, and system controls.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Admin Username</label>
              <input
                type="text"
                placeholder="Enter admin name"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setAuthError(false);
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                autoFocus
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Admin Password</label>
              <input
                type="password"
                placeholder="Enter admin password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError(false);
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                suppressHydrationWarning
              />
              {authError && (
                <p className="text-xs text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Incorrect username or password.
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
            Protected Admin Gate • Master Access
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0 font-black text-xl">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                Master Administrator • Shyam
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Role Enforced: Users Read-Only / Admin Controls
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Welcome, Shyam | CineFuel Control Center
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
          <Link2 className="w-4 h-4" /> Manage Links ({allFlattenedLinks.length})
        </button>

        <button
          onClick={() => setActiveTab('titles')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'titles'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Film className="w-4 h-4" /> Manage Titles & Search
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'users'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Users className="w-4 h-4" /> Manage Users
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
          <Key className="w-4 h-4" /> API Integrations
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
          <Database className="w-4 h-4" /> Backup & Vault
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
          <Server className="w-4 h-4" /> Diagnostics
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW & METRICS */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Tracked Titles</span>
              <p className="text-3xl font-black text-white" suppressHydrationWarning>{isMounted ? watchlist.length : 0}</p>
              <span className="text-[11px] text-amber-400 font-medium">In local/cloud storage</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Custom Links</span>
              <p className="text-3xl font-black text-amber-400">{allFlattenedLinks.length}</p>
              <span className="text-[11px] text-zinc-400 font-medium">Across all titles</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Cached Titles</span>
              <p className="text-3xl font-black text-emerald-400">{Object.keys(knownTitlesCache).length}</p>
              <span className="text-[11px] text-emerald-400 font-medium">TMDB Fast Indexed</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Active Admin</span>
              <p className="text-3xl font-black text-sky-400">Shyam</p>
              <span className="text-[11px] text-sky-400 font-medium">Master Security Level</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400" /> Quick Title Jump & Manage
                </h3>
                <button
                  onClick={() => setActiveTab('titles')}
                  className="text-xs text-amber-400 font-bold hover:underline"
                >
                  View All Titles →
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {PINNED_TITLES.slice(0, 6).map((pt) => (
                  <button
                    key={pt.id}
                    onClick={() => {
                      setSelectedTargetTitle(pt);
                      setActiveTab('links');
                    }}
                    className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/50 flex items-center gap-2.5 transition-all text-left group"
                  >
                    <div className="w-8 h-10 rounded bg-zinc-800 relative overflow-hidden shrink-0">
                      {pt.poster_path && (
                        <Image src={getImageURL(pt.poster_path, 'w200')} alt={pt.title} fill className="object-cover" sizes="32px" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold text-white group-hover:text-amber-400 truncate block">
                        {pt.title}
                      </span>
                      <span className="text-[10px] text-zinc-400 block font-mono">
                        {pt.media_type.toUpperCase()} • {pt.year}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" /> Service Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> TMDB Universal Search
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Live Operational
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> SIMKL Sync Engine
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Ready
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> TV Season Parser Engine (S01/S02)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MANAGE LINKS (UNIVERSAL TITLE SEARCH + SINGLE / BULK IMPORTER) */}
      {/* ========================================================= */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          {/* Add Custom Link Box with Universal Title Search & Mode Toggle */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0f121a] border border-amber-500/30 space-y-5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" /> Add / Import Custom Links
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select any title across TMDB, then add links one-by-one or use the Bulk Importer to auto-detect all episodes & zip packs.
                </p>
              </div>

              {/* Mode Toggle Pills (Single vs Bulk vs Episode Grid) */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-2xl border border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setAddLinkMode('single')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    addLinkMode === 'single'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> Single Link
                </button>
                <button
                  type="button"
                  onClick={() => setAddLinkMode('bulk')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                    addLinkMode === 'bulk'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" /> Bulk Auto-Detector
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddLinkMode('grid');
                    handleOpenAdminGrid();
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                    addLinkMode === 'grid'
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Episode Grid ({adminGridEpisodeCount} EPs)
                </button>
              </div>
            </div>

            {/* Target Title Search & Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 block">
                  1. Search & Select Target Title <span className="text-amber-400 font-normal">(Search any movie, show, or TMDB ID)</span>:
                </label>
                {selectedTargetTitle && (
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    Target: {selectedTargetTitle.title} ({selectedTargetTitle.id})
                  </span>
                )}
              </div>

              <div className="relative" ref={searchDropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type title name (e.g. Daredevil, Loki, Reacher, Breaking Bad, Inception) or enter TMDB ID..."
                    value={targetSearchQuery}
                    onChange={(e) => {
                      setTargetSearchQuery(e.target.value);
                      setIsTargetDropdownOpen(true);
                    }}
                    onFocus={() => setIsTargetDropdownOpen(true)}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none shadow-inner"
                  />
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  {isSearchingTarget ? (
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  ) : targetSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetSearchQuery('');
                        setTargetSearchResults([]);
                      }}
                      className="text-zinc-400 hover:text-white absolute right-3.5 top-1/2 -translate-y-1/2 text-xs"
                    >
                      ✕
                    </button>
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>

                {/* Auto-suggest Search Dropdown */}
                {isTargetDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#11141d] border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                    {targetSearchResults.length > 0 ? (
                      <div className="divide-y divide-zinc-800">
                        {targetSearchResults.map((item) => {
                          const title = item.title || item.name || 'Untitled';
                          const type = (item.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
                          const year = (item.release_date || item.first_air_date || '').split('-')[0];
                          const poster = getImageURL(item.poster_path, 'w200');

                          return (
                            <button
                              key={`${type}-${item.id}`}
                              type="button"
                              onClick={() => handleSelectTargetTitle(item)}
                              className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/80 transition-colors text-left group"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-9 h-12 rounded bg-zinc-800 relative overflow-hidden shrink-0">
                                  <Image src={poster} alt={title} fill className="object-cover" sizes="36px" />
                                </div>
                                <div className="overflow-hidden">
                                  <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors block truncate">
                                    {title}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                                    <span className={`px-1.5 py-0.2 rounded font-black ${type === 'tv' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                      {type.toUpperCase()}
                                    </span>
                                    {year && <span>• {year}</span>}
                                    <span>• ID: {item.id}</span>
                                  </div>
                                </div>
                              </div>

                              <span className="text-[11px] text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                Select ➔
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : targetSearchQuery.trim() ? (
                      <div className="p-4 text-center text-xs text-zinc-500">
                        {isSearchingTarget ? 'Searching TMDB catalog...' : `No titles found matching "${targetSearchQuery}".`}
                      </div>
                    ) : (
                      <div className="p-3">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block px-2 pb-2">
                          Popular / Quick Pinned Titles:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {PINNED_TITLES.map((pt) => (
                            <button
                              key={pt.id}
                              type="button"
                              onClick={() => handleSelectTargetTitle(pt)}
                              className="flex items-center gap-2 p-2 rounded-xl hover:bg-zinc-800 transition-colors text-left"
                            >
                              <div className="w-7 h-9 rounded bg-zinc-800 relative overflow-hidden shrink-0">
                                {pt.poster_path && (
                                  <Image src={getImageURL(pt.poster_path, 'w200')} alt={pt.title} fill className="object-cover" sizes="28px" />
                                )}
                              </div>
                              <div className="overflow-hidden">
                                <span className="text-xs font-bold text-white block truncate">{pt.title}</span>
                                <span className="text-[9px] text-zinc-400 font-mono">{pt.media_type.toUpperCase()} • {pt.year}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Suggestion Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-zinc-500 font-semibold">Quick pick:</span>
                {PINNED_TITLES.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => handleSelectTargetTitle(pt)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      selectedTargetTitle?.id === pt.id
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {pt.title} ({pt.id})
                  </button>
                ))}
              </div>
            </div>

            {/* VIEW A: SINGLE LINK FORM */}
            {addLinkMode === 'single' && (
              <form onSubmit={handleQuickAddLink} className="space-y-4 pt-3 border-t border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 block">
                    2. Enter Link Details for &quot;{selectedTargetTitle?.title || 'Selected Title'}&quot;:
                  </label>
                  <span className="text-[11px] text-amber-400 font-mono font-bold">
                    {selectedTargetTitle?.media_type === 'tv' ? '📺 TV Series Mode' : '🎬 Movie Mode'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="lg:col-span-2">
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                      Link Title / Release Label <span className="text-amber-400 text-[10px]">(Auto-detects S01/S02, Episode, Zip, Quality & Audio)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={selectedTargetTitle?.media_type === 'tv' ? "e.g. S01E01 2160p DSNP WEB-DL [Hindi + Eng] or S01 Complete.zip" : "e.g. 4K IMAX BluRay [Hindi + English Atmos], 1080p WEB-DL..."}
                      value={newLinkTitle}
                      onChange={(e) => handleNewLinkTitleChange(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div className="lg:col-span-2">
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
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Category / Release Type</label>
                    <select
                      value={newLinkCategory}
                      onChange={(e) => {
                        const val = e.target.value as CustomLink['category'];
                        setNewLinkCategory(val);
                        if (val === 'SingleEpisode') setNewLinkType('single_episode');
                        else if (val === 'ZipPack') setNewLinkType('zip_pack');
                        else setNewLinkType('general');
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                    >
                      <option value="SingleEpisode">📥 Single Episode (TV Series)</option>
                      <option value="ZipPack">🗜️ Complete Season Zip / Batch Pack (TV)</option>
                      <option value="Streaming">🎬 Streaming & OTT Platform</option>
                      <option value="Download">📥 Movie / Direct Download</option>
                      <option value="Subtitles">🌐 Subtitles (SRT / Zip)</option>
                      <option value="Discussion">💬 Discussion & Community</option>
                      <option value="Review">📝 Review & Guides</option>
                      <option value="Official">🏛️ Official Website</option>
                      <option value="Recent">⚡ Recent Release</option>
                    </select>
                  </div>

                  {/* Season Selector for TV / Episode / ZipPack */}
                  {(newLinkCategory === 'SingleEpisode' || newLinkCategory === 'ZipPack' || selectedTargetTitle?.media_type === 'tv') && (
                    <div>
                      <label className="text-[11px] font-semibold text-amber-400 block mb-1">Season #</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={newLinkSeason}
                        onChange={(e) => setNewLinkSeason(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-zinc-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
                      />
                    </div>
                  )}

                  {/* Episode Selector when Single Episode is chosen */}
                  {newLinkCategory === 'SingleEpisode' && (
                    <div>
                      <label className="text-[11px] font-semibold text-sky-400 block mb-1">Episode #</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={newLinkEpisode}
                        onChange={(e) => setNewLinkEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-zinc-900 border border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Quality / Resolution</label>
                    <input
                      type="text"
                      placeholder="e.g. 2160p 4K, 1080p FHD"
                      value={newLinkQuality}
                      onChange={(e) => setNewLinkQuality(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Audio / Dub</label>
                    <input
                      type="text"
                      placeholder="e.g. Hindi + English, Dual Audio"
                      value={newLinkAudio}
                      onChange={(e) => setNewLinkAudio(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">File Size</label>
                    <input
                      type="text"
                      placeholder="e.g. 6.36 GB, 1.2 GB"
                      value={newLinkSize}
                      onChange={(e) => setNewLinkSize(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 hover:scale-105"
                  >
                    <Plus className="w-4 h-4" /> Attach Custom Link to {selectedTargetTitle?.title || 'Title'}
                  </button>
                </div>
              </form>
            )}

            {/* VIEW B: BULK MULTI-LINK AUTO-DETECTOR CONTAINER */}
            {addLinkMode === 'bulk' && (
              <div className="space-y-4 pt-3 border-t border-zinc-800/80">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block flex items-center justify-between">
                    <span>2. Paste Multiple Episode & Zip Pack Links for &quot;{selectedTargetTitle?.title}&quot;:</span>
                    <span className="text-[10px] text-amber-400 font-mono">Auto-detects S01/S02, Zip Packs vs Single EPs, Qualities, and Dubs</span>
                  </label>
                  <textarea
                    rows={6}
                    placeholder={`Paste multiple release lines or download URLs at once! Examples:\n${selectedTargetTitle?.title} S01E01 2160p WEB-DL Hindi DDP 5.1 [6.36 GB] - https://hubcloud.foo/video/1...\n${selectedTargetTitle?.title} S01E02 2160p WEB-DL Hindi DDP 5.1 [6.28 GB] - https://hubcloud.foo/video/2...\n${selectedTargetTitle?.title} S01 Complete 2160p UHD BluRay DV HDR [Hindi DDP 5.1 + English Atmos].zip https://mega.nz/file/3...`}
                    value={adminBulkRawText}
                    onChange={(e) => setAdminBulkRawText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500 leading-relaxed shadow-inner"
                    autoFocus
                  />
                </div>

                {/* Real-time Parsed Results Preview */}
                {adminBulkParsedItems.length > 0 && (
                  <div className="space-y-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-black text-white">
                          {adminBulkParsedItems.length} Links Auto-Detected:
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 font-bold text-[10px]">
                          📥 {adminBulkParsedItems.filter((i) => i.linkType === 'single_episode').length} Episodes
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[10px]">
                          🗜️ {adminBulkParsedItems.filter((i) => i.linkType === 'zip_pack').length} Zip Packs
                        </span>
                      </div>

                      {/* Quick Bulk Convert Controls */}
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
                          type="button"
                          onClick={handleAdminImportBulk}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-lg hover:scale-105 flex items-center gap-1.5 ml-2"
                        >
                          <ListPlus className="w-4 h-4" />
                          <span>🚀 Import All ({adminBulkParsedItems.length}) Links to {selectedTargetTitle?.title}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {adminBulkParsedItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="overflow-hidden space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-black text-[9px] font-mono">
                                S0{item.seasonNumber}
                              </span>

                              {/* Clickable Badge to Toggle between Single Episode and Zip Pack */}
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
                            type="button"
                            onClick={() => setAdminBulkParsedItems((prev) => prev.filter((i) => i.id !== item.id))}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {adminBulkSuccessMsg && (
                  <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4" /> {adminBulkSuccessMsg}
                  </p>
                )}
              </div>
            )}

            {/* VIEW C: DYNAMIC EPISODE GRID CONTAINER (N TITLE & N LINK CONTAINERS) */}
            {addLinkMode === 'grid' && (
              <div className="space-y-4 pt-3 border-t border-zinc-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-zinc-300 block">
                    2. Dynamic Episode Containers for &quot;{selectedTargetTitle?.title}&quot;:
                  </label>
                  <span className="text-[11px] text-sky-400 font-mono font-bold">
                    {adminGridEpisodes.length} Title Containers & {adminGridEpisodes.length} Link Containers Open
                  </span>
                </div>

                {/* Season & Episode Count Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800/80">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1">Target Season:</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={adminGridSeason}
                      onChange={(e) => {
                        const s = Math.max(1, parseInt(e.target.value) || 1);
                        setAdminGridSeason(s);
                        syncAdminGridSlots(adminGridEpisodeCount, s, adminGridBasePattern, adminGridQuality, adminGridAudio, adminGridSize);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                      Episode Count <span className="text-sky-400">({adminGridEpisodeCount} Containers)</span>:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={adminGridEpisodeCount}
                        onChange={(e) => {
                          const c = Math.max(1, parseInt(e.target.value) || 1);
                          setAdminGridEpisodeCount(c);
                          syncAdminGridSlots(c, adminGridSeason, adminGridBasePattern, adminGridQuality, adminGridAudio, adminGridSize);
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                      <div className="flex flex-wrap items-center gap-1">
                        {[6, 8, 10, 12, 16, 24].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setAdminGridEpisodeCount(n);
                              syncAdminGridSlots(n, adminGridSeason, adminGridBasePattern, adminGridQuality, adminGridAudio, adminGridSize);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                              adminGridEpisodeCount === n
                                ? 'bg-sky-500 text-black shadow-md'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1">Default Quality:</label>
                    <input
                      type="text"
                      value={adminGridQuality}
                      onChange={(e) => setAdminGridQuality(e.target.value)}
                      placeholder="e.g. 2160p 4K, 1080p WEB-DL"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1">Default Audio:</label>
                    <input
                      type="text"
                      value={adminGridAudio}
                      onChange={(e) => setAdminGridAudio(e.target.value)}
                      placeholder="e.g. Hindi + English 5.1"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Base Pattern Template & URL Distributor */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-300 block">
                        Title Pattern Template <span className="text-zinc-500 font-normal">(Tokens: {'{title}'}, {'{season}'}, {'{ep}'}, {'{quality}'}, {'{audio}'})</span>:
                      </label>
                      <button
                        type="button"
                        onClick={handleApplyAdminPatternToAll}
                        className="text-[10px] text-sky-400 hover:text-sky-300 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 transition-colors"
                      >
                        ⚡ Apply Pattern to All {adminGridEpisodes.length} Titles
                      </button>
                    </div>
                    <input
                      type="text"
                      value={adminGridBasePattern}
                      onChange={(e) => setAdminGridBasePattern(e.target.value)}
                      placeholder="{title} S{season}E{ep} {quality} [{audio}]"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-300 block">
                        Paste Multiple URLs to Auto-Distribute into Containers:
                      </label>
                      <span className="text-[10px] text-zinc-500">1 URL per line</span>
                    </div>
                    <textarea
                      rows={2}
                      value={adminGridBulkLinksText}
                      onChange={(e) => handleDistributeAdminGridUrls(e.target.value)}
                      placeholder="Paste up to 8+ links here (one per line) — auto-fills into Link containers below!"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-mono resize-none shadow-inner"
                    />
                  </div>
                </div>

                {/* The N Title and N Link Containers Grid */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      Episode Containers ({adminGridEpisodes.length} Episodes):
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Filled: {adminGridEpisodes.filter((e) => e.url.trim()).length} / {adminGridEpisodes.length} Links
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                    {adminGridEpisodes.map((ep) => (
                      <div
                        key={ep.episodeNumber}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          ep.url.trim()
                            ? 'bg-zinc-900/90 border-sky-500/40 shadow-sm'
                            : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                          {/* Badge */}
                          <div className="md:col-span-2 flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-300 font-black text-xs font-mono border border-sky-500/30 whitespace-nowrap">
                              EP {ep.episodeNumber < 10 ? `0${ep.episodeNumber}` : ep.episodeNumber}
                            </span>
                            <span className="text-[11px] font-bold text-zinc-400 hidden sm:inline">
                              S{adminGridSeason < 10 ? `0${adminGridSeason}` : adminGridSeason}
                            </span>
                          </div>

                          {/* Title Container */}
                          <div className="md:col-span-5">
                            <label className="text-[10px] text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider">
                              Title Container #{ep.episodeNumber}
                            </label>
                            <input
                              type="text"
                              value={ep.title}
                              onChange={(e) => handleUpdateAdminGridSlot(ep.episodeNumber, 'title', e.target.value)}
                              placeholder={`Episode ${ep.episodeNumber} Title`}
                              className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                            />
                          </div>

                          {/* Link Container */}
                          <div className="md:col-span-5">
                            <label className="text-[10px] text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider">
                              Link Container #{ep.episodeNumber}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={ep.url}
                                onChange={(e) => handleUpdateAdminGridSlot(ep.episodeNumber, 'url', e.target.value)}
                                placeholder={`https://... / Drive link for Ep ${ep.episodeNumber}`}
                                className={`w-full bg-zinc-900/80 border rounded-xl px-3 py-2 text-xs font-mono placeholder-zinc-500 focus:outline-none ${
                                  ep.url.trim()
                                    ? 'border-emerald-500/50 text-emerald-300'
                                    : 'border-zinc-700 text-white focus:border-sky-500'
                                }`}
                              />
                              {ep.url.trim() && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAdminGridSlot(ep.episodeNumber, 'url', '')}
                                  className="text-zinc-500 hover:text-rose-400 px-1 text-xs"
                                  title="Clear URL"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Success Message */}
                {adminGridSuccessMsg && (
                  <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4" /> {adminGridSuccessMsg}
                  </p>
                )}

                {/* Footer Save Button */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <span className="text-xs text-zinc-400">
                    Saving will attach episode links to <strong className="text-white">{selectedTargetTitle?.title}</strong> under <strong className="text-white">Season {adminGridSeason}</strong>.
                  </span>

                  <button
                    type="button"
                    onClick={handleSaveAllAdminGridEpisodes}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-xs transition-all shadow-lg hover:scale-105 flex items-center gap-2"
                  >
                    <ListPlus className="w-4 h-4" />
                    <span>🚀 Save All ({adminGridEpisodes.filter((e) => e.url.trim()).length} of {adminGridEpisodes.length}) Episode Containers</span>
                  </button>
                </div>
              </div>
            )}

            {addLinkSuccess && (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Link published to &quot;{selectedTargetTitle?.title}&quot; catalog and title page successfully!
              </p>
            )}
          </div>

          {/* Links Moderation Table */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" /> All Saved Custom Links ({filteredLinks.length})
              </h3>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search links, titles..."
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 w-48"
                  />
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                <select
                  value={linkCategoryFilter}
                  onChange={(e) => setLinkCategoryFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-semibold"
                >
                  <option value="All">All Categories</option>
                  <option value="Streaming">Streaming</option>
                  <option value="Download">Download</option>
                  <option value="ZipPack">ZipPack</option>
                  <option value="SingleEpisode">SingleEpisode</option>
                  <option value="Subtitles">Subtitles</option>
                  <option value="Discussion">Discussion</option>
                  <option value="Review">Review</option>
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
                      <th className="py-3 px-3">Target Title</th>
                      <th className="py-3 px-3">Link Name / Release</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">URL</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredLinks.map((item) => (
                      <tr key={item.link.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-white">
                          <Link
                            href={`/${item.mediaType || 'movie'}/${item.movieId}`}
                            target="_blank"
                            className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>{item.movieName}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">({item.movieId})</span>
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-300">
                          <div>{item.link.title}</div>
                          {(item.link.quality || item.link.audioLanguage) && (
                            <div className="text-[10px] text-zinc-400 font-normal">
                              {item.link.quality} {item.link.audioLanguage ? `• ${item.link.audioLanguage}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 text-[10px]">
                            {item.link.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400 max-w-xs truncate">
                          {item.link.url}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
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
                            onClick={() => openEditModal(item.movieId, item.link)}
                            className="inline-flex p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                            title="Edit Link"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLink(item.movieId, item.link.id, item.link.title)}
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
      {/* TAB 3: MANAGE TITLES & LIVE CATALOG SEARCH */}
      {/* ========================================================= */}
      {activeTab === 'titles' && (
        <div className="p-6 sm:p-7 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Film className="w-4 h-4 text-amber-400" /> TMDB Universal Title & Catalog Search
              </h3>
              <p className="text-xs text-zinc-400">
                Search ANY movie or TV series across TMDB in real-time, view page, or attach custom links.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search TMDB catalog (e.g. Daredevil, Loki, Avatar)..."
                value={titleSearchQuery}
                onChange={(e) => setTitleSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {isSearchingManageTitles && (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCatalogTitles.map((t) => {
              const poster = getImageURL(t.poster_path, 'w200');
              const linksCount = (customLinksMap[String(t.id)] || []).length + (BUILTIN_CURATED_LINKS[t.id] || []).length;
              const titleText = t.title || (t as any).name || 'Title';
              const mediaType = t.media_type || ((t as any).name ? 'tv' : 'movie');
              const yearText = (t as any).year || ((t as any).release_date || (t as any).first_air_date || '').split('-')[0];

              return (
                <div key={`${mediaType}-${t.id}`} className="flex gap-3.5 p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/50 transition-all group shadow-md">
                  <div className="relative w-16 h-24 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                    <Image src={poster} alt={titleText} fill className="object-cover" sizes="64px" />
                  </div>
                  <div className="flex-1 overflow-hidden space-y-1.5">
                    <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                      {titleText}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                      <span className={`px-1.5 py-0.2 rounded font-black ${mediaType === 'tv' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {mediaType.toUpperCase()}
                      </span>
                      {yearText && <span>• {yearText}</span>}
                      <span>• ID: {t.id}</span>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20 inline-block">
                      {linksCount} Custom Link{linksCount !== 1 ? 's' : ''}
                    </span>

                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
                      <Link
                        href={`/${mediaType}/${t.id}`}
                        target="_blank"
                        className="text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 font-semibold"
                      >
                        <Eye className="w-3 h-3" /> View Page
                      </Link>
                      <button
                        onClick={() => {
                          handleSelectTargetTitle({
                            id: t.id,
                            title: titleText,
                            media_type: mediaType,
                            poster_path: t.poster_path,
                            release_date: (t as any).release_date,
                            first_air_date: (t as any).first_air_date,
                          });
                          setActiveTab('links');
                        }}
                        className="text-[10px] text-amber-400 hover:underline font-bold"
                      >
                        + Add Custom Link
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: MANAGE USERS */}
      {/* ========================================================= */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> User Directory & Account Vault
            </h3>
            <p className="text-xs text-zinc-400">
              Overview of connected user accounts, Firebase authentication states, and collection storage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-black font-black text-sm">
                  {userProfile?.displayName ? userProfile.displayName[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {userProfile?.displayName || 'Active Account'}
                  </h4>
                  <span className="text-xs text-zinc-400">{userProfile?.email || 'Guest User Session'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-black/40">
                  <span className="text-zinc-500 block text-[10px]">Watchlist</span>
                  <span className="font-bold text-white" suppressHydrationWarning>{isMounted ? watchlist.length : 0}</span>
                </div>
                <div className="p-2 rounded-xl bg-black/40">
                  <span className="text-zinc-500 block text-[10px]">Favorites</span>
                  <span className="font-bold text-amber-400" suppressHydrationWarning>{isMounted ? stats.favoritesCount : 0}</span>
                </div>
                <div className="p-2 rounded-xl bg-black/40">
                  <span className="text-zinc-500 block text-[10px]">Watched</span>
                  <span className="font-bold text-emerald-400" suppressHydrationWarning>{isMounted ? stats.watchedCount : 0}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <UserCheck className="w-4 h-4 text-emerald-400" /> Firebase Auth Integration
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Users authenticate securely with email/password or Google Auth. User custom watchlists, ratings, and custom links sync automatically to their profile.
              </p>
              <div className="text-[11px] text-zinc-500 font-mono">
                Status: <span className="text-emerald-400">Firebase Ready</span> • Role: <span className="text-amber-400">Master Administrator</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: API KEYS & INTEGRATIONS */}
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
      {/* TAB 6: BACKUP & DATABASE RESTORE */}
      {/* ========================================================= */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      {/* TAB 7: DIAGNOSTICS & LOGS */}
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

      {/* ========================================================= */}
      {/* EDIT LINK MODAL (ADMIN ONLY) */}
      {/* ========================================================= */}
      {editingLink && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#10141d] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Edit Custom Link
              </h3>
              <button
                onClick={() => setEditingLink(null)}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLink} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Link Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Destination URL</label>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="Streaming">🎬 Streaming</option>
                    <option value="Download">📥 Download</option>
                    <option value="ZipPack">ZipPack</option>
                    <option value="SingleEpisode">SingleEpisode</option>
                    <option value="Subtitles">🌐 Subtitles</option>
                    <option value="Discussion">💬 Discussion</option>
                    <option value="Review">📝 Review</option>
                    <option value="Official">🏛️ Official</option>
                    <option value="Recent">⚡ Recent</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Quality</label>
                  <input
                    type="text"
                    placeholder="e.g. 2160p 4K, 1080p"
                    value={editQuality}
                    onChange={(e) => setEditQuality(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Audio Dub</label>
                  <input
                    type="text"
                    placeholder="e.g. Hindi + English"
                    value={editAudio}
                    onChange={(e) => setEditAudio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 16.8 GB"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-md"
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
}
