'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Plus,
  Trash2,
  Pencil,
  Tv,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowUpRight,
  Play,
  Sparkles,
  Info,
  FileArchive,
  FileVideo,
  Layers,
  Film,
  ExternalLink,
  Copy,
  Flag,
} from 'lucide-react';
import { CustomLink, TitleDetails } from '@/types';
import { useWatchlist } from '@/context/WatchlistContext';
import {
  updateGlobalCustomLink,
  deleteGlobalCustomLink,
} from '@/lib/curatedLinks';
import {
  detectSeasonNumber,
  detectEpisodeNumber,
  detectLinkType,
  detectQuality,
  detectAudio,
  detectSize,
  getQualityWeight,
  parseFullMediaTitle,
  detectShowPlatform,
  stripWatermarks,
  extractEpisodeTitle,
  extractFilenameFromUrl,
  isPackMedia,
  isPackUrl,
} from '@/lib/seasonParser';
import { detectServer } from '@/lib/serverDetector';
import RequestLinkModal from './RequestLinkModal';
import ReportBrokenLinkModal, { ReportModalData } from './ReportBrokenLinkModal';

interface TVEpisodeLinksManagerProps {
  titleDetails: TitleDetails;
  customLinks: CustomLink[];
  isAdmin: boolean;
  onLinkAdded?: () => void;
}

interface EnrichedLink extends CustomLink {
  seasonNumber: number;
  episodeNumber?: number;
  linkType: 'zip_pack' | 'single_episode';
  quality: string;
  audioLanguage: string;
  size?: string;
  resolution: string;
  source: string;
}

interface ReleaseOption {
  id: string;
  title: string;
  seasonNumber: number;
  episodeCountLabel: string;
  audioLanguages: string;
  packs: EnrichedLink[];
  episodes: EnrichedLink[];
}

interface FormatGroup {
  id: string;
  resolution: string;
  source: string;
  options: ReleaseOption[];
}

interface GroupedEpisode {
  episodeNumber: number;
  title: string;
  size: string;
  links: EnrichedLink[];
}

