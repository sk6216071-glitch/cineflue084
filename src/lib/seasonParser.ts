import { CustomLink } from '@/types';

export interface ParsedMediaMeta {
  seasonNumber: number;
  episodeNumber?: number;
  linkType: 'zip_pack' | 'single_episode';
  quality?: string;
  audioLanguage?: string;
  size?: string;
}

/**
 * Auto-detect Season Number from title, filename, or link metadata
 */
export function detectSeasonNumber(link: { title?: string; seasonNumber?: number }): number {
  if (link.title) {
    // 1. Check patterns like S02, S2, s02, S.02, S-02, S_02
    const sMatch = link.title.match(/(?:^|[\s._\-[\]()])s0*(\d{1,2})(?:[\s._\-[\]()]|e\d|\b)/i);
    if (sMatch && sMatch[1]) {
      return parseInt(sMatch[1], 10);
    }

    // 2. Check patterns like Season 2, Season 02, Season.2, Season_2
    const seasonMatch = link.title.match(/(?:^|[\s._\-[\]()])season[\s._-]?0*(\d{1,2})/i);
    if (seasonMatch && seasonMatch[1]) {
      return parseInt(seasonMatch[1], 10);
    }
  }

  return link.seasonNumber && link.seasonNumber > 0 ? link.seasonNumber : 1;
}

/**
 * Auto-detect Episode Number from title or link metadata
 */
export function detectEpisodeNumber(link: { title?: string; episodeNumber?: number }): number | undefined {
  if (link.episodeNumber !== undefined && link.episodeNumber > 0) {
    return link.episodeNumber;
  }

  if (link.title) {
    // Check patterns like E01, E1, EP01, EP 1, Episode 1, Episode 01, Ep.01
    const epMatch = link.title.match(/(?:^|[\s._\-[\]()]|s\d{1,2})(?:ep|episode|e)[\s._-]?0*(\d{1,3})(?:[\s._\-[\]()]|\b)/i);
    if (epMatch && epMatch[1]) {
      return parseInt(epMatch[1], 10);
    }
  }

  return undefined;
}

/**
 * Auto-detect whether a link is a Complete Season Zip/Batch Pack or Single Episode
 */
export function detectLinkType(link: { title?: string; linkType?: string; category?: string; episodeNumber?: number }): 'zip_pack' | 'single_episode' {
  if (link.linkType === 'single_episode' || link.category === 'SingleEpisode') {
    return 'single_episode';
  }
  if (link.linkType === 'zip_pack' || link.category === 'ZipPack') {
    return 'zip_pack';
  }

  const ep = detectEpisodeNumber(link);
  if (ep !== undefined && ep > 0) {
    // If title specifically mentions complete/zip/pack even with E01-E10, it's a pack
    if (link.title && /(?:complete|pack|zip|batch|all\s*episodes|season\s*\d+\s*complete)/i.test(link.title)) {
      return 'zip_pack';
    }
    return 'single_episode';
  }

  return 'zip_pack';
}

/**
 * Auto-extract Quality/Resolution format tags from title
 */
export function detectQuality(title: string, defaultQuality?: string): string {
  if (!title) return defaultQuality || '1080p';

  const tags: string[] = [];

  // Resolution
  if (/2160p|4k|uhd/i.test(title)) tags.push('2160p 4K');
  else if (/1080p|fhd/i.test(title)) tags.push('1080p FHD');
  else if (/720p|hd/i.test(title)) tags.push('720p HD');
  else if (/480p|sd/i.test(title)) tags.push('480p SD');

  // Source / Codec
  if (/remux/i.test(title)) tags.push('REMUX');
  else if (/bluray|blu-ray|bdrip/i.test(title)) tags.push('BluRay');
  else if (/web-dl|webrip|web/i.test(title)) tags.push('WEB-DL');
  else if (/hdtv/i.test(title)) tags.push('HDTV');

  // HDR / Color
  if (/dv\s*hdr|dolby\s*vision/i.test(title)) tags.push('DV HDR');
  else if (/hdr10\+|hdr10|hdr/i.test(title)) tags.push('HDR');

  if (/10bit/i.test(title)) tags.push('10bit');
  if (/hevc|x265/i.test(title)) tags.push('HEVC');

  if (tags.length > 0) {
    return tags.join(' • ');
  }

  return defaultQuality || '1080p WEB-DL';
}

/**
 * Auto-extract Audio and Language tags from title
 */
export function detectAudio(title: string, defaultAudio?: string): string {
  if (!title) return defaultAudio || 'English';

  const languages: string[] = [];

  // Dual / Multi Audio
  if (/dual\s*audio/i.test(title)) {
    return 'Dual Audio (Hin + Eng)';
  }
  if (/multi\s*audio/i.test(title)) {
    return 'Multi Audio (5.1)';
  }

  // Language tags with channels
  const hasHindi = /hindi|hin/i.test(title);
  const hasEnglish = /english|eng/i.test(title);
  const hasTamil = /tamil|tam/i.test(title);
  const hasTelugu = /telugu|tel/i.test(title);
  const hasJapanese = /japanese|jap/i.test(title);
  const hasKorean = /korean|kor/i.test(title);

  if (hasHindi && hasEnglish) {
    const atmos = /atmos|truehd/i.test(title) ? 'Atmos' : '';
    const ddp = /ddp\s*5\.1|ddp5\.1|5\.1/i.test(title) ? '5.1' : '';
    return `Hindi + English ${[atmos, ddp].filter(Boolean).join(' ')}`.trim();
  }

  if (hasHindi) languages.push('Hindi Dubbed');
  if (hasEnglish) languages.push('English (Original)');
  if (hasTamil) languages.push('Tamil');
  if (hasTelugu) languages.push('Telugu');
  if (hasJapanese) languages.push('Japanese Sub');
  if (hasKorean) languages.push('Korean Sub');

  if (languages.length > 0) {
    return languages.join(' • ');
  }

  return defaultAudio || 'English';
}

