import { CustomLink } from '@/types';

export interface ParsedMediaMeta {
  seasonNumber: number;
  episodeNumber?: number;
  linkType: 'zip_pack' | 'single_episode';
  quality?: string;
  audioLanguage?: string;
  size?: string;
  category: 'ZipPack' | 'SingleEpisode';
  rawReleaseTitle?: string;
}

/**
 * Auto-detect Season Number from title, filename, or link metadata
 */
export function detectSeasonNumber(link: { title?: string; seasonNumber?: number }): number {
  if (link.seasonNumber && link.seasonNumber > 0) {
    return link.seasonNumber;
  }

  if (link.title) {
    // 1. Check patterns like 1x01, 02x05, 100x12 (Season x Episode)
    const xMatch = link.title.match(/(?:^|[\s._\-[\]()])(\d{1,3})x\d{1,4}(?:[\s._\-[\]()]|\b)/i);
    if (xMatch && xMatch[1]) {
      return parseInt(xMatch[1], 10);
    }

    // 2. Check patterns like S01, S02, S100, s100, S.02, S-02, S_02, [S01], (S100)
    const sMatch = link.title.match(/(?:^|[\s._\-[\]()])s0*(\d{1,3})(?:[\s._\-[\]()]|e\d|\b)/i);
    if (sMatch && sMatch[1]) {
      return parseInt(sMatch[1], 10);
    }

    // 3. Check patterns like Season 2, Season 02, Season 100, Season.2, Season_2, Season-2
    const seasonMatch = link.title.match(/(?:^|[\s._\-[\]()])season[\s._-]?0*(\d{1,3})/i);
    if (seasonMatch && seasonMatch[1]) {
      return parseInt(seasonMatch[1], 10);
    }

    // 4. Check ordinal patterns like 1st Season, 2nd Season, 10th Season
    const ordinalMatch = link.title.match(/(\d{1,3})(?:st|nd|rd|th)\s*season/i);
    if (ordinalMatch && ordinalMatch[1]) {
      return parseInt(ordinalMatch[1], 10);
    }

    // 5. Check season range like S01-S04, S1-S8, S01-04
    const rangeMatch = link.title.match(/(?:^|[\s._\-[\]()])s0*(\d{1,3})\s*[-–—to]+\s*s?0*(\d{1,3})/i);
    if (rangeMatch && rangeMatch[1]) {
      return parseInt(rangeMatch[1], 10);
    }
  }

  return 1;
}

/**
 * Auto-detect Episode Number from title or link metadata (supports E01 - E100+)
 */