// Extract rich release profiles including 4K SDR vs 4K DV HDR vs 1080p DV HDR vs 1080p SDR
function extractReleaseProfile(title: string, quality?: string, titleDetails?: TitleDetails, url?: string) {
  // Strip website domain watermarks (e.g. 4kHdHub.Com, TSS-4kHdHub.com, Vegamovies.NL, etc.) before checking resolution
  const urlFn = extractFilenameFromUrl(url);
  const cleanTitle = stripWatermarks(title || urlFn || '');
  const cleanQuality = stripWatermarks(quality || '');

  const titleLower = `${cleanTitle} ${urlFn}`.toLowerCase();
  const qHintLower = cleanQuality.toLowerCase();

  // 1. Resolution sensing (First analyze title directly, fallback to quality hint)
  let resolution = '1080p';
  let resTag = '1080p';

  if (/(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(titleLower)) {
    resolution = '1080p';
    resTag = '1080p';
  } else if (/(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(titleLower)) {
    resolution = '720p';
    resTag = '720p';
  } else if (/(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(titleLower)) {
    resolution = '480p';
    resTag = '480p';
  } else if (/(?:^|[\s._\-[\]()])(?:2160p|2160i|uhd|\b4k\b)(?:[\s._\-[\]()]|$)/i.test(titleLower)) {
    resolution = '2160p / 4K';
    resTag = '2160p';
  } else if (/(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|$)/i.test(qHintLower)) {
    resolution = '1080p';
    resTag = '1080p';
  } else if (/(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|$)/i.test(qHintLower)) {
    resolution = '720p';
    resTag = '720p';
  } else if (/(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|$)/i.test(qHintLower)) {
    resolution = '480p';
    resTag = '480p';
  } else if (/(?:^|[\s._\-[\]()])(?:2160p|2160i|uhd|\b4k\b)(?:[\s._\-[\]()]|$)/i.test(qHintLower)) {
    resolution = '2160p / 4K';
    resTag = '2160p';
  }

  // 2. Platform sensing (Detect accurate platform: DSNP for Disney+ Marvel/Star Wars, AMZN, NF, etc.)
  const platform = detectShowPlatform(cleanTitle || urlFn, titleDetails);

  // 3. Source sensing (Disney+ streaming series are official DSNP.WEB-DL, never REMUX or BluRay disc)
  let source = 'WEB-DL';
  if (platform === 'DSNP') {
    source = 'WEB-DL';
  } else if (/(?:^|[\s._\-[\]()])remux(?:[\s._\-[\]()]|$)/i.test(titleLower)) source = 'REMUX';
  else if (/(?:^|[\s._\-[\]()])(?:bluray|blu-ray|bdrip)(?:[\s._\-[\]()]|$)/i.test(titleLower)) source = 'BluRay';
  else if (/(?:^|[\s._\-[\]()])(?:web-dl|webdl|webrip|web)(?:[\s._\-[\]()]|$)/i.test(titleLower)) source = 'WEB-DL';
  else if (/(?:^|[\s._\-[\]()])hdtv(?:[\s._\-[\]()]|$)/i.test(titleLower)) source = 'HDTV';
  else if (qHintLower.includes('remux')) source = 'REMUX';
  else if (qHintLower.includes('bluray')) source = 'BluRay';

  // 4. Dynamic Range sensing (Sense DV HDR vs HDR vs SDR / simple H.265)
  const isSceneFilename =
    titleLower.includes('.mkv') ||
    titleLower.includes('.mp4') ||
    titleLower.includes('web-dl') ||
    titleLower.includes('webdl') ||
    titleLower.includes('bluray') ||
    titleLower.includes('remux');

  const hasDVInTitle = /(?:^|[\s._\-[\]()])(?:dv|dovi|dolby[.\s_-]*vision|hdr[-._]dv|dv[-._]hdr)(?:[\s._\-[\]()]|$)/i.test(titleLower);
  const hasHDRInTitle = /(?:^|[\s._\-[\]()])(?:hdr10\+|hdr10|hdr)(?:[\s._\-[\]()]|$)/i.test(titleLower);
  const hasSDRInTitle = /(?:^|[\s._\-[\]()])sdr(?:[\s._\-[\]()]|$)/i.test(titleLower);

  const hasDVInHint = /(?:^|[\s._\-[\]()])(?:dv|dovi|dolby[.\s_-]*vision|hdr[-._]dv|dv[-._]hdr)(?:[\s._\-[\]()]|$)/i.test(qHintLower);
  const hasHDRInHint = /(?:^|[\s._\-[\]()])(?:hdr10\+|hdr10|hdr)(?:[\s._\-[\]()]|$)/i.test(qHintLower);
  const hasSDRInHint = /(?:^|[\s._\-[\]()])sdr(?:[\s._\-[\]()]|$)/i.test(qHintLower);

  let dynamicRange = '';
  if (hasDVInTitle || (!isSceneFilename && hasDVInHint)) {
    dynamicRange = 'DV HDR';
  } else if (hasHDRInTitle || (!isSceneFilename && hasHDRInHint)) {
    dynamicRange = 'HDR';
  } else if (hasSDRInTitle || hasSDRInHint) {
    dynamicRange = 'SDR';
  } else if (resTag === '2160p') {
    // In 4K / 2160p: if it has NO DV and NO HDR, it is strictly 2160p SDR!
    dynamicRange = 'SDR';
  } else if (resTag === '1080p' && (/(?:h\.?265|x265|hevc)/i.test(titleLower) || qHintLower.includes('265') || qHintLower.includes('hevc'))) {
    // In 1080p: if it has H.265/HEVC and NO DV and NO HDR, it is strictly 1080p SDR!
    dynamicRange = 'SDR';
  }

  // 5. Codec sensing (Supports H.265, H265, HEVC, x265, H.264, x264, etc.)
  let codec = '';
  if (/(?:^|[\s._\-[\]()])(?:h\.?265|x265|hevc)/i.test(titleLower)) {
    codec = 'H.265';
  } else if (/(?:^|[\s._\-[\]()])(?:h\.?264|x264|avc)(?:[\s._\-[\]()]|$)/i.test(titleLower)) {
    codec = 'H.264';
  } else if (qHintLower.includes('h.265') || qHintLower.includes('265') || qHintLower.includes('hevc')) {
    codec = 'H.265';
  } else if (qHintLower.includes('h.264') || qHintLower.includes('264') || qHintLower.includes('avc')) {
    codec = 'H.264';
  } else {
    codec = resTag === '2160p' || hasDVInTitle || hasHDRInTitle ? 'H.265' : 'H.264';
  }

  // 6. Part sensing (e.g. Part 1, Part 2, Part-1, Part-2, pt1, pt2)
  let part = '';
  const partMatch = cleanTitle.match(/(?:^|[\s._\-[\]()])(?:part|pt)[\s._-]?0*(\d+)(?:[\s._\-[\]()]|$)/i);
  if (partMatch && partMatch[1]) {
    part = `Part-${parseInt(partMatch[1], 10)}`;
  }

  return {
    resolution,
    source,
    dynamicRange,
    codec,
    platform,
    part,
    cleanDisplayTitle: (showName: string, seasonNum: number) => {
      const sTag = `S${String(seasonNum).padStart(2, '0')}`;
      const cleanShow = (showName || 'Series').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '.');
      const partSeg = part ? `.${part.replace(/-/g, '.')}` : '';
      const dynSeg = dynamicRange ? `.${dynamicRange.replace(/\s+/g, '.')}` : '';
      const codecSeg = codec || (resTag === '2160p' ? 'H.265' : 'H.264');
      const platSeg = platform ? `.${platform}` : '';
      const effSource = platform === 'DSNP' ? 'WEB-DL' : source;
      return `${cleanShow}.${sTag}${partSeg}.${resTag}${platSeg}.${effSource}.DUAL.DDP5.1.Atmos${dynSeg}.${codecSeg}`;
    },
  };
}

interface ParsedOptionTitle {
  baseTitle: string;
  partTag: string;
  epSize: string;
  zipSize: string;
}

function parseOptionTitleAndTags(
  option: ReleaseOption,
  titleDetails: TitleDetails,
  seasonNum: number,
  groupRes: string,
  groupSource: string
): ParsedOptionTitle {
  const showName = titleDetails.name || titleDetails.title || 'Series';
  const rawTitle = option.title || '';

  // 1. Part tag
  let partTag = '';
  const partMatch =
    rawTitle.match(/(?:^|[\s._\-[\]()])(?:part|pt)[\s._-]?0*(\d+)(?:[\s._\-[\]()]|$)/i) ||
    (option.episodes[0]?.title || '').match(/(?:^|[\s._\-[\]()])(?:part|pt)[\s._-]?0*(\d+)(?:[\s._\-[\]()]|$)/i) ||
    (option.packs[0]?.title || '').match(/(?:^|[\s._\-[\]()])(?:part|pt)[\s._-]?0*(\d+)(?:[\s._\-[\]()]|$)/i);
  if (partMatch && partMatch[1]) {
    partTag = `Part-${parseInt(partMatch[1], 10)}`;
  }

  // 2. Base release title
  let baseTitle = stripWatermarks(rawTitle)
    .replace(/^Name\s*:\s*/i, '')
    .replace(/HUBCLOUD\s*=\s*/gi, '')
    .replace(/\[Part[-.\s]*\d+\]/gi, '')
    .replace(/\[\s*[\d.]+\s*(?:GB|MB)\s*\/\s*E\s*\]/gi, '')
    .replace(/\[\s*[\d.]+\s*(?:GB|MB)\s*Zip\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  baseTitle = baseTitle.replace(/\.(?:mkv|mp4|zip|rar)$/i, '');

  const correctPlat = detectShowPlatform(baseTitle, titleDetails);

  if (!baseTitle.includes('.') || baseTitle.includes('(')) {
    const prof = extractReleaseProfile(rawTitle, undefined, titleDetails);
    const sTag = `S${String(seasonNum).padStart(2, '0')}`;
    const cleanShow = showName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '.');
    const partSeg = partTag ? `.${partTag.replace(/-/g, '.')}` : '';
    const dynSeg = prof.dynamicRange ? `.${prof.dynamicRange.replace(/\s+/g, '.')}` : '';
    const resSeg = groupRes.replace(/\s*\/\s*/g, '.');
    const platSeg = prof.platform ? `.${prof.platform}` : '';
    const sourceSeg = prof.platform === 'DSNP' ? 'WEB-DL' : groupSource;
    const codecSeg = prof.codec || (resSeg.includes('2160') ? 'H.265' : 'H.264');
    baseTitle = `${cleanShow}.${sTag}${partSeg}.${resSeg}${platSeg}.${sourceSeg}.DUAL.DDP5.1.Atmos${dynSeg}.${codecSeg}`;
  } else {
    // If title has dot syntax, normalize platform & source tags according to verified platform
    if (correctPlat === 'DSNP') {
      // Disney+ titles MUST use DSNP.WEB-DL (never NF, never REMUX/BluRay)
      baseTitle = baseTitle
        .replace(/(?:^|\.)(?:NF|AMZN|ATVP|MAX|SLIV|SONYLIV|ZEE5|JIO)(?:\.(?:REMUX|BluRay|BDRip|WEB-DL|WEBRip))?(?=\.|$)/gi, '.DSNP.WEB-DL')
        .replace(/(?:^|\.)DSNP\.(?:REMUX|BluRay|BDRip)(?=\.|$)/gi, '.DSNP.WEB-DL');
      if (!baseTitle.includes('.DSNP.')) {
        baseTitle = baseTitle.replace(/(?:^|\.)(?:REMUX|BluRay|BDRip|WEB-DL|WEBRip)(?=\.|$)/i, '.DSNP.WEB-DL');
      }
    } else if (correctPlat) {
      // Normalize wrong NF tag on other known OTT services (e.g. Amazon The Boys, Apple Ted Lasso)
      baseTitle = baseTitle.replace(/(?:^|\.)NF(?=\.|$)/gi, `.${correctPlat}`);
    }
  }

  // 3. Episode size (per episode)
  let epSize = '';
  if (option.episodes.length > 0) {
    for (const ep of option.episodes) {
      const s = ep.size || detectSize(ep.title) || detectSize(ep.url);
      if (s) {
        epSize = s;
        break;
      }
    }
  }
  if (!epSize) {
    epSize = detectSize(rawTitle) || '';
  }

  // 4. Zip pack size
  let zipSize = '';
  if (option.packs.length > 0) {
    for (const pack of option.packs) {
      const s = pack.size || detectSize(pack.title) || detectSize(pack.url);
      if (s) {
        zipSize = s;
        break;
      }
    }
  }
  if (!zipSize && option.packs.length > 0) {
    zipSize = detectSize(rawTitle) || '';
  }

  return {
    baseTitle,
    partTag,
    epSize,
    zipSize,
  };
}

function formatEpisodeTitle(
  ep: EnrichedLink,
  option: ReleaseOption,
  titleDetails: TitleDetails,
  seasonNum: number,
  groupRes: string,
  groupSource: string
): string {
  const epNumStr = String(ep.episodeNumber || 1).padStart(2, '0');
  const sTag = `S${String(seasonNum).padStart(2, '0')}E${epNumStr}`;

  // If ep.title or ep.url is already an authentic scene release filename:
  const raw = (ep.title || '').trim();
  const urlFn = extractFilenameFromUrl(ep.url);
  const candidate = (raw && raw.includes('.')) ? raw : (urlFn || raw);

  if (candidate && /(?:s\d{1,2}e\d{1,2}|e\d{1,2})/i.test(candidate) && candidate.includes('.')) {
    let clean = stripWatermarks(candidate);
    const plat = detectShowPlatform(clean, titleDetails);
    if (plat === 'DSNP') {
      clean = clean
        .replace(/(?:^|\.)(?:NF|AMZN|ATVP|MAX)(?:\.(?:REMUX|BluRay|BDRip|WEB-DL|WEBRip))?(?=\.|$)/gi, '.DSNP.WEB-DL')
        .replace(/(?:^|\.)DSNP\.(?:REMUX|BluRay|BDRip)(?=\.|$)/gi, '.DSNP.WEB-DL');
    }
    return clean;
  }

  const { baseTitle } = parseOptionTitleAndTags(
    option,
    titleDetails,
    seasonNum,
    groupRes,
    groupSource
  );

  const sMatch = baseTitle.match(/S\d{2}/i);
  if (sMatch) {
    return `${baseTitle.replace(sMatch[0], sTag)}.mkv`;
  }

  return `${baseTitle}.${sTag}.mkv`;
}

function getResolutionBadgeStyle(resolution: string): string {
  if (resolution.includes('2160p') || resolution.includes('4K') || resolution.includes('4k')) {
    return 'bg-[#f59e0b] text-black font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
  }
  if (resolution.includes('1080p')) {
    return 'bg-[#14223d] text-blue-400 border border-[#1e3a6a] font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
  }
  if (resolution.includes('720p')) {
    return 'bg-[#221838] text-purple-400 border border-[#3b2960] font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
  }
  return 'bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold px-3 py-1 rounded-lg text-xs shadow-sm';
}

function formatAudioLanguages(audio?: string, title?: string): string {
  const combined = `${audio || ''} ${title || ''}`.toLowerCase();
  const list: string[] = [];
  if (combined.includes('hindi') || combined.includes('hin')) list.push('Hindi');
  if (combined.includes('english') || combined.includes('eng')) list.push('English');
  if (combined.includes('spanish') || combined.includes('spa')) list.push('Spanish');
  if (combined.includes('tamil') || combined.includes('tam')) list.push('Tamil');
  if (combined.includes('telugu') || combined.includes('tel')) list.push('Telugu');
  if (combined.includes('korean') || combined.includes('kor')) list.push('Korean');
  if (combined.includes('japanese') || combined.includes('jap')) list.push('Japanese');

  // DUAL audio on Indian streaming scene indicates Hindi + English
  if (combined.includes('dual')) {
    if (!list.includes('Hindi')) list.unshift('Hindi');
    if (!list.includes('English')) list.push('English');
  }

  if (list.length > 0) {
    return list.join(', ');
  }

  if (audio && audio !== 'Original' && audio !== 'English') {
    return audio.replace(/\s*•\s*/g, ', ').replace(/\s*\+\s*/g, ', ');
  }

  return 'Hindi, English, Spanish';
}

export const TVEpisodeLinksManager: React.FC<TVEpisodeLinksManagerProps> = ({
  titleDetails,
  customLinks,
  isAdmin,
  onLinkAdded,
}) => {
  const { removeCustomLink } = useWatchlist();
  const [sessionAdmin, setSessionAdmin] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('cinefuel_admin_auth');
      const user = sessionStorage.getItem('cinefuel_admin_user');
      setSessionAdmin(auth === 'true' && user === 'shyam');
    }
  }, []);

  const isEffectiveAdmin = isAdmin && sessionAdmin;

  // Open state for individual seasons: e.g. 5: true
  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});
  // Open mirror dropdown menu per episode or zip: e.g. "optionId_ep_1" or "optionId_zip"
  const [openMirrorMenu, setOpenMirrorMenu] = useState<string | null>(null);
  // Option ID currently being managed by admin
  const [managingOptionId, setManagingOptionId] = useState<string | null>(null);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [reportingLink, setReportingLink] = useState<ReportModalData | null>(null);

  // Click outside to dismiss open mirror dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMirrorMenu && !(e.target as HTMLElement).closest('.mirror-menu-container')) {
        setOpenMirrorMenu(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openMirrorMenu]);

  // Form states for Admin editing an existing link
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const [editSeason, setEditSeason] = useState<number>(1);
  const [editType, setEditType] = useState<'zip_pack' | 'single_episode'>('zip_pack');
  const [editEpisode, setEditEpisode] = useState<number>(1);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editUrl, setEditUrl] = useState<string>('');
  const [editQuality, setEditQuality] = useState<string>('');
  const [editAudio, setEditAudio] = useState<string>('');
  const [editSize, setEditSize] = useState<string>('');

  // User Selection States (Single Open Accordion Slide & Season Selection)
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [openSlideId, setOpenSlideId] = useState<string | null>(null);

  // Dynamically calculate all seasons in ascending order (Season 1, Season 2, Season 3...) matching screenshot
  const seasonsList = useMemo(() => {
    const detectedSeasons = new Set<number>();
    const tmdbSeasons = titleDetails.number_of_seasons || 1;
    for (let i = 1; i <= tmdbSeasons; i++) {
      detectedSeasons.add(i);
    }

    customLinks.forEach((link) => {
      const s = detectSeasonNumber(link);
      if (s > 0) detectedSeasons.add(s);
    });

    // Sort ascending (Season 1, Season 2, Season 3...) matching reference screenshot
    return Array.from(detectedSeasons).sort((a, b) => a - b);
  }, [titleDetails.number_of_seasons, customLinks]);

  // Enrich each custom link with smart auto-detected metadata
  const enrichedLinks: EnrichedLink[] = useMemo(() => {
    return customLinks.map((l) => {
      const urlFn = extractFilenameFromUrl(l.url);
      const effectiveTitle = l.title || urlFn || '';
      const isPack = isPackMedia(effectiveTitle, l.url);
      const detectedSeason = detectSeasonNumber({ title: effectiveTitle, seasonNumber: l.seasonNumber, url: l.url });
      const detectedEp = isPack ? undefined : detectEpisodeNumber({ title: effectiveTitle, episodeNumber: l.episodeNumber, url: l.url });
      const detectedType = detectLinkType({
        title: effectiveTitle,
        episodeNumber: detectedEp,
        url: l.url,
        linkType: isPack ? 'zip_pack' : l.linkType,
        category: isPack ? 'ZipPack' : l.category,
      });
      const isSceneRelease = /(?:s\d{1,2}e\d{1,2}|2160p|1080p|720p|480p|\.mkv|\.mp4|web-dl|webdl|bluray)/i.test(effectiveTitle);
      const detectedQ = (isSceneRelease || !l.quality || l.quality === 'HD')
        ? detectQuality(effectiveTitle, l.quality, l.url)
        : l.quality;
      const detectedAud = l.audioLanguage && l.audioLanguage !== 'Original' ? l.audioLanguage : detectAudio(effectiveTitle, l.audioLanguage, l.url);
      const detectedSz = l.size || detectSize(effectiveTitle, undefined, l.url);
      const prof = extractReleaseProfile(effectiveTitle, detectedQ, titleDetails, l.url);

      const finalTitle = (isSceneRelease && effectiveTitle.includes('.'))
        ? stripWatermarks(effectiveTitle)
        : (urlFn && /\.(?:mkv|mp4)/i.test(urlFn))
          ? stripWatermarks(urlFn)
          : (l.title || '');

      return {
        ...l,
        title: finalTitle,
        seasonNumber: detectedSeason,
        episodeNumber: detectedEp,
        linkType: detectedType,
        category: detectedType === 'zip_pack' ? 'ZipPack' : l.category,
        quality: detectedQ,
        audioLanguage: detectedAud,
        size: detectedSz,
        resolution: prof.resolution,
        source: prof.source,
      };
    });
  }, [customLinks, titleDetails]);

  // Group enriched links by Season -> Format Groups (2160p / 4K DV HDR, 2160p / 4K SDR, 1080p...) -> Release Options
  const seasonGroupsMap = useMemo(() => {
    const map = new Map<number, FormatGroup[]>();
    const showName = titleDetails.name || titleDetails.title || 'Series';

    seasonsList.forEach((s) => {
      const currentSeasonLinks = enrichedLinks.filter((l) => l.seasonNumber === s);
      if (currentSeasonLinks.length === 0) {
        map.set(s, []);
        return;
      }

      // Group by format key: resolution + source + dynamicRange + codec (e.g. "1080p_WEB-DL_DV_HDR_H.265", "1080p_WEB-DL_SDR_H.265")
      const formatMap = new Map<string, { resolution: string; source: string; links: EnrichedLink[] }>();

      currentSeasonLinks.forEach((link) => {
        const prof = extractReleaseProfile(link.title, link.quality, titleDetails, link.url);
        const dyn = prof.dynamicRange || (prof.codec === 'H.265' ? 'SDR' : '');
        const dynSuffix = dyn ? `_${dyn.replace(/\s+/g, '_')}` : '';
        const codecSuffix = prof.codec ? `_${prof.codec.replace(/\s+/g, '_')}` : '';
        const key = `${link.resolution}_${link.source}${dynSuffix}${codecSuffix}`;
        if (!formatMap.has(key)) {
          formatMap.set(key, {
            resolution: link.resolution,
            source: link.source,
            links: [],
          });
        }
        formatMap.get(key)!.links.push(link);
      });

      const formats: FormatGroup[] = [];

      formatMap.forEach((fVal, fKey) => {
        // Group links inside this format by release profile (Separate 4K DV HDR vs 4K SDR vs 1080p DV HDR vs 1080p SDR)
        const optionsMap = new Map<
          string,
          {
            id: string;
            title: string;
            seasonNumber: number;
            audioLanguages: string;
            packs: EnrichedLink[];
            episodes: EnrichedLink[];
          }
        >();

        fVal.links.forEach((link) => {
          const prof = extractReleaseProfile(link.title, link.quality, titleDetails, link.url);
          const partSuffix = prof.part ? `_${prof.part}` : '';
          const optKey = `s${s}_${fKey}_${prof.dynamicRange || 'std'}_${prof.codec || 'codec'}${partSuffix}`;

          if (!optionsMap.has(optKey)) {
            let optTitle = link.title;
            if (optTitle.includes('.mkv') || optTitle.includes('.zip') || !optTitle.includes('(')) {
              optTitle = prof.cleanDisplayTitle(showName, s);
            }

            optionsMap.set(optKey, {
              id: optKey,
              title: optTitle,
              seasonNumber: s,
              audioLanguages: formatAudioLanguages(link.audioLanguage, link.title),
              packs: [],
              episodes: [],
            });
          }

          const opt = optionsMap.get(optKey)!;
          if (link.linkType === 'zip_pack' || link.category === 'ZipPack' || isPackMedia(link.title, link.url)) {
            opt.packs.push(link);
          } else {
            opt.episodes.push(link);
          }
        });

        const options: ReleaseOption[] = [];

        optionsMap.forEach((optVal) => {
          // Intelligent Auto-Recovery:
          // If no episodes were detected, but multiple links are in packs:
          // A TV season release never has multiple zip packs on the same server unless they are different parts/providers!
          // Separate true zip/rar/pack links from episode links.
          if (optVal.episodes.length === 0 && optVal.packs.length > 1) {
            const realPacks: EnrichedLink[] = [];
            const recoveredEpisodes: EnrichedLink[] = [];

            optVal.packs.forEach((p, idx) => {
              const isPack = isPackMedia(p.title, p.url) || p.linkType === 'zip_pack' || p.category === 'ZipPack';

              if (isPack) {
                realPacks.push(p);
              } else {
                const epNum = p.episodeNumber || detectEpisodeNumber(p) || idx + 1;
                recoveredEpisodes.push({
                  ...p,
                  episodeNumber: epNum,
                  linkType: 'single_episode',
                  category: 'SingleEpisode',
                });
              }
            });

            if (recoveredEpisodes.length > 0 && realPacks.length > 0) {
              optVal.episodes = recoveredEpisodes;
              optVal.packs = realPacks;
            } else if (recoveredEpisodes.length > 0 && realPacks.length === 0) {
              optVal.episodes = recoveredEpisodes;
              optVal.packs = [];
            }
          }

          // Ensure every episode has a valid positive integer episodeNumber
          optVal.episodes.forEach((ep, idx) => {
            if (!ep.episodeNumber || ep.episodeNumber <= 0) {
              ep.episodeNumber = detectEpisodeNumber(ep) || idx + 1;
            }
          });

          let epCount = '10';
          if (optVal.episodes.length > 0) {
            epCount = `${optVal.episodes.length}`;
          } else if (optVal.packs.length > 0) {
            const firstPack = optVal.packs[0];
            const epMatch = firstPack.title.match(/(?:episodes?\s*|e\d{1,2}\s*-\s*e?|total\s*)(\d{1,3})/i);
            epCount = epMatch
              ? epMatch[1]
              : titleDetails.number_of_episodes
              ? `${titleDetails.number_of_episodes}`
              : '10';
          }

          options.push({
            id: optVal.id,
            title: optVal.title,
            seasonNumber: s,
            episodeCountLabel: `Episodes ${epCount}`,
            audioLanguages: optVal.audioLanguages,
            packs: optVal.packs,
            episodes: optVal.episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0)),
          });
        });

        // Sort options: DV HDR first, then SDR, then others
        options.sort((a, b) => {
          const orderA = a.title.includes('DV') || a.title.includes('HDR') ? 2 : a.title.includes('SDR') ? 1 : 0;
          const orderB = b.title.includes('DV') || b.title.includes('HDR') ? 2 : b.title.includes('SDR') ? 1 : 0;
          return orderB - orderA;
        });

        formats.push({
          id: `s${s}_${fKey}`,
          resolution: fVal.resolution,
          source: fVal.source,
          options,
        });
      });

      // Sort formats: 2160p / 4K > 1080p > 720p > 480p
      formats.sort((a, b) => getQualityWeight(b.resolution) - getQualityWeight(a.resolution));
      map.set(s, formats);
    });

    return map;
  }, [seasonsList, enrichedLinks, titleDetails]);

  // Auto-select season with links on initial load or default to seasonsList[0]
  useEffect(() => {
    if (seasonsList.length > 0 && !seasonsList.includes(selectedSeason)) {
      const firstSeasonWithLinks =
        seasonsList.find((s) => {
          const fmts = seasonGroupsMap.get(s);
          return fmts && fmts.length > 0;
        }) || seasonsList[0];
      setSelectedSeason(firstSeasonWithLinks);
    }
  }, [seasonsList, seasonGroupsMap, selectedSeason]);

  // Active season packs for selectedSeason
  const activeSeasonPacks = useMemo(() => {
    const showName = titleDetails.name || titleDetails.title || 'Series';
    const formats = seasonGroupsMap.get(selectedSeason) || [];
    const results: Array<{
      optionId: string;
      resolution: string;
      source: string;
      title: string;
      codec?: string;
      dynamicRange?: string;
      audioLanguages: string;
      packs: EnrichedLink[];
      size: string;
    }> = [];

    formats.forEach((fmt) => {
      fmt.options.forEach((opt) => {
        if (opt.packs.length > 0) {
          const first = opt.packs[0];
          const detectedSz = first.size || detectSize(first.title) || detectSize(undefined, undefined, first.url) || '';
          const urlFn = extractFilenameFromUrl(first.url);
          let rawPackTitle = first.title || opt.title || '';
          if (urlFn && (/\.(?:zip|rar|7z|tar|mkv|mp4)$/i.test(urlFn) || /(?:2160p|1080p|720p|s\d{1,2}|season)/i.test(urlFn))) {
            if (!rawPackTitle || rawPackTitle.length < 15 || !/(?:2160p|1080p|720p|web-dl|h\.?26[45])/i.test(rawPackTitle)) {
              rawPackTitle = urlFn;
            }
          }
          let cleanPackTitle = stripWatermarks(rawPackTitle);
          if (!cleanPackTitle || cleanPackTitle.length < 5 || /^p[0-9a-z]{10,}$/i.test(cleanPackTitle) || cleanPackTitle.startsWith('http')) {
            cleanPackTitle = `${showName} S0${selectedSeason} Complete Pack (${fmt.resolution} ${fmt.source})`;
          }
          const finalPackTitle = cleanPackTitle || rawPackTitle || opt.title;
          const prof = extractReleaseProfile(finalPackTitle, first.quality, titleDetails, first.url);

          results.push({
            optionId: opt.id,
            resolution: fmt.resolution,
            source: fmt.source,
            title: finalPackTitle,
            codec: prof.codec,
            dynamicRange: prof.dynamicRange,
            audioLanguages: opt.audioLanguages,
            packs: opt.packs,
            size: detectedSz,
          });
        }
      });
    });

    return results;
  }, [selectedSeason, seasonGroupsMap, titleDetails]);

  // Group format releases by quality into dedicated quality slides (e.g. 2160p DV HDR, 2160p SDR, 1080p, 720p, 480p)
  const qualitySlides = useMemo(() => {
    const formats = seasonGroupsMap.get(selectedSeason) || [];

    const getQualitySlideInfo = (
      res: string,
      source: string,
      dynamicRange?: string,
      codec?: string,
      sampleTitle?: string,
      sampleUrl?: string
    ) => {
      const urlFn = extractFilenameFromUrl(sampleUrl);
      const rLower = (res || '').toLowerCase();
      const tLower = `${sampleTitle || ''} ${urlFn}`.toLowerCase();
      const src = source && source !== 'Unknown' ? source.replace(/[^a-zA-Z0-9-]/g, '') : 'WebDL';

      // 1. Detect Resolution
      let resTag = '1080p';
      let baseWeight = 200;
      if (rLower.includes('2160') || rLower.includes('4k') || rLower.includes('uhd') || /(?:2160p|2160i|\buhd\b|\b4k\b)/i.test(tLower)) {
        resTag = '2160p';
        baseWeight = 400;
      } else if (rLower.includes('1080') || rLower.includes('fhd') || /(?:1080p|1080i|\bfhd\b)/i.test(tLower)) {
        resTag = '1080p';
        baseWeight = 300;
      } else if (rLower.includes('720') || rLower.includes('hd') || /(?:720p|720i|\bhd\b)/i.test(tLower)) {
        resTag = '720p';
        baseWeight = 200;
      } else if (rLower.includes('480') || rLower.includes('sd') || /(?:480p|480i|\bsd\b)/i.test(tLower)) {
        resTag = '480p';
        baseWeight = 100;
      }

      // 2. Detect Dynamic Range (DV HDR vs HDR vs SDR)
      let dyn = (dynamicRange || '').trim();
      if (!dyn) {
        if (/(?:dv|dovi|dolby[.\s_-]*vision|hdr[-._]dv|dv[-._]hdr)/i.test(tLower)) {
          dyn = 'DV HDR';
        } else if (/(?:hdr10\+|hdr10|hdr)/i.test(tLower)) {
          dyn = 'HDR';
        } else if (/sdr/i.test(tLower)) {
          dyn = 'SDR';
        } else if (resTag === '2160p') {
          dyn = 'SDR';
        } else if (resTag === '1080p' && /(?:h\.?265|x265|hevc)/i.test(tLower)) {
          dyn = 'SDR';
        }
      }

      // 3. Detect 10bit / HEVC
      const is10Bit = /10bit|10-bit/i.test(tLower);
      const isHEVC = /hevc|x265|h\.?265/i.test(tLower) || codec === 'H.265' || resTag === '2160p';

      // 4. Construct Key & Title per resolution:
      if (resTag === '2160p') {
        const codecLabel = isHEVC ? ' H.265' : '';
        if (dyn === 'DV HDR' || dyn === 'DV') {
          return {
            key: '2160p_dv_hdr_h265',
            title: `2160p 4K DV HDR${codecLabel} ${src}`,
            badge: `2160p DV HDR${codecLabel}`,
            resolution: '2160p / 4K',
            accentBorder: 'border-l-4 border-l-fuchsia-500',
            weight: 450,
          };
        } else if (dyn === 'HDR') {
          return {
            key: '2160p_hdr_h265',
            title: `2160p 4K HDR${codecLabel} ${src}`,
            badge: `2160p HDR${codecLabel}`,
            resolution: '2160p / 4K',
            accentBorder: 'border-l-4 border-l-purple-500',
            weight: 440,
          };
        } else {
          return {
            key: '2160p_sdr_h265',
            title: `2160p 4K SDR${codecLabel} ${src}`,
            badge: `2160p SDR${codecLabel}`,
            resolution: '2160p / 4K',
            accentBorder: 'border-l-4 border-l-blue-500',
            weight: 420,
          };
        }
      }

      if (resTag === '1080p') {
        const codecLabel = isHEVC ? ' H.265' : '';
        if (dyn === 'DV HDR' || dyn === 'DV') {
          return {
            key: '1080p_dv_hdr_h265',
            title: `1080p DV HDR${codecLabel} ${src}`,
            badge: `1080p DV HDR${codecLabel}`,
            resolution: '1080p',
            accentBorder: 'border-l-4 border-l-fuchsia-400',
            weight: 390,
          };
        } else if (dyn === 'HDR') {
          return {
            key: '1080p_hdr_h265',
            title: `1080p HDR${codecLabel} ${src}`,
            badge: `1080p HDR${codecLabel}`,
            resolution: '1080p',
            accentBorder: 'border-l-4 border-l-indigo-400',
            weight: 380,
          };
        } else if (is10Bit && isHEVC) {
          return {
            key: '1080p_hevc_10bit',
            title: `1080p 10-bit HEVC ${src}`,
            badge: '1080p HEVC 10bit',
            resolution: '1080p',
            accentBorder: 'border-l-4 border-l-emerald-400',
            weight: 360,
          };
        } else if (isHEVC || dyn === 'SDR') {
          return {
            key: '1080p_sdr_h265',
            title: `1080p SDR H.265 ${src}`,
            badge: '1080p SDR H.265',
            resolution: '1080p',
            accentBorder: 'border-l-4 border-l-sky-500',
            weight: 340,
          };
        } else {
          return {
            key: '1080p_webdl',
            title: `1080p ${src}`,
            badge: '1080p',
            resolution: '1080p',
            accentBorder: 'border-l-4 border-l-cyan-400',
            weight: 300,
          };
        }
      }

      if (resTag === '720p') {
        const codecLabel = isHEVC ? ' HEVC' : '';
        if (dyn === 'DV HDR' || dyn === 'DV') {
          return {
            key: '720p_dv_hdr',
            title: `720p DV HDR${codecLabel} ${src}`,
            badge: `720p DV HDR${codecLabel}`,
            resolution: '720p',
            accentBorder: 'border-l-4 border-l-fuchsia-400',
            weight: 270,
          };
        } else if (dyn === 'HDR') {
          return {
            key: '720p_hdr',
            title: `720p HDR${codecLabel} ${src}`,
            badge: `720p HDR${codecLabel}`,
            resolution: '720p',
            accentBorder: 'border-l-4 border-l-indigo-400',
            weight: 260,
          };
        } else if (is10Bit && isHEVC) {
          return {
            key: '720p_hevc_10bit',
            title: `720p 10-bit HEVC ${src}`,
            badge: '720p HEVC 10bit',
            resolution: '720p',
            accentBorder: 'border-l-4 border-l-emerald-400',
            weight: 250,
          };
        } else if (isHEVC) {
          return {
            key: '720p_hevc',
            title: `720p HEVC ${src}`,
            badge: '720p HEVC',
            resolution: '720p',
            accentBorder: 'border-l-4 border-l-teal-400',
            weight: 240,
          };
        } else {
          return {
            key: '720p_webdl',
            title: `720p HD ${src}`,
            badge: '720p',
            resolution: '720p',
            accentBorder: 'border-l-4 border-l-teal-400',
            weight: 200,
          };
        }
      }

      return {
        key: '480p_webdl',
        title: `480p SD ${src}`,
        badge: '480p',
        resolution: '480p',
        accentBorder: 'border-l-4 border-l-slate-400',
        weight: 100,
      };
    };

    const slidesMap = new Map<
      string,
      {
        key: string;
        title: string;
        resolution: string;
        source: string;
        dynamicRange?: string;
        accentBorder: string;
        weight: number;
        options: ReleaseOption[];
        episodes: Array<{
          episodeNumber: number;
          title: string;
          episodeName: string;
          size: string;
          audio: string;
          codec?: string;
          dynamicRange?: string;
          links: EnrichedLink[];
        }>;
      }
    >();

    formats.forEach((fmt) => {
      fmt.options.forEach((opt) => {
        const sample = opt.episodes[0] || opt.packs[0];
        const sampleTitle = sample?.title || opt.title;
        const prof = extractReleaseProfile(sampleTitle, sample?.quality, titleDetails, sample?.url);

        const info = getQualitySlideInfo(
          fmt.resolution,
          fmt.source,
          prof.dynamicRange,
          prof.codec,
          sampleTitle,
          sample?.url
        );

        if (!slidesMap.has(info.key)) {
          slidesMap.set(info.key, {
            key: info.key,
            title: info.title,
            resolution: info.resolution,
            source: fmt.source || 'WEB-DL',
            dynamicRange: prof.dynamicRange,
            accentBorder: info.accentBorder,
            weight: info.weight,
            options: [],
            episodes: [],
          });
        }

        slidesMap.get(info.key)!.options.push(opt);
      });
    });

    // Populate unique episodes per slide
    slidesMap.forEach((slide) => {
      const epMap = new Map<
        number,
        {
          episodeNumber: number;
          title: string;
          episodeName: string;
          size: string;
          audio: string;
          codec?: string;
          dynamicRange?: string;
          links: EnrichedLink[];
        }
      >();

      slide.options.forEach((opt) => {
        opt.episodes.forEach((ep) => {
          const epNum = ep.episodeNumber || 1;
          if (!epMap.has(epNum)) {
            const detectedSz = ep.size || detectSize(ep.title) || detectSize(undefined, undefined, ep.url) || '';
            const epFormattedTitle = formatEpisodeTitle(
              ep,
              opt,
              titleDetails,
              selectedSeason,
              slide.resolution,
              slide.source
            );
            const epName = extractEpisodeTitle(ep.title) || extractEpisodeTitle(epFormattedTitle);
            const prof = extractReleaseProfile(ep.title || epFormattedTitle, ep.quality, titleDetails, ep.url);

            epMap.set(epNum, {
              episodeNumber: epNum,
              title: epFormattedTitle,
              episodeName: epName,
              size: detectedSz,
              audio: opt.audioLanguages,
              codec: prof.codec,
              dynamicRange: prof.dynamicRange || slide.dynamicRange,
              links: [],
            });
          }
          epMap.get(epNum)!.links.push(ep);
        });
      });

      slide.episodes = Array.from(epMap.values()).sort((a, b) => a.episodeNumber - b.episodeNumber);
    });

    // If no format groups exist yet for this season, present standard 1080p and 720p slides
    if (slidesMap.size === 0) {
      return [
        {
          key: '1080p_webdl',
          title: '1080p WebDL',
          resolution: '1080p',
          source: 'WEB-DL',
          accentBorder: 'border-l-4 border-l-cyan-400',
          weight: 300,
          options: [],
          episodes: [],
        },
        {
          key: '720p_webdl',
          title: '720p WebDL',
          resolution: '720p',
          source: 'WEB-DL',
          accentBorder: 'border-l-4 border-l-teal-400',
          weight: 200,
          options: [],
          episodes: [],
        },
      ];
    }

    // Sort: highest quality first (2160p DV HDR > 2160p HDR > 2160p SDR > 1080p HEVC > 1080p > 720p > 480p)
    return Array.from(slidesMap.values()).sort((a, b) => b.weight - a.weight);
  }, [seasonGroupsMap, selectedSeason, titleDetails]);

  // Accordion toggle: clicking an open tab minimizes it, clicking a minimized tab maximizes it & closes other tabs
  const toggleSlide = (slideKey: string) => {
    setOpenSlideId((prev) => (prev === slideKey ? null : slideKey));
  };

  // Keep all tabs minimized by default and reset to minimized when switching seasons
  useEffect(() => {
    setOpenSlideId(null);
  }, [selectedSeason]);

  const handleStartEdit = (link: CustomLink) => {
    setEditingLink(link);
    setEditSeason(link.seasonNumber || 1);
    setEditType(link.linkType === 'single_episode' ? 'single_episode' : 'zip_pack');
    setEditEpisode(link.episodeNumber || 1);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditQuality(link.quality || '');
    setEditAudio(link.audioLanguage || '');
    setEditSize(link.size || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editTitle.trim() || !editUrl.trim()) return;

    let finalUrl = editUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    const parsed = parseFullMediaTitle(editTitle.trim());

    const updatedLink: CustomLink = {
      ...editingLink,
      title: editTitle.trim(),
      url: finalUrl,
      category: editType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
      seasonNumber: editSeason,
      episodeNumber: editType === 'single_episode' ? editEpisode : undefined,
      quality: editQuality.trim() || parsed.quality || editingLink.quality,
      audioLanguage: editAudio.trim() || parsed.audioLanguage || editingLink.audioLanguage,
      size: editSize.trim() || parsed.size || editingLink.size,
      linkType: editType,
    };

    updateGlobalCustomLink(titleDetails.id, updatedLink);
    setEditingLink(null);
    if (onLinkAdded) onLinkAdded();
  };

  const handleDelete = async (linkId: string) => {
    if (confirm('Delete this TV link permanently?')) {
      removeCustomLink(titleDetails.id, linkId);
      if (onLinkAdded) onLinkAdded();
      await deleteGlobalCustomLink(titleDetails.id, linkId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Admin Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg sm:text-xl font-bold text-white">Season & Episode Vault</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Select format (4K DV HDR, 4K SDR, 1080p, 720p) and release packages to access direct episode & zip downloads.
          </p>
        </div>

        {isEffectiveAdmin && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
            <a
              href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 font-bold text-xs transition-all hover:bg-zinc-800 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
              <span>Admin File Uploader ↗</span>
            </a>
          </div>
        )}
      </div>

      {/* 1. SELECT SEASON (media_1790848168477.png reference design) */}
      <div className="rounded-3xl bg-[#0c0d13] border border-white/5 p-5 sm:p-6 shadow-2xl space-y-3.5">
        <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase block">
          SELECT SEASON
        </label>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {seasonsList.map((s) => {
            const isActive = selectedSeason === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSeason(s)}
                className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-[0_4px_24px_rgba(59,130,246,0.65)] border border-blue-400/40 scale-[1.02]'
                    : 'bg-[#14161f] hover:bg-[#1f2230] text-zinc-300 hover:text-white border border-white/5'
                }`}
              >
                SEASON {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Choose a Download Option Header & Accordion Cards (media_1790899727140.png) */}
      <div className="space-y-4">
        {/* Section Title */}
        <div className="space-y-1.5 pt-2 pb-1">
          <p className="text-xs font-bold tracking-widest text-sky-400 uppercase">
            CHOOSE A DOWNLOAD OPTION
          </p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Open download links
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium">
            Select the type of links you want to view.
          </p>
        </div>

        {/* SLIDE: Full Collection / Zip Archive */}
        <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 border-l-4 border-l-cyan-400 shadow-xl transition-all duration-300 bg-[#0e1322]/95 hover:bg-[#12182c]/95">
          {/* Card Button matching media_1790899727140.png */}
          <button
            type="button"
            onClick={() => toggleSlide('zip')}
            className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none focus:outline-none transition-colors"
          >
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-[#1c243a] border border-[#2b3756] flex items-center justify-center text-cyan-400 shadow-inner shrink-0">
                <ArrowUpRight className="w-5 h-5 text-cyan-400" />
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold tracking-widest text-sky-400 uppercase">
                    FULL COLLECTION / SEASON PACKS
                  </p>
                  {activeSeasonPacks.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {activeSeasonPacks.reduce((acc, r) => acc + r.packs.length, 0)} Available
                    </span>
                  )}
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight truncate">
                  Zip Archive / Season Packs
                </h4>
                <p className="text-xs text-zinc-400 font-medium truncate">
                  Complete Season Packs · GDrive · HubCloud · All Episodes in One Link
                </p>
              </div>
            </div>

            <div className="text-zinc-400 shrink-0 p-1">
              {openSlideId === 'zip' ? (
                <ChevronDown className="w-5 h-5 text-zinc-300 transition-transform duration-200" />
              ) : (
                <ChevronRight className="w-5 h-5 text-zinc-400 transition-transform duration-200" />
              )}
            </div>
          </button>

          {/* Expanded Body for Zip Archive */}
          {openSlideId === 'zip' && (
            <div className="bg-[#090c15] p-4 sm:p-6 space-y-4 animate-fadeIn border-t border-white/10">
              {activeSeasonPacks.length > 0 ? (
                <div className="space-y-2.5">
                  {activeSeasonPacks.map((packRel) => {
                    return packRel.packs.map((primaryPack, pIdx) => {
                      const destinationUrl = primaryPack?.url || '#';
                      const server = detectServer(destinationUrl);
                      const serverName = server.name || 'HubCloud';
                      const packTitle = primaryPack.title && !primaryPack.title.startsWith('http') && !/^p[0-9a-z]{10,}$/i.test(primaryPack.title)
                        ? primaryPack.title
                        : packRel.title;
                      const detectedSz = primaryPack.size || detectSize(primaryPack.title) || detectSize(undefined, undefined, primaryPack.url) || packRel.size;

                      return (
                        <div
                          key={`${primaryPack.id || pIdx}-${packRel.optionId}`}
                          className="group relative rounded-2xl bg-[#0e111a] hover:bg-[#131724] border border-white/5 hover:border-amber-500/40 p-3.5 sm:p-4.5 transition-all shadow-md hover:shadow-amber-500/10 flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          {/* Direct Clickable Release Filename redirecting directly to HubCloud / GDFlix */}
                          <a
                            href={destinationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 min-w-0 flex-1 select-none cursor-pointer"
                            title={`Click to download ${packTitle} on ${serverName}`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all shadow-inner">
                              <FileArchive className="w-4 h-4" />
                            </div>

                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-amber-300 group-hover:underline transition-colors break-all">
                                  {packTitle}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-amber-400/70 group-hover:text-amber-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] text-zinc-400">
                                <span className="font-semibold text-amber-400">
                                  {packRel.resolution} {packRel.source}
                                </span>
                                {detectedSz && (
                                  <span className="font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                    {detectedSz}
                                  </span>
                                )}
                                {packRel.dynamicRange && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                    {packRel.dynamicRange}
                                  </span>
                                )}
                                {packRel.codec && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                    {packRel.codec}
                                  </span>
                                )}
                                {packRel.audioLanguages && (
                                  <span className="text-zinc-500">
                                    🔊 {packRel.audioLanguages}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  {serverName} Pack
                                </span>
                              </div>
                            </div>
                          </a>

                          {/* Report Broken Link Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportingLink({
                                linkId: primaryPack?.id,
                                movieId: titleDetails.id,
                                mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                                mediaType: 'tv',
                                posterPath: titleDetails.poster_path,
                                linkTitle: packTitle,
                                reportedUrl: destinationUrl,
                                quality: packRel.resolution,
                                server: serverName,
                              });
                            }}
                            className="p-2 sm:p-2.5 rounded-xl bg-[#141824] hover:bg-[#1d2335] text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer shrink-0 self-end md:self-center"
                            title="Report broken or defective pack link"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>

                          {/* Admin Controls (Only visible to admin) */}
                          {isEffectiveAdmin && primaryPack && (
                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(primaryPack);
                                }}
                                className="p-2 sm:p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors cursor-pointer"
                                title="Admin: Edit pack link"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(primaryPack.id);
                                }}
                                className="p-2 sm:p-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-900/50 transition-colors cursor-pointer"
                                title="Admin: Delete pack link"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-[#0c0d13] border border-white/5 text-center space-y-3.5 shadow-xl">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h4 className="text-white font-bold text-base sm:text-lg">
                    No Complete Season {selectedSeason} Zip Packs Uploaded Yet
                  </h4>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                    Single episodes are available in the quality slides below! You can also request a complete season pack zip archive.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsRequestModalOpen(true)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Request Season {selectedSeason} Zip Pack</span>
                    </button>
                    {isEffectiveAdmin && (
                      <a
                        href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Upload in Admin ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SLIDES: Episode-Wise Quality Slides (e.g. 2160p 4K, 1080p, 720p, 480p) */}
        {qualitySlides.map((slide) => {
          const isOpen = openSlideId === slide.key;
          const episodesCount = slide.episodes.length;

          return (
            <div
              key={slide.key}
              className={`rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 ${slide.accentBorder || 'border-l-4 border-l-cyan-400'} shadow-xl transition-all duration-300 bg-[#0e1322]/95 hover:bg-[#12182c]/95`}
            >
              {/* Quality Card Button matching media_1790899727140.png */}
              <button
                type="button"
                onClick={() => toggleSlide(slide.key)}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none focus:outline-none transition-colors"
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-[#1c243a] border border-[#2b3756] flex items-center justify-center text-white shadow-inner shrink-0">
                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-[11px] font-bold tracking-widest text-sky-400 uppercase">
                      INDIVIDUAL EPISODES
                    </p>
                    <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight truncate">
                      {slide.title}
                    </h4>
                    <p className="text-xs text-zinc-400 font-medium truncate">
                      Episode Wise · GDrive · HubCloud · Download Links
                    </p>
                  </div>
                </div>

                <div className="text-zinc-400 shrink-0 p-1">
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-zinc-300 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-zinc-400 transition-transform duration-200" />
                  )}
                </div>
              </button>

              {/* Expanded Body for this Quality */}
              {isOpen && (
                <div className="bg-[#090c15] p-4 sm:p-6 space-y-5 animate-fadeIn border-t border-white/10">
                  {episodesCount > 0 ? (
                    <div className="space-y-2.5">
                      {slide.episodes.map((ep) => {
                        const primaryLink = ep.links[0];
                        const server = primaryLink ? detectServer(primaryLink.url) : { name: 'HubCloud' };
                        const serverName = server.name || 'HubCloud';

                        return (
                          <div
                            key={ep.episodeNumber}
                            className="group relative rounded-2xl bg-[#0e111a] hover:bg-[#131724] border border-white/5 hover:border-blue-500/40 p-3.5 sm:p-4.5 transition-all shadow-md hover:shadow-blue-500/10 flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            {/* Direct Clickable Link to destination HubCloud / GDFlix */}
                            <a
                              href={primaryLink?.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-0 flex items-start sm:items-center gap-3 select-none cursor-pointer"
                              title={`Click to open ${ep.title} on ${serverName}`}
                            >
                              {/* E01 Badge */}
                              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-xl bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/40 text-blue-300 font-mono font-black text-xs shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                                E{ep.episodeNumber < 10 ? `0${ep.episodeNumber}` : ep.episodeNumber}
                              </span>

                              <div className="space-y-1 min-w-0 flex-1">
                                {/* The Direct Clickable Scene Release Filename */}
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-blue-400 group-hover:underline transition-colors break-all line-clamp-2 md:line-clamp-1">
                                    {ep.title}
                                  </span>
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-400/70 group-hover:text-blue-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                {/* Subtext: Episode Name, Resolution, Source, Size, Codec, Dynamic Range, Audio, Server */}
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] text-zinc-400">
                                  {ep.episodeName && (
                                    <span className="font-semibold text-zinc-300">
                                      {ep.episodeName}
                                    </span>
                                  )}
                                  <span className="font-semibold text-blue-400">
                                    {slide.resolution} {slide.source}
                                  </span>
                                  {ep.size && (
                                    <span className="font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                      {ep.size}
                                    </span>
                                  )}
                                  {ep.dynamicRange && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                      {ep.dynamicRange}
                                    </span>
                                  )}
                                  {ep.codec && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                      {ep.codec}
                                    </span>
                                  )}
                                  {ep.audio && (
                                    <span className="text-zinc-500">
                                      🔊 {ep.audio}
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                    {serverName}
                                  </span>
                                </div>
                              </div>
                            </a>

                            {/* Report Broken Link Button (media_1790900300745.png) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportingLink({
                                  linkId: primaryLink?.id,
                                  movieId: titleDetails.id,
                                  mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                                  mediaType: 'tv',
                                  posterPath: titleDetails.poster_path,
                                  linkTitle: ep.title,
                                  reportedUrl: primaryLink?.url || '',
                                  quality: slide.resolution,
                                  server: serverName,
                                });
                              }}
                              className="p-2 sm:p-2.5 rounded-xl bg-[#141824] hover:bg-[#1d2335] text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer shrink-0 self-end md:self-center"
                              title="Report broken or defective link"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>

                            {/* Admin Edit / Delete Actions (Only visible to admin) */}
                            {(isEffectiveAdmin || isAdmin) && primaryLink && (
                              <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(primaryLink);
                                  }}
                                  className="p-2 sm:p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors cursor-pointer"
                                  title="Admin: Edit link"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(primaryLink.id);
                                  }}
                                  className="p-2 sm:p-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-900/50 transition-colors cursor-pointer"
                                  title="Admin: Delete link"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-[#0c0d13] border border-white/5 text-center space-y-3.5 shadow-xl">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                        <FileVideo className="w-6 h-6" />
                      </div>
                      <h4 className="text-white font-bold text-base sm:text-lg">
                        No {slide.title} Links for Season {selectedSeason} Yet
                      </h4>
                      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                        Download links for this quality haven&apos;t been uploaded yet. Request below and our team will add it!
                      </p>
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsRequestModalOpen(true)}
                          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Request {slide.resolution} Links</span>
                        </button>
                        {isEffectiveAdmin && (
                          <a
                            href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Upload in Admin ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Request Custom Quality & Report Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0b0e17] border border-blue-500/25 shadow-xl text-center space-y-3.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400 shadow-md shadow-blue-500/10">
          <Info className="w-5 h-5" />
        </div>
        <p className="text-xs sm:text-sm text-zinc-200 font-medium max-w-md mx-auto leading-relaxed">
          Can&apos;t find the episode or quality you want? Request custom format (4K DV HDR, 1080p, Dual Audio) or report a broken link and our team will add it!
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            REQUEST LINK
          </button>
          <button
            type="button"
            onClick={() => {
              const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
              setReportingLink({
                movieId: titleDetails.id,
                mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                mediaType: 'tv',
                posterPath: titleDetails.poster_path,
                linkTitle: `${titleDetails.name || titleDetails.title} (Broken Link Report)`,
                reportedUrl: currentUrl,
              });
            }}
            className="px-6 py-3 rounded-2xl bg-[#141824] hover:bg-[#1d2335] text-zinc-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/40 font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer inline-flex items-center gap-2"
            title="Report broken or defective link"
          >
            <Flag className="w-4 h-4 text-zinc-400 group-hover:text-rose-400" />
            <span>REPORT LINK</span>
          </button>
        </div>
      </div>

      {/* Admin Quick Edit Modal */}
      {editingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Pencil className="w-4 h-4" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Edit TV Link
                </h4>
              </div>
              <button
                onClick={() => setEditingLink(null)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Season Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editSeason}
                    onChange={(e) => setEditSeason(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Link Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="zip_pack">🗜️ Complete Season Zip/Pack</option>
                    <option value="single_episode">📥 Single Episode (Weekly)</option>
                  </select>
                </div>
              </div>

              {editType === 'single_episode' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Episode Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editEpisode}
                    onChange={(e) => setEditEpisode(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Display Title / Release Tag
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Destination URL
                </label>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Quality</label>
                  <input
                    type="text"
                    value={editQuality}
                    onChange={(e) => setEditQuality(e.target.value)}
                    placeholder="1080p, 4K..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Audio</label>
                  <input
                    type="text"
                    value={editAudio}
                    onChange={(e) => setEditAudio(e.target.value)}
                    placeholder="Hindi DDP..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Size</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    placeholder="1.2 GB..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs hover:scale-105 transition-transform"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Modal */}
      <RequestLinkModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        prefillTitle={titleDetails.name || titleDetails.title}
        prefillMediaType="tv"
        prefillTmdbId={titleDetails.id}
        prefillPosterPath={titleDetails.poster_path}
        prefillYear={titleDetails.first_air_date ? new Date(titleDetails.first_air_date).getFullYear().toString() : undefined}
      />

      {/* Report Broken Link Modal */}
      <ReportBrokenLinkModal
        isOpen={!!reportingLink}
        data={reportingLink}
        onClose={() => setReportingLink(null)}
      />
    </div>
  );
};

export default TVEpisodeLinksManager;
