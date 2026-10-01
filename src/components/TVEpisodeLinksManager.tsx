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

// Extract rich release profiles including 4K SDR vs 4K DV HDR vs 1080p
function extractReleaseProfile(title: string, quality?: string, titleDetails?: TitleDetails) {
  // Strip website domain watermarks (e.g. 4kHdHub.Com, TSS-4kHdHub.com, Vegamovies.NL, etc.) before checking resolution
  const cleanTitle = stripWatermarks(title || '');
  const cleanQuality = stripWatermarks(quality || '');

  const titleLower = cleanTitle.toLowerCase();
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
  const platform = detectShowPlatform(title, titleDetails);

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
  // First analyze the filename/title directly:
  const hasDV = /(?:^|[\s._\-[\]()])(?:dv|dovi|dolby[.\s_-]*vision)(?:[\s._\-[\]()]|$)/i.test(titleLower);
  const hasHDR = /(?:^|[\s._\-[\]()])(?:hdr10\+|hdr10|hdr)(?:[\s._\-[\]()]|$)/i.test(titleLower);
  const hasSDR = /(?:^|[\s._\-[\]()])sdr(?:[\s._\-[\]()]|$)/i.test(titleLower);

  let dynamicRange = '';
  if (hasDV && hasHDR) {
    dynamicRange = 'DV HDR';
  } else if (hasDV) {
    dynamicRange = 'DV HDR';
  } else if (hasHDR) {
    dynamicRange = 'HDR';
  } else if (hasSDR) {
    dynamicRange = 'SDR';
  } else if (resTag === '2160p') {
    // In 4K / 2160p: if it has NO DV and NO HDR, it is simple H.265 SDR!
    dynamicRange = 'SDR';
  } else if (qHintLower.includes('dv hdr') || qHintLower.includes('dolby vision')) {
    dynamicRange = 'DV HDR';
  } else if (qHintLower.includes('hdr')) {
    dynamicRange = 'HDR';
  } else if (qHintLower.includes('sdr')) {
    dynamicRange = 'SDR';
  }

  // 5. Codec sensing (Supports H.265, H265, HEVC, x265, H.264, x264, etc.)
  let codec = '';
  if (/(?:^|[\s._\-[\]()])(?:h\.?265|x265|hevc)(?:[\s._\-[\]()]|$)/i.test(titleLower)) {
    codec = 'H.265';
  } else if (/(?:^|[\s._\-[\]()])(?:h\.?264|x264|avc)(?:[\s._\-[\]()]|$)/i.test(titleLower)) {
    codec = 'H.264';
  } else if (qHintLower.includes('h.265') || qHintLower.includes('265') || qHintLower.includes('hevc')) {
    codec = 'H.265';
  } else if (qHintLower.includes('h.264') || qHintLower.includes('264') || qHintLower.includes('avc')) {
    codec = 'H.264';
  } else {
    codec = resTag === '2160p' ? 'H.265' : 'H.264';
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

  // If ep.title is already an authentic scene release filename:
  const raw = (ep.title || '').trim();
  if (/(?:s\d{1,2}e\d{1,2}|e\d{1,2})/i.test(raw) && raw.includes('.')) {
    let clean = stripWatermarks(raw);
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
  const [openSlideId, setOpenSlideId] = useState<string | null>('1080p');
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [episodeViewMode, setEpisodeViewMode] = useState<'single' | 'all'>('single');

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
      const detectedSeason = detectSeasonNumber(l);
      const detectedEp = detectEpisodeNumber({ ...l, episodeNumber: l.episodeNumber, url: l.url });
      const detectedType = detectLinkType({ ...l, episodeNumber: detectedEp, url: l.url });
      const detectedQ = l.quality && l.quality !== 'HD' ? l.quality : detectQuality(l.title, l.quality);
      const detectedAud = l.audioLanguage && l.audioLanguage !== 'Original' ? l.audioLanguage : detectAudio(l.title, l.audioLanguage);
      const detectedSz = l.size || detectSize(l.title) || detectSize(l.url);
      const prof = extractReleaseProfile(l.title, detectedQ, titleDetails);

      return {
        ...l,
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
  }, [customLinks]);

  // Group enriched links by Season -> Format Groups (2160p / 4K, 1080p...) -> Release Options (DV HDR, SDR...)
  const seasonGroupsMap = useMemo(() => {
    const map = new Map<number, FormatGroup[]>();
    const showName = titleDetails.name || titleDetails.title || 'Series';

    seasonsList.forEach((s) => {
      const currentSeasonLinks = enrichedLinks.filter((l) => l.seasonNumber === s);
      if (currentSeasonLinks.length === 0) {
        map.set(s, []);
        return;
      }

      // Group by format key: resolution + source (e.g. "2160p / 4K_WEB-DL", "1080p_WEB-DL")
      const formatMap = new Map<string, { resolution: string; source: string; links: EnrichedLink[] }>();

      currentSeasonLinks.forEach((link) => {
        const key = `${link.resolution}_${link.source}`;
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
        // Group links inside this format by release profile (Separate 4K DV HDR vs 4K SDR)
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
          const prof = extractReleaseProfile(link.title, link.quality, titleDetails);
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

  // Compute available episodes for selectedSeason
  const availableEpisodes = useMemo(() => {
    const formats = seasonGroupsMap.get(selectedSeason) || [];
    const eps = new Set<number>();
    formats.forEach((fmt) => {
      fmt.options.forEach((opt) => {
        opt.episodes.forEach((ep) => {
          if (ep.episodeNumber && ep.episodeNumber > 0) {
            eps.add(ep.episodeNumber);
          }
        });
      });
    });

    if (eps.size === 0) {
      const tmdbSeason = titleDetails.seasons?.find((s) => s.season_number === selectedSeason);
      const totalCount = tmdbSeason?.episode_count || (selectedSeason === 1 ? (titleDetails.number_of_episodes || 8) : 8);
      for (let i = 1; i <= Math.min(totalCount, 24); i++) {
        eps.add(i);
      }
    }

    return Array.from(eps).sort((a, b) => a - b);
  }, [selectedSeason, seasonGroupsMap, titleDetails]);

  // Ensure selectedEpisode stays valid when season changes
  useEffect(() => {
    if (availableEpisodes.length > 0 && !availableEpisodes.includes(selectedEpisode)) {
      setSelectedEpisode(availableEpisodes[0]);
    }
  }, [availableEpisodes, selectedEpisode]);

  // Active episode releases for selectedSeason and selectedEpisode
  const activeEpisodeReleases = useMemo(() => {
    const formats = seasonGroupsMap.get(selectedSeason) || [];
    const results: Array<{
      optionId: string;
      resolution: string;
      source: string;
      title: string;
      episodeName: string;
      codec?: string;
      dynamicRange?: string;
      audioLanguages: string;
      links: EnrichedLink[];
      size: string;
    }> = [];

    formats.forEach((fmt) => {
      fmt.options.forEach((opt) => {
        const epLinks = opt.episodes.filter((e) => e.episodeNumber === selectedEpisode);
        if (epLinks.length > 0) {
          const first = epLinks[0];
          const detectedSz = first.size || detectSize(first.title) || '';
          const epFormattedTitle = formatEpisodeTitle(
            first,
            opt,
            titleDetails,
            selectedSeason,
            fmt.resolution,
            fmt.source
          );
          const epName = extractEpisodeTitle(first.title) || extractEpisodeTitle(epFormattedTitle);
          const prof = extractReleaseProfile(first.title || epFormattedTitle, first.quality, titleDetails);

          results.push({
            optionId: opt.id,
            resolution: fmt.resolution,
            source: fmt.source,
            title: epFormattedTitle,
            episodeName: epName,
            codec: prof.codec,
            dynamicRange: prof.dynamicRange,
            audioLanguages: opt.audioLanguages,
            links: epLinks,
            size: detectedSz,
          });
        }
      });
    });

    return results;
  }, [selectedSeason, selectedEpisode, seasonGroupsMap, titleDetails]);

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
          const detectedSz = first.size || detectSize(first.title) || '';
          const cleanPackTitle = stripWatermarks(first.title || opt.title);
          const prof = extractReleaseProfile(cleanPackTitle, first.quality, titleDetails);

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

  // Group format releases by quality into dedicated quality slides (e.g. 2160p, 1080p, 720p, 480p)
  const qualitySlides = useMemo(() => {
    const formats = seasonGroupsMap.get(selectedSeason) || [];

    const getQualityKey = (res: string) => {
      const r = (res || '').toLowerCase();
      if (r.includes('2160') || r.includes('4k') || r.includes('uhd')) return '2160p';
      if (r.includes('1080') || r.includes('fhd')) return '1080p';
      if (r.includes('720') || r.includes('hd')) return '720p';
      if (r.includes('480') || r.includes('sd')) return '480p';
      return r.replace(/[^a-z0-9]/g, '') || '1080p';
    };

    const getQualityTitle = (key: string, source: string) => {
      const src = source && source !== 'Unknown' ? source.replace(/[^a-zA-Z0-9-]/g, '') : 'WebDL';
      if (key === '2160p') return `2160p 4K ${src}`;
      if (key === '1080p') return `1080p ${src}`;
      if (key === '720p') return `720p ${src}`;
      if (key === '480p') return `480p ${src}`;
      return `${key.toUpperCase()} ${src}`;
    };

    const slidesMap = new Map<
      string,
      {
        key: string;
        title: string;
        resolution: string;
        source: string;
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
      const qKey = getQualityKey(fmt.resolution);
      if (!slidesMap.has(qKey)) {
        slidesMap.set(qKey, {
          key: qKey,
          title: getQualityTitle(qKey, fmt.source || 'WebDL'),
          resolution: fmt.resolution,
          source: fmt.source || 'WEB-DL',
          options: [],
          episodes: [],
        });
      }
      slidesMap.get(qKey)!.options.push(...fmt.options);
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
            const detectedSz = ep.size || detectSize(ep.title) || '';
            const epFormattedTitle = formatEpisodeTitle(
              ep,
              opt,
              titleDetails,
              selectedSeason,
              slide.resolution,
              slide.source
            );
            const epName = extractEpisodeTitle(ep.title) || extractEpisodeTitle(epFormattedTitle);
            const prof = extractReleaseProfile(ep.title || epFormattedTitle, ep.quality, titleDetails);

            epMap.set(epNum, {
              episodeNumber: epNum,
              title: epFormattedTitle,
              episodeName: epName,
              size: detectedSz,
              audio: opt.audioLanguages,
              codec: prof.codec,
              dynamicRange: prof.dynamicRange,
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
          key: '1080p',
          title: '1080p WebDL',
          resolution: '1080p',
          source: 'WEB-DL',
          options: [],
          episodes: [],
        },
        {
          key: '720p',
          title: '720p WebDL',
          resolution: '720p',
          source: 'WEB-DL',
          options: [],
          episodes: [],
        },
      ];
    }

    // Sort: 2160p > 1080p > 720p > 480p
    return Array.from(slidesMap.values()).sort((a, b) => {
      return getQualityWeight(b.resolution) - getQualityWeight(a.resolution);
    });
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
      setOpenSlideId('1080p');
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

                    {/* Release Filename */}
                    <div className="font-mono text-xs sm:text-sm text-zinc-200 font-semibold break-all bg-black/40 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">{packRel.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(packRel.title);
                          alert('Pack title copied to clipboard!');
                        }}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1 cursor-pointer"
                        title="Copy release name"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Blue Download Button matching media_1790848047765.png */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {packRel.packs.map((pack, idx) => {
                        const server = detectServer(pack.url);
                        const sameServerCount = packRel.packs.filter(
                          (p) => detectServer(p.url).name === server.name
                        ).length;
                        const serverLabel =
                          sameServerCount > 1
                            ? `Download ${server.name || 'HubCloud'} ${idx + 1}`
                            : `Download ${server.name || 'HubCloud'}`;

                        return (
                          <div key={pack.id || idx} className="flex items-center gap-2">
                            <a
                              href={pack.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 sm:px-7 sm:py-3 rounded-2xl bg-gradient-to-r from-[#2160fd] via-[#2b66ff] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-[0_4px_20px_rgba(37,99,235,0.45)] hover:shadow-[0_6px_28px_rgba(37,99,235,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer select-none"
                              title={`Download complete season pack from ${server.name}`}
                            >
                              <Download className="w-4 h-4 shrink-0 text-white" />
                              <span>{serverLabel}</span>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-white/90" />
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(pack.url);
                                alert('Zip pack link copied to clipboard!');
                              }}
                              className="p-2.5 sm:p-3 rounded-2xl bg-[#141620] hover:bg-[#1f2230] text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                              title="Copy zip pack link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setReportingLink({
                                  linkId: pack.id,
                                  movieId: titleDetails.id,
                                  mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                                  mediaType: 'tv',
                                  posterPath: titleDetails.poster_path,
                                  linkTitle: pack.title,
                                  reportedUrl: pack.url,
                                  quality: pack.quality,
                                  server: server.name,
                                })
                              }
                              className="p-2.5 sm:p-3 rounded-2xl bg-[#141620] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer"
                              title="Report broken pack link"
                            >
                              <Flag className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
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

          // Find current active episode in this slide
          const currentEp =
            slide.episodes.find((e) => e.episodeNumber === selectedEpisode) ||
            slide.episodes[0] ||
            null;

          const currentEpIndex = slide.episodes.findIndex(
            (e) => e.episodeNumber === (currentEp?.episodeNumber ?? selectedEpisode)
          );
          const hasPrev = currentEpIndex > 0;
          const hasNext = currentEpIndex !== -1 && currentEpIndex < slide.episodes.length - 1;

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
                    <>
                      {/* Episode Quick-Select Pills Bar */}
                      <div className="space-y-2.5 pb-2 border-b border-white/5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                            SELECT EPISODE:
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setEpisodeViewMode(episodeViewMode === 'all' ? 'single' : 'all')
                            }
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          >
                            {episodeViewMode === 'all' ? '← View Single Episode' : 'View All Episodes ↗'}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 max-h-48 overflow-y-auto pr-1">
                          <button
                            type="button"
                            onClick={() => setEpisodeViewMode('all')}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              episodeViewMode === 'all'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                                : 'bg-[#14161f] text-zinc-400 hover:text-white border border-white/5'
                            }`}
                          >
                            ALL ({episodesCount})
                          </button>
                          {slide.episodes.map((ep) => {
                            const isSelected =
                              episodeViewMode === 'single' &&
                              (currentEp?.episodeNumber ?? selectedEpisode) === ep.episodeNumber;

                            return (
                              <button
                                key={ep.episodeNumber}
                                type="button"
                                onClick={() => {
                                  setSelectedEpisode(ep.episodeNumber);
                                  setEpisodeViewMode('single');
                                }}
                                className={`min-w-[42px] h-[38px] px-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-[0_4px_16px_rgba(59,130,246,0.6)] border border-blue-400/40 scale-105'
                                    : 'bg-[#14161f] hover:bg-[#1e2130] text-zinc-300 hover:text-white border border-white/5'
                                }`}
                              >
                                E{ep.episodeNumber < 10 ? `0${ep.episodeNumber}` : ep.episodeNumber}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* View Mode 1: Single Episode Focused Card */}
                      {episodeViewMode === 'single' && currentEp && (
                        <div className="rounded-2xl bg-[#0e111a] border border-white/5 hover:border-blue-500/30 p-4 sm:p-5 space-y-4 transition-all shadow-xl">
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                <FileVideo className="w-4 h-4" />
                              </div>
                              <h4 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                                Episode {currentEp.episodeNumber}
                                {currentEp.episodeName ? ` : ${currentEp.episodeName}` : ''}
                              </h4>
                            </div>

                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className={getResolutionBadgeStyle(slide.resolution)}>
                                {slide.resolution}
                              </span>
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0d281e] text-emerald-400 border border-[#154634]">
                                {slide.source}
                              </span>
                              {currentEp.codec && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  {currentEp.codec}
                                </span>
                              )}
                              {currentEp.dynamicRange && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  {currentEp.dynamicRange}
                                </span>
                              )}
                              {currentEp.size && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-zinc-900 text-zinc-300 border border-white/5">
                                  {currentEp.size}
                                </span>
                              )}
                              {currentEp.audio && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  {currentEp.audio}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Filename Box */}
                          <div className="font-mono text-xs sm:text-sm text-zinc-200 font-semibold break-all bg-black/40 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Film className="w-4 h-4 text-blue-400 shrink-0" />
                              <span className="truncate">{currentEp.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(currentEp.title);
                                alert('Release name copied to clipboard!');
                              }}
                              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1 cursor-pointer"
                              title="Copy release name"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Blue Download Buttons matching media_1790848047765.png */}
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Download className="w-3.5 h-3.5 text-blue-400" />
                              <span>Direct Download Mirrors</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                              {currentEp.links.map((lnk, idx) => {
                                const server = detectServer(lnk.url);
                                const sameServerCount = currentEp.links.filter(
                                  (l) => detectServer(l.url).name === server.name
                                ).length;
                                const serverLabel =
                                  sameServerCount > 1
                                    ? `Download ${server.name || 'HubCloud'} ${idx + 1}`
                                    : `Download ${server.name || 'HubCloud'}`;

                                return (
                                  <div key={lnk.id || idx} className="flex items-center gap-2">
                                    <a
                                      href={lnk.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 sm:px-7 sm:py-3 rounded-2xl bg-gradient-to-r from-[#2160fd] via-[#2b66ff] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-[0_4px_20px_rgba(37,99,235,0.45)] hover:shadow-[0_6px_28px_rgba(37,99,235,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer select-none"
                                      title={`Download from ${serverLabel}`}
                                    >
                                      <Download className="w-4 h-4 shrink-0 text-white" />
                                      <span>{serverLabel}</span>
                                      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-white/90" />
                                    </a>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(lnk.url);
                                        alert('Download link copied to clipboard!');
                                      }}
                                      className="p-2.5 sm:p-3 rounded-2xl bg-[#141620] hover:bg-[#1f2230] text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                                      title="Copy download link"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReportingLink({
                                          linkId: lnk.id,
                                          movieId: titleDetails.id,
                                          mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                                          mediaType: 'tv',
                                          posterPath: titleDetails.poster_path,
                                          linkTitle: lnk.title,
                                          reportedUrl: lnk.url,
                                          quality: lnk.quality,
                                          server: server.name,
                                        })
                                      }
                                      className="p-2.5 sm:p-3 rounded-2xl bg-[#141620] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer"
                                      title="Report broken mirror"
                                    >
                                      <Flag className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Episode Prev / Next Navigation Controls */}
                          <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs font-bold text-zinc-400">
                            {hasPrev ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedEpisode(slide.episodes[currentEpIndex - 1].episodeNumber)
                                }
                                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                              >
                                <span>← Episode {slide.episodes[currentEpIndex - 1].episodeNumber}</span>
                              </button>
                            ) : (
                              <div />
                            )}

                            {hasNext ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedEpisode(slide.episodes[currentEpIndex + 1].episodeNumber)
                                }
                                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                              >
                                <span>Episode {slide.episodes[currentEpIndex + 1].episodeNumber} →</span>
                              </button>
                            ) : (
                              <div />
                            )}
                          </div>
                        </div>
                      )}

                      {/* View Mode 2: All Episodes List */}
                      {episodeViewMode === 'all' && (
                        <div className="space-y-3">
                          {slide.episodes.map((ep) => (
                            <div
                              key={ep.episodeNumber}
                              className="rounded-2xl bg-[#0e111a] border border-white/5 hover:border-blue-500/30 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-md"
                            >
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-black text-xs font-mono">
                                    E{ep.episodeNumber < 10 ? `0${ep.episodeNumber}` : ep.episodeNumber}
                                  </span>
                                  <h5 className="font-bold text-white text-sm sm:text-base truncate">
                                    {ep.episodeName || `Episode ${ep.episodeNumber}`}
                                  </h5>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                  <span className="font-semibold text-blue-400">
                                    {slide.resolution} {slide.source}
                                  </span>
                                  {ep.size && <span>• {ep.size}</span>}
                                  {ep.audio && <span className="text-zinc-500">• {ep.audio}</span>}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {ep.links.map((lnk, idx) => {
                                  const server = detectServer(lnk.url);
                                  const serverLabel = `Download ${server.name || 'HubCloud'}`;
                                  return (
                                    <div key={lnk.id || idx} className="flex items-center gap-1.5">
                                      <a
                                        href={lnk.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#2160fd] via-[#2b66ff] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-md shadow-blue-600/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer select-none"
                                        title={`Download Episode ${ep.episodeNumber} from ${serverLabel}`}
                                      >
                                        <Download className="w-3.5 h-3.5 text-white" />
                                        <span>{serverLabel}</span>
                                        <ExternalLink className="w-3 h-3 text-white/90" />
                                      </a>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(lnk.url);
                                          alert('Download link copied to clipboard!');
                                        }}
                                        className="p-2 rounded-xl bg-[#141620] hover:bg-[#1f2230] text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                                        title="Copy link"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
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