export function detectEpisodeNumber(link: { title?: string; episodeNumber?: number; url?: string }): number | undefined {
  if (link.episodeNumber !== undefined && link.episodeNumber > 0) {
    return link.episodeNumber;
  }

  let text = link.title || '';
  if (link.url) {
    try {
      const decoded = decodeURIComponent(link.url);
      text = `${text} ${decoded}`;
    } catch {
      text = `${text} ${link.url}`;
    }
  }

  if (!text) return undefined;

  // 1. Check patterns like 1x05, 01x13, 10x100 (Season x Episode)
  const xMatch = text.match(/(?:^|[\s._\-[\]()])\d{1,3}x0*(\d{1,4})(?:[\s._\-[\]()]|\b)/i);
  if (xMatch && xMatch[1]) {
    return parseInt(xMatch[1], 10);
  }

  // 2. Check patterns like S01E05, S1E1, s01e13, S02-E04, S100E100, S01.E01, S01_E01
  const sEpMatch = text.match(/s\d{1,3}[\s._\-]*(?:ep|episode|e)[\s._-]?0*(\d{1,4})(?:[\s._\-[\]()]|\b)/i);
  if (sEpMatch && sEpMatch[1]) {
    return parseInt(sEpMatch[1], 10);
  }

  // 3. Check patterns like S01.01, S01-01, S01_01, S01 01 (season.episode without 'e')
  const sNumMatch = text.match(/s\d{1,3}[\s._\-]+0*(\d{1,3})(?:[\s._\-[\]()]|\b)(?![0-9]*p\b)/i);
  if (sNumMatch && sNumMatch[1]) {
    const candidate = parseInt(sNumMatch[1], 10);
    if (candidate > 0 && candidate < 200) {
      return candidate;
    }
  }

  // 4. Check patterns like Episode 01, Episode 1, Episode: 1, Episode - 1, Episode.01, Episode-01
  const episodeMatch = text.match(/(?:^|[\s._\-[\]()])episode[\s._\-:]*0*(\d{1,4})(?:[\s._\-[\]()]|\b)/i);
  if (episodeMatch && episodeMatch[1]) {
    return parseInt(episodeMatch[1], 10);
  }

  // 5. Check patterns like EP01, EP 01, EP.01, EP. 01, EP: 1, EP - 1, Ep:01
  const epMatch = text.match(/(?:^|[\s._\-[\]()])ep[\s._\-:]*0*(\d{1,4})(?:[\s._\-[\]()]|\b)/i);
  if (epMatch && epMatch[1]) {
    return parseInt(epMatch[1], 10);
  }

  // 6. Check patterns like E01, E1, E.01, E. 1, E: 1, E-01 (must not match 2160p, 1080p, etc.)
  const eMatch = text.match(/(?:^|[\s._\-[\]()])e[\s._\-:]*0*(\d{1,4})(?:[\s._\-[\]()]|\b)(?![0-9]*p\b)/i);
  if (eMatch && eMatch[1]) {
    return parseInt(eMatch[1], 10);
  }

  // 7. Check brackets like [01], [1], (01), (1) following a season or separator
  const bracketMatch = text.match(/(?:season|\bS\d{1,3}\b|[-|•:])[ \t]*[\[(]0*(\d{1,3})[\])]/i);
  if (bracketMatch && bracketMatch[1]) {
    const candidate = parseInt(bracketMatch[1], 10);
    if (candidate > 0 && candidate < 200) {
      return candidate;
    }
  }

  // 8. Check patterns like " - 01.mkv", " - 01", " - 1.mkv", ".01.mkv"
  const fileNumMatch = text.match(/[-_.\s]0*(\d{1,3})\.(?:mkv|mp4|avi|webm)/i);
  if (fileNumMatch && fileNumMatch[1]) {
    const candidate = parseInt(fileNumMatch[1], 10);
    if (candidate > 0 && candidate < 200) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Auto-detect whether a link is a Complete Season Zip/Batch Pack or Single Episode
 */
export function detectLinkType(link: { title?: string; linkType?: string; category?: string; episodeNumber?: number; url?: string }): 'zip_pack' | 'single_episode' {
  const title = link.title || '';
  const url = link.url || '';
  const combined = `${title} ${url}`.toLowerCase();

  // 1. Explicit Zip / Archive file indicators
  const isExplicitZip = /(?:\.zip|\.rar|\.7z|\.tar|\.gz|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b|\ball\s*episodes\b|\bseason\s*\d+\s*complete\b|\bfull\s*season\b)/i.test(combined);

  // 2. Check for detected episode number (if present and not explicit complete zip pack, always single_episode)
  const ep = detectEpisodeNumber(link);

  if (ep !== undefined && ep > 0) {
    if (isExplicitZip && /(?:complete|pack|zip|batch|all\s*episodes)/i.test(combined)) {
      return 'zip_pack';
    }
    return 'single_episode';
  }

  // 3. Explicit zip archives without episode number
  if (isExplicitZip) {
    return 'zip_pack';
  }

  // 4. Check explicit flags from database/admin
  if (link.linkType === 'single_episode' || link.category === 'SingleEpisode') {
    return 'single_episode';
  }
  if (link.linkType === 'zip_pack' || link.category === 'ZipPack') {
    return 'zip_pack';
  }

  // 5. Default: for media files and streaming links, default to single episode
  return 'single_episode';
}

/**
 * Auto-extract Quality/Resolution format tags from title
 */
export function detectQuality(title: string, defaultQuality?: string): string {
  if (!title) return defaultQuality || '1080p WEB-DL';

  const tags: string[] = [];

  const cleanForQuality = title
    .replace(/[-_.\s]*4k[a-z0-9-_.]*(?:\.com|\.org|\.net|\.in|\.cx|\.to|\.nl|\.app|\.site|\.vip)\b/gi, ' ')
    .replace(/\b(?:4khdhub|vegamovies|bollyflix|hdhub4u|katmoviehd|cinemaluxe|skymovieshd|uhdmovies)[a-z0-9-_.]*/gi, ' ');

  // 1. Resolution
  let is4k = false;
  if (/(?:^|[\s._\-[\]()])(?:1080p|1080i|fhd)(?:[\s._\-[\]()]|\b)/i.test(cleanForQuality)) {
    tags.push('1080p FHD');
  } else if (/(?:^|[\s._\-[\]()])(?:2160p|uhd|\b4k\b)(?:[\s._\-[\]()]|\b)/i.test(cleanForQuality)) {
    tags.push('2160p 4K');
    is4k = true;
  } else if (/(?:^|[\s._\-[\]()])(?:720p|720i|hd)(?:[\s._\-[\]()]|\b)/i.test(cleanForQuality)) {
    tags.push('720p HD');
  } else if (/(?:^|[\s._\-[\]()])(?:480p|480i|sd)(?:[\s._\-[\]()]|\b)/i.test(cleanForQuality)) {
    tags.push('480p SD');
  }

  // 2. Source
  if (/(?:^|[\s._\-[\]()])remux(?:[\s._\-[\]()]|$)/i.test(cleanForQuality)) tags.push('REMUX');
  else if (/(?:^|[\s._\-[\]()])(?:bluray|blu-ray|bdrip)(?:[\s._\-[\]()]|$)/i.test(cleanForQuality)) tags.push('BluRay');
  else if (/(?:^|[\s._\-[\]()])(?:web-dl|webdl|webrip|web)(?:[\s._\-[\]()]|$)/i.test(cleanForQuality)) tags.push('WEB-DL');
  else if (/(?:^|[\s._\-[\]()])hdtv(?:[\s._\-[\]()]|$)/i.test(cleanForQuality)) tags.push('HDTV');

  // 3. Dynamic Range (Sense DV HDR vs HDR vs SDR / simple H.265)
  const hasDV = /(?:^|[\s._\-[\]()])(?:dv|dovi|dolby[.\s_-]*vision)(?:[\s._\-[\]()]|$)/i.test(cleanForQuality);
  const hasHDR = /(?:^|[\s._\-[\]()])(?:hdr10\+|hdr10|hdr)(?:[\s._\-[\]()]|$)/i.test(cleanForQuality);
  const hasSDR = /(?:^|[\s._\-[\]()])sdr(?:[\s._\-[\]()]|$)/i.test(cleanForQuality);

  if (hasDV && hasHDR) tags.push('DV HDR');
  else if (hasDV) tags.push('DV HDR');
  else if (hasHDR) tags.push('HDR');
  else if (hasSDR) tags.push('SDR');
  else if (is4k) tags.push('SDR'); // 4K without DV or HDR is SDR (simple H.265)

  if (/10bit/i.test(cleanForQuality)) tags.push('10bit');

  // 4. Codec (Supports H.265 / HEVC, H.264 / AVC)
  if (/(?:^|[\s._\-[\]()])(?:h\.?265|x265|hevc)(?:[\s._\-[\]()]|$)/i.test(cleanForQuality)) {
    tags.push('HEVC');
  } else if (/(?:^|[\s._\-[\]()])(?:h\.?264|x264|avc)(?:[\s._\-[\]()]|$)/i.test(cleanForQuality)) {
    tags.push('x264');
  }

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
  const hasSpanish = /spanish|spa/i.test(title);

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
  if (hasSpanish) languages.push('Spanish');

  if (languages.length > 0) {
    return languages.join(' • ');
  }

  return defaultAudio || 'English';
}

/**
 * Auto-extract File Size from title (e.g. 16.8 GB, 7.4 GB, 850 MB, 6.36 GB)
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
  const category: 'ZipPack' | 'SingleEpisode' = linkType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode';

  // Extract raw release title candidate if present
  let rawReleaseTitle = '';
  const lines = title.split('\n').map((l) => l.trim()).filter(Boolean);
  const candidate = lines.find((l) => !l.startsWith('http') && /(?:1080p|2160p|720p|4k|bluray|remux|web-dl|hevc|x265|x264|\.mkv|\.mp4)/i.test(l)) || lines[0];
  if (candidate && candidate.length > 8 && !candidate.startsWith('http')) {
    rawReleaseTitle = candidate
      .replace(/^(?:📥|🔗|⚡|🔥|🎬|▶️|\d+\.|\d+\))\s*/gu, '')
      .replace(/^(?:Name|Title|Movie|Download|Link)\s*[-:=]+\s*/i, '')
      .replace(/https?:\/\/[^\s]+/gi, '')
      .trim();
  }

  return {
    seasonNumber,
    episodeNumber,
    linkType,
    quality,
    audioLanguage,
    size,
    category,
    rawReleaseTitle: rawReleaseTitle || undefined,
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
  linkType?: 'zip_pack' | 'single_episode' | 'general';
  seasonNumber?: number;
  episodeNumber?: number;
  quality: string;
  audioLanguage: string;
  size?: string;
  category: CustomLink['category'];
}

