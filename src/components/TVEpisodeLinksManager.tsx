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
      const detectedSeason = detectSeasonNumber({ title: effectiveTitle, seasonNumber: l.seasonNumber, url: l.url });
      const detectedEp = detectEpisodeNumber({ title: effectiveTitle, episodeNumber: l.episodeNumber, url: l.url });
      const detectedType = detectLinkType({ title: effectiveTitle, episodeNumber: detectedEp, url: l.url, linkType: l.linkType, category: l.category });
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
          if (link.linkType === 'zip_pack') {
            opt.packs.push(link);
          } else {
            opt.episodes.push(link);
          }
        });

        const options: ReleaseOption[] = [];

        optionsMap.forEach((optVal) => {
          // Intelligent Auto-Recovery:
          // If no episodes were detected, but multiple links are in packs:
          // A TV season release never has multiple zip packs on the same server!
          // Separate true zip/rar archive packs from episode links.
          if (optVal.episodes.length === 0 && optVal.packs.length > 0) {
            const realPacks: EnrichedLink[] = [];
            const recoveredEpisodes: EnrichedLink[] = [];

            optVal.packs.forEach((p, idx) => {
              const combined = `${p.title || ''} ${p.url || ''}`.toLowerCase();
              const isExplicitZip = /(?:\.zip|\.rar|\.7z|\bzip\b|\bcomplete\b|\ball\s*episodes\b|\bfull\s*season\b)/i.test(
                combined
              );

              if (isExplicitZip && (optVal.packs.length > 1 || combined.includes('.zip') || combined.includes('.rar'))) {
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

            if (recoveredEpisodes.length > 0) {
              optVal.episodes = recoveredEpisodes;
              optVal.packs = realPacks;
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
          const cleanPackTitle = stripWatermarks(first.title || opt.title);
          const prof = extractReleaseProfile(cleanPackTitle, first.quality, titleDetails, first.url);

          results.push({
            optionId: opt.id,
            resolution: fmt.resolution,
            source: fmt.source,
            title: cleanPackTitle || opt.title,
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
            weight: 450,
          };
        } else if (dyn === 'HDR') {
          return {
            key: '2160p_hdr_h265',
            title: `2160p 4K HDR${codecLabel} ${src}`,
            badge: `2160p HDR${codecLabel}`,
            resolution: '2160p / 4K',
            weight: 440,
          };
        } else {
          return {
            key: '2160p_sdr_h265',
            title: `2160p 4K SDR${codecLabel} ${src}`,
            badge: `2160p SDR${codecLabel}`,
            resolution: '2160p / 4K',
            weight: 420,
          };
        }
      }

      if (resTag === '1080p') {
        const codecLabel = isHEVC ? ' H.265' : '';
        if (dyn === 'DV HDR' || dyn === 'DV') {
          return {
            key: '1080p_dv_hdr_h265',
            title: `1080p FHD DV HDR${codecLabel} ${src}`,
            badge: `1080p DV HDR${codecLabel}`,
            resolution: '1080p',
            weight: 390,
          };
        } else if (dyn === 'HDR') {
          return {
            key: '1080p_hdr_h265',
            title: `1080p FHD HDR${codecLabel} ${src}`,
            badge: `1080p HDR${codecLabel}`,
            resolution: '1080p',
            weight: 380,
          };
        } else if (is10Bit && isHEVC) {
          return {
            key: '1080p_hevc_10bit',
            title: `1080p FHD 10bit HEVC ${src}`,
            badge: '1080p HEVC 10bit',
            resolution: '1080p',
            weight: 360,
          };
        } else if (isHEVC || dyn === 'SDR') {
          return {
            key: '1080p_sdr_h265',
            title: `1080p FHD SDR H.265 ${src}`,
            badge: '1080p SDR H.265',
            resolution: '1080p',
            weight: 340,
          };
        } else {
          return {
            key: '1080p_webdl',
            title: `1080p FHD ${src}`,
            badge: '1080p',
            resolution: '1080p',
            weight: 300,
          };
        }
      }

      if (resTag === '720p') {
        const codecLabel = isHEVC ? ' HEVC' : '';
        if (dyn === 'DV HDR' || dyn === 'DV') {
          return {
            key: '720p_dv_hdr',
            title: `720p HD DV HDR${codecLabel} ${src}`,
            badge: `720p DV HDR${codecLabel}`,
            resolution: '720p',
            weight: 270,
          };
        } else if (dyn === 'HDR') {
          return {
            key: '720p_hdr',
            title: `720p HD HDR${codecLabel} ${src}`,
            badge: `720p HDR${codecLabel}`,
            resolution: '720p',
            weight: 260,
          };
        } else if (is10Bit && isHEVC) {
          return {
            key: '720p_hevc_10bit',
            title: `720p HD 10bit HEVC ${src}`,
            badge: '720p HEVC 10bit',
            resolution: '720p',
            weight: 250,
          };
        } else if (isHEVC) {
          return {
            key: '720p_hevc',
            title: `720p HD HEVC ${src}`,
            badge: '720p HEVC',
            resolution: '720p',
            weight: 240,
          };
        } else {
          return {
            key: '720p_webdl',
            title: `720p HD ${src}`,
            badge: '720p',
            resolution: '720p',
            weight: 200,
          };
        }
      }

      return {
        key: '480p_webdl',
        title: `480p SD ${src}`,
        badge: '480p',
        resolution: '480p',
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
          weight: 300,
          options: [],
          episodes: [],
        },
        {
          key: '720p_webdl',
          title: '720p WebDL',
          resolution: '720p',
          source: 'WEB-DL',
          weight: 200,
          options: [],
          episodes: [],
        },
      ];
    }

    // Sort: highest quality first (2160p DV HDR > 2160p HDR > 2160p SDR > 1080p HEVC > 1080p > 720p > 480p)
    return Array.from(slidesMap.values()).sort((a, b) => b.weight - a.weight);
  }, [seasonGroupsMap, selectedSeason, titleDetails]);

  // Single-open accordion toggle: clicking an open slide closes it, clicking another opens it & closes all others
  const toggleSlide = (slideKey: string) => {
    setOpenSlideId((prev) => (prev === slideKey ? null : slideKey));
  };

  // Sync open slide on season changes
  useEffect(() => {
    const availableKeys = ['zip', ...qualitySlides.map((s) => s.key)];
    if (openSlideId && availableKeys.includes(openSlideId)) return;
    const firstWithEps = qualitySlides.find((s) => s.episodes.length > 0);
    if (firstWithEps) {
      setOpenSlideId(firstWithEps.key);
    } else if (activeSeasonPacks.length > 0) {
      setOpenSlideId('zip');
    } else {
      setOpenSlideId(qualitySlides[0]?.key || '1080p_webdl');
    }
  }, [selectedSeason, qualitySlides, activeSeasonPacks.length, openSlideId]);

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

      {/* 2. Collapsible Accordion Slides (Zip Archive & Episode-Wise Qualities - media_1790847788704.jpg) */}
      <div className="space-y-4">
        {/* SLIDE: Zip Archive GDrive GDTOT Download Links */}
        <div className="rounded-2xl overflow-hidden border border-[#8f2b42]/60 shadow-xl transition-all">
          {/* Maroon Clickable Header Banner */}
          <div
            onClick={() => toggleSlide('zip')}
            className={`w-full p-4 sm:p-5 cursor-pointer select-none transition-all duration-200 ${
              openSlideId === 'zip'
                ? 'bg-gradient-to-r from-[#6e1e2f] via-[#5a1725] to-[#45101c] border-b border-[#8f2b42]/70 shadow-inner'
                : 'bg-gradient-to-r from-[#5a1725] via-[#48111c] to-[#360b13] hover:from-[#661b2b] hover:via-[#521521] hover:to-[#3e0e17]'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold tracking-wide text-rose-200/90 italic font-serif">
                  Click Here to Open All Qualities
                </p>
                <div className="flex items-center gap-2 sm:gap-2.5 text-white">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-black/40 border border-white/30 text-white font-mono text-xs font-black shrink-0 shadow-inner">
                    {openSlideId === 'zip' ? '−' : '+'}
                  </span>
                  <h4 className="text-sm sm:text-base md:text-lg font-bold tracking-tight truncate">
                    Zip Archive GDrive HubCloud Download Links
                  </h4>
                </div>
              </div>

              {/* Corner + / - Icon */}
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 ${
                  openSlideId === 'zip'
                    ? 'bg-white/20 border-white/30 text-white'
                    : 'bg-black/30 border-white/10 text-rose-200 hover:text-white hover:bg-black/50'
                }`}
              >
                <span className="font-bold text-lg sm:text-xl leading-none">
                  {openSlideId === 'zip' ? '−' : '+'}
                </span>
              </div>
            </div>
          </div>

          {/* Expanded Body for Zip Archive */}
          {openSlideId === 'zip' && (
            <div className="bg-[#090b10] p-4 sm:p-6 space-y-4 animate-fadeIn border-t border-rose-950/40">
              {activeSeasonPacks.length > 0 ? (
                activeSeasonPacks.map((packRel) => (
                  <div
                    key={packRel.optionId}
                    className="rounded-2xl bg-[#0e111a] border border-white/5 hover:border-blue-500/30 p-4 sm:p-5 space-y-3.5 transition-all shadow-xl"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                          Complete Season {selectedSeason} Pack
                        </h4>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className={getResolutionBadgeStyle(packRel.resolution)}>
                          {packRel.resolution}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0d281e] text-emerald-400 border border-[#154634]">
                          {packRel.source}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Layers className="w-3 h-3" /> Season Pack
                        </span>
                        {packRel.size && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-zinc-900 text-zinc-300 border border-white/5">
                            {packRel.size}
                          </span>
                        )}
                        {packRel.audioLanguages && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {packRel.audioLanguages}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Release Filename & Direct Link */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 hover:bg-black/60 p-3 sm:p-4 rounded-xl border border-white/5 hover:border-blue-500/40 transition-all">
                      <a
                        href={packRel.packs[0]?.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 min-w-0 flex-1 group/pack select-none cursor-pointer"
                        title={`Click to download ${packRel.title}`}
                      >
                        <Layers className="w-4 h-4 text-blue-400 shrink-0 group-hover/pack:scale-110 transition-transform" />
                        <span className="font-mono text-xs sm:text-sm text-zinc-100 group-hover/pack:text-blue-400 group-hover/pack:underline font-semibold break-all line-clamp-2 sm:line-clamp-1 transition-colors">
                          {packRel.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400/70 group-hover/pack:text-blue-300 shrink-0 opacity-0 group-hover/pack:opacity-100 transition-opacity" />
                      </a>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {packRel.packs.length > 1 && (
                          <div className="flex items-center gap-1.5 mr-1">
                            {packRel.packs.map((p, idx) => {
                              const s = detectServer(p.url);
                              return (
                                <a
                                  key={p.id || idx}
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#141622] hover:bg-blue-600 text-zinc-300 hover:text-white border border-white/10 hover:border-blue-500 transition-all cursor-pointer"
                                  title={`Download from ${s.name || `Mirror ${idx + 1}`}`}
                                >
                                  {s.name || `Mirror ${idx + 1}`} ↗
                                </a>
                              );
                            })}
                          </div>
                        )}

                        {packRel.packs[0] && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(packRel.packs[0].url);
                              alert('Zip pack link copied to clipboard!');
                            }}
                            className="p-2 sm:p-2.5 rounded-xl bg-[#141620] hover:bg-[#1f2230] text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                            title="Copy zip pack link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {packRel.packs[0] && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportingLink({
                                linkId: packRel.packs[0].id,
                                movieId: titleDetails.id,
                                mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                                mediaType: 'tv',
                                posterPath: titleDetails.poster_path,
                                linkTitle: packRel.title,
                                reportedUrl: packRel.packs[0].url,
                                quality: packRel.packs[0].quality,
                                server: detectServer(packRel.packs[0].url).name || 'HubCloud',
                              });
                            }}
                            className="p-2 sm:p-2.5 rounded-xl bg-[#141620] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer"
                            title="Report broken pack link"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Admin Management Section */}
                    {isEffectiveAdmin && managingOptionId === packRel.optionId && (
                      <div className="w-full mt-3 space-y-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                        <div className="text-xs font-bold text-zinc-300">Admin Pack Manager:</div>
                        <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
                          {packRel.packs.map((lnk) => (
                            <div key={lnk.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                              <div className="truncate flex-1 font-mono text-zinc-300">
                                <span className="text-amber-400 font-bold mr-1">ZIP:</span>
                                {lnk.title}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(lnk)}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400"
                                  title="Edit Link"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(lnk.id)}
                                  className="p-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-400"
                                  title="Delete Link"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
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
              className="rounded-2xl overflow-hidden border border-[#8f2b42]/60 shadow-xl transition-all"
            >
              {/* Maroon Clickable Header Banner matching media_1790847788704.jpg */}
              <div
                onClick={() => toggleSlide(slide.key)}
                className={`w-full p-4 sm:p-5 cursor-pointer select-none transition-all duration-200 ${
                  isOpen
                    ? 'bg-gradient-to-r from-[#6e1e2f] via-[#5a1725] to-[#45101c] border-b border-[#8f2b42]/70 shadow-inner'
                    : 'bg-gradient-to-r from-[#5a1725] via-[#48111c] to-[#360b13] hover:from-[#661b2b] hover:via-[#521521] hover:to-[#3e0e17]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold tracking-wide text-rose-200/90 italic font-serif">
                      Click Here to Open Episode Wise
                    </p>
                    <div className="flex items-center gap-2 sm:gap-2.5 text-white">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-black/40 border border-white/30 text-white font-mono text-xs font-black shrink-0 shadow-inner">
                        {isOpen ? '−' : '+'}
                      </span>
                      <h4 className="text-sm sm:text-base md:text-lg font-bold tracking-tight truncate">
                        {slide.title} GDrive HubCloud Download Links
                      </h4>
                    </div>
                  </div>

                  {/* Corner + / - Icon */}
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 ${
                      isOpen
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-black/30 border-white/10 text-rose-200 hover:text-white hover:bg-black/50'
                    }`}
                  >
                    <span className="font-bold text-lg sm:text-xl leading-none">
                      {isOpen ? '−' : '+'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Body for this Quality */}
              {isOpen && (
                <div className="bg-[#090b10] p-4 sm:p-6 space-y-5 animate-fadeIn border-t border-rose-950/40">
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

                            {/* Action icons / Mirror servers if more than 1 server exists */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                              {/* If there are multiple mirrors, show each mirror server link */}
                              {ep.links.length > 1 && (
                                <div className="flex items-center gap-1.5 mr-1">
                                  {ep.links.map((lnk, idx) => {
                                    const srv = detectServer(lnk.url);
                                    return (
                                      <a
                                        key={lnk.id || idx}
                                        href={lnk.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#141622] hover:bg-blue-600 text-zinc-300 hover:text-white border border-white/10 hover:border-blue-500 transition-all cursor-pointer"
                                        title={`Download from ${srv.name || `Mirror ${idx + 1}`}`}
                                      >
                                        {srv.name || `Mirror ${idx + 1}`} ↗
                                      </a>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Quick Copy Link */}
                              {primaryLink && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(primaryLink.url);
                                    alert('Download link copied to clipboard!');
                                  }}
                                  className="p-2 sm:p-2.5 rounded-xl bg-[#141620] hover:bg-[#1f2230] text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                                  title="Copy download link"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Flag / Report Broken Link */}
                              {primaryLink && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReportingLink({
                                      linkId: primaryLink.id,
                                      movieId: titleDetails.id,
                                      mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                                      mediaType: 'tv',
                                      posterPath: titleDetails.poster_path,
                                      linkTitle: ep.title,
                                      reportedUrl: primaryLink.url,
                                      quality: primaryLink.quality,
                                      server: serverName,
                                    });
                                  }}
                                  className="p-2 sm:p-2.5 rounded-xl bg-[#141620] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer"
                                  title="Report broken mirror"
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Admin Edit / Delete Actions */}
                              {isAdmin && primaryLink && (
                                <>
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
                                </>
                              )}
                            </div>
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

      {/* Bottom Request Custom Quality Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0b0e17] border border-blue-500/25 shadow-xl text-center space-y-3.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400 shadow-md shadow-blue-500/10">
          <Info className="w-5 h-5" />
        </div>
        <p className="text-xs sm:text-sm text-zinc-200 font-medium max-w-md mx-auto leading-relaxed">
          Can&apos;t find the episode or quality you want? Request custom format (4K DV HDR, 1080p, Dual Audio) and our team will add it!
        </p>
        <button
          type="button"
          onClick={() => setIsRequestModalOpen(true)}
          className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          REQUEST LINK
        </button>
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