/**
 * Auto-extract File Size from title (e.g. 16.8 GB, 7.4 GB, 850 MB)
 */
export function detectSize(title: string, defaultSize?: string): string | undefined {
  if (!title) return defaultSize;
  const sizeMatch = title.match(/\b(\d+(?:\.\d+)?\s*(?:gb|mb|tb))\b/i);
  if (sizeMatch && sizeMatch[1]) {
    return sizeMatch[1].toUpperCase();
  }
  return defaultSize;
}

/**
 * Auto-parse full media metadata from title string
 */
export function parseFullMediaTitle(title: string): ParsedMediaMeta {
  const seasonNumber = detectSeasonNumber({ title });
  const episodeNumber = detectEpisodeNumber({ title });
  const linkType = detectLinkType({ title, episodeNumber });
  const quality = detectQuality(title);
  const audioLanguage = detectAudio(title);
  const size = detectSize(title);

  return {
    seasonNumber,
    episodeNumber,
    linkType,
    quality,
    audioLanguage,
    size,
  };
}

/**
 * Quality weight score for sorting links (2160p 4K at top, then 1080p, then 720p)
 */
export function getQualityWeight(qualityStr: string = ''): number {
  const q = qualityStr.toLowerCase();
  if (q.includes('2160') || q.includes('4k') || q.includes('uhd')) return 400;
  if (q.includes('remux')) return 350;
  if (q.includes('1080') || q.includes('fhd')) return 300;
  if (q.includes('720') || q.includes('hd')) return 200;
  if (q.includes('480') || q.includes('sd')) return 100;
  return 250;
}

export interface ParsedBulkItem {
  id: string;
  title: string;
  url: string;
  linkType: 'zip_pack' | 'single_episode';
  seasonNumber: number;
  episodeNumber?: number;
  quality: string;
  audioLanguage: string;
  size?: string;
  category: 'ZipPack' | 'SingleEpisode';
}

/**
 * Intelligently parse raw bulk/multi-line text into structured season, episode, and zip pack links
 */
export function parseBulkLinksInput(rawText: string, fallbackSeason: number = 1): ParsedBulkItem[] {
  if (!rawText || !rawText.trim()) return [];

  const items: ParsedBulkItem[] = [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const urlRegex = /(https?:\/\/[^\s<>"']+)/i;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(urlRegex);

    if (match) {
      const url = match[1];
      let titlePart = line.replace(url, '').trim();
      titlePart = titlePart.replace(/^[-|:•\s\t>\])]+|[-|:•\s\t<\[(]+$/g, '').trim();

      if (!titlePart || titlePart.length < 3) {
        try {
          const urlObj = new URL(url);
          const pathname = decodeURIComponent(urlObj.pathname);
          const filename = pathname.split('/').pop() || '';
          titlePart = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[._-]/g, ' ').trim();
        } catch {
          titlePart = `Link ${items.length + 1}`;
        }
      }

      const meta = parseFullMediaTitle(titlePart);
      const sNum = meta.seasonNumber || fallbackSeason;

      items.push({
        id: `bulk-${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
        title: titlePart || `Episode / Pack ${items.length + 1}`,
        url,
        linkType: meta.linkType,
        seasonNumber: sNum,
        episodeNumber: meta.episodeNumber,
        quality: meta.quality || '1080p WEB-DL',
        audioLanguage: meta.audioLanguage || 'English',
        size: meta.size,
        category: meta.linkType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
      });
      i++;
    } else {
      if (i + 1 < lines.length && urlRegex.test(lines[i + 1])) {
        const titlePart = line.replace(/^[-|:•\s\t>\])]+|[-|:•\s\t<\[(]+$/g, '').trim();
        const nextUrlMatch = lines[i + 1].match(urlRegex);
        if (nextUrlMatch) {
          const url = nextUrlMatch[1];
          const meta = parseFullMediaTitle(titlePart);
          const sNum = meta.seasonNumber || fallbackSeason;

          items.push({
            id: `bulk-${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
            title: titlePart || `Episode / Pack ${items.length + 1}`,
            url,
            linkType: meta.linkType,
            seasonNumber: sNum,
            episodeNumber: meta.episodeNumber,
            quality: meta.quality || '1080p WEB-DL',
            audioLanguage: meta.audioLanguage || 'English',
            size: meta.size,
            category: meta.linkType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
          });
          i += 2;
          continue;
        }
      }
      i++;
    }
  }

  return items;
}

