'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Copy,
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
  ChevronLeft,
  ChevronRight,
  Menu,
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
import { CustomLink, CustomList, TitleDetails, UserRequest, DefectiveLinkReport, RegisteredUser } from '@/types';
import { MOCK_TITLES, TRENDING_LIST } from '@/lib/mockData';
import { getImageURL, getBackdropURL, searchMulti, getTitleDetails } from '@/lib/tmdb';
import { BUILTIN_CURATED_LINKS, saveGlobalCustomLink, saveMultipleGlobalCustomLinks, deleteGlobalCustomLink, deleteMultipleGlobalCustomLinks, getDeletedLinkIds, syncServerLinks } from '@/lib/curatedLinks';
import { safeSetLocalStorage, safeGetLocalStorage, safeRemoveLocalStorage } from '@/lib/safeStorage';
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
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return 'Active Session';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Active Session' : d.toLocaleDateString();
  } catch {
    return 'Active Session';
  }
}

function formatDateTimeSafe(isoString?: string | null): string {
  if (!isoString) return 'Recently';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // API Form States
  const [tmdbKey, setTmdbKey] = useState('');
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false);
  const [isTestingTmdb, setIsTestingTmdb] = useState(false);
  const [tmdbTestResult, setTmdbTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  // Users Directory state
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilterCategory, setUserFilterCategory] = useState<'all' | 'requesters' | 'reporters'>('all');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const handleCopyUid = (uid: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(uid);
      setCopiedUid(uid);
      setTimeout(() => setCopiedUid(null), 2000);
    }
  };

  // Links Moderation Filter, Search & Pagination
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkCategoryFilter, setLinkCategoryFilter] = useState('All');
  const [linksCurrentPage, setLinksCurrentPage] = useState<number>(1);
  const [linksPerPage, setLinksPerPage] = useState<number>(50);
  const [totalServerLinksCount, setTotalServerLinksCount] = useState<number>(0);
  const [isRefreshingLinks, setIsRefreshingLinks] = useState(false);
  const [deletedCuratedLinkIds, setDeletedCuratedLinkIds] = useState<Set<string>>(new Set());
  const attemptedTitleFetchRef = useRef<Set<number>>(new Set());

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

  // Fulfill Modal State (Single, Bulk, & Grid Modes)
  const [fulfillingRequest, setFulfillingRequest] = useState<UserRequest | null>(null);
  const [fulfillMode, setFulfillMode] = useState<'single' | 'bulk' | 'grid'>('single');
  const [fulfillUrl, setFulfillUrl] = useState('');
  const [fulfillTitle, setFulfillTitle] = useState('');
  const [fulfillQuality, setFulfillQuality] = useState('');
  const [fulfillAudio, setFulfillAudio] = useState('');
  const [fulfillSize, setFulfillSize] = useState('');
  const [fulfillCategory, setFulfillCategory] = useState<CustomLink['category']>('Download');
  const [isFulfillingSubmit, setIsFulfillingSubmit] = useState(false);
  const [fulfillSuccessMsg, setFulfillSuccessMsg] = useState('');

  // Fulfill Bulk Auto-Detector States
  const [fulfillBulkRawText, setFulfillBulkRawText] = useState('');
  const [fulfillBulkParsedItems, setFulfillBulkParsedItems] = useState<ParsedBulkItem[]>([]);
  const [fulfillBulkMediaType, setFulfillBulkMediaType] = useState<'movie' | 'tv'>('movie');
  const [fulfillBulkMovieCategory, setFulfillBulkMovieCategory] = useState<CustomLink['category']>('Download');

  // Fulfill Episode Grid States
  const [fulfillGridSeason, setFulfillGridSeason] = useState(1);
  const [fulfillGridEpisodeCount, setFulfillGridEpisodeCount] = useState(8);
  const [fulfillGridBasePattern, setFulfillGridBasePattern] = useState('');
  const [fulfillGridQuality, setFulfillGridQuality] = useState('1080p WEB-DL');
  const [fulfillGridAudio, setFulfillGridAudio] = useState('Hindi + English');
  const [fulfillGridSize, setFulfillGridSize] = useState('');
  const [fulfillGridBulkLinksText, setFulfillGridBulkLinksText] = useState('');
  const [fulfillGridEpisodes, setFulfillGridEpisodes] = useState<
    Array<{
      episodeNumber: number;
      title: string;
      url: string;
      quality: string;
      audio: string;
      size: string;
    }>
  >([]);

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

      const storedLinks = safeGetLocalStorage('cinefuel_custom_links');
      if (storedLinks) {
        try {
          if (storedLinks.length > 200000) {
            safeRemoveLocalStorage('cinefuel_custom_links');
          } else {
            const parsed = JSON.parse(storedLinks);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              setCustomLinksMap(parsed);
            }
          }
        } catch {
          // ignore
        }
      }

      // Real-time live fetch of all cloud database links with pagination
      const fetchAllAdminLinks = async (
        page = 1,
        limit = 50,
        q = '',
        category = 'All',
        showLoading = false
      ) => {
        try {
          if (showLoading) setIsRefreshingLinks(true);
          const params = new URLSearchParams();
          params.set('page', String(page));
          params.set('limit', String(limit));
          if (q && q.trim()) params.set('q', q.trim());
          if (category && category !== 'All') params.set('category', category);
          params.set('_t', String(Date.now()));

          const res = await fetch(`/api/curated-links?${params.toString()}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (typeof data.total === 'number') {
              setTotalServerLinksCount(data.total);
            }
            if (data && data.allLinks && typeof data.allLinks === 'object' && !Array.isArray(data.allLinks)) {
              const currentDeleted = getDeletedLinkIds();
              const cleanedMap: Record<string, CustomLink[]> = {};
              for (const [k, arr] of Object.entries(data.allLinks)) {
                if (Array.isArray(arr)) {
                  const filtered = (arr as CustomLink[]).filter((l) => l && l.id && !currentDeleted.has(l.id));
                  if (filtered.length > 0) {
                    cleanedMap[k] = filtered;
                  }
                }
              }
              setCustomLinksMap(cleanedMap);
            }
          }
        } catch {} finally {
          if (showLoading) setIsRefreshingLinks(false);
        }
      };

      fetchAllAdminLinks(1, 50, '', 'All', false);
      const adminSyncInterval = setInterval(() => fetchAllAdminLinks(1, 50, '', 'All', false), 30000);

      const storedLists = localStorage.getItem('cinefuel_custom_lists');
      if (storedLists) {
        try {
          const parsed = JSON.parse(storedLists);
          if (Array.isArray(parsed)) {
            setCustomLists(parsed);
          }
        } catch {
          // ignore
        }
      }

      const storedTitlesCache = localStorage.getItem('cinefuel_known_titles_cache');
      if (storedTitlesCache) {
        try {
          const parsed = JSON.parse(storedTitlesCache);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setKnownTitlesCache(parsed);
          }
        } catch {
          // ignore
        }
      }

      setDeletedCuratedLinkIds(getDeletedLinkIds());

      // Initial fetch and interval for user requests
      fetchAdminRequests();
      const requestsSyncInterval = setInterval(fetchAdminRequests, 15000);

      // Initial fetch and interval for defective link reports
      fetchAdminReports();
      const reportsSyncInterval = setInterval(fetchAdminReports, 15000);

      // Initial fetch and interval for registered users
      fetchAdminUsers();
      const usersSyncInterval = setInterval(fetchAdminUsers, 20000);

      const handleLinksUpdated = () => {
        setDeletedCuratedLinkIds(getDeletedLinkIds());
        fetchAllAdminLinks();
        fetchAdminRequests();
        fetchAdminReports();
        fetchAdminUsers();
      };
      const handleReportsUpdated = () => {
        fetchAdminReports();
        fetchAdminUsers();
      };
      window.addEventListener('cinefuel_links_updated', handleLinksUpdated);
      window.addEventListener('cinefuel_report_submitted', handleReportsUpdated);
      return () => {
        clearInterval(adminSyncInterval);
        clearInterval(requestsSyncInterval);
        clearInterval(reportsSyncInterval);
        clearInterval(usersSyncInterval);
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

  // Save cache helper (in-memory for speed, never triggers quota errors)
  const cacheTitle = (id: number, data: { title: string; poster_path?: string | null; media_type?: 'movie' | 'tv'; year?: string }) => {
    setKnownTitlesCache((prev) => ({ ...prev, [id]: data }));
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

  // Real-time bulk parsing for fulfill modal
  useEffect(() => {
    if (!fulfillBulkRawText.trim() || !fulfillingRequest) {
      setFulfillBulkParsedItems([]);
      return;
    }
    const currentType = fulfillBulkMediaType || (fulfillingRequest.mediaType === 'tv' ? 'tv' : 'movie');
    const defaultSeason = fulfillingRequest.seasonNumber || 1;
    const parsed = parseBulkLinksInput(fulfillBulkRawText, defaultSeason, currentType, fulfillBulkMovieCategory);
    setFulfillBulkParsedItems(parsed);
  }, [fulfillBulkRawText, fulfillBulkMediaType, fulfillBulkMovieCategory, fulfillingRequest]);

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

  // Registered Users Directory Action Handlers
  const fetchAdminUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await fetch(`/api/users?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'x-admin-key': adminPass || 'shyam081',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setRegisteredUsers(data.users);
        }
      }
    } catch (e) {
      console.error('Failed to fetch registered users:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (!confirm(`Are you sure you want to remove user "${email || uid}" from the system?`)) return;
    try {
      const res = await fetch(`/api/users?uid=${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminPass || 'shyam081',
        },
      });
      if (res.ok) {
        setRegisteredUsers((prev) => prev.filter((u) => u.uid !== uid && u.firebaseUid !== uid));
        addLog(`Deleted user account: ${email || uid}`, 'info');
      }
    } catch (e: any) {
      alert('Failed to delete user: ' + e.message);
    }
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

  // Helper to format episode title with pattern tokens
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
    return `${targetTitle || 'Series'} S${sStr}E${epStr} ${quality || '1080p WEB-DL'} [${audio || 'Hindi + English'}]`;
  };

  // Sync episode slots for Fulfill Modal grid
  const syncFulfillGridSlots = (
    count: number,
    season: number,
    pattern: string,
    quality: string,
    audio: string,
    size: string,
    titleName?: string
  ) => {
    const seriesTitle = titleName || fulfillingRequest?.title || 'Series';
    setFulfillGridEpisodes((prev) => {
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
          quality: existing?.quality || quality || '1080p WEB-DL',
          audio: existing?.audio || audio || 'Hindi + English',
          size: existing?.size || size || '',
        });
      }
      return newSlots;
    });
  };

  const handleOpenFulfill = (req: UserRequest) => {
    setFulfillingRequest(req);
    const yr = req.releaseYear ? ` (${req.releaseYear})` : '';
    const initialQuality = req.quality || '1080p';
    const initialAudio = req.audioLanguage || 'Hindi + English';

    setFulfillTitle(`${req.title}${yr} ${initialQuality} [${initialAudio}]`);
    setFulfillUrl('');
    setFulfillQuality(initialQuality);
    setFulfillAudio(initialAudio);
    setFulfillSize('');
    setFulfillCategory(req.mediaType === 'tv' ? (req.seasonNumber ? 'SingleEpisode' : 'ZipPack') : 'Download');
    setFulfillSuccessMsg('');

    // Default mode: single, bulk, or grid
    setFulfillMode(req.mediaType === 'tv' && !req.episodeNumber ? 'bulk' : 'single');
    setFulfillBulkMediaType(req.mediaType === 'tv' ? 'tv' : 'movie');
    setFulfillBulkMovieCategory(req.mediaType === 'tv' ? 'SingleEpisode' : 'Download');
    setFulfillBulkRawText('');
    setFulfillBulkParsedItems([]);

    // Grid states
    const defaultSeason = req.seasonNumber || 1;
    const defaultCount = 8;
    const pattern = `{title} S{season}E{ep} {quality} [{audio}]`;
    setFulfillGridSeason(defaultSeason);
    setFulfillGridEpisodeCount(defaultCount);
    setFulfillGridBasePattern(pattern);
    setFulfillGridQuality(initialQuality);
    setFulfillGridAudio(initialAudio);
    setFulfillGridSize('');
    setFulfillGridBulkLinksText('');

    const newSlots = [];
    for (let i = 1; i <= defaultCount; i++) {
      newSlots.push({
        episodeNumber: i,
        title: formatAdminGridEpTitle(i, pattern, defaultSeason, req.title, initialQuality, initialAudio),
        url: '',
        quality: initialQuality,
        audio: initialAudio,
        size: '',
      });
    }
    setFulfillGridEpisodes(newSlots);
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillingRequest || !fulfillUrl.trim()) return;

    setIsFulfillingSubmit(true);
    let targetTmdbId = fulfillingRequest.tmdbId;

    if (!targetTmdbId) {
      const reqTitleLower = (fulfillingRequest.title || '').trim().toLowerCase();
      const found = Object.entries(knownTitlesCache).find(([_, info]) => {
        const titleStr = typeof info === 'string' ? info : info?.title;
        return (titleStr || '').trim().toLowerCase() === reqTitleLower;
      });
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

      // 2. Update local customLinksMap with URL deduplication
      setCustomLinksMap((prev) => {
        const key = String(targetTmdbId);
        const existing = prev[key] || [];
        const filtered = existing.filter(
          (l) => l.id !== newCustomLink.id && l.url.trim().toLowerCase() !== newCustomLink.url.trim().toLowerCase()
        );
        return {
          ...prev,
          [key]: [newCustomLink, ...filtered],
        };
      });

      // 3. Mark request as fulfilled
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

  // Toggle type of individual item in fulfill bulk preview
  const handleFulfillToggleBulkItemType = (id: string) => {
    setFulfillBulkParsedItems((prev) =>
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

  // Set category for all items in fulfill movie bulk mode
  const handleFulfillSetAllBulkCategory = (cat: CustomLink['category']) => {
    setFulfillBulkMovieCategory(cat);
    setFulfillBulkParsedItems((prev) =>
      prev.map((item) => ({
        ...item,
        category: cat,
      }))
    );
  };

  // Convert all items in fulfill bulk preview to single episodes or zip packs
  const handleFulfillSetAllBulkType = (type: 'single_episode' | 'zip_pack') => {
    setFulfillBulkParsedItems((prev) =>
      prev.map((item, index) => ({
        ...item,
        linkType: type,
        category: type === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
        episodeNumber: type === 'single_episode' ? (item.episodeNumber || index + 1) : undefined,
      }))
    );
  };

  // Handle Bulk Links Fulfill Submission
  const handleFulfillBulkSubmit = async () => {
    if (!fulfillingRequest || fulfillBulkParsedItems.length === 0) return;

    setIsFulfillingSubmit(true);
    let targetTmdbId = fulfillingRequest.tmdbId;

    if (!targetTmdbId) {
      const reqTitleLower = (fulfillingRequest.title || '').trim().toLowerCase();
      const found = Object.entries(knownTitlesCache).find(([_, info]) => {
        const titleStr = typeof info === 'string' ? info : info?.title;
        return (titleStr || '').trim().toLowerCase() === reqTitleLower;
      });
      if (found) targetTmdbId = Number(found[0]);
    }

    if (!targetTmdbId) {
      targetTmdbId = Math.floor(Math.random() * 800000) + 100000;
    }

    const isMovie = fulfillBulkMediaType === 'movie';
    const createdObjs: CustomLink[] = [];

    fulfillBulkParsedItems.forEach((item, index) => {
      let finalUrl = item.url.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `https://${finalUrl}`;
      }

      const newObj: CustomLink = {
        id: `bulk-fulfill-${Date.now()}-${index}`,
        title: item.title,
        url: finalUrl,
        category: isMovie ? (item.category || fulfillBulkMovieCategory || 'Download') : item.category,
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

    try {
      // 1. Save all links to database
      await saveMultipleGlobalCustomLinks(targetTmdbId, createdObjs);

      // 2. Update local customLinksMap with URL deduplication
      setCustomLinksMap((prev) => {
        const key = String(targetTmdbId);
        const existing = prev[key] || [];
        const newUrls = new Set(createdObjs.map((l) => l.url.trim().toLowerCase()));
        const filtered = existing.filter((l) => !newUrls.has(l.url.trim().toLowerCase()));
        return {
          ...prev,
          [key]: [...createdObjs, ...filtered],
        };
      });

      // 3. Mark user request fulfilled
      const primeUrl = createdObjs[0]?.url || '';
      const primeId = createdObjs[0]?.id || `link-${Date.now()}`;

      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fulfillingRequest.id,
          status: 'fulfilled',
          fulfilledLinkId: primeId,
          fulfilledLinkUrl: primeUrl,
        }),
      });

      if (res.ok) {
        setFulfillSuccessMsg(`🎉 Successfully imported ${createdObjs.length} link${createdObjs.length > 1 ? 's' : ''} & fulfilled request for "${fulfillingRequest.title}"!`);
        addLog(`Fulfilled request for "${fulfillingRequest.title}" with ${createdObjs.length} bulk links`, 'success');

        setRequestsList((prev) =>
          prev.map((r) =>
            r.id === fulfillingRequest.id
              ? {
                  ...r,
                  status: 'fulfilled',
                  fulfilledAt: new Date().toISOString(),
                  fulfilledLinkUrl: primeUrl,
                }
              : r
          )
        );
        setPendingRequestsCount((prev) => Math.max(0, prev - 1));

        setTimeout(() => {
          setFulfillingRequest(null);
          setFulfillSuccessMsg('');
          setFulfillBulkRawText('');
          setFulfillBulkParsedItems([]);
        }, 2200);
      }
    } catch (err: any) {
      console.error('Error fulfilling bulk request:', err);
      addLog(`Failed to fulfill request with bulk links: ${err.message}`, 'warn');
    } finally {
      setIsFulfillingSubmit(false);
    }
  };

  // Distribute links pasted into fulfill grid
  const handleFulfillDistributeGridUrls = (text: string) => {
    setFulfillGridBulkLinksText(text);
    const urls = text.match(/(https?:\/\/[^\s<>"']+)/gi) || [];
    if (urls.length > 0) {
      setFulfillGridEpisodes((prev) =>
        prev.map((slot, index) => {
          if (urls[index]) {
            return { ...slot, url: urls[index] };
          }
          return slot;
        })
      );
    }
  };

  // Update a single episode slot in fulfill grid
  const handleFulfillUpdateGridSlot = (
    epNum: number,
    field: 'title' | 'url' | 'quality' | 'audio' | 'size',
    value: string
  ) => {
    setFulfillGridEpisodes((prev) =>
      prev.map((slot) => (slot.episodeNumber === epNum ? { ...slot, [field]: value } : slot))
    );
  };

  // Apply pattern to all titles in fulfill grid
  const handleFulfillApplyPatternToAll = () => {
    const seriesTitle = fulfillingRequest?.title || 'Series';
    setFulfillGridEpisodes((prev) =>
      prev.map((slot) => ({
        ...slot,
        title: formatAdminGridEpTitle(
          slot.episodeNumber,
          fulfillGridBasePattern,
          fulfillGridSeason,
          seriesTitle,
          fulfillGridQuality,
          fulfillGridAudio
        ),
      }))
    );
  };

  // Save all fulfill grid episode containers and fulfill request
  const handleFulfillGridSubmit = async () => {
    if (!fulfillingRequest) return;
    const valid = fulfillGridEpisodes.filter((e) => e.url.trim() && e.title.trim());
    if (valid.length === 0) {
      alert('Please fill in at least one episode container link before fulfilling.');
      return;
    }

    setIsFulfillingSubmit(true);
    let targetTmdbId = fulfillingRequest.tmdbId;

    if (!targetTmdbId) {
      const reqTitleLower = (fulfillingRequest.title || '').trim().toLowerCase();
      const found = Object.entries(knownTitlesCache).find(([_, info]) => {
        const titleStr = typeof info === 'string' ? info : info?.title;
        return (titleStr || '').trim().toLowerCase() === reqTitleLower;
      });
      if (found) targetTmdbId = Number(found[0]);
    }

    if (!targetTmdbId) {
      targetTmdbId = Math.floor(Math.random() * 800000) + 100000;
    }

    const createdObjs: CustomLink[] = [];
    valid.forEach((ep, index) => {
      let finalUrl = ep.url.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `https://${finalUrl}`;
      }

      const newLink: CustomLink = {
        id: `fulfill-grid-${Date.now()}-${ep.episodeNumber}-${index}`,
        title: ep.title.trim(),
        url: finalUrl,
        category: 'SingleEpisode',
        createdAt: new Date(Date.now() - index * 1000).toISOString(),
        seasonNumber: fulfillGridSeason,
        episodeNumber: ep.episodeNumber,
        quality: ep.quality.trim() || fulfillGridQuality || '1080p WEB-DL',
        audioLanguage: ep.audio.trim() || fulfillGridAudio || 'Hindi + English',
        size: ep.size.trim() || fulfillGridSize || undefined,
        linkType: 'single_episode',
      };
      createdObjs.push(newLink);
    });

    try {
      // 1. Save links to title database
      await saveMultipleGlobalCustomLinks(targetTmdbId, createdObjs);

      // 2. Update local customLinksMap with URL deduplication
      setCustomLinksMap((prev) => {
        const key = String(targetTmdbId);
        const existing = prev[key] || [];
        const newUrls = new Set(createdObjs.map((l) => l.url.trim().toLowerCase()));
        const filtered = existing.filter((l) => !newUrls.has(l.url.trim().toLowerCase()));
        return {
          ...prev,
          [key]: [...createdObjs, ...filtered],
        };
      });

      // 3. Mark request as fulfilled
      const primeUrl = createdObjs[0]?.url || '';
      const primeId = createdObjs[0]?.id || `link-${Date.now()}`;

      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fulfillingRequest.id,
          status: 'fulfilled',
          fulfilledLinkId: primeId,
          fulfilledLinkUrl: primeUrl,
        }),
      });

      if (res.ok) {
        setFulfillSuccessMsg(`🎉 Successfully saved ${createdObjs.length} episode containers & fulfilled request for "${fulfillingRequest.title}"!`);
        addLog(`Fulfilled request for "${fulfillingRequest.title}" with ${createdObjs.length} episode grid links`, 'success');

        setRequestsList((prev) =>
          prev.map((r) =>
            r.id === fulfillingRequest.id
              ? {
                  ...r,
                  status: 'fulfilled',
                  fulfilledAt: new Date().toISOString(),
                  fulfilledLinkUrl: primeUrl,
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
      console.error('Error fulfilling grid request:', err);
      addLog(`Failed to fulfill request with episode grid: ${err.message}`, 'warn');
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
      const storedSettings = safeGetLocalStorage('cinefuel_settings') || '{}';
      try {
        const parsed = JSON.parse(storedSettings);
        parsed.tmdbApiKey = tmdbKey.trim();
        safeSetLocalStorage('cinefuel_settings', JSON.stringify(parsed));
      } catch {
        safeSetLocalStorage('cinefuel_settings', JSON.stringify({ tmdbApiKey: tmdbKey.trim() }));
      }
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
      const key = String(selectedTargetTitle.id);
      const existing = prev[key] || [];
      const filtered = existing.filter(
        (l) => l.id !== newLinkObj.id && l.url.trim().toLowerCase() !== newLinkObj.url.trim().toLowerCase()
      );
      return {
        ...prev,
        [key]: [newLinkObj, ...filtered],
      };
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
      const key = String(selectedTargetTitle.id);
      const existing = prev[key] || [];
      const newUrls = new Set(createdObjs.map((l) => l.url.trim().toLowerCase()));
      const filtered = existing.filter((l) => !newUrls.has(l.url.trim().toLowerCase()));
      return {
        ...prev,
        [key]: [...createdObjs, ...filtered],
      };
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
      const key = String(selectedTargetTitle.id);
      const existing = prev[key] || [];
      const newUrls = new Set(createdObjs.map((l) => l.url.trim().toLowerCase()));
      const filtered = existing.filter((l) => !newUrls.has(l.url.trim().toLowerCase()));
      return {
        ...prev,
        [key]: [...createdObjs, ...filtered],
      };
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
      return { ...prev, [movieIdStr]: updatedList };
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
      return { ...prev, [movieIdStr]: updatedList };
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

  // Manual & Dynamic Refresh of Custom Links with pagination and search
  const refreshAdminLinks = async (
    page = linksCurrentPage,
    limit = linksPerPage,
    q = linkSearchQuery,
    category = linkCategoryFilter
  ) => {
    setIsRefreshingLinks(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (q && q.trim()) params.set('q', q.trim());
      if (category && category !== 'All') params.set('category', category);
      params.set('_t', String(Date.now()));

      const res = await fetch(`/api/curated-links?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.total === 'number') {
          setTotalServerLinksCount(data.total);
        }
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
          addLog(`Refreshed authoritative links from database (${(data.total || Object.keys(cleanedMap).length).toLocaleString()} total)`, 'success');
        }
      }
    } catch (e: any) {
      addLog(`Failed to refresh links: ${e.message}`, 'warn');
    } finally {
      setIsRefreshingLinks(false);
    }
  };

  // Re-fetch links whenever page, limit, search query, or category changes
  useEffect(() => {
    if (isMounted) {
      refreshAdminLinks(linksCurrentPage, linksPerPage, linkSearchQuery, linkCategoryFilter);
    }
  }, [linksCurrentPage, linksPerPage, linkSearchQuery, linkCategoryFilter, isMounted]);

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
        if (parsed.watchlist) safeSetLocalStorage('cinefuel_watchlist', JSON.stringify(parsed.watchlist));
        if (parsed.customLists) safeSetLocalStorage('cinefuel_custom_lists', JSON.stringify(parsed.customLists));
        if (parsed.customLinks) safeSetLocalStorage('cinefuel_custom_links', JSON.stringify(parsed.customLinks));
        if (parsed.knownTitles) safeSetLocalStorage('cinefuel_known_titles_cache', JSON.stringify(parsed.knownTitles));
        if (parsed.mdblistConfig) safeSetLocalStorage('cinefuel_mdblist_config', JSON.stringify(parsed.mdblistConfig));

        addLog('Database backup restored successfully! Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1200);
      } catch (err: any) {
        alert('Invalid backup file format: ' + err.message);
        addLog('Failed to parse backup JSON: ' + err.message, 'warn');
      }
    };
    reader.readAsText(file);
  };

  // Memoized Title Lookup Map for O(1) Instant Title Resolution across 7,000+ links
  const titleLookupMap = useMemo(() => {
    const map = new Map<number, { title: string; poster_path?: string | null; media_type?: 'movie' | 'tv' }>();
    if (Array.isArray(PINNED_TITLES)) {
      PINNED_TITLES.forEach((p) => {
        if (p && p.id) {
          map.set(p.id, { title: p.title || `Title #${p.id}`, poster_path: p.poster_path, media_type: p.media_type || 'movie' });
        }
      });
    }
    if (typeof MOCK_TITLES === 'object' && MOCK_TITLES !== null) {
      Object.values(MOCK_TITLES).forEach((m) => {
        if (m && m.id) {
          map.set(m.id, {
            title: m.title || m.name || `Title #${m.id}`,
            poster_path: m.poster_path,
            media_type: ((m.media_type as any) || (m.name ? 'tv' : 'movie')) as 'movie' | 'tv',
          });
        }
      });
    }
    if (Array.isArray(watchlist)) {
      watchlist.forEach((w) => {
        if (w && w.id) {
          map.set(w.id, {
            title: w.title || `Title #${w.id}`,
            poster_path: w.poster_path,
            media_type: w.mediaType || 'movie',
          });
        }
      });
    }
    if (knownTitlesCache && typeof knownTitlesCache === 'object') {
      Object.entries(knownTitlesCache).forEach(([idStr, val]) => {
        const numId = Number(idStr);
        if (!isNaN(numId)) {
          if (typeof val === 'string') {
            map.set(numId, { title: val, media_type: 'movie' });
          } else if (val && typeof val === 'object') {
            map.set(numId, {
              title: (val as any).title || `Title #${numId}`,
              poster_path: (val as any).poster_path,
              media_type: (val as any).media_type || 'movie',
            });
          }
        }
      });
    }
    return map;
  }, [watchlist, knownTitlesCache]);

  const resolveTitleInfo = useCallback(
    (movieId: number) => {
      return titleLookupMap.get(movieId) || { title: `Title #${movieId}`, media_type: 'movie' as const };
    },
    [titleLookupMap]
  );

  // Flatten all custom links across all movie IDs for the moderation table (Memoized)
  const allFlattenedLinks = useMemo(() => {
    const list: Array<{ movieId: number; movieName: string; mediaType: 'movie' | 'tv'; link: CustomLink }> = [];
    const seenLinkIds = new Set<string>();
    const safeDelIds = deletedCuratedLinkIds instanceof Set ? deletedCuratedLinkIds : new Set<string>();

    // 1. Built-in Curated Links (Filtered by safeDelIds)
    if (typeof BUILTIN_CURATED_LINKS === 'object' && BUILTIN_CURATED_LINKS !== null) {
      Object.entries(BUILTIN_CURATED_LINKS).forEach(([movieIdStr, links]) => {
        const numId = Number(movieIdStr);
        const info = resolveTitleInfo(numId);
        if (Array.isArray(links)) {
          links.forEach((l) => {
            if (l && l.id && !safeDelIds.has(l.id) && !seenLinkIds.has(l.id)) {
              seenLinkIds.add(l.id);
              list.push({
                movieId: numId,
                movieName: info.title || `Title #${numId}`,
                mediaType: info.media_type || 'movie',
                link: l,
              });
            }
          });
        }
      });
    }

    // 2. Watchlist Links (Filtered by safeDelIds)
    if (Array.isArray(watchlist)) {
      watchlist.forEach((w) => {
        if (w && w.customLinks && Array.isArray(w.customLinks)) {
          w.customLinks.forEach((l) => {
            if (l && l.id && !safeDelIds.has(l.id) && !seenLinkIds.has(l.id)) {
              seenLinkIds.add(l.id);
              list.push({
                movieId: w.id,
                movieName: w.title || `Title #${w.id}`,
                mediaType: w.mediaType || 'movie',
                link: l,
              });
            }
          });
        }
      });
    }

    // 3. Dynamic Live Server/Cloud Custom Links
    if (customLinksMap && typeof customLinksMap === 'object') {
      Object.entries(customLinksMap).forEach(([movieIdStr, links]) => {
        if (Array.isArray(links)) {
          const numId = Number(movieIdStr);
          const info = resolveTitleInfo(numId);
          const isTv =
            info.media_type === 'tv' ||
            links.some(
              (l) =>
                l &&
                (l.seasonNumber !== undefined ||
                  l.episodeNumber !== undefined ||
                  l.linkType === 'single_episode' ||
                  l.linkType === 'zip_pack')
            );
          links.forEach((l: CustomLink) => {
            if (l && l.id && !safeDelIds.has(l.id) && !seenLinkIds.has(l.id)) {
              seenLinkIds.add(l.id);
              list.push({
                movieId: numId,
                movieName: info.title || `Title #${numId}`,
                mediaType: isTv ? 'tv' : 'movie',
                link: l,
              });
            }
          });
        }
      });
    }

    // Sort all links newest first by default
    list.sort((a, b) => {
      const timeA = a.link?.createdAt ? new Date(a.link.createdAt).getTime() : 0;
      const timeB = b.link?.createdAt ? new Date(b.link.createdAt).getTime() : 0;
      const validA = isNaN(timeA) ? 0 : timeA;
      const validB = isNaN(timeB) ? 0 : timeB;
      return validB - validA;
    });

    return list;
  }, [customLinksMap, deletedCuratedLinkIds, watchlist, resolveTitleInfo]);

  // Auto-resolve title names from TMDB for unknown IDs in customLinksMap (Throttled & Non-reentrant)
  useEffect(() => {
    const unknownIds = Object.keys(customLinksMap)
      .map(Number)
      .filter(
        (id) =>
          id > 0 &&
          !attemptedTitleFetchRef.current.has(id) &&
          (!knownTitlesCache[id] || knownTitlesCache[id].title.startsWith('Title #'))
      );
    if (unknownIds.length === 0) return;

    unknownIds.slice(0, 10).forEach(async (id) => {
      attemptedTitleFetchRef.current.add(id);
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
  }, [customLinksMap]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setLinksCurrentPage(1);
  }, [linkSearchQuery, linkCategoryFilter]);

  // Memoized Filtered Links
  const filteredLinks = useMemo(() => {
    const q = linkSearchQuery.toLowerCase().trim();

    // 1. If Recent Uploads filter is active:
    if (linkCategoryFilter === 'Recent') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      let recents = allFlattenedLinks.filter((item) => {
        if (!item || !item.link) return false;
        if (item.link.category === 'Recent') return true;
        if (!item.link.createdAt) return false;
        const t = new Date(item.link.createdAt).getTime();
        return !isNaN(t) && t >= sevenDaysAgo;
      });

      // If no links were uploaded in the last 7 days, fallback to the latest 100 uploaded links
      if (recents.length === 0) {
        recents = allFlattenedLinks
          .filter((item) => {
            if (!item || !item.link?.createdAt) return false;
            const t = new Date(item.link.createdAt).getTime();
            return !isNaN(t);
          })
          .slice(0, 100);
      }

      // Sort by upload time (newest first)
      recents = [...recents].sort((a, b) => {
        const timeA = a.link?.createdAt ? new Date(a.link.createdAt).getTime() : 0;
        const timeB = b.link?.createdAt ? new Date(b.link.createdAt).getTime() : 0;
        const validA = isNaN(timeA) ? 0 : timeA;
        const validB = isNaN(timeB) ? 0 : timeB;
        return validB - validA;
      });

      if (!q) return recents;
      return recents.filter((item) => {
        return (
          (item.link?.title || '').toLowerCase().includes(q) ||
          (item.link?.url || '').toLowerCase().includes(q) ||
          (item.movieName || '').toLowerCase().includes(q) ||
          String(item.movieId || '').includes(q)
        );
      });
    }

    // 2. Standard Category & Search Filter
    if (!q && linkCategoryFilter === 'All') {
      return allFlattenedLinks;
    }
    return allFlattenedLinks.filter((item) => {
      if (!item || !item.link) return false;
      const matchesCat = linkCategoryFilter === 'All' || item.link.category === linkCategoryFilter;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        (item.link.title || '').toLowerCase().includes(q) ||
        (item.link.url || '').toLowerCase().includes(q) ||
        (item.movieName || '').toLowerCase().includes(q) ||
        String(item.movieId || '').includes(q)
      );
    });
  }, [allFlattenedLinks, linkCategoryFilter, linkSearchQuery]);

  // Server-aware Pagination
  const effectiveTotalLinks = totalServerLinksCount > 0 ? totalServerLinksCount : allFlattenedLinks.length;
  const totalLinkPages = Math.max(1, Math.ceil(effectiveTotalLinks / linksPerPage));
  const paginatedLinks = filteredLinks;

  const isCurrentPageAllSelected =
    paginatedLinks.length > 0 && paginatedLinks.every((item) => selectedLinkIds.has(item.link.id));

  const handleSelectAllCurrentPage = () => {
    if (paginatedLinks.length === 0) return;
    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      if (isCurrentPageAllSelected) {
        paginatedLinks.forEach((item) => next.delete(item.link.id));
      } else {
        paginatedLinks.forEach((item) => next.add(item.link.id));
      }
      return next;
    });
  };

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

  // Filtered registered users for Manage Users directory tab
  const filteredRegisteredUsers = useMemo(() => {
    let list = Array.isArray(registeredUsers) ? registeredUsers : [];
    if (userFilterCategory === 'requesters') {
      list = list.filter((u) => (u.requestsCount || 0) > 0);
    } else if (userFilterCategory === 'reporters') {
      list = list.filter((u) => (u.reportsCount || 0) > 0);
    }

    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((u) => {
      const matchName = (u.displayName || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchUid = (u.uid || '').toLowerCase().includes(q);
      const matchRecent =
        Array.isArray(u.recentRequests) &&
        u.recentRequests.some((t) => String(t || '').toLowerCase().includes(q));
      return matchName || matchEmail || matchUid || matchRecent;
    });
  }, [registeredUsers, userFilterCategory, userSearchQuery]);

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
    <div className="max-w-[1720px] mx-auto px-3 sm:px-6 py-6 min-h-screen">
      {(() => {
        const navItems = [
          {
            id: 'overview' as const,
            label: 'Overview & Metrics',
            shortLabel: 'Overview',
            icon: Activity,
            badge: null,
            badgePulse: false,
            badgeColor: 'amber' as const,
          },
          {
            id: 'links' as const,
            label: `Manage Links (${effectiveTotalLinks.toLocaleString()})`,
            shortLabel: 'Links',
            icon: Link2,
            badge: effectiveTotalLinks > 0 ? effectiveTotalLinks.toLocaleString() : allFlattenedLinks.length,
            badgePulse: false,
            badgeColor: 'zinc' as const,
          },
          {
            id: 'titles' as const,
            label: 'Manage Titles & Search',
            shortLabel: 'Titles',
            icon: Film,
            badge: null,
            badgePulse: false,
            badgeColor: 'amber' as const,
          },
          {
            id: 'requests' as const,
            label: 'User Requests',
            shortLabel: 'Requests',
            icon: Inbox,
            badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
            badgePulse: pendingRequestsCount > 0,
            badgeColor: 'amber' as const,
          },
          {
            id: 'reports' as const,
            label: 'Defective Links',
            shortLabel: 'Defective',
            icon: AlertTriangle,
            badge: pendingReportsCount > 0 ? pendingReportsCount : null,
            badgePulse: pendingReportsCount > 0,
            badgeColor: 'rose' as const,
          },
          {
            id: 'users' as const,
            label: 'Manage Users',
            shortLabel: 'Users',
            icon: Users,
            badge: registeredUsers.length > 0 ? registeredUsers.length : null,
            badgePulse: false,
            badgeColor: 'zinc' as const,
          },
          {
            id: 'apis' as const,
            label: 'API Integrations',
            shortLabel: 'APIs',
            icon: Key,
            badge: null,
            badgePulse: false,
            badgeColor: 'amber' as const,
          },
          {
            id: 'backup' as const,
            label: 'Backup & Vault',
            shortLabel: 'Backup',
            icon: Database,
            badge: null,
            badgePulse: false,
            badgeColor: 'amber' as const,
          },
          {
            id: 'logs' as const,
            label: 'Diagnostics',
            shortLabel: 'Diagnostics',
            icon: Server,
            badge: null,
            badgePulse: false,
            badgeColor: 'amber' as const,
          },
        ];

        return (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Desktop Collapsible Sidebar */}
            <aside
              className={`hidden lg:flex flex-col shrink-0 sticky top-6 bg-[#0f121a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-2xl transition-all duration-300 ease-in-out z-30 ${
                isSidebarCollapsed ? 'w-20 items-center' : 'w-72'
              }`}
              style={{ maxHeight: 'calc(100vh - 3rem)' }}
            >
              {/* Sidebar Header */}
              <div
                className={`flex items-center pb-4 mb-3 border-b border-white/5 w-full ${
                  isSidebarCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between'
                }`}
              >
                {!isSidebarCollapsed ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-black font-black flex items-center justify-center text-base shadow-md shadow-amber-500/30 shrink-0">
                      S
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-black text-white tracking-wide uppercase truncate">
                        CineFuel
                      </h2>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[10px] text-amber-400/90 font-bold tracking-tight uppercase">
                          Control Center
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-black font-black flex items-center justify-center text-base shadow-md shadow-amber-500/30 shrink-0"
                    title="CineFuel Control Center"
                  >
                    S
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 hover:border-amber-500/30 text-zinc-400 hover:text-amber-400 transition-all cursor-pointer shadow-sm"
                  title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                  aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                >
                  {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>

              {/* Navigation Items List */}
              <nav className="flex-1 w-full space-y-1.5 overflow-y-auto no-scrollbar py-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isReportTab = item.id === 'reports';

                  if (isSidebarCollapsed) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        title={`${item.shortLabel}${item.badge !== null ? ` (${item.badge})` : ''}`}
                        className={`relative group w-12 h-12 mx-auto rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                          isActive
                            ? isReportTab
                              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 font-bold'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25 font-black'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                        }`}
                        suppressHydrationWarning
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {item.badge !== null && (
                          <span
                            className={`absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow-md ${
                              isReportTab
                                ? 'bg-rose-500 text-white'
                                : isActive
                                ? 'bg-black text-amber-400'
                                : 'bg-amber-500 text-black'
                            } ${item.badgePulse ? 'animate-pulse' : ''}`}
                          >
                            {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                        {/* Floating Tooltip */}
                        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-xl bg-zinc-900 border border-zinc-700/90 px-3 py-1.5 text-xs font-bold text-white shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                          {item.shortLabel}
                          {item.badge !== null && ` (${item.badge})`}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full px-3.5 py-2.5 rounded-2xl flex items-center gap-3 transition-all duration-200 cursor-pointer text-left group ${
                        isActive
                          ? isReportTab
                            ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold shadow-lg shadow-rose-600/25'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black shadow-lg shadow-amber-500/25'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70 font-semibold'
                      }`}
                      suppressHydrationWarning
                    >
                      <div
                        className={`p-1.5 rounded-xl transition-all ${
                          isActive
                            ? isReportTab
                              ? 'bg-white/20 text-white'
                              : 'bg-black/20 text-black'
                            : 'bg-zinc-800/60 text-zinc-400 group-hover:text-amber-400 group-hover:bg-amber-500/10'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                      </div>
                      <span className="text-xs font-bold truncate flex-1 tracking-tight">
                        {item.label}
                      </span>
                      {item.badge !== null && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            isReportTab
                              ? isActive
                                ? 'bg-black/40 text-rose-200'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isActive
                              ? 'bg-black/30 text-black'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Sidebar Footer */}
              {isSidebarCollapsed ? (
                <div className="pt-3 mt-2 border-t border-white/5 flex flex-col items-center gap-2 w-full">
                  <Link
                    href="/"
                    title="View Public Site"
                    className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Lock Panel"
                    className="w-10 h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center transition-all cursor-pointer"
                    suppressHydrationWarning
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="pt-3 mt-2 border-t border-white/5 space-y-3 w-full">
                  <div className="p-2.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> MongoDB Atlas
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold font-mono">12K Links</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-400" /> Upstash Redis
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold font-mono">v2 Active</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/"
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Public Site
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      suppressHydrationWarning
                    >
                      <Lock className="w-3.5 h-3.5" /> Lock
                    </button>
                  </div>
                </div>
              )}
            </aside>

            {/* Main Content Workspace */}
            <main className="flex-1 min-w-0 w-full space-y-6">
              {/* Top Bar Header */}
              <header className="bg-[#0f121a]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-3.5">
                  {/* Mobile Drawer Trigger (< lg) */}
                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                    className="lg:hidden p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                    aria-label="Toggle Navigation Menu"
                  >
                    {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>

                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-black flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0 font-black text-lg">
                    S
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                        Master Admin • Shyam
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Role Enforced: Admin Controls
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      CineFuel Control Center
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  <Link
                    href="/"
                    className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">View</span> Public Site
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    suppressHydrationWarning
                  >
                    <Lock className="w-3.5 h-3.5" /> Lock <span className="hidden sm:inline">Panel</span>
                  </button>
                </div>
              </header>

              {/* Mobile Quick Horizontal Bar (< lg) */}
              <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-1 border-b border-zinc-800/80">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isReportTab = item.id === 'reports';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? isReportTab
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                            : 'bg-amber-500 text-black shadow-md'
                          : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5'
                      }`}
                      suppressHydrationWarning
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.shortLabel}</span>
                      {item.badge !== null && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                            isActive
                              ? 'bg-black text-white'
                              : item.badgeColor === 'rose'
                              ? 'bg-rose-500 text-white'
                              : 'bg-zinc-800 text-zinc-300'
                          } ${item.badgePulse ? 'animate-pulse' : ''}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Mobile Full Navigation Drawer (< lg) */}
              {isMobileNavOpen && (
                <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-black/80 backdrop-blur-md animate-fade-in p-4">
                  <div className="bg-[#0f121a] border border-amber-500/30 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-black font-black flex items-center justify-center text-sm">
                          S
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white">CineFuel Navigation</h3>
                          <p className="text-[10px] text-zinc-400">Select administrative section</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMobileNavOpen(false)}
                        className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        const isReportTab = item.id === 'reports';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(item.id);
                              setIsMobileNavOpen(false);
                            }}
                            className={`w-full px-4 py-3 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                              isActive
                                ? isReportTab
                                  ? 'bg-rose-600 text-white font-bold'
                                  : 'bg-amber-500 text-black font-black'
                                : 'bg-zinc-900/60 text-zinc-300 hover:bg-zinc-850 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4" />
                              <span className="text-xs font-bold">{item.label}</span>
                            </div>
                            {item.badge !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  isActive ? 'bg-black text-white' : 'bg-zinc-800 text-zinc-300'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

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
              <p className="text-3xl font-black text-amber-400">{effectiveTotalLinks.toLocaleString()}</p>
              <span className="text-[11px] text-zinc-400 font-medium">12,000+ in cloud database</span>
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

            <div
              onClick={() => setActiveTab('users')}
              className="p-5 rounded-2xl bg-[#11141c] border border-amber-500/20 hover:border-amber-500/50 cursor-pointer transition-all space-y-1 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">User Accounts</span>
                <span className="text-[10px] text-amber-400 group-hover:underline">Manage →</span>
              </div>
              <p className="text-3xl font-black text-amber-400">{registeredUsers.length}</p>
              <span className="text-[11px] text-zinc-400 font-medium">
                {registeredUsers.filter((u) => (u.requestsCount || 0) > 0).length} active requesters
              </span>
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
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>{linkCategoryFilter === 'Recent' ? 'Recent Uploads' : 'All Saved Custom Links'}</span>
                  <span>({effectiveTotalLinks.toLocaleString()})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => refreshAdminLinks()}
                  disabled={isRefreshingLinks}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Reload custom links from cloud database"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingLinks ? 'animate-spin text-amber-400' : 'text-zinc-400'}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search links, titles..."
                    value={linkSearchQuery}
                    onChange={(e) => {
                      setLinkSearchQuery(e.target.value);
                      setLinksCurrentPage(1);
                    }}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 w-44"
                  />
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                <select
                  value={linkCategoryFilter}
                  onChange={(e) => {
                    setLinkCategoryFilter(e.target.value);
                    setLinksCurrentPage(1);
                  }}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-semibold"
                >
                  <option value="All">All Categories</option>
                  <option value="Recent">⚡ Recent Uploads</option>
                  <option value="Streaming">Streaming</option>
                  <option value="Download">Download</option>
                  <option value="ZipPack">ZipPack</option>
                  <option value="SingleEpisode">SingleEpisode</option>
                  <option value="Subtitles">Subtitles</option>
                  <option value="Discussion">Discussion</option>
                  <option value="Review">Review</option>
                  <option value="Official">Official</option>
                </select>

                <select
                  value={linksPerPage}
                  onChange={(e) => {
                    setLinksPerPage(Number(e.target.value));
                    setLinksCurrentPage(1);
                  }}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-semibold"
                  title="Rows per page"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={200}>200 / page</option>
                </select>
              </div>
            </div>

            {/* Bulk Action Controls */}
            {selectedLinkIds.size > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 animate-fadeIn shadow-lg">
                <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>
                    {selectedLinkIds.size} of {filteredLinks.length} link{selectedLinkIds.size !== 1 ? 's' : ''} selected
                  </span>
                  {selectedLinkIds.size < filteredLinks.length && (
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="ml-2 text-[11px] underline text-amber-400 hover:text-amber-300 font-normal"
                    >
                      (Select all {filteredLinks.length.toLocaleString()} matching)
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLinkIds(new Set())}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-colors"
                  >
                    Clear Selection
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs transition-all shadow-md shadow-rose-600/30 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedLinkIds.size})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Top Pagination Bar */}
            {filteredLinks.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 py-2 px-1 text-xs text-zinc-400 border-b border-zinc-800/60">
                <div className="text-zinc-400 text-xs">
                  Showing <span className="font-semibold text-white">{effectiveTotalLinks === 0 ? 0 : (linksCurrentPage - 1) * linksPerPage + 1}</span>-
                  <span className="font-semibold text-white">{Math.min(linksCurrentPage * linksPerPage, effectiveTotalLinks)}</span> of{' '}
                  <span className="font-bold text-amber-400">{effectiveTotalLinks.toLocaleString()}</span> links
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage(1)}
                    disabled={linksCurrentPage <= 1}
                    className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-[11px] font-mono transition-all"
                    title="First page"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={linksCurrentPage <= 1}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-xs font-semibold transition-all"
                  >
                    ‹ Prev
                  </button>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs font-mono text-zinc-300">
                    <span className="text-amber-400 font-bold">{linksCurrentPage}</span> / {totalLinkPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage((p) => Math.min(totalLinkPages, p + 1))}
                    disabled={linksCurrentPage >= totalLinkPages}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-xs font-semibold transition-all"
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage(totalLinkPages)}
                    disabled={linksCurrentPage >= totalLinkPages}
                    className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-[11px] font-mono transition-all"
                    title="Last page"
                  >
                    »
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
                          checked={isCurrentPageAllSelected}
                          onChange={handleSelectAllCurrentPage}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                          title="Select / Deselect all links on current page"
                        />
                      </th>
                      <th className="py-3 px-3">Target Title</th>
                      <th className="py-3 px-3">Link Name / Release</th>
                      <th className="py-3 px-3">Uploaded</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">URL</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {paginatedLinks.map((item) => {
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
                          <td className="py-3 px-3 text-[11px] text-zinc-400 whitespace-nowrap font-mono">
                            <span
                              className="flex items-center gap-1.5"
                              title={formatDateTimeSafe(item.link.createdAt)}
                            >
                              <Clock className="w-3 h-3 text-amber-400/80 shrink-0" />
                              <span>{formatRelativeTime(item.link.createdAt)}</span>
                            </span>
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

            {/* Bottom Pagination Bar */}
            {filteredLinks.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                <div>
                  Showing <span className="font-semibold text-white">{effectiveTotalLinks === 0 ? 0 : (linksCurrentPage - 1) * linksPerPage + 1}</span>-
                  <span className="font-semibold text-white">{Math.min(linksCurrentPage * linksPerPage, effectiveTotalLinks)}</span> of{' '}
                  <span className="font-bold text-amber-400">{effectiveTotalLinks.toLocaleString()}</span> links
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage(1)}
                    disabled={linksCurrentPage <= 1}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-[11px] font-mono transition-all"
                  >
                    « First
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={linksCurrentPage <= 1}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-xs font-semibold transition-all"
                  >
                    ‹ Prev
                  </button>
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-300">
                    Page <strong className="text-amber-400">{linksCurrentPage}</strong> of <strong className="text-zinc-200">{totalLinkPages}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage((p) => Math.min(totalLinkPages, p + 1))}
                    disabled={linksCurrentPage >= totalLinkPages}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-xs font-semibold transition-all"
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinksCurrentPage(totalLinkPages)}
                    disabled={linksCurrentPage >= totalLinkPages}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-[11px] font-mono transition-all"
                  >
                    Last »
                  </button>
                </div>
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
            const filteredRequests = (Array.isArray(requestsList) ? requestsList : []).filter((r) => {
              if (requestsFilter !== 'all' && r.status !== requestsFilter) return false;
              if (!requestsSearchQuery.trim()) return true;
              const q = requestsSearchQuery.toLowerCase();
              return (
                (r.title || '').toLowerCase().includes(q) ||
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
                  const dateStr = formatDateTimeSafe(req.createdAt);

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
                              {(req.userName || req.userEmail || req.userContact) && (
                                <button
                                  onClick={() => {
                                    setActiveTab('users');
                                    setUserSearchQuery(req.userEmail || req.userName || req.userContact || '');
                                  }}
                                  className="text-[11px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-0.5 rounded-lg border border-blue-500/20 transition-colors text-left"
                                  title="Jump to this user in Manage Users directory"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span>
                                    {req.userName ? `${req.userName} • ` : ''}
                                    {req.userEmail || req.userContact}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 underline ml-1 hidden sm:inline">View Account →</span>
                                </button>
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
                          title="Open fulfillment dialog (Single Link, Bulk Auto-Detector, or Episode Grid)"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{req.status === 'fulfilled' ? 'Add Another Link' : 'Fulfill & Add Link'}</span>
                        </button>

                        {/* Direct Jump to Manage Links Tab */}
                        <button
                          onClick={() => {
                            const targetObj = {
                              id: req.tmdbId || Math.floor(Math.random() * 800000) + 100000,
                              title: req.title,
                              media_type: (req.mediaType === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv',
                              poster_path: req.posterPath || null,
                              year: req.releaseYear || '',
                            };
                            setSelectedTargetTitle(targetObj);
                            cacheTitle(targetObj.id, targetObj);
                            setActiveTab('links');
                            if (req.mediaType === 'tv') {
                              setAddLinkMode('bulk');
                              setAdminBulkMediaType('tv');
                            } else {
                              setAddLinkMode('single');
                              setAdminBulkMediaType('movie');
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 text-zinc-300 hover:text-amber-400 text-xs font-bold transition-all"
                          title="Open in Full Manage Links Tab (Bulk & Grid Available)"
                        >
                          <Link2 className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden lg:inline">Manage Links</span>
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
            const filteredReports = (Array.isArray(reportsList) ? reportsList : []).filter((r) => {
              if (reportsFilter !== 'all' && r.status !== reportsFilter) return false;
              if (reportsIssueFilter !== 'all' && r.issueType !== reportsIssueFilter) return false;
              if (!reportsSearchQuery.trim()) return true;
              const q = reportsSearchQuery.toLowerCase();
              return (
                (r.mediaTitle || '').toLowerCase().includes(q) ||
                (r.linkTitle || '').toLowerCase().includes(q) ||
                (r.reportedUrl || '').toLowerCase().includes(q) ||
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
                            {(report.userName || report.userEmail) && (
                              <button
                                onClick={() => {
                                  setActiveTab('users');
                                  setUserSearchQuery(report.userEmail || report.userName || '');
                                }}
                                className="text-zinc-300 hover:text-white font-mono flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-800 transition-colors"
                                title="Jump to this user in Manage Users directory"
                              >
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                                <span>{report.userName ? `${report.userName} (${report.userEmail})` : report.userEmail}</span>
                              </button>
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
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
            <div className="space-y-1">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2.5">
                <Users className="w-5 h-5 text-amber-400" /> User Directory & Account Vault
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">
                  {registeredUsers.length} {registeredUsers.length === 1 ? 'User' : 'Users'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Real-time registry of authenticated users, sign-in accounts, movie request history, and active link reports.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAdminUsers()}
                disabled={isLoadingUsers}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/10 active:scale-95 disabled:opacity-50"
                title="Fetch latest accounts from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                <span>{isLoadingUsers ? 'Fetching...' : 'Fetch Users'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Total Accounts
              </span>
              <p className="text-2xl font-black text-white">{registeredUsers.length}</p>
              <span className="text-[10px] text-zinc-500 block">Registered & Live</span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-blue-500/20 space-y-1">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">
                Active Requesters
              </span>
              <p className="text-2xl font-black text-blue-400">
                {registeredUsers.filter((u) => (u.requestsCount || 0) > 0).length}
              </p>
              <span className="text-[10px] text-zinc-500 block">Requested Media</span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-rose-500/20 space-y-1">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
                Defective Reporters
              </span>
              <p className="text-2xl font-black text-rose-400">
                {registeredUsers.filter((u) => (u.reportsCount || 0) > 0).length}
              </p>
              <span className="text-[10px] text-zinc-500 block">Reported Issues</span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/20 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                Active Admin Session
              </span>
              <p className="text-sm font-bold text-emerald-400 truncate">
                {userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Shyam'}
              </p>
              <span className="text-[10px] text-zinc-500 block truncate">
                {userProfile?.email || 'admin@cinefuel.app'}
              </span>
            </div>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search users by name, email, UID, or requested title (e.g. Ballerina)..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
              />
              {userSearchQuery && (
                <button
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shrink-0">
              <button
                onClick={() => setUserFilterCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  userFilterCategory === 'all'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All ({registeredUsers.length})
              </button>
              <button
                onClick={() => setUserFilterCategory('requesters')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  userFilterCategory === 'requesters'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Requesters ({registeredUsers.filter((u) => (u.requestsCount || 0) > 0).length})
              </button>
              <button
                onClick={() => setUserFilterCategory('reporters')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  userFilterCategory === 'reporters'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Reporters ({registeredUsers.filter((u) => (u.reportsCount || 0) > 0).length})
              </button>
            </div>
          </div>

          {/* User Directory Cards Grid */}
          {isLoadingUsers && registeredUsers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <p className="text-sm font-bold text-white">Fetching user directory & accounts...</p>
              <p className="text-xs text-zinc-500">Querying central database and activity registry</p>
            </div>
          ) : filteredRegisteredUsers.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 p-6">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">
                {userSearchQuery || userFilterCategory !== 'all'
                  ? 'No matching users found'
                  : 'No registered user accounts yet'}
              </h4>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {userSearchQuery || userFilterCategory !== 'all'
                  ? 'Try clearing your search query or switching filters.'
                  : 'When visitors sign in with Google or Email/Password, or submit movie requests, their accounts will appear here automatically.'}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setUserSearchQuery('');
                    setUserFilterCategory('all');
                    fetchAdminUsers();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white inline-flex items-center gap-2 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset & Fetch Users
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRegisteredUsers.map((user) => {
                const userName = user.name || user.displayName || 'Cinema Explorer';
                const initial = (userName || user.email || 'U')[0].toUpperCase();
                const userUid = user.firebaseUid || user.uid;
                const isCopied = copiedUid === userUid;
                const isGoogle = user.provider === 'google' || user.provider === 'google.com';
                const providerLabel = isGoogle
                  ? 'Google Auth'
                  : user.provider === 'password' || user.provider === 'email_password'
                  ? 'Email / Password'
                  : user.provider === 'request_submitter'
                  ? 'Request Submitter'
                  : user.provider === 'report_submitter'
                  ? 'Report Submitter'
                  : user.provider === 'fast_login'
                  ? 'Fast Login'
                  : 'Firebase User';

                return (
                  <div
                    key={userUid}
                    className="p-5 rounded-2xl bg-zinc-900/75 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all space-y-4 flex flex-col justify-between group shadow-sm"
                  >
                    <div className="space-y-3.5">
                      {/* User Identity Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-black font-black text-base shrink-0 shadow-md">
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt={userName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              initial
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                              <span className="truncate">{userName}</span>
                            </h4>
                            <span className="text-xs text-zinc-400 truncate block font-mono">
                              {user.email || 'No email registered'}
                            </span>
                          </div>
                        </div>

                        {/* Provider & Status Badges */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isGoogle
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {providerLabel}
                          </span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/60 uppercase">
                            {user.status || 'active'}
                          </span>
                        </div>
                      </div>

                      {/* UID & Date Info */}
                      <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-400 font-mono bg-black/40 p-2.5 rounded-xl border border-zinc-800/80">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-zinc-500">Firebase UID:</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate max-w-[140px] text-zinc-300 font-mono text-[10px]" title={userUid}>
                              {userUid}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyUid(userUid)}
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
                              title="Copy Firebase UID"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-zinc-500">Joined:</span>
                          <span className="text-zinc-300">
                            {formatDateSafe(user.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-zinc-500">Last Active:</span>
                          <span className="text-zinc-300">
                            {formatRelativeTime(user.lastLoginAt || user.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Activity Badges */}
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-blue-500/5 border border-blue-500/20">
                          <span className="text-blue-400/80 block text-[10px] font-semibold uppercase">Requests</span>
                          <span className="font-black text-blue-400 text-sm">{user.requestsCount || 0}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-rose-500/5 border border-rose-500/20">
                          <span className="text-rose-400/80 block text-[10px] font-semibold uppercase">Reports</span>
                          <span className="font-black text-rose-400 text-sm">{user.reportsCount || 0}</span>
                        </div>
                      </div>

                      {/* Requested Titles Pills */}
                      {Array.isArray(user.recentRequests) && user.recentRequests.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Requested Titles:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {user.recentRequests.map((title, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setActiveTab('requests');
                                  setRequestsSearchQuery(title);
                                }}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center gap-1 transition-colors"
                                title={`Jump to requests for "${title}"`}
                              >
                                <Film className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate max-w-[180px]">{title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setActiveTab('requests');
                          setRequestsSearchQuery(user.email || user.displayName || '');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Inbox className="w-3.5 h-3.5 text-amber-400" />
                        <span>View Requests</span>
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user.uid, user.email)}
                        className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete user account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: API KEYS & INTEGRATIONS */}
      {/* ========================================================= */}
      {activeTab === 'apis' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0f121a] border border-zinc-800 space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" /> API Keys & Configuration
            </h3>
            <p className="text-xs text-zinc-400">
              Configure and test live connection credentials for TMDB movie & TV database.
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

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Save API Configuration
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
            </main>
          </div>
        );
      })()}

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

      {/* Admin Fulfill Link Request Modal (Single, Bulk Auto-Detector, & Episode Grid) */}
      {fulfillingRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#0f131d] border border-blue-500/40 rounded-3xl p-5 sm:p-7 max-w-4xl w-full space-y-4 shadow-2xl animate-scaleIn my-6 max-h-[92vh] overflow-y-auto">
            {/* Header with Title & 3 Mode Switcher Pills */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 font-black">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${fulfillingRequest.mediaType === 'tv' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                      {fulfillingRequest.mediaType === 'tv' ? 'TV SERIES' : 'MOVIE'}
                    </span>
                    {fulfillingRequest.releaseYear && (
                      <span className="text-xs text-zinc-400 font-mono">({fulfillingRequest.releaseYear})</span>
                    )}
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-white leading-tight">
                    Fulfill Request: <span className="text-blue-400">{fulfillingRequest.title}</span>
                  </h4>
                </div>
              </div>

              {/* 3 Link Mode Tabs (Single, Bulk, Grid) */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-2xl border border-zinc-800 self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setFulfillMode('single')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    fulfillMode === 'single'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> Single Link
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillMode('bulk')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                    fulfillMode === 'bulk'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-amber-500/20'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" /> Bulk Auto-Detector
                </button>
                {fulfillingRequest.mediaType === 'tv' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFulfillMode('grid');
                      if (fulfillGridEpisodes.length === 0) {
                        syncFulfillGridSlots(
                          fulfillGridEpisodeCount,
                          fulfillGridSeason,
                          fulfillGridBasePattern,
                          fulfillGridQuality,
                          fulfillGridAudio,
                          fulfillGridSize,
                          fulfillingRequest.title
                        );
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                      fulfillMode === 'grid'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> Episode Grid ({fulfillGridEpisodeCount} EPs)
                  </button>
                )}
                <button
                  onClick={() => setFulfillingRequest(null)}
                  className="text-zinc-400 hover:text-white text-xs font-bold px-2 py-1.5 ml-1 rounded-lg hover:bg-zinc-800"
                  title="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Request Summary Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400">Requested Quality:</span>
                    <span className="text-blue-400 font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      {fulfillingRequest.quality || 'Any Quality'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400">Requested Audio:</span>
                    <span className="text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                      {fulfillingRequest.audioLanguage || 'Any Audio'}
                    </span>
                  </div>
                  {fulfillingRequest.mediaType === 'tv' && (fulfillingRequest.seasonNumber || fulfillingRequest.episodeNumber) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-400">Target Season/EP:</span>
                      <span className="text-amber-400 font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {fulfillingRequest.seasonNumber ? `S${fulfillingRequest.seasonNumber}` : ''}
                        {fulfillingRequest.episodeNumber ? `E${fulfillingRequest.episodeNumber}` : ' (Full Pack)'}
                      </span>
                    </div>
                  )}
                </div>
                {fulfillingRequest.userContact && (
                  <span className="text-[11px] text-zinc-400 font-mono">
                    User Contact: <strong className="text-blue-400">{fulfillingRequest.userContact}</strong>
                  </span>
                )}
              </div>
              {fulfillingRequest.notes && (
                <div className="pt-1.5 border-t border-zinc-800/60 text-zinc-300 italic">
                  &ldquo;{fulfillingRequest.notes}&rdquo;
                </div>
              )}
            </div>

            {fulfillSuccessMsg ? (
              <div className="p-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold space-y-2 animate-fadeIn">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">{fulfillSuccessMsg}</p>
              </div>
            ) : (
              <>
                {/* ----------------- MODE 1: SINGLE LINK ----------------- */}
                {fulfillMode === 'single' && (
                  <form onSubmit={handleFulfillSubmit} className="space-y-4 pt-1 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="lg:col-span-2">
                        <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                          Link Title / Release Label *
                        </label>
                        <input
                          type="text"
                          value={fulfillTitle}
                          onChange={(e) => setFulfillTitle(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-medium"
                          required
                        />
                      </div>

                      <div className="lg:col-span-2">
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

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Category / Type</label>
                        <select
                          value={fulfillCategory}
                          onChange={(e) => setFulfillCategory(e.target.value as CustomLink['category'])}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                        >
                          <option value="Download">📥 Direct Download</option>
                          <option value="Streaming">🎬 Streaming & OTT</option>
                          <option value="SingleEpisode">📺 Single Episode</option>
                          <option value="ZipPack">🗜️ Season Zip / Batch Pack</option>
                          <option value="Subtitles">🌐 Subtitles</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Quality</label>
                        <input
                          type="text"
                          placeholder="e.g. 1080p, 4K"
                          value={fulfillQuality}
                          onChange={(e) => setFulfillQuality(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Audio / Dub</label>
                        <input
                          type="text"
                          placeholder="e.g. Hindi + English"
                          value={fulfillAudio}
                          onChange={(e) => setFulfillAudio(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 block mb-1">File Size</label>
                        <input
                          type="text"
                          placeholder="e.g. 2.4 GB"
                          value={fulfillSize}
                          onChange={(e) => setFulfillSize(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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

                {/* ----------------- MODE 2: BULK AUTO-DETECTOR ----------------- */}
                {fulfillMode === 'bulk' && (
                  <div className="space-y-4 pt-1 animate-fadeIn">
                    {/* Bulk Target Format Switcher */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-300">Bulk Target Format:</span>
                        <div className="inline-flex rounded-xl p-1 bg-zinc-900 border border-zinc-700/80 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setFulfillBulkMediaType('movie');
                              if (fulfillBulkRawText.trim()) {
                                const parsed = parseBulkLinksInput(fulfillBulkRawText, 1, 'movie', fulfillBulkMovieCategory);
                                setFulfillBulkParsedItems(parsed);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              fulfillBulkMediaType === 'movie'
                                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Film className="w-3.5 h-3.5" /> Movie Releases Mode
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFulfillBulkMediaType('tv');
                              if (fulfillBulkRawText.trim()) {
                                const parsed = parseBulkLinksInput(fulfillBulkRawText, fulfillingRequest.seasonNumber || 1, 'tv', 'SingleEpisode');
                                setFulfillBulkParsedItems(parsed);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              fulfillBulkMediaType === 'tv'
                                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Tv className="w-3.5 h-3.5" /> TV Episodes & Packs
                          </button>
                        </div>
                      </div>

                      {fulfillBulkMediaType === 'movie' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-zinc-400">Default Category:</span>
                          <select
                            value={fulfillBulkMovieCategory}
                            onChange={(e) => {
                              const cat = e.target.value as CustomLink['category'];
                              setFulfillBulkMovieCategory(cat);
                              handleFulfillSetAllBulkCategory(cat);
                            }}
                            className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                          >
                            <option value="Download">📥 Direct Download</option>
                            <option value="Streaming">🎬 Streaming & OTT</option>
                            <option value="Subtitles">🌐 Subtitles</option>
                            <option value="Recent">⚡ Recent Release</option>
                            <option value="Official">🏛️ Official Website</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Textarea */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-300 block flex items-center justify-between">
                        <span>
                          {fulfillBulkMediaType === 'movie'
                            ? `Paste Multiple Movie Release Lines / URLs for "${fulfillingRequest.title}":`
                            : `Paste Multiple Episode & Zip Pack Lines for "${fulfillingRequest.title}":`}
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono">
                          {fulfillBulkMediaType === 'movie'
                            ? 'Auto-detects 4K UHD, 1080p, 720p, HDR, Dubs, and Sizes'
                            : 'Auto-detects S01/S02, Zip Packs vs Single EPs, Qualities, and Dubs'}
                        </span>
                      </label>
                      <textarea
                        rows={5}
                        placeholder={
                          fulfillBulkMediaType === 'movie'
                            ? `Paste multiple movie release lines or download URLs at once! Examples:\n${fulfillingRequest.title} 2160p UHD BluRay HEVC TrueHD Atmos 7.1 [Hindi DDP 5.1 + English] [24.5 GB] - https://hubcloud.cx/drive/movie4k\n${fulfillingRequest.title} 1080p FHD BluRay x264 [Hindi + English 5.1] [10.2 GB] - https://gdflix.dev/file/movie1080\n${fulfillingRequest.title} 720p HD WEB-DL [Hindi Dubbed] [2.1 GB] - https://mnmcloud.fun/files/movie720`
                            : `Paste multiple release lines or download URLs at once! Examples:\n${fulfillingRequest.title} S01E01 2160p WEB-DL Hindi DDP 5.1 [6.36 GB] - https://hubcloud.foo/video/1...\n${fulfillingRequest.title} S01E02 2160p WEB-DL Hindi DDP 5.1 [6.28 GB] - https://hubcloud.foo/video/2...\n${fulfillingRequest.title} S01 Complete 2160p UHD BluRay DV HDR [Hindi DDP 5.1 + English Atmos].zip https://mega.nz/file/3...`
                        }
                        value={fulfillBulkRawText}
                        onChange={(e) => setFulfillBulkRawText(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500 leading-relaxed shadow-inner"
                        autoFocus
                      />
                    </div>

                    {/* Real-time Parsed Results Preview */}
                    {fulfillBulkParsedItems.length > 0 && (
                      <div className="space-y-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-black text-white">
                              {fulfillBulkParsedItems.length} {fulfillBulkMediaType === 'movie' ? 'Movie Releases' : 'Links'} Auto-Detected:
                            </span>
                            {fulfillBulkMediaType === 'movie' ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[10px]">
                                🎬 {fulfillBulkParsedItems.length} Movie Releases
                              </span>
                            ) : (
                              <>
                                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 font-bold text-[10px]">
                                  📥 {fulfillBulkParsedItems.filter((i) => i.linkType === 'single_episode').length} Episodes
                                </span>
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[10px]">
                                  🗜️ {fulfillBulkParsedItems.filter((i) => i.linkType === 'zip_pack').length} Zip Packs
                                </span>
                              </>
                            )}
                          </div>

                          {/* Quick Bulk Convert Controls */}
                          <div className="flex items-center gap-2">
                            {fulfillBulkMediaType === 'movie' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleFulfillSetAllBulkCategory('Download')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-bold transition-colors"
                                  title="Set all movie items to Download"
                                >
                                  📥 Set All Download
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFulfillSetAllBulkCategory('Streaming')}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold transition-colors"
                                  title="Set all movie items to Streaming"
                                >
                                  🎬 Set All Streaming
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleFulfillSetAllBulkType('single_episode')}
                                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[10px] font-bold transition-colors"
                                  title="Convert all items to Single Episodes"
                                >
                                  📥 Set All as Episodes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFulfillSetAllBulkType('zip_pack')}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold transition-colors"
                                  title="Convert all items to Zip Packs"
                                >
                                  🗜️ Set All as Zip Packs
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                          {fulfillBulkParsedItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="overflow-hidden space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {fulfillBulkMediaType === 'movie' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextCat: CustomLink['category'] =
                                          item.category === 'Download' ? 'Streaming' : item.category === 'Streaming' ? 'Subtitles' : 'Download';
                                        setFulfillBulkParsedItems((prev) =>
                                          prev.map((i) => (i.id === item.id ? { ...i, category: nextCat } : i))
                                        );
                                      }}
                                      className="px-2 py-0.5 rounded font-black text-[9px] font-mono transition-all hover:scale-105 bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      title="Click to toggle category (Download / Streaming / Subtitles)"
                                    >
                                      {item.category === 'Download' ? '📥 DOWNLOAD' : item.category === 'Subtitles' ? '🌐 SUBTITLES' : '🎬 STREAMING'}
                                    </button>
                                  ) : (
                                    <>
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-black text-[9px] font-mono">
                                        S0{item.seasonNumber}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => handleFulfillToggleBulkItemType(item.id)}
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
                                onClick={() => setFulfillBulkParsedItems((prev) => prev.filter((i) => i.id !== item.id))}
                                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                        type="button"
                        onClick={handleFulfillBulkSubmit}
                        disabled={isFulfillingSubmit || fulfillBulkParsedItems.length === 0}
                        className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs shadow-lg shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      >
                        <ListPlus className="w-4 h-4" />
                        <span>{isFulfillingSubmit ? 'Importing Links...' : `🚀 Fulfill & Import All (${fulfillBulkParsedItems.length}) Links`}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ----------------- MODE 3: EPISODE GRID ----------------- */}
                {fulfillMode === 'grid' && (
                  <div className="space-y-4 pt-1 animate-fadeIn">
                    {/* Season & Episode Count Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800/80">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-300 block mb-1">Target Season:</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={fulfillGridSeason}
                          onChange={(e) => {
                            const s = Math.max(1, parseInt(e.target.value) || 1);
                            setFulfillGridSeason(s);
                            syncFulfillGridSlots(fulfillGridEpisodeCount, s, fulfillGridBasePattern, fulfillGridQuality, fulfillGridAudio, fulfillGridSize);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                          Episode Count <span className="text-sky-400">({fulfillGridEpisodeCount} Containers)</span>:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={fulfillGridEpisodeCount}
                            onChange={(e) => {
                              const c = Math.max(1, parseInt(e.target.value) || 1);
                              setFulfillGridEpisodeCount(c);
                              syncFulfillGridSlots(c, fulfillGridSeason, fulfillGridBasePattern, fulfillGridQuality, fulfillGridAudio, fulfillGridSize);
                            }}
                            className="w-20 bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                          />
                          <div className="flex flex-wrap items-center gap-1">
                            {[6, 8, 10, 12, 16, 24].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  setFulfillGridEpisodeCount(n);
                                  syncFulfillGridSlots(n, fulfillGridSeason, fulfillGridBasePattern, fulfillGridQuality, fulfillGridAudio, fulfillGridSize);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                                  fulfillGridEpisodeCount === n
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
                          value={fulfillGridQuality}
                          onChange={(e) => setFulfillGridQuality(e.target.value)}
                          placeholder="e.g. 2160p 4K, 1080p WEB-DL"
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-300 block mb-1">Default Audio:</label>
                        <input
                          type="text"
                          value={fulfillGridAudio}
                          onChange={(e) => setFulfillGridAudio(e.target.value)}
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
                            onClick={handleFulfillApplyPatternToAll}
                            className="text-[10px] text-sky-400 hover:text-sky-300 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 transition-colors"
                          >
                            ⚡ Apply Pattern to All Titles
                          </button>
                        </div>
                        <input
                          type="text"
                          value={fulfillGridBasePattern}
                          onChange={(e) => setFulfillGridBasePattern(e.target.value)}
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
                          value={fulfillGridBulkLinksText}
                          onChange={(e) => handleFulfillDistributeGridUrls(e.target.value)}
                          placeholder="Paste up to 8+ links here (one per line) — auto-fills into Link containers below!"
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-mono resize-none shadow-inner"
                        />
                      </div>
                    </div>

                    {/* The N Title and N Link Containers Grid */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          Episode Containers ({fulfillGridEpisodes.length} Episodes):
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          Filled: <strong className="text-sky-400">{fulfillGridEpisodes.filter((e) => e.url.trim()).length}</strong> / {fulfillGridEpisodes.length} Links
                        </span>
                      </div>

                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {fulfillGridEpisodes.map((ep) => (
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
                              </div>

                              {/* Title Input */}
                              <div className="md:col-span-5">
                                <input
                                  type="text"
                                  value={ep.title}
                                  onChange={(e) => handleFulfillUpdateGridSlot(ep.episodeNumber, 'title', e.target.value)}
                                  placeholder="Episode Title..."
                                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-medium"
                                />
                              </div>

                              {/* URL Input */}
                              <div className="md:col-span-5">
                                <input
                                  type="text"
                                  value={ep.url}
                                  onChange={(e) => handleFulfillUpdateGridSlot(ep.episodeNumber, 'url', e.target.value)}
                                  placeholder="https://hubcloud.foo/video/... or GDFlix URL"
                                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-sky-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
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
                        type="button"
                        onClick={handleFulfillGridSubmit}
                        disabled={isFulfillingSubmit || fulfillGridEpisodes.filter((e) => e.url.trim()).length === 0}
                        className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-sky-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" />
                        <span>{isFulfillingSubmit ? 'Saving Episodes...' : `🚀 Fulfill & Save All (${fulfillGridEpisodes.filter((e) => e.url.trim()).length}) Episode Containers`}</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
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
