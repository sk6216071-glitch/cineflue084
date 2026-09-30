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

  // User Selection States matching reference design (media_1790752115635.png)
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [releaseFormat, setReleaseFormat] = useState<'episodes' | 'pack'>('episodes');
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);

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
          results.push({
            optionId: opt.id,
            resolution: fmt.resolution,
            source: fmt.source,
            title: epFormattedTitle,
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
      audioLanguages: string;
      packs: EnrichedLink[];
      size: string;
    }> = [];

    formats.forEach((fmt) => {
      fmt.options.forEach((opt) => {
        if (opt.packs.length > 0) {
          const first = opt.packs[0];
          const detectedSz = first.size || detectSize(first.title) || '';
          results.push({
            optionId: opt.id,
            resolution: fmt.resolution,
            source: fmt.source,
            title: first.title || opt.title,
            audioLanguages: opt.audioLanguages,
            packs: opt.packs,
            size: detectedSz,
          });
        }
      });
    });

    return results;
  }, [selectedSeason, seasonGroupsMap]);

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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-amber-200 font-bold text-xs transition-all shadow-sm cursor-pointer group"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Request Link</span>
          </button>

          {isEffectiveAdmin && (
            <a
              href={`/admin?title=${encodeURIComponent(titleDetails.name || titleDetails.title || '')}&id=${titleDetails.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 font-bold text-xs transition-all hover:bg-zinc-800 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
              <span>Admin File Uploader ↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Interactive Vault Controls (media_1790752115635.png reference design) */}
      <div className="rounded-3xl bg-[#0c0d13] border border-white/5 p-5 sm:p-6 shadow-2xl space-y-6">
        {/* Section 1: SELECT SEASON */}
        <div className="space-y-2.5">
          <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase block">
            Select Season
          </label>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {seasonsList.map((s) => {
              const isActive = selectedSeason === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSeason(s)}
                  className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-[0_4px_24px_rgba(59,130,246,0.55)] border border-blue-400/30'
                      : 'bg-[#181921] hover:bg-[#222430] text-zinc-300 hover:text-white border border-white/5'
                  }`}
                >
                  SEASON {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: RELEASE FORMAT */}
        <div className="space-y-2.5">
          <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase block">
            Release Format
          </label>
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#121319] border border-white/5">
            <button
              type="button"
              onClick={() => setReleaseFormat('episodes')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer select-none ${
                releaseFormat === 'episodes'
                  ? 'bg-[#272832] text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <FileVideo className="w-4 h-4" />
              <span>EPISODES</span>
            </button>
            <button
              type="button"
              onClick={() => setReleaseFormat('pack')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer select-none ${
                releaseFormat === 'pack'
                  ? 'bg-[#272832] text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>PACK</span>
            </button>
          </div>
        </div>

        {/* Section 3: SELECT EPISODE (when EPISODES is selected) */}
        {releaseFormat === 'episodes' && (
          <div className="space-y-2.5 animate-fadeIn">
            <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase block">
              Select Episode
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 max-h-56 overflow-y-auto pr-1">
              {availableEpisodes.map((epNum) => {
                const isActive = selectedEpisode === epNum;
                return (
                  <button
                    key={epNum}
                    type="button"
                    onClick={() => setSelectedEpisode(epNum)}
                    className={`min-w-[44px] h-[44px] px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer select-none ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-[0_4px_20px_rgba(59,130,246,0.55)] border border-blue-400/30'
                        : 'bg-[#181921] hover:bg-[#222430] text-zinc-300 hover:text-white border border-white/5'
                    }`}
                  >
                    E{epNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Active Releases Display */}
      <div className="space-y-4">
        {releaseFormat === 'episodes' ? (
          activeEpisodeReleases.length > 0 ? (
            activeEpisodeReleases.map((rel) => (
              <div
                key={rel.optionId}
                className="rounded-2xl bg-[#0c0d13] border border-white/5 hover:border-blue-500/30 transition-all p-5 sm:p-6 space-y-4 shadow-xl"
              >
                {/* Header Row: Badges, Title, Audio & Size */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={getResolutionBadgeStyle(rel.resolution)}>
                      {rel.resolution}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#0d281e] text-emerald-400 border border-[#154634] shadow-sm">
                      {rel.source}
                    </span>
                    {rel.size && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-[#181921] text-zinc-300 border border-white/5">
                        {rel.size}
                      </span>
                    )}
                    {rel.audioLanguages && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {rel.audioLanguages}
                      </span>
                    )}
                  </div>

                  {isEffectiveAdmin && (
                    <div className="flex items-center gap-1.5 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setManagingOptionId(managingOptionId === rel.optionId ? null : rel.optionId)
                        }
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Manage ({rel.links.length})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Release Scene Filename */}
                <div className="font-mono text-xs sm:text-sm text-zinc-200 font-semibold break-all bg-[#121319] p-3 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Film className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="truncate">{rel.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(rel.title);
                      alert('Release title copied to clipboard!');
                    }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1"
                    title="Copy release name"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Direct Download Server Mirrors */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Download Mirrors</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {rel.links.map((link, idx) => {
                      const server = detectServer(link.url);
                      const sameServerCount = rel.links.filter(
                        (l) => detectServer(l.url).name === server.name
                      ).length;
                      const serverLabel =
                        sameServerCount > 1
                          ? `${server.name || 'Server'} ${idx + 1}`
                          : server.name || `Server ${idx + 1}`;

                      return (
                        <div key={link.id || idx} className="flex items-center gap-1.5">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            title={`Download from ${serverLabel}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{serverLabel}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(link.url);
                              alert('Download link copied to clipboard!');
                            }}
                            className="p-2 rounded-xl bg-[#181921] hover:bg-[#222430] text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                            title="Copy download link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setReportingLink({
                                linkId: link.id,
                                movieId: titleDetails.id,
                                mediaTitle: titleDetails.name || titleDetails.title || 'TV Series',
                                mediaType: 'tv',
                                posterPath: titleDetails.poster_path,
                                linkTitle: link.title,
                                reportedUrl: link.url,
                                quality: link.quality,
                                server: server.name,
                              })
                            }
                            className="p-2 rounded-xl bg-[#181921] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer"
                            title="Report broken mirror"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Admin Management Section */}
                {isEffectiveAdmin && managingOptionId === rel.optionId && (
                  <div className="w-full mt-3 space-y-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <div className="text-xs font-bold text-zinc-300">Admin Link Manager:</div>
                    <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
                      {rel.links.map((lnk) => (
                        <div key={lnk.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                          <div className="truncate flex-1 font-mono text-zinc-300">
                            <span className="text-blue-400 font-bold mr-1">E{selectedEpisode}:</span>
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
            <div className="p-8 rounded-3xl bg-[#0c0d13] border border-white/5 text-center space-y-3.5 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                <FileVideo className="w-6 h-6" />
              </div>
              <h4 className="text-white font-bold text-base sm:text-lg">
                No Links Uploaded Yet for Season {selectedSeason} Episode {selectedEpisode}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                We don&apos;t have download links uploaded for Episode {selectedEpisode} yet. Request it below and our team will add it!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Request Episode {selectedEpisode} Links</span>
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
          )
        ) : (
          activeSeasonPacks.length > 0 ? (
            activeSeasonPacks.map((packRel) => (
              <div
                key={packRel.optionId}
                className="rounded-2xl bg-[#0c0d13] border border-white/5 hover:border-amber-500/30 transition-all p-5 sm:p-6 space-y-4 shadow-xl"
              >
                {/* Header Row: Badges, Title, Audio & Size */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={getResolutionBadgeStyle(packRel.resolution)}>
                      {packRel.resolution}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#0d281e] text-emerald-400 border border-[#154634] shadow-sm">
                      {packRel.source}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Season Pack
                    </span>
                    {packRel.size && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-[#181921] text-zinc-300 border border-white/5">
                        {packRel.size}
                      </span>
                    )}
                    {packRel.audioLanguages && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {packRel.audioLanguages}
                      </span>
                    )}
                  </div>

                  {isEffectiveAdmin && (
                    <div className="flex items-center gap-1.5 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setManagingOptionId(
                            managingOptionId === packRel.optionId ? null : packRel.optionId
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Manage ({packRel.packs.length})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Pack Filename */}
                <div className="font-mono text-xs sm:text-sm text-zinc-200 font-semibold break-all bg-[#121319] p-3 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{packRel.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(packRel.title);
                      alert('Pack title copied to clipboard!');
                    }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1"
                    title="Copy pack name"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Direct Download Mirrors for Pack */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Complete Season Pack Downloads</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {packRel.packs.map((pack, idx) => {
                      const server = detectServer(pack.url);
                      const sameServerCount = packRel.packs.filter(
                        (p) => detectServer(p.url).name === server.name
                      ).length;
                      const serverLabel =
                        sameServerCount > 1
                          ? `${server.name || 'Zip Server'} ${idx + 1}`
                          : server.name || `Zip Server ${idx + 1}`;

                      return (
                        <div key={pack.id || idx} className="flex items-center gap-1.5">
                          <a
                            href={pack.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-amber-600/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            title={`Download complete season pack from ${serverLabel}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{serverLabel}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(pack.url);
                              alert('Zip pack link copied to clipboard!');
                            }}
                            className="p-2 rounded-xl bg-[#181921] hover:bg-[#222430] text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                            title="Copy zip pack link"
                          >
                            <Copy className="w-3.5 h-3.5" />
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
                            className="p-2 rounded-xl bg-[#181921] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-colors cursor-pointer"
                            title="Report broken pack link"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
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
            <div className="p-8 rounded-3xl bg-[#0c0d13] border border-white/5 text-center space-y-3.5 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-white font-bold text-base sm:text-lg">
                No Complete Season Packs Uploaded Yet for Season {selectedSeason}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                Single episodes may be available under the <strong>EPISODES</strong> tab! You can also request a complete season pack zip archive.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Request Season {selectedSeason} Pack</span>
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
          )
        )}
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