/**
 * Intelligently parse raw bulk/multi-line text into structured season/episode links OR movie release links
 */
export function parseBulkLinksInput(
  rawText: string,
  fallbackSeason: number = 1,
  mediaType: 'movie' | 'tv' = 'tv',
  defaultCategory: CustomLink['category'] = 'Streaming'
): ParsedBulkItem[] {
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

      if (mediaType === 'movie') {
        const quality = detectQuality(titlePart);
        const audioLanguage = detectAudio(titlePart);
        const size = detectSize(titlePart);

        items.push({
          id: `bulk-${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
          title: titlePart || `Movie Release ${items.length + 1}`,
          url,
          linkType: 'general',
          seasonNumber: undefined,
          episodeNumber: undefined,
          quality: quality || '1080p WEB-DL',
          audioLanguage: audioLanguage || 'English',
          size,
          category: defaultCategory || 'Streaming',
        });
        i++;
        continue;
      }

      const meta = parseFullMediaTitle(titlePart);
      const sNum = meta.seasonNumber || fallbackSeason;
      let finalEp = meta.episodeNumber || detectEpisodeNumber({ title: titlePart, url });
      let finalLinkType = meta.linkType;
      const isExplicitZip = /(?:\.zip|\.rar|\.7z|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b)/i.test(`${titlePart} ${url}`);
      if (!finalEp && !isExplicitZip) {
        finalEp = items.filter((it) => it.linkType !== 'zip_pack').length + 1;
        finalLinkType = 'single_episode';
      }

      items.push({
        id: `bulk-${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
        title: titlePart || `Episode ${finalEp || items.length + 1}`,
        url,
        linkType: finalLinkType,
        seasonNumber: sNum,
        episodeNumber: finalEp,
        quality: meta.quality || '1080p WEB-DL',
        audioLanguage: meta.audioLanguage || 'English',
        size: meta.size,
        category: finalLinkType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
      });
      i++;
    } else {
      if (i + 1 < lines.length && urlRegex.test(lines[i + 1])) {
        const titlePart = line.replace(/^[-|:•\s\t>\])]+|[-|:•\s\t<\[(]+$/g, '').trim();
        const nextUrlMatch = lines[i + 1].match(urlRegex);
        if (nextUrlMatch) {
          const url = nextUrlMatch[1];

          if (mediaType === 'movie') {
            const quality = detectQuality(titlePart);
            const audioLanguage = detectAudio(titlePart);
            const size = detectSize(titlePart);

            items.push({
              id: `bulk-${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
              title: titlePart || `Movie Release ${items.length + 1}`,
              url,
              linkType: 'general',
              seasonNumber: undefined,
              episodeNumber: undefined,
              quality: quality || '1080p WEB-DL',
              audioLanguage: audioLanguage || 'English',
              size,
              category: defaultCategory || 'Streaming',
            });
            i += 2;
            continue;
          }

          const meta = parseFullMediaTitle(titlePart);
          const sNum = meta.seasonNumber || fallbackSeason;
          let finalEp = meta.episodeNumber || detectEpisodeNumber({ title: titlePart, url });
          let finalLinkType = meta.linkType;
          const isExplicitZip = /(?:\.zip|\.rar|\.7z|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b)/i.test(`${titlePart} ${url}`);
          if (!finalEp && !isExplicitZip) {
            finalEp = items.filter((it) => it.linkType !== 'zip_pack').length + 1;
            finalLinkType = 'single_episode';
          }

          items.push({
            id: `bulk-${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
            title: titlePart || `Episode ${finalEp || items.length + 1}`,
            url,
            linkType: finalLinkType,
            seasonNumber: sNum,
            episodeNumber: finalEp,
            quality: meta.quality || '1080p WEB-DL',
            audioLanguage: meta.audioLanguage || 'English',
            size: meta.size,
            category: finalLinkType === 'zip_pack' ? 'ZipPack' : 'SingleEpisode',
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

