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
  EyeOff,
  User,
  UserCheck,
  X,
  ChevronDown,
  Clock,
  Zap,
  ListPlus,
  LayoutGrid,
  Inbox,
  MessageSquare,
  CheckCircle,
  Link2Off,
  Wrench,
  ShieldAlert,
  FileWarning,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAuth } from '@/context/AuthContext';
import { CustomLink, CustomList, TitleDetails, UserRequest, DefectiveLinkReport } from '@/types';
import { MOCK_TITLES, TRENDING_LIST } from '@/lib/mockData';
import { getImageURL, getBackdropURL, searchMulti, getTitleDetails } from '@/lib/tmdb';
import { BUILTIN_CURATED_LINKS, saveGlobalCustomLink, saveMultipleGlobalCustomLinks, deleteGlobalCustomLink, deleteMultipleGlobalCustomLinks, getDeletedLinkIds, syncServerLinks } from '@/lib/curatedLinks';
import { parseFullMediaTitle, parseBulkLinksInput, ParsedBulkItem } from '@/lib/seasonParser';
import { detectServer } from '@/lib/serverDetector';

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
  { id: 61889, title: "Marvel's Daredevil", media_type: 'tv', year: '2015', poster_path: null },
  { id: 88396, title: 'Loki', media_type: 'tv', year: '2021', poster_path: '/kEl2t3OhXc3cm9hwvGuh8sqNVeb.jpg' },
  { id: 108978, title: 'Reacher', media_type: 'tv', year: '2022', poster_path: null },
  { id: 113962, title: 'Special Ops: Lioness', media_type: 'tv', year: '2023', poster_path: null },
  { id: 1396, title: 'Breaking Bad', media_type: 'tv', year: '2008', poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg' },
  { id: 157336, title: 'Interstellar', media_type: 'movie', year: '2014', poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
  { id: 155, title: 'The Dark Knight', media_type: 'movie', year: '2008', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
  { id: 27205, title: 'Inception', media_type: 'movie', year: '2010', poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg' },
  { id: 579974, title: 'RRR', media_type: 'movie', year: '2022', poster_path: '/nEufeZlyAOLqO2brrs0yeBEoo0R.jpg' },
];

interface BackdropTheme {
  name: string;
  editionTag: string;
  quote: string;
  backdropPath: string;
}

const BACKDROP_THEMES: Record<string, BackdropTheme> = {
  spiderman: {
    name: 'Spider-Man',
    editionTag: 'SPIDER-MAN : NO WAY HOME EDITION',
    quote: '“With great power comes great responsibility.”',
    backdropPath: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
  },
  dune: {
    name: 'Dune: Part Two',
    editionTag: 'DUNE : PART TWO EDITION',
    quote: '“Long live the fighters.”',
    backdropPath: '/xOMo8BRK7PfcJv9JCnx7s520fff.jpg',
  },
  oppenheimer: {
    name: 'Oppenheimer',
    editionTag: 'OPPENHEIMER CINEMATIC EDITION',
    quote: '“Now I am become Death, the destroyer of worlds.”',
    backdropPath: '/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
  },
  interstellar: {
    name: 'Interstellar',
    editionTag: 'INTERSTELLAR COSMIC EDITION',
    quote: '“Mankind was born on Earth. It was never meant to die here.”',
    backdropPath: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
  },
};

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Recently';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export default function AdminPage() {
  const {
    watchlist,
    addCustomLink,
    removeCustomLink,
    mdblistConfig,
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
  const [showPassword, setShowPassword] = useState(false);
  const [selectedBackdropTheme, setSelectedBackdropTheme] = useState<'spiderman' | 'dune' | 'oppenheimer' | 'interstellar'>('spiderman');

  // Tabs: 'overview' | 'links' | 'titles' | 'requests' | 'reports' | 'users' | 'apis' | 'backup' | 'logs'
  const [activeTab, setActiveTab] = useState<'overview' | 'links' | 'titles' | 'requests' | 'reports' | 'users' | 'apis' | 'backup' | 'logs'>('overview');

  // API Form States
  const [tmdbKey, setTmdbKey] = useState('');
  const [mdblistKey, setMdblistKey] = useState('');
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false);
  const [isTestingTmdb, setIsTestingTmdb] = useState(false);
  const [tmdbTestResult, setTmdbTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Links Moderation Filter & Search
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkCategoryFilter, setLinkCategoryFilter] = useState('All');
  const [deletedCuratedLinkIds, setDeletedCuratedLinkIds] = useState<Set<string>>(new Set());

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
  const [targetMediaTypeFilter, setTargetMediaTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [isSearchingTarget, setIsSearchingTarget] = useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Manual Custom Title Creation State (for titles not in TMDB or title mismatches)
  const [isManualTitleModalOpen, setIsManualTitleModalOpen] = useState(false);
  const [manualTitleName, setManualTitleName] = useState('');
  const [manualMediaType, setManualMediaType] = useState<'movie' | 'tv'>('movie');
  const [manualYear, setManualYear] = useState('');
  const [manualPoster, setManualPoster] = useState('');

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
  const [adminBulkMediaType, setAdminBulkMediaType] = useState<'movie' | 'tv'>('movie');
  const [adminBulkMovieCategory, setAdminBulkMovieCategory] = useState<CustomLink['category']>('Streaming');

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

  // Multi-Select Links State for Bulk Deletion
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());

  // Manage Titles Tab Live Search State
  const [titleSearchQuery, setTitleSearchQuery] = useState('');
  const [manageTitlesResults, setManageTitlesResults] = useState<TitleDetails[]>([]);
  const [isSearchingManageTitles, setIsSearchingManageTitles] = useState(false);

  // User Requests Management States
  const [requestsList, setRequestsList] = useState<UserRequest[]>([]);
  const [requestsFilter, setRequestsFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected'>('all');
  const [requestsSearchQuery, setRequestsSearchQuery] = useState('');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Fulfill Modal State
  const [fulfillingRequest, setFulfillingRequest] = useState<UserRequest | null>(null);
  const [fulfillUrl, setFulfillUrl] = useState('');
  const [fulfillTitle, setFulfillTitle] = useState('');
  const [fulfillQuality, setFulfillQuality] = useState('');
  const [fulfillAudio, setFulfillAudio] = useState('');
  const [fulfillSize, setFulfillSize] = useState('');
  const [fulfillCategory, setFulfillCategory] = useState<CustomLink['category']>('Download');
  const [isFulfillingSubmit, setIsFulfillingSubmit] = useState(false);
  const [fulfillSuccessMsg, setFulfillSuccessMsg] = useState('');

  // Defective Links Management States
  const [reportsList, setReportsList] = useState<DefectiveLinkReport[]>([]);
  const [reportsFilter, setReportsFilter] = useState<'all' | 'pending' | 'fixed' | 'dismissed'>('all');
  const [reportsIssueFilter, setReportsIssueFilter] = useState<string>('all');
  const [reportsSearchQuery, setReportsSearchQuery] = useState('');
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  // Fix / Replace Link Modal State
  const [fixingReport, setFixingReport] = useState<DefectiveLinkReport | null>(null);
  const [replaceUrl, setReplaceUrl] = useState('');
  const [replaceTitle, setReplaceTitle] = useState('');
  const [replaceQuality, setReplaceQuality] = useState('');
  const [replaceAudio, setReplaceAudio] = useState('');
  const [replaceSize, setReplaceSize] = useState('');
  const [replaceAdminNote, setReplaceAdminNote] = useState('');
  const [updateDbWithReplacement, setUpdateDbWithReplacement] = useState(true);
  const [isFixingSubmit, setIsFixingSubmit] = useState(false);
  const [fixSuccessMsg, setFixSuccessMsg] = useState('');

  // Reassign & Title Mismatch States for Fix Modal
  const [replaceTargetTitle, setReplaceTargetTitle] = useState('');
  const [replaceTargetMediaType, setReplaceTargetMediaType] = useState<'movie' | 'tv'>('movie');
  const [replaceTargetMovieId, setReplaceTargetMovieId] = useState<number>(0);
  const [isChangingTarget, setIsChangingTarget] = useState(false);
  const [reassignSearchQuery, setReassignSearchQuery] = useState('');
  const [reassignSearchResults, setReassignSearchResults] = useState<TitleDetails[]>([]);
  const [isSearchingReassign, setIsSearchingReassign] = useState(false);

  // Diagnostics logs
  const [systemLogs, setSystemLogs] = useState<Array<{ timestamp: string; level: 'info' | 'success' | 'warn'; message: string }>>([
    { timestamp: 'Just now', level: 'success', message: 'Admin session initialized for Shyam.' },
    { timestamp: '1m ago', level: 'info', message: 'Bulk Multi-Link Auto-Detector Engine ready for batch episodes & zip packs.' },
    { timestamp: '2m ago', level: 'info', message: 'TMDB & MDBList engines operational.' },
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

      // Real-time live fetch of all cloud database links
      const fetchAllAdminLinks = async () => {
        try {
          const res = await fetch(`/api/curated-links?_t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data.allLinks && typeof data.allLinks === 'object') {
              const currentDeleted = getDeletedLinkIds();
              const cleanedMap: Record<string, CustomLink[]> = {};
              for (const [k, arr] of Object.entries(data.allLinks)) {
                if (Array.isArray(arr)) {
                  const filtered = (arr as CustomLink[]).filter((l) => !currentDeleted.has(l.id));
                  if (filtered.length > 0) {
                    cleanedMap[k] = filtered;
                  }
                }
              }
              setCustomLinksMap(cleanedMap);
              localStorage.setItem('cinefuel_custom_links', JSON.stringify(cleanedMap));
            }
          }
        } catch {}
      };

      fetchAllAdminLinks();
      const adminSyncInterval = setInterval(fetchAllAdminLinks, 3000);

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

      if (mdblistConfig?.apiKey) setMdblistKey(mdblistConfig.apiKey);

      setDeletedCuratedLinkIds(getDeletedLinkIds());

      // Initial fetch and interval for user requests
      fetchAdminRequests();
      const requestsSyncInterval = setInterval(fetchAdminRequests, 4000);

      // Initial fetch and interval for defective link reports
      fetchAdminReports();
      const reportsSyncInterval = setInterval(fetchAdminReports, 4000);

      const handleLinksUpdated = () => {
        setDeletedCuratedLinkIds(getDeletedLinkIds());
        fetchAllAdminLinks();
        fetchAdminRequests();
        fetchAdminReports();
      };
      const handleReportsUpdated = () => {
        fetchAdminReports();
      };
      window.addEventListener('cinefuel_links_updated', handleLinksUpdated);
      window.addEventListener('cinefuel_report_submitted', handleReportsUpdated);
      return () => {
        clearInterval(adminSyncInterval);
        clearInterval(requestsSyncInterval);
        clearInterval(reportsSyncInterval);
        window.removeEventListener('cinefuel_links_updated', handleLinksUpdated);
        window.removeEventListener('cinefuel_report_submitted', handleReportsUpdated);
      };
    }
  }, [mdblistConfig]);

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
      const explicitType = numericMatch[1] as 'movie' | 'tv' | undefined;
      setIsSearchingTarget(true);

      if (explicitType) {
        getTitleDetails(explicitType, detectedId).then((res) => {
          setIsSearchingTarget(false);
          if (res && (res.title || res.name)) {
            setTargetSearchResults([{ ...res, media_type: explicitType }]);
          }
        });
      } else {
        // Query both Movie and TV in parallel so TMDB ID lookup never fails!
        Promise.allSettled([
          getTitleDetails('movie', detectedId),
          getTitleDetails('tv', detectedId),
        ]).then(([mRes, tRes]) => {
          setIsSearchingTarget(false);
          const list: TitleDetails[] = [];
          if (mRes.status === 'fulfilled' && mRes.value && (mRes.value.title || mRes.value.name)) {
            list.push({ ...mRes.value, media_type: 'movie' });
          }
          if (tRes.status === 'fulfilled' && tRes.value && (tRes.value.title || tRes.value.name)) {
            list.push({ ...tRes.value, media_type: 'tv' });
          }
          setTargetSearchResults(list);
        });
      }
      return;
    }

    setIsSearchingTarget(true);
    const handler = setTimeout(async () => {
      try {
        const data = await searchMulti(query, 1);
        if (data && data.results) {
          let filtered = data.results.filter(
            (item): item is TitleDetails =>
              (item as any).media_type === 'movie' || (item as any).media_type === 'tv'
          );
          if (targetMediaTypeFilter !== 'all') {
            filtered = filtered.filter((i) => (i as any).media_type === targetMediaTypeFilter);
          }
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
  }, [targetSearchQuery, targetMediaTypeFilter]);

  // Debounced TMDB Live Search for Reassigning Title in Defective Link Modal
  useEffect(() => {
    const q = reassignSearchQuery.trim();
    if (!q) {
      setReassignSearchResults([]);
      setIsSearchingReassign(false);
      return;
    }

    const numericMatch = q.match(/^\d+$/) || q.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
    if (numericMatch) {
      const detectedId = Number(numericMatch[2] || numericMatch[0]);
      setIsSearchingReassign(true);
      Promise.allSettled([
        getTitleDetails('movie', detectedId),
        getTitleDetails('tv', detectedId),
      ]).then(([mRes, tRes]) => {
        setIsSearchingReassign(false);
        const list: TitleDetails[] = [];
        if (mRes.status === 'fulfilled' && mRes.value && (mRes.value.title || mRes.value.name)) {
          list.push({ ...mRes.value, media_type: 'movie' });
        }
        if (tRes.status === 'fulfilled' && tRes.value && (tRes.value.title || tRes.value.name)) {
          list.push({ ...tRes.value, media_type: 'tv' });
        }
        setReassignSearchResults(list);
      });
      return;
    }

    setIsSearchingReassign(true);
    const handler = setTimeout(async () => {
      try {
        const data = await searchMulti(q, 1);
        if (data && data.results) {
          const filtered = data.results.filter(
            (item): item is TitleDetails =>
              (item as any).media_type === 'movie' || (item as any).media_type === 'tv'
          );
          setReassignSearchResults(filtered);
        } else {
          setReassignSearchResults([]);
        }
      } catch {
        setReassignSearchResults([]);
      } finally {
        setIsSearchingReassign(false);
      }
    }, 280);

    return () => clearTimeout(handler);
  }, [reassignSearchQuery]);

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
    const currentType = adminBulkMediaType || (selectedTargetTitle?.media_type === 'tv' ? 'tv' : 'movie');
    const parsed = parseBulkLinksInput(adminBulkRawText, 1, currentType, adminBulkMovieCategory);
    setAdminBulkParsedItems(parsed);
  }, [adminBulkRawText, adminBulkMediaType, adminBulkMovieCategory, selectedTargetTitle?.media_type]);

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

    // Set intelligent default category and bulk media type based on media type
    if (resolvedType === 'tv') {
      setNewLinkCategory('SingleEpisode');
      setNewLinkType('single_episode');
      setAdminBulkMediaType('tv');
      syncAdminGridSlots(adminGridEpisodeCount, adminGridSeason, adminGridBasePattern, adminGridQuality, adminGridAudio, adminGridSize, resolvedTitle);
    } else {
      setNewLinkCategory('Streaming');
      setNewLinkType('general');
      setAdminBulkMediaType('movie');
    }

    addLog(`Target title switched to "${resolvedTitle}" (ID: ${item.id})`, 'info');
  };

  // Handle Manual Custom Title Creation (When TMDB doesn't find title)
  const handleCreateManualTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualTitleName.trim()) return;

    const manualId = Math.floor(900000000 + (Date.now() % 99999999));
    const targetObj = {
      id: manualId,
      title: manualTitleName.trim(),
      media_type: manualMediaType,
      poster_path: manualPoster.trim() || null,
      year: manualYear.trim() || String(new Date().getFullYear()),
    };

    setSelectedTargetTitle(targetObj);
    cacheTitle(manualId, targetObj);
    setIsTargetDropdownOpen(false);
    setTargetSearchQuery('');
    setIsManualTitleModalOpen(false);
    setManualTitleName('');
    setManualYear('');
    setManualPoster('');

    if (manualMediaType === 'tv') {
      setNewLinkCategory('SingleEpisode');
      setNewLinkType('single_episode');
      setAdminBulkMediaType('tv');
    } else {
      setNewLinkCategory('Streaming');
      setNewLinkType('general');
      setAdminBulkMediaType('movie');
    }

    addLog(`Created and selected custom title "${targetObj.title}" (ID: ${manualId})`, 'success');
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

  // User Requests Action Handlers
  const fetchAdminRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const res = await fetch(`/api/requests?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          setRequestsList(data.requests);
          setPendingRequestsCount(data.pendingCount || 0);
        }
      }
    } catch (e) {
      console.error('Failed to fetch user requests:', e);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: 'pending' | 'fulfilled' | 'rejected',
    meta?: any
  ) => {
    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...meta }),
      });
      if (res.ok) {
        setRequestsList((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  ...(status === 'fulfilled' ? { fulfilledAt: new Date().toISOString() } : {}),
                  ...(meta?.fulfilledLinkUrl ? { fulfilledLinkUrl: meta.fulfilledLinkUrl } : {}),
                }
              : r
          )
        );
        addLog(`Request ${id} marked as ${status}.`, 'success');
        const refreshRes = await fetch(`/api/requests?_t=${Date.now()}`);
        if (refreshRes.ok) {
          const d = await refreshRes.json();
          setPendingRequestsCount(d.pendingCount || 0);
        }
      }
    } catch (err: any) {
      addLog(`Failed to update request: ${err.message}`, 'warn');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user request?')) return;
    try {
      const res = await fetch(`/api/requests?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRequestsList((prev) => prev.filter((r) => r.id !== id));
        addLog(`Request ${id} deleted.`, 'info');
        const refreshRes = await fetch(`/api/requests?_t=${Date.now()}`);
        if (refreshRes.ok) {
          const d = await refreshRes.json();
          setPendingRequestsCount(d.pendingCount || 0);
        }
      }
    } catch (err: any) {
      addLog(`Failed to delete request: ${err.message}`, 'warn');
    }
  };

  const handleOpenFulfill = (req: UserRequest) => {
    setFulfillingRequest(req);
    const yr = req.releaseYear ? ` (${req.releaseYear})` : '';
    setFulfillTitle(`${req.title}${yr} ${req.quality || '1080p'} [${req.audioLanguage || 'Dual Audio'}]`);
    setFulfillUrl('');
    setFulfillQuality(req.quality || '1080p');
    setFulfillAudio(req.audioLanguage || 'Hindi + English');
    setFulfillSize('');
    setFulfillCategory(req.mediaType === 'tv' ? (req.seasonNumber ? 'SingleEpisode' : 'ZipPack') : 'Download');
    setFulfillSuccessMsg('');
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillingRequest || !fulfillUrl.trim()) return;

    setIsFulfillingSubmit(true);
    let targetTmdbId = fulfillingRequest.tmdbId;

    if (!targetTmdbId) {
      const found = Object.entries(knownTitlesCache).find(([_, info]) =>
        info.title.toLowerCase() === fulfillingRequest.title.toLowerCase()
      );
      if (found) targetTmdbId = Number(found[0]);
    }

    if (!targetTmdbId) {
      targetTmdbId = Math.floor(Math.random() * 800000) + 100000;
    }

    try {
      let finalUrl = fulfillUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }

      const generatedLinkId = `link-${Date.now()}`;
      const newCustomLink: CustomLink = {
        id: generatedLinkId,
        title: fulfillTitle.trim(),
        url: finalUrl,
        category: fulfillCategory,
        createdAt: new Date().toISOString(),
        quality: fulfillQuality.trim() || undefined,
        audioLanguage: fulfillAudio.trim() || undefined,
        size: fulfillSize.trim() || undefined,
        seasonNumber: fulfillingRequest.seasonNumber,
        episodeNumber: fulfillingRequest.episodeNumber,
        linkType: fulfillingRequest.mediaType === 'tv' ? (fulfillingRequest.seasonNumber ? 'single_episode' : 'zip_pack') : 'general',
      };

      // 1. Save link to title database
      await saveGlobalCustomLink(targetTmdbId, newCustomLink);

      // 2. Mark request as fulfilled
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fulfillingRequest.id,
          status: 'fulfilled',
          fulfilledLinkId: generatedLinkId,
          fulfilledLinkUrl: finalUrl,
        }),
      });

      if (res.ok) {
        setFulfillSuccessMsg(`🎉 Successfully published link and fulfilled request for "${fulfillingRequest.title}"!`);
        addLog(`Fulfilled request for "${fulfillingRequest.title}" with link: ${finalUrl}`, 'success');
        
        setRequestsList((prev) =>
          prev.map((r) =>
            r.id === fulfillingRequest.id
              ? {
                  ...r,
                  status: 'fulfilled',
                  fulfilledAt: new Date().toISOString(),
                  fulfilledLinkUrl: finalUrl,
                }
              : r
          )
        );
        setPendingRequestsCount((prev) => Math.max(0, prev - 1));

        setTimeout(() => {
          setFulfillingRequest(null);
          setFulfillSuccessMsg('');
        }, 2200);
      }
    } catch (err: any) {
      console.error('Error fulfilling request:', err);
      addLog(`Failed to fulfill request: ${err.message}`, 'warn');
    } finally {
      setIsFulfillingSubmit(false);
    }
  };

  // ==============================================================
  // Defective Links / Broken Reports Handlers
  // ==============================================================
  const fetchAdminReports = async () => {
    try {
      setIsLoadingReports(true);
      const res = await fetch(`/api/reports?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          setReportsList(data.reports);
          setPendingReportsCount(data.pendingCount || 0);
        }
      }
    } catch (e) {
      console.error('Failed to fetch defective link reports:', e);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleUpdateReportStatus = async (
    id: string,
    status: 'pending' | 'fixed' | 'dismissed',
    meta?: any
  ) => {
    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...meta }),
      });
      if (res.ok) {
        setReportsList((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  ...(status === 'fixed' || status === 'dismissed' ? { resolvedAt: new Date().toISOString() } : {}),
                  ...(meta?.replacementUrl ? { replacementUrl: meta.replacementUrl } : {}),
                  ...(meta?.adminNote ? { adminNote: meta.adminNote } : {}),
                }
              : r
          )
        );
        addLog(`Defective report ${id} status updated to ${status}.`, 'success');
        const refreshRes = await fetch(`/api/reports?_t=${Date.now()}`);
        if (refreshRes.ok) {
          const d = await refreshRes.json();
          setPendingReportsCount(d.pendingCount || 0);
        }
      }
    } catch (err: any) {
      addLog(`Failed to update defective report: ${err.message}`, 'warn');
    }
  };

  const handleDeleteBrokenLinkDirectly = async (report: DefectiveLinkReport) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete this broken link from CineFuel?\n\nTitle: ${report.mediaTitle}\nURL: ${report.reportedUrl}`
      )
    )
      return;

    try {
      // 1. Remove from client state & local storage
      if (report.linkId && report.movieId) {
        removeCustomLink(report.movieId, report.linkId);
        await deleteGlobalCustomLink(report.movieId, report.linkId);
      }

      // 2. Mark report as fixed with deletion metadata
      await handleUpdateReportStatus(report.id, 'fixed', {
        adminNote: 'Broken link permanently removed from CineFuel database.',
        deleteInDatabase: true,
        movieId: report.movieId,
        linkId: report.linkId,
      });

      addLog(`Deleted defective link permanently for "${report.mediaTitle}"`, 'warn');
    } catch (err: any) {
      addLog(`Failed to delete defective link: ${err.message}`, 'warn');
    }
  };

  const handleOpenFixModal = (report: DefectiveLinkReport) => {
    setFixingReport(report);
    setReplaceUrl(report.reportedUrl || ''); // Pre-fill with existing reported URL so admin can edit it directly!
    setReplaceTitle(report.linkTitle);
    setReplaceQuality(report.quality || '1080p WEB-DL');
    setReplaceAudio('');
    setReplaceSize('');
    setReplaceAdminNote(
      report.issueType === 'wrong_episode'
        ? 'Corrected media title/type and updated working link.'
        : 'Replaced with verified working download mirror.'
    );
    setUpdateDbWithReplacement(true);
    setFixSuccessMsg('');

    // Pre-populate target title, media type, and movieId
    setReplaceTargetTitle(report.mediaTitle);
    setReplaceTargetMediaType(report.mediaType || 'movie');
    setReplaceTargetMovieId(report.movieId);
    setIsChangingTarget(report.issueType === 'wrong_episode'); // Auto-open title reassign panel if issue was title/episode mismatch!
    setReassignSearchQuery('');
    setReassignSearchResults([]);
  };

  const handleSubmitFixReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixingReport || !replaceUrl.trim()) return;

    let finalUrl = replaceUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    const targetMovieId = replaceTargetMovieId || fixingReport.movieId;
    const isTargetChanged = targetMovieId !== fixingReport.movieId || replaceTargetMediaType !== fixingReport.mediaType;

    try {
      setIsFixingSubmit(true);

      // 1. If target changed (e.g. from TV show to Movie, or to another movie ID):
      if (isTargetChanged && fixingReport.movieId) {
        deleteGlobalCustomLink(fixingReport.movieId, fixingReport.linkId || '');
        removeCustomLink(fixingReport.movieId, fixingReport.linkId || '');
        await deleteMultipleGlobalCustomLinks([{ movieId: fixingReport.movieId, linkId: fixingReport.linkId || '' }]);
        try {
          await fetch(`/api/curated-links?movieId=${fixingReport.movieId}&linkId=${fixingReport.linkId}`, {
            method: 'DELETE',
          });
        } catch {}
      }

      // 2. If updateDbWithReplacement is enabled and we have a valid targetMovieId
      if (updateDbWithReplacement && targetMovieId) {
        const isTV = replaceTargetMediaType === 'tv';
        const parsed = parseFullMediaTitle(replaceTitle.trim());

        const replacementLinkObj: CustomLink = {
          id: fixingReport.linkId || `link-${Date.now()}`,
          title: replaceTitle.trim() || fixingReport.linkTitle,
          url: finalUrl,
          category: isTV ? 'SingleEpisode' : 'Download',
          createdAt: new Date().toISOString(),
          seasonNumber: isTV ? (parsed.seasonNumber || 1) : undefined,
          episodeNumber: isTV ? (parsed.episodeNumber || 1) : undefined,
          linkType: isTV ? 'single_episode' : 'general',
          quality: replaceQuality.trim() || fixingReport.quality || '1080p WEB-DL',
          audioLanguage: replaceAudio.trim(),
          size: replaceSize.trim(),
        };

        saveGlobalCustomLink(targetMovieId, replacementLinkObj);
        addCustomLink(targetMovieId, {
          title: replacementLinkObj.title,
          url: replacementLinkObj.url,
          category: isTV ? 'SingleEpisode' : 'Download',
        });
      }

      // 3. Mark report as fixed in server database
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fixingReport.id,
          status: 'fixed',
          replacementUrl: finalUrl,
          adminNote: replaceAdminNote.trim(),
          replaceInDatabase: updateDbWithReplacement,
          movieId: targetMovieId,
          linkId: fixingReport.linkId,
          updatedLinkTitle: replaceTitle.trim() || fixingReport.linkTitle,
          updatedQuality: replaceQuality.trim(),
          updatedAudio: replaceAudio.trim(),
          updatedSize: replaceSize.trim(),
          oldMovieId: isTargetChanged ? fixingReport.movieId : undefined,
        }),
      });

      if (res.ok) {
        setFixSuccessMsg('🎉 Defective link updated, reassigned to correct title, and marked as fixed!');
        addLog(`Replaced defective link for "${replaceTargetTitle || fixingReport.mediaTitle}" with: ${finalUrl}`, 'success');

        setReportsList((prev) =>
          prev.map((r) =>
            r.id === fixingReport.id
              ? {
                  ...r,
                  status: 'fixed',
                  resolvedAt: new Date().toISOString(),
                  replacementUrl: finalUrl,
                  adminNote: replaceAdminNote.trim(),
                  mediaTitle: replaceTargetTitle || r.mediaTitle,
                  mediaType: replaceTargetMediaType || r.mediaType,
                  movieId: targetMovieId,
                }
              : r
          )
        );
        setPendingReportsCount((prev) => Math.max(0, prev - 1));

        setTimeout(() => {
          setFixingReport(null);
          setFixSuccessMsg('');
        }, 2000);
      }
    } catch (err: any) {
      addLog(`Failed to fix defective link: ${err.message}`, 'warn');
    } finally {
      setIsFixingSubmit(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this defective link report record?')) return;
    try {
      const res = await fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setReportsList((prev) => prev.filter((r) => r.id !== id));
        addLog(`Report ${id} deleted permanently.`, 'info');
      }
    } catch (err: any) {
      addLog(`Failed to delete report: ${err.message}`, 'warn');
    }
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

  // Set category for all items in movie bulk mode
  const handleSetAllBulkCategory = (cat: CustomLink['category']) => {
    setAdminBulkMovieCategory(cat);
    setAdminBulkParsedItems((prev) =>
      prev.map((item) => ({
        ...item,
        category: cat,
      }))
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

    const isMovie = adminBulkMediaType === 'movie';
    const createdObjs: CustomLink[] = [];
    adminBulkParsedItems.forEach((item, index) => {
      const newObj: CustomLink = {
        id: `bulk-admin-${Date.now()}-${index}`,
        title: item.title,
        url: item.url,
        category: isMovie ? (item.category || adminBulkMovieCategory || 'Streaming') : item.category,
        createdAt: new Date(Date.now() - index * 1000).toISOString(),
        seasonNumber: isMovie ? undefined : item.seasonNumber,
        episodeNumber: isMovie ? undefined : item.episodeNumber,
        quality: item.quality,
        audioLanguage: item.audioLanguage,
        size: item.size,
        linkType: isMovie ? 'general' : item.linkType,
      };
      createdObjs.push(newObj);
    });

    saveMultipleGlobalCustomLinks(selectedTargetTitle.id, createdObjs);

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
    if (isMovie) {
      setAdminBulkSuccessMsg(`🎉 Successfully imported ${count} Movie Release${count > 1 ? 's' : ''} to "${selectedTargetTitle.title}"!`);
      addLog(`Admin bulk imported ${count} movie releases for "${selectedTargetTitle.title}"`, 'success');
    } else {
      const epCount = adminBulkParsedItems.filter((i) => i.linkType === 'single_episode').length;
      const zipCount = adminBulkParsedItems.filter((i) => i.linkType === 'zip_pack').length;
      setAdminBulkSuccessMsg(`🎉 Successfully imported ${count} links (${epCount} Episodes, ${zipCount} Zip Packs) for "${selectedTargetTitle.title}"!`);
      addLog(`Admin bulk imported ${count} TV links for "${selectedTargetTitle.title}"`, 'success');
    }

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
  const handleDeleteLink = async (movieId: number, linkId: string, linkTitle: string) => {
    if (!confirm(`Delete link "${linkTitle}" permanently?`)) return;

    // 1. Instant optimistic state update
    setDeletedCuratedLinkIds((prev) => {
      const updated = new Set(prev);
      updated.add(linkId);
      return updated;
    });

    setCustomLinksMap((prev) => {
      const movieIdStr = String(movieId);
      const existing = prev[movieIdStr] || [];
      const updatedList = existing.filter((l) => l.id !== linkId);
      const updatedMap = { ...prev, [movieIdStr]: updatedList };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(updatedMap));
      }
      return updatedMap;
    });

    setSelectedLinkIds((prev) => {
      if (prev.has(linkId)) {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      }
      return prev;
    });

    removeCustomLink(movieId, linkId);
    addLog(`Admin deleted link "${linkTitle}"`, 'warn');

    // 2. Persist deletion to server & cloud database
    await deleteGlobalCustomLink(movieId, linkId);
  };

  // Multi-Select Toggle for Single Link
  const toggleSelectLink = (linkId: string) => {
    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) {
        next.delete(linkId);
      } else {
        next.add(linkId);
      }
      return next;
    });
  };

  // Multi-Select Toggle All Filtered Links
  const handleSelectAllFiltered = () => {
    if (filteredLinks.length === 0) return;
    const allSelected = filteredLinks.every((item) => selectedLinkIds.has(item.link.id));
    if (allSelected) {
      setSelectedLinkIds((prev) => {
        const next = new Set(prev);
        filteredLinks.forEach((item) => next.delete(item.link.id));
        return next;
      });
    } else {
      setSelectedLinkIds((prev) => {
        const next = new Set(prev);
        filteredLinks.forEach((item) => next.add(item.link.id));
        return next;
      });
    }
  };

  // Bulk Delete Selected Links
  const handleBulkDelete = async () => {
    if (selectedLinkIds.size === 0) return;
    const count = selectedLinkIds.size;
    if (!confirm(`Are you sure you want to permanently delete all ${count} selected link${count > 1 ? 's' : ''}?`)) return;

    const itemsToDelete = allFlattenedLinks.filter((item) => selectedLinkIds.has(item.link.id));
    const deleteIds = new Set(selectedLinkIds);

    // 1. Instant optimistic UI update
    setDeletedCuratedLinkIds((prev) => {
      const updated = new Set(prev);
      deleteIds.forEach((id) => updated.add(id));
      return updated;
    });

    setCustomLinksMap((prev) => {
      const updatedMap = { ...prev };
      itemsToDelete.forEach((item) => {
        const movieIdStr = String(item.movieId);
        if (updatedMap[movieIdStr]) {
          updatedMap[movieIdStr] = updatedMap[movieIdStr].filter((l) => !deleteIds.has(l.id));
        }
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(updatedMap));
      }
      return updatedMap;
    });

    setSelectedLinkIds(new Set());
    itemsToDelete.forEach((item) => {
      removeCustomLink(item.movieId, item.link.id);
    });
    addLog(`Admin bulk deleted ${count} links permanently`, 'warn');

    // 2. Fast atomic batch deletion to cloud database
    await deleteMultipleGlobalCustomLinks(itemsToDelete.map((i) => ({ movieId: i.movieId, linkId: i.link.id })));
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

  // 1. Built-in Curated Links (Filtered by deletedCuratedLinkIds)
  Object.entries(BUILTIN_CURATED_LINKS).forEach(([movieIdStr, links]) => {
    const numId = Number(movieIdStr);
    const info = resolveTitleInfo(numId);
    links.forEach((l) => {
      if (!deletedCuratedLinkIds.has(l.id) && !seenLinkIds.has(l.id)) {
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

  // 2. Watchlist Links (Filtered by deletedCuratedLinkIds)
  watchlist.forEach((w) => {
    if (w.customLinks && Array.isArray(w.customLinks)) {
      w.customLinks.forEach((l) => {
        if (!deletedCuratedLinkIds.has(l.id) && !seenLinkIds.has(l.id)) {
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

  // 3. Dynamic Live Server/Cloud Custom Links
  Object.entries(customLinksMap).forEach(([movieIdStr, links]) => {
    if (Array.isArray(links)) {
      const numId = Number(movieIdStr);
      const info = resolveTitleInfo(numId);
      const isTv = info.media_type === 'tv' || links.some((l) => l.seasonNumber !== undefined || l.episodeNumber !== undefined || l.linkType === 'single_episode' || l.linkType === 'zip_pack');
      links.forEach((l: CustomLink) => {
        if (!deletedCuratedLinkIds.has(l.id) && !seenLinkIds.has(l.id)) {
          seenLinkIds.add(l.id);
          allFlattenedLinks.push({
            movieId: numId,
            movieName: info.title,
            mediaType: isTv ? 'tv' : 'movie',
            link: l,
          });
        }
      });
    }
  });

  // Auto-resolve title names from TMDB for unknown IDs in customLinksMap
  useEffect(() => {
    const unknownIds = Object.keys(customLinksMap)
      .map(Number)
      .filter((id) => id > 0 && (!knownTitlesCache[id] || knownTitlesCache[id].title.startsWith('Title #')));
    if (unknownIds.length === 0) return;

    unknownIds.slice(0, 15).forEach(async (id) => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=8265bd1679663a7ea12ac168da84d2e8`);
        if (res.ok) {
          const d = await res.json();
          cacheTitle(id, {
            title: d.title || d.name || `Title #${id}`,
            poster_path: d.poster_path,
            media_type: 'movie',
            year: (d.release_date || '').split('-')[0],
          });
          return;
        }
        const tvRes = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=8265bd1679663a7ea12ac168da84d2e8`);
        if (tvRes.ok) {
          const d = await tvRes.json();
          cacheTitle(id, {
            title: d.name || `Title #${id}`,
            poster_path: d.poster_path,
            media_type: 'tv',
            year: (d.first_air_date || '').split('-')[0],
          });
        }
      } catch {}
    });
  }, [customLinksMap, knownTitlesCache]);

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
  // 1. Password Lock Gate (If not authenticated) - Cinematic Glassmorphism Edition
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    const currentTheme = BACKDROP_THEMES[selectedBackdropTheme] || BACKDROP_THEMES.spiderman;
    const backdropUrl = getBackdropURL(currentTheme.backdropPath, 'original');

    return (
      <div className="relative min-h-[92vh] w-full flex flex-col justify-between items-center px-4 py-8 overflow-hidden">
        {/* 1. Full-Screen Cinematic Backdrop Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          <Image
            src={backdropUrl}
            alt={currentTheme.name}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-30 scale-105 transition-all duration-1000 filter brightness-90 contrast-125"
          />
          {/* Multi-layered cinematic vignette & dark depth gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/75 to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07090e]/90 via-transparent to-[#07090e]/90" />

          {/* Ambient Cinematic Glow Orbs */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-amber-500/10 rounded-full blur-[160px]" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
          <div className="absolute top-12 right-10 w-96 h-96 bg-rose-600/10 rounded-full blur-[140px]" />
        </div>

        {/* 2. Top Floating Glass Navigation Header */}
        <header className="relative z-10 w-full max-w-4xl flex items-center justify-between py-2.5 px-4 sm:px-6 rounded-2xl bg-zinc-950/40 backdrop-blur-xl border border-white/10 shadow-xl mb-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-black font-black text-xs shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Flame className="w-4 h-4 fill-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wider flex items-center gap-1">
                CINE<span className="text-amber-400">FUEL</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">ADMIN</span>
              </span>
            </div>
          </Link>

          {/* Theme Edition Switcher Pills (like Spider-Man Edition in user screenshot!) */}
          <div className="hidden sm:flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[11px]">
            {Object.entries(BACKDROP_THEMES).map(([key, t]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedBackdropTheme(key as any)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedBackdropTheme === key
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
                title={`Switch backdrop to ${t.name}`}
              >
                {t.name.split(':')[0]}
              </button>
            ))}
          </div>

          <Link
            href="/"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-sm"
          >
            <span>← Website</span>
          </Link>
        </header>

        {/* 3. Center Glassmorphic Master Control Card */}
        <div className="relative z-10 w-full max-w-md my-auto py-4">
          <div className="relative backdrop-blur-2xl bg-[#0b0e17]/75 border border-white/10 hover:border-amber-500/40 rounded-3xl p-7 sm:p-9 shadow-[0_20px_70px_-10px_rgba(0,0,0,0.95)] space-y-6 transition-all duration-300 overflow-hidden">
            {/* Top Amber Accent Line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            {/* Glowing Lock Icon */}
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
              <div className="absolute inset-0 rounded-2xl bg-amber-400/15 blur-md -z-10 animate-pulse" />
              <Lock className="w-7 h-7" />
            </div>

            {/* Title & Thematic Subtitle */}
            <div className="text-center space-y-1.5">
              <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                {currentTheme.editionTag}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                CineFuel Master Control
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Enter Administrator Credentials to access backend catalog, links, and system controls.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                  Admin Username
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <User className="w-4 h-4 text-amber-400/80" />
                  </div>
                  <input
                    type="text"
                    placeholder="Enter admin name"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      setAuthError(false);
                    }}
                    className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-amber-400 focus:bg-black/60 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all backdrop-blur-md"
                    autoFocus
                    suppressHydrationWarning
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                  Admin Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Key className="w-4 h-4 text-amber-400/80" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter admin password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setAuthError(false);
                    }}
                    className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-amber-400 focus:bg-black/60 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-mono backdrop-blur-md"
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authError && (
                  <p className="text-xs text-rose-400 mt-2 font-medium flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Invalid credentials. Please verify username and password.</span>
                  </p>
                )}
              </div>

              {/* Unlock Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_auto] hover:bg-right transition-all duration-500 text-black font-black text-sm shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                suppressHydrationWarning
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock Admin Panel</span>
              </button>
            </form>

            {/* Thematic Quote & Security Details */}
            <div className="pt-2 text-center space-y-1.5 border-t border-white/5">
              <p className="text-[11px] text-amber-400/90 italic font-medium">
                {currentTheme.quote}
              </p>
              <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-mono">
                <span>Protected Admin Gate</span>
                <span>•</span>
                <span>256-Bit SSL Encrypted</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Bottom Footer */}
        <footer className="relative z-10 text-center py-2 text-[11px] text-zinc-500 font-mono">
          CineFuel Platform • Confidential Administrator Environment
        </footer>
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
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all relative ${
            activeTab === 'requests'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <Inbox className="w-4 h-4" /> User Requests
          {pendingRequestsCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'requests'
                  ? 'bg-black text-amber-400'
                  : 'bg-amber-500 text-black animate-pulse'
              }`}
            >
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all relative ${
            activeTab === 'reports'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
          suppressHydrationWarning
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" /> Defective Links
          {pendingReportsCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'reports'
                  ? 'bg-black text-rose-300'
                  : 'bg-rose-500 text-white animate-pulse'
              }`}
            >
              {pendingReportsCount}
            </span>
          )}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
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

            <div
              onClick={() => setActiveTab('requests')}
              className="p-5 rounded-2xl bg-[#11141c] border border-blue-500/20 hover:border-blue-500/50 cursor-pointer transition-all space-y-1 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">User Requests</span>
                <span className="text-[10px] text-blue-400 group-hover:underline">View →</span>
              </div>
              <p className="text-3xl font-black text-blue-400">{pendingRequestsCount}</p>
              <span className="text-[11px] text-zinc-400 font-medium">{requestsList.length} total submitted</span>
            </div>

            <div
              onClick={() => setActiveTab('reports')}
              className="p-5 rounded-2xl bg-[#11141c] border border-rose-500/20 hover:border-rose-500/50 cursor-pointer transition-all space-y-1 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Defective Links</span>
                <span className="text-[10px] text-rose-400 group-hover:underline">Fix Now →</span>
              </div>
              <p className="text-3xl font-black text-rose-400">{pendingReportsCount}</p>
              <span className="text-[11px] text-zinc-400 font-medium">{reportsList.length} reported links</span>
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

              {/* Filter Pills for Movie vs TV */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1 text-[11px]">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Filter:</span>
                {(['all', 'movie', 'tv'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTargetMediaTypeFilter(filter)}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      targetMediaTypeFilter === filter
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/60'
                    }`}
                  >
                    {filter === 'all' ? 'All (Movies & TV)' : filter === 'movie' ? '🎬 Movies Only' : '📺 TV Series Only'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setManualTitleName(targetSearchQuery.trim());
                    setManualMediaType(targetMediaTypeFilter === 'tv' ? 'tv' : 'movie');
                    setManualYear(String(new Date().getFullYear()));
                    setIsManualTitleModalOpen(true);
                  }}
                  className="sm:ml-auto text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 underline pt-1 sm:pt-0"
                  title="Create a custom movie or TV series not in TMDB"
                >
                  <Plus className="w-3 h-3" /> Custom Title (Not on TMDB)
                </button>
              </div>

              <div className="relative" ref={searchDropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type title name (e.g. War, Loki, Inception) or enter TMDB ID (e.g. 585268)..."
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
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#11141d] border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                    {targetSearchResults.length > 0 ? (
                      <div>
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
                        <div className="p-2.5 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-[11px] px-3">
                          <span className="text-zinc-400">Can&apos;t find what you need on TMDB?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setManualTitleName(targetSearchQuery.trim());
                              setManualMediaType(targetMediaTypeFilter === 'tv' ? 'tv' : 'movie');
                              setManualYear(String(new Date().getFullYear()));
                              setIsManualTitleModalOpen(true);
                            }}
                            className="text-amber-400 hover:text-amber-300 font-bold hover:underline"
                          >
                            + Create Custom Title
                          </button>
                        </div>
                      </div>
                    ) : targetSearchQuery.trim() ? (
                      <div className="p-5 text-center space-y-3">
                        <p className="text-xs text-zinc-400">
                          {isSearchingTarget ? 'Searching TMDB catalog...' : `No TMDB matches found for "${targetSearchQuery}".`}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setManualTitleName(targetSearchQuery.trim());
                            setManualMediaType(targetMediaTypeFilter === 'tv' ? 'tv' : 'movie');
                            setManualYear(String(new Date().getFullYear()));
                            setIsManualTitleModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs hover:scale-105 transition-all shadow-md"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Create &quot;{targetSearchQuery.trim()}&quot; as Custom Title</span>
                        </button>
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
                {/* Bulk Target Format Mode Selector (Movie vs TV) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-300">Bulk Target Format:</span>
                    <div className="inline-flex rounded-xl p-1 bg-zinc-900 border border-zinc-700/80 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminBulkMediaType('movie');
                          if (adminBulkRawText.trim()) {
                            const parsed = parseBulkLinksInput(adminBulkRawText, 1, 'movie', adminBulkMovieCategory);
                            setAdminBulkParsedItems(parsed);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          adminBulkMediaType === 'movie'
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5" /> Movie Releases Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminBulkMediaType('tv');
                          if (adminBulkRawText.trim()) {
                            const parsed = parseBulkLinksInput(adminBulkRawText, 1, 'tv', 'SingleEpisode');
                            setAdminBulkParsedItems(parsed);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          adminBulkMediaType === 'tv'
                            ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Tv className="w-3.5 h-3.5" /> TV Episodes & Packs
                      </button>
                    </div>
                  </div>

                  {adminBulkMediaType === 'movie' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-zinc-400">Default Category:</span>
                      <select
                        value={adminBulkMovieCategory}
                        onChange={(e) => {
                          const cat = e.target.value as CustomLink['category'];
                          setAdminBulkMovieCategory(cat);
                          handleSetAllBulkCategory(cat);
                        }}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value="Streaming">🎬 Streaming & OTT</option>
                        <option value="Download">📥 Direct Download</option>
                        <option value="Subtitles">🌐 Subtitles</option>
                        <option value="Recent">⚡ Recent Release</option>
                        <option value="Official">🏛️ Official Website</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block flex items-center justify-between">
                    <span>
                      {adminBulkMediaType === 'movie'
                        ? `2. Paste Multiple Movie Links / Releases for "${selectedTargetTitle?.title}":`
                        : `2. Paste Multiple Episode & Zip Pack Links for "${selectedTargetTitle?.title}":`}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {adminBulkMediaType === 'movie'
                        ? 'Auto-detects 4K UHD, 1080p, 720p, HDR, Dubs, and Sizes'
                        : 'Auto-detects S01/S02, Zip Packs vs Single EPs, Qualities, and Dubs'}
                    </span>
                  </label>
                  <textarea
                    rows={6}
                    placeholder={
                      adminBulkMediaType === 'movie'
                        ? `Paste multiple movie release lines or download URLs at once! Examples:\n${selectedTargetTitle?.title} 2160p UHD BluRay HEVC TrueHD Atmos 7.1 [Hindi DDP 5.1 + English] [24.5 GB] - https://hubcloud.cx/drive/movie4k\n${selectedTargetTitle?.title} 1080p FHD BluRay x264 [Hindi + English 5.1] [10.2 GB] - https://gdflix.dev/file/movie1080\n${selectedTargetTitle?.title} 720p HD WEB-DL [Hindi Dubbed] [2.1 GB] - https://mnmcloud.fun/files/movie720`
                        : `Paste multiple release lines or download URLs at once! Examples:\n${selectedTargetTitle?.title} S01E01 2160p WEB-DL Hindi DDP 5.1 [6.36 GB] - https://hubcloud.foo/video/1...\n${selectedTargetTitle?.title} S01E02 2160p WEB-DL Hindi DDP 5.1 [6.28 GB] - https://hubcloud.foo/video/2...\n${selectedTargetTitle?.title} S01 Complete 2160p UHD BluRay DV HDR [Hindi DDP 5.1 + English Atmos].zip https://mega.nz/file/3...`
                    }
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
                          {adminBulkParsedItems.length} {adminBulkMediaType === 'movie' ? 'Movie Releases' : 'Links'} Auto-Detected:
                        </span>
                        {adminBulkMediaType === 'movie' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[10px]">
                            🎬 {adminBulkParsedItems.length} Movie Releases
                          </span>
                        ) : (
                          <>
                            <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 font-bold text-[10px]">
                              📥 {adminBulkParsedItems.filter((i) => i.linkType === 'single_episode').length} Episodes
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[10px]">
                              🗜️ {adminBulkParsedItems.filter((i) => i.linkType === 'zip_pack').length} Zip Packs
                            </span>
                          </>
                        )}
                      </div>

                      {/* Quick Bulk Convert Controls */}
                      <div className="flex items-center gap-2">
                        {adminBulkMediaType === 'movie' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSetAllBulkCategory('Streaming')}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold transition-colors"
                              title="Set all movie items to Streaming"
                            >
                              🎬 Set All Streaming
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetAllBulkCategory('Download')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-bold transition-colors"
                              title="Set all movie items to Download"
                            >
                              📥 Set All Download
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetAllBulkCategory('Subtitles')}
                              className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[10px] font-bold transition-colors"
                              title="Set all movie items to Subtitles"
                            >
                              🌐 Set All Subtitles
                            </button>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}

                        <button
                          type="button"
                          onClick={handleAdminImportBulk}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-lg hover:scale-105 flex items-center gap-1.5 ml-2"
                        >
                          <ListPlus className="w-4 h-4" />
                          <span>🚀 Import All ({adminBulkParsedItems.length}) {adminBulkMediaType === 'movie' ? 'Movie' : ''} Links to {selectedTargetTitle?.title}</span>
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
                              {adminBulkMediaType === 'movie' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextCat: CustomLink['category'] =
                                      item.category === 'Streaming' ? 'Download' : item.category === 'Download' ? 'Subtitles' : 'Streaming';
                                    setAdminBulkParsedItems((prev) =>
                                      prev.map((i) => (i.id === item.id ? { ...i, category: nextCat } : i))
                                    );
                                  }}
                                  className="px-2 py-0.5 rounded font-black text-[9px] font-mono transition-all hover:scale-105 bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  title="Click to toggle category (Streaming / Download / Subtitles)"
                                >
                                  {item.category === 'Download' ? '📥 DOWNLOAD' : item.category === 'Subtitles' ? '🌐 SUBTITLES' : '🎬 STREAMING'}
                                </button>
                              ) : (
                                <>
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
                                </>
                              )}
                            </div>
                            <p className="font-bold text-white truncate text-[11px]">{item.title}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                              <span className="font-semibold text-amber-400/90">{item.quality}</span>
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

            {/* Bulk Action Controls */}
            {selectedLinkIds.size > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 animate-fadeIn shadow-lg">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>
                    {selectedLinkIds.size} of {filteredLinks.length} link{selectedLinkIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedLinkIds(new Set())}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-colors"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs transition-all shadow-md shadow-rose-600/30 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedLinkIds.size})</span>
                  </button>
                </div>
              </div>
            )}

            {filteredLinks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredLinks.length > 0 && filteredLinks.every((item) => selectedLinkIds.has(item.link.id))}
                          onChange={handleSelectAllFiltered}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                          title="Select / Deselect all visible links"
                        />
                      </th>
                      <th className="py-3 px-3">Target Title</th>
                      <th className="py-3 px-3">Link Name / Release</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">URL</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredLinks.map((item) => {
                      const isSelected = selectedLinkIds.has(item.link.id);
                      return (
                        <tr
                          key={item.link.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-amber-500/15 hover:bg-amber-500/20'
                              : 'hover:bg-zinc-900/40'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectLink(item.link.id)}
                              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                            />
                          </td>
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
                      );
                    })}
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
      {/* TAB: USER REQUESTS & FULFILLMENT */}
      {/* ========================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Inbox className="w-4 h-4 text-amber-400" /> User Link Requests & Fulfillment Vault
              </h3>
              <p className="text-xs text-zinc-400">
                Review titles requested by visitors, add custom qualities/languages, and fulfill downloads in 1-click.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAdminRequests}
                disabled={isLoadingRequests}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRequests ? 'animate-spin' : ''}`} />
                <span>Refresh Requests</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setRequestsFilter('all')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                requestsFilter === 'all'
                  ? 'bg-blue-600/10 border-blue-500 text-white shadow-md'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Total Requests</span>
              <p className="text-2xl font-black text-white">{requestsList.length}</p>
            </button>

            <button
              onClick={() => setRequestsFilter('pending')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                requestsFilter === 'pending'
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pending</span>
                {pendingRequestsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              <p className="text-2xl font-black text-amber-400">{pendingRequestsCount}</p>
            </button>

            <button
              onClick={() => setRequestsFilter('fulfilled')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                requestsFilter === 'fulfilled'
                  ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">Fulfilled</span>
              <p className="text-2xl font-black text-emerald-400">
                {requestsList.filter((r) => r.status === 'fulfilled').length}
              </p>
            </button>

            <button
              onClick={() => setRequestsFilter('rejected')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                requestsFilter === 'rejected'
                  ? 'bg-rose-500/15 border-rose-500 text-white shadow-md shadow-rose-500/10'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">Rejected</span>
              <p className="text-2xl font-black text-rose-400">
                {requestsList.filter((r) => r.status === 'rejected').length}
              </p>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#0f121a] border border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by title, quality, audio, contact, or notes..."
                value={requestsSearchQuery}
                onChange={(e) => setRequestsSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              {requestsSearchQuery && (
                <button
                  onClick={() => setRequestsSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {(['all', 'pending', 'fulfilled', 'rejected'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setRequestsFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
                    requestsFilter === filterKey
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Cards List */}
          {(() => {
            const filteredRequests = requestsList.filter((r) => {
              if (requestsFilter !== 'all' && r.status !== requestsFilter) return false;
              if (!requestsSearchQuery.trim()) return true;
              const q = requestsSearchQuery.toLowerCase();
              return (
                r.title.toLowerCase().includes(q) ||
                (r.userContact && r.userContact.toLowerCase().includes(q)) ||
                (r.notes && r.notes.toLowerCase().includes(q)) ||
                (r.quality && r.quality.toLowerCase().includes(q)) ||
                (r.audioLanguage && r.audioLanguage.toLowerCase().includes(q))
              );
            });

            if (filteredRequests.length === 0) {
              return (
                <div className="p-12 rounded-3xl bg-[#0f121a] border border-zinc-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-300">No requests found</h4>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    {requestsSearchQuery
                      ? 'No user requests match your current search query.'
                      : requestsFilter === 'pending'
                      ? 'All caught up! No pending requests to fulfill.'
                      : 'No requests submitted under this filter.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredRequests.map((req) => {
                  const posterUrl = req.posterPath ? getImageURL(req.posterPath, 'w200') : null;
                  const dateStr = new Date(req.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={req.id}
                      className="p-5 rounded-3xl bg-[#0f121a] border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg group"
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {posterUrl ? (
                          <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-zinc-700 bg-zinc-900 shadow-md">
                            <Image
                              src={posterUrl}
                              alt={req.title}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-20 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-600">
                            {req.mediaType === 'tv' ? <Tv className="w-6 h-6" /> : <Film className="w-6 h-6" />}
                          </div>
                        )}

                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Title & Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-white truncate">
                              {req.title}
                            </h4>
                            {req.releaseYear && (
                              <span className="text-xs text-zinc-400 font-mono">({req.releaseYear})</span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                              {req.mediaType === 'tv' ? <Tv className="w-2.5 h-2.5 text-sky-400" /> : <Film className="w-2.5 h-2.5 text-amber-400" />}
                              {req.mediaType === 'tv' ? 'TV' : 'Movie'}
                            </span>

                            {/* Status Badge */}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                req.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : req.status === 'fulfilled'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>

                          {/* Requested Quality & Audio Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-300 font-semibold text-[11px] flex items-center gap-1">
                              <Zap className="w-3 h-3 text-blue-400" />
                              <span>{req.quality || 'Any Quality'}</span>
                            </span>

                            <span className="px-2.5 py-0.5 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-300 font-semibold text-[11px] flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-purple-400" />
                              <span>{req.audioLanguage || 'Any Audio'}</span>
                            </span>

                            {req.mediaType === 'tv' && (req.seasonNumber || req.episodeNumber) && (
                              <span className="px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-mono">
                                {req.seasonNumber ? `S${req.seasonNumber}` : ''}
                                {req.episodeNumber ? `E${req.episodeNumber}` : ' (Pack)'}
                              </span>
                            )}
                          </div>

                          {/* User notes & contact */}
                          {(req.notes || req.userContact) && (
                            <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                              {req.notes && (
                                <p className="italic text-zinc-300 bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-800 text-[11px]">
                                  &ldquo;{req.notes}&rdquo;
                                </p>
                              )}
                              {req.userContact && (
                                <span className="text-[11px] text-blue-400 font-mono flex items-center gap-1">
                                  <span>User: {req.userContact}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Fulfilled Link URL preview */}
                          {req.status === 'fulfilled' && req.fulfilledLinkUrl && (
                            <div className="pt-1 flex items-center gap-2 text-xs text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-semibold text-[11px]">Fulfilled Link:</span>
                              <a
                                href={req.fulfilledLinkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate max-w-xs font-mono text-[11px] underline hover:text-emerald-300"
                              >
                                {req.fulfilledLinkUrl}
                              </a>
                            </div>
                          )}

                          <div className="text-[10px] text-zinc-500 pt-0.5">
                            <span>Requested on {dateStr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                        {/* 1-Click Fulfill Action Button */}
                        <button
                          onClick={() => handleOpenFulfill(req)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                          title="Open fulfillment dialog to attach link and fulfill request"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{req.status === 'fulfilled' ? 'Add Another Link' : 'Fulfill & Add Link'}</span>
                        </button>

                        {/* Status Toggle Quick Buttons */}
                        {req.status === 'pending' ? (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'rejected')}
                            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-rose-500/50 text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors"
                            title="Reject this request"
                          >
                            Reject
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'pending')}
                            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors"
                            title="Reopen as pending"
                          >
                            Reopen
                          </button>
                        )}

                        {/* View Title on Live Site */}
                        {req.tmdbId && (
                          <Link
                            href={`/${req.mediaType}/${req.tmdbId}`}
                            target="_blank"
                            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="View Title on Site"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}

                        {/* Delete Request */}
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB: DEFECTIVE LINKS CONTROL CENTER */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-3xl bg-[#0f121a] border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/10">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Defective Links Control Center
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold uppercase">
                    Live Moderation
                  </span>
                </div>
                <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                  Review and manage links reported by users for 404 dead links, paywall loops, corrupted files, or audio desyncs. Test, replace with working mirrors, or purge broken downloads in 1 click.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <button
                onClick={fetchAdminReports}
                disabled={isLoadingReports}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="Refresh defective reports list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin text-rose-400' : ''}`} />
                <span>{isLoadingReports ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <button
              onClick={() => setReportsFilter('all')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                reportsFilter === 'all'
                  ? 'bg-rose-500/15 border-rose-500 text-white shadow-md shadow-rose-500/10'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Total Reports</span>
              <p className="text-2xl font-black text-white">{reportsList.length}</p>
            </button>

            <button
              onClick={() => setReportsFilter('pending')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                reportsFilter === 'pending'
                  ? 'bg-rose-500/15 border-rose-500 text-white shadow-md shadow-rose-500/10'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Needs Fix</span>
                {pendingReportsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                )}
              </div>
              <p className="text-2xl font-black text-rose-400">{pendingReportsCount}</p>
            </button>

            <button
              onClick={() => setReportsFilter('fixed')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                reportsFilter === 'fixed'
                  ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">Fixed / Replaced</span>
              <p className="text-2xl font-black text-emerald-400">
                {reportsList.filter((r) => r.status === 'fixed').length}
              </p>
            </button>

            <button
              onClick={() => setReportsFilter('dismissed')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                reportsFilter === 'dismissed'
                  ? 'bg-zinc-700/40 border-zinc-500 text-white shadow-md'
                  : 'bg-[#11141c] border-white/5 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Dismissed (Valid)</span>
              <p className="text-2xl font-black text-zinc-300">
                {reportsList.filter((r) => r.status === 'dismissed').length}
              </p>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-[#0f121a] border border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by title, URL, release name, server, or notes..."
                value={reportsSearchQuery}
                onChange={(e) => setReportsSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
              />
              {reportsSearchQuery && (
                <button
                  onClick={() => setReportsSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {(['all', 'pending', 'fixed', 'dismissed'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setReportsFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
                    reportsFilter === filterKey
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>

            {/* Issue Filter Selector */}
            <select
              value={reportsIssueFilter}
              onChange={(e) => setReportsIssueFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Issue Types</option>
              <option value="dead_link">Dead Link / 404</option>
              <option value="paywall_loop">Bypass / Paywall Loop</option>
              <option value="audio_desync">Audio Desync / Missing</option>
              <option value="video_glitch">Video Glitch / Corrupted</option>
              <option value="wrong_episode">Wrong Episode / Title</option>
              <option value="slow_timeout">Slow Server / Timeout</option>
              <option value="other">Other Issue</option>
            </select>
          </div>

          {/* Reports List Cards */}
          {(() => {
            const filteredReports = reportsList.filter((r) => {
              if (reportsFilter !== 'all' && r.status !== reportsFilter) return false;
              if (reportsIssueFilter !== 'all' && r.issueType !== reportsIssueFilter) return false;
              if (!reportsSearchQuery.trim()) return true;
              const q = reportsSearchQuery.toLowerCase();
              return (
                r.mediaTitle.toLowerCase().includes(q) ||
                r.linkTitle.toLowerCase().includes(q) ||
                r.reportedUrl.toLowerCase().includes(q) ||
                (r.server && r.server.toLowerCase().includes(q)) ||
                (r.additionalNotes && r.additionalNotes.toLowerCase().includes(q)) ||
                (r.userEmail && r.userEmail.toLowerCase().includes(q))
              );
            });

            if (filteredReports.length === 0) {
              return (
                <div className="p-12 rounded-3xl bg-[#0f121a] border border-zinc-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">No Defective Link Reports</h4>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    {reportsFilter === 'all'
                      ? 'All custom downloads and streams are functioning normally! When a user reports a broken link, it will appear here.'
                      : `No reports currently matching the filter "${reportsFilter}".`}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredReports.map((report) => {
                  const issueBadgeStyle = (() => {
                    switch (report.issueType) {
                      case 'dead_link':
                        return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
                      case 'paywall_loop':
                        return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
                      case 'audio_desync':
                        return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
                      case 'video_glitch':
                        return 'bg-pink-500/15 text-pink-300 border-pink-500/40';
                      case 'wrong_episode':
                        return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
                      case 'slow_timeout':
                        return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40';
                      default:
                        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
                    }
                  })();

                  const serverInfo = detectServer(report.reportedUrl);

                  return (
                    <div
                      key={report.id}
                      className="p-5 rounded-3xl bg-[#0f121a] border border-zinc-800/80 hover:border-zinc-700 flex flex-col md:flex-row items-start justify-between gap-5 transition-all shadow-md group"
                    >
                      {/* Left: Poster + Details */}
                      <div className="flex items-start gap-4 overflow-hidden w-full md:w-auto">
                        {/* Title Poster Thumbnail */}
                        <div className="w-14 h-20 rounded-xl bg-zinc-900 border border-zinc-800 relative overflow-hidden shrink-0 shadow-md">
                          {report.posterPath ? (
                            <Image
                              src={getImageURL(report.posterPath, 'w200')}
                              alt={report.mediaTitle}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black text-xs">
                              {report.mediaType === 'tv' ? 'TV' : 'MOVIE'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 overflow-hidden flex-1">
                          {/* Title & Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-white hover:text-rose-400 transition-colors">
                              {report.movieId ? (
                                <Link
                                  href={`/${report.mediaType || 'movie'}/${report.movieId}`}
                                  target="_blank"
                                  className="flex items-center gap-1.5"
                                >
                                  <span>{report.mediaTitle}</span>
                                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                                </Link>
                              ) : (
                                report.mediaTitle
                              )}
                            </h4>

                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase">
                              {report.mediaType === 'tv' ? 'TV Series' : 'Movie'}
                            </span>

                            {/* Issue Pill */}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${issueBadgeStyle}`}>
                              <AlertTriangle className="w-3 h-3" />
                              <span>{report.issueLabel}</span>
                            </span>

                            {/* Status Pill */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                report.status === 'fixed'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : report.status === 'dismissed'
                                  ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                              }`}
                            >
                              {report.status === 'fixed' ? '✓ Fixed' : report.status === 'dismissed' ? 'Dismissed' : 'Pending Fix'}
                            </span>
                          </div>

                          {/* Link Title / Release Name */}
                          <div className="text-xs font-bold text-zinc-300 font-mono break-all">
                            {report.linkTitle}
                          </div>

                          {/* Server & Quality Tags */}
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className={`px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${serverInfo.badgeClass}`}>
                              {report.server || serverInfo.name}
                            </span>
                            {report.quality && (
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                                {report.quality}
                              </span>
                            )}
                            <span className="text-zinc-500 font-mono">
                              Reported {formatRelativeTime(report.createdAt)}
                            </span>
                            {report.userEmail && (
                              <span className="text-zinc-400 font-mono">
                                • By: {report.userEmail}
                              </span>
                            )}
                          </div>

                          {/* Reported Broken URL Box */}
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-zinc-400 max-w-xl">
                            <span className="text-rose-400 font-bold shrink-0">Dead URL:</span>
                            <span className="truncate flex-1 text-zinc-300" title={report.reportedUrl}>
                              {report.reportedUrl}
                            </span>
                            <a
                              href={report.reportedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1 text-[10px] shrink-0 transition-colors"
                              title="Test link in new tab to see if it 404s"
                            >
                              <span>Test Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {/* User Additional Notes */}
                          {report.additionalNotes && (
                            <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 italic">
                              &ldquo;{report.additionalNotes}&rdquo;
                            </div>
                          )}

                          {/* Resolved State Display */}
                          {report.status === 'fixed' && report.replacementUrl && (
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-semibold">Replaced with:</span>
                              <a
                                href={report.replacementUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate underline font-mono text-[11px]"
                              >
                                {report.replacementUrl}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Admin Action Controls */}
                      <div className="flex flex-wrap md:flex-col items-center md:items-end gap-2 shrink-0 self-end md:self-center w-full md:w-auto">
                        {/* 1. Replace & Fix Link Action */}
                        <button
                          onClick={() => handleOpenFixModal(report)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 hover:from-rose-400 hover:to-amber-400 text-black font-black text-xs shadow-md shadow-rose-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          title="Open dialog to enter working replacement link"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>{report.status === 'fixed' ? 'Update Replacement' : 'Replace & Fix Link'}</span>
                        </button>

                        {/* 2. Direct Delete Broken Link Button */}
                        <button
                          onClick={() => handleDeleteBrokenLinkDirectly(report)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all hover:scale-105 cursor-pointer"
                          title="Permanently remove broken link from CineFuel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Broken Link</span>
                        </button>

                        {/* 3. Dismiss / Reopen Actions */}
                        <div className="flex items-center gap-1.5">
                          {report.status === 'pending' ? (
                            <button
                              onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-semibold transition-colors"
                              title="Mark as false alarm or link is functioning fine"
                            >
                              Dismiss (Valid)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateReportStatus(report.id, 'pending')}
                              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500 text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
                              title="Reopen report as pending"
                            >
                              Reopen
                            </button>
                          )}

                          {/* Delete Report Record */}
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete this report record"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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

      {/* Admin Fulfill Link Request Modal */}
      {fulfillingRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141d] border border-blue-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Fulfill Request: {fulfillingRequest.title}
                </h4>
              </div>
              <button
                onClick={() => setFulfillingRequest(null)}
                className="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Request Summary Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Requested Quality:</span>
                <span className="text-blue-400 font-bold">{fulfillingRequest.quality || 'Any Quality'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Requested Audio:</span>
                <span className="text-purple-400 font-bold">{fulfillingRequest.audioLanguage || 'Any Audio'}</span>
              </div>
              {fulfillingRequest.notes && (
                <div className="pt-1 border-t border-zinc-800/60 text-zinc-300 italic">
                  &ldquo;{fulfillingRequest.notes}&rdquo;
                </div>
              )}
            </div>

            {fulfillSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold">
                {fulfillSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleFulfillSubmit} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Link Title / Release Label *
                  </label>
                  <input
                    type="text"
                    value={fulfillTitle}
                    onChange={(e) => setFulfillTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Download / Streaming Destination URL *
                  </label>
                  <input
                    type="text"
                    placeholder="https://hubcloud.club/... or GDFlix / Google Drive URL"
                    value={fulfillUrl}
                    onChange={(e) => setFulfillUrl(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-blue-500"
                    required
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Quality</label>
                    <input
                      type="text"
                      placeholder="e.g. 1080p, 4K"
                      value={fulfillQuality}
                      onChange={(e) => setFulfillQuality(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Audio</label>
                    <input
                      type="text"
                      placeholder="e.g. Hindi + Eng"
                      value={fulfillAudio}
                      onChange={(e) => setFulfillAudio(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Size</label>
                    <input
                      type="text"
                      placeholder="e.g. 2.4 GB"
                      value={fulfillSize}
                      onChange={(e) => setFulfillSize(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setFulfillingRequest(null)}
                    disabled={isFulfillingSubmit}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFulfillingSubmit}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isFulfillingSubmit ? 'Publishing Link...' : 'Publish Link & Fulfill'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2. Admin Replace Defective Link Modal with Title Mismatch & Editable URL Controls */}
      {fixingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div
            className="relative w-full max-w-lg bg-[#0d111a] border border-rose-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setFixingReport(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3.5 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-black flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20 font-black">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 uppercase">
                    {fixingReport.issueLabel}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${replaceTargetMediaType === 'tv' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {replaceTargetMediaType === 'tv' ? 'TV SERIES' : 'MOVIE'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white leading-tight">
                  Replace Defective Link
                </h3>
                <p className="text-xs text-zinc-400">
                  Target: <strong className="text-white">{replaceTargetTitle || fixingReport.mediaTitle}</strong> (ID: {replaceTargetMovieId || fixingReport.movieId})
                </p>
              </div>
            </div>

            {fixSuccessMsg ? (
              <div className="p-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">{fixSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFixReplacement} className="space-y-3.5 text-left">
                {/* Title Mismatch / Reassign Media Box (Addresses "this is a movie not a tv series") */}
                <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <span>Title Mismatch?</span>
                      <span className="text-[11px] text-amber-400 font-normal">
                        ({replaceTargetMediaType === 'tv' ? 'Reported as TV Series' : 'Reported as Movie'})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsChangingTarget(!isChangingTarget)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      {isChangingTarget ? '✕ Close Reassign' : '⇄ Fix Mismatch / Reassign'}
                    </button>
                  </div>

                  {isChangingTarget && (
                    <div className="pt-2 border-t border-zinc-800 space-y-2.5 animate-fadeIn">
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        If this title was mistakenly reported or uploaded as a TV series instead of a Movie (or vice versa), switch type and reassign below:
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-400 font-semibold">Change Media Type:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setReplaceTargetMediaType('movie');
                            // Clean release title: strip Season/Episode if converting to movie
                            setReplaceTitle((prev) =>
                              prev
                                .replace(/Season\s*\d+\s*Episode\s*\d+/gi, '')
                                .replace(/S\d+E\d+/gi, '')
                                .trim()
                            );
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                            replaceTargetMediaType === 'movie'
                              ? 'bg-amber-500 text-black shadow-md'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          🎬 Movie
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplaceTargetMediaType('tv')}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                            replaceTargetMediaType === 'tv'
                              ? 'bg-sky-500 text-black shadow-md'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          📺 TV Series
                        </button>
                      </div>

                      {/* Live TMDB Reassign Search */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-400 block">
                          Search Correct Title or enter TMDB ID:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g. War (2019) or enter TMDB ID 585268..."
                            value={reassignSearchQuery}
                            onChange={(e) => setReassignSearchQuery(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                          />
                          {isSearchingReassign && (
                            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                          )}
                        </div>

                        {/* Search results dropdown for reassign */}
                        {reassignSearchResults.length > 0 && (
                          <div className="max-h-36 overflow-y-auto divide-y divide-zinc-800 bg-black/80 rounded-xl border border-zinc-700 mt-1">
                            {reassignSearchResults.map((t) => {
                              const title = t.title || t.name || 'Untitled';
                              const year = (t.release_date || t.first_air_date || '').split('-')[0];
                              const type = (t.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';

                              return (
                                <button
                                  key={`${type}-${t.id}`}
                                  type="button"
                                  onClick={() => {
                                    setReplaceTargetTitle(title);
                                    setReplaceTargetMovieId(t.id);
                                    setReplaceTargetMediaType(type);
                                    if (type === 'movie') {
                                      setReplaceTitle((prev) =>
                                        prev
                                          .replace(/Season\s*\d+\s*Episode\s*\d+/gi, '')
                                          .replace(/S\d+E\d+/gi, '')
                                          .trim()
                                      );
                                    }
                                    setReassignSearchQuery('');
                                    setReassignSearchResults([]);
                                    setIsChangingTarget(false);
                                  }}
                                  className="w-full text-left p-2 hover:bg-zinc-800 flex items-center justify-between text-xs transition-colors"
                                >
                                  <div className="truncate">
                                    <span className="font-bold text-white">{title}</span>
                                    {year && <span className="text-zinc-400 ml-1.5 font-mono">({year})</span>}
                                  </div>
                                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-bold shrink-0 ml-2 ${
                                    type === 'tv' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'
                                  }`}>
                                    {type} • ID: {t.id}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Current Defective URL Info with 1-Click "Edit / Copy" and "Test Link" */}
                <div className="p-3.5 rounded-2xl bg-black/60 border border-zinc-800 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Current Defective URL:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReplaceUrl(fixingReport.reportedUrl)}
                        className="text-[11px] px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Load this defective URL into the input field below to fix typos or modify it directly"
                      >
                        <Edit className="w-3 h-3" /> Edit / Copy to Input
                      </button>
                      <a
                        href={fixingReport.reportedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] px-2.5 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors flex items-center gap-1"
                        title="Test whether this link opens or 404s"
                      >
                        <ExternalLink className="w-3 h-3" /> Test Link ↗
                      </a>
                    </div>
                  </div>
                  <div
                    className="font-mono text-zinc-300 text-[11px] break-all bg-black/40 p-2 rounded-xl border border-white/5 select-all"
                    title={fixingReport.reportedUrl}
                  >
                    {fixingReport.reportedUrl}
                  </div>
                </div>

                {/* Working Link URL Input (Pre-filled so admin can edit directly or replace) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                    <span>Working Link / Replacement URL *</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Direct / Mirror CDN</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://hubcloud.club/drive/... or https://gdflix..."
                    value={replaceUrl}
                    onChange={(e) => setReplaceUrl(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-rose-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none transition-all"
                    autoFocus
                  />
                  <p className="text-[10px] text-zinc-500">
                    💡 You can edit the URL directly above to fix typos, or replace it with a fresh working mirror.
                  </p>
                </div>

                {/* Link Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">Link Title / Release Tag</label>
                  <input
                    type="text"
                    value={replaceTitle}
                    onChange={(e) => setReplaceTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-rose-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                {/* Quality, Audio, Size */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Quality</label>
                    <input
                      type="text"
                      placeholder="e.g. 1080p, 4K"
                      value={replaceQuality}
                      onChange={(e) => setReplaceQuality(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Audio</label>
                    <input
                      type="text"
                      placeholder="e.g. Hindi + Eng"
                      value={replaceAudio}
                      onChange={(e) => setReplaceAudio(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Size</label>
                    <input
                      type="text"
                      placeholder="e.g. 2.4 GB"
                      value={replaceSize}
                      onChange={(e) => setReplaceSize(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Admin Note */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">Resolution Note</label>
                  <input
                    type="text"
                    value={replaceAdminNote}
                    onChange={(e) => setReplaceAdminNote(e.target.value)}
                    placeholder="e.g. Fixed with clean 1080p GDFlix mirror."
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-rose-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Database update toggle */}
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateDbWithReplacement}
                    onChange={(e) => setUpdateDbWithReplacement(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 accent-rose-500"
                  />
                  <span>
                    Auto-update in live database so visitors get the new working link immediately.
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setFixingReport(null)}
                    disabled={isFixingSubmit}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFixingSubmit}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 hover:from-rose-400 hover:to-amber-400 text-black font-black text-xs shadow-lg shadow-rose-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{isFixingSubmit ? 'Applying Replacement...' : 'Save & Mark as Fixed'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. Manual Custom Title Creation Modal (For titles not found on TMDB) */}
      {isManualTitleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div
            className="relative w-full max-w-md bg-[#0d111a] border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Create Custom Title
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsManualTitleModalOpen(false)}
                className="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              If TMDB catalog does not have your title, create a custom entry here to manage and attach links directly:
            </p>

            <form onSubmit={handleCreateManualTitle} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Title Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. War (2019) or Mirzapur Season 3"
                  value={manualTitleName}
                  onChange={(e) => setManualTitleName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Media Type *</label>
                  <select
                    value={manualMediaType}
                    onChange={(e) => setManualMediaType(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="movie">🎬 Movie</option>
                    <option value="tv">📺 TV Series</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Release Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2024"
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Poster Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://... (image url or leave blank)"
                  value={manualPoster}
                  onChange={(e) => setManualPoster(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsManualTitleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs hover:scale-105 transition-all shadow-md cursor-pointer"
                >
                  Save & Select Title ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
