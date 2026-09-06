import fs from 'fs';
import path from 'path';
import { parseFullMediaTitle } from './seasonParser';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '8265bd1679663a7ea12ac168da84d2e8';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cineflue084.vercel.app';
const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'serverLinks.json');

// Authorized Admin IDs (Shyam's Telegram ID is 930928310)
export const AUTHORIZED_TELEGRAM_IDS = [
  930928310, // Shyam
];

export interface ProcessResult {
  replyText: string;
  success: boolean;
  movie?: any;
  link?: any;
}

export function cleanTitleForSearch(text: string): { query: string; year?: number } {
  let s = text.replace(/https?:\/\/[^\s<>'"`]+/gi, '');
  
  // Extract 4-digit year if present (19xx or 20xx)
  const yearMatch = s.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  // Remove common media release noise
  s = s.replace(/\b(19\d\d|20\d\d)\b/g, '');
  s = s.replace(/s\d{1,2}(?:\s*e\d{1,3})?/gi, '');
  s = s.replace(/\b(?:season|episode|ep|s|e)[\s._-]?\d{1,3}\b/gi, '');
  s = s.replace(/\b(?:complete|zip\s*pack|zip|pack|batch|all\s*episodes|full\s*season)\b/gi, '');
  s = s.replace(/\b(?:2160p|4k|1080p|720p|480p|uhd|fhd|hd|sd)\b/gi, '');
  s = s.replace(/\b(?:remux|bluray|blu-ray|web-dl|webrip|web|hdtv|bdrip|dsnp|nf|amzn|hmax|hotstar|zee5)\b/gi, '');
  s = s.replace(/\b(?:dual\s*audio|multi\s*audio|hindi|english|tamil|telugu|korean|japanese|spanish|dubs?|sub|subs)\b/gi, '');
  s = s.replace(/\b(?:atmos|ddp5\.1|ddp|5\.1|7\.1|aac|ac3|truehd|dts)\b/gi, '');
  s = s.replace(/\b(?:hdr10\+|hdr10|hdr|dv|dolby\s*vision|10bit|hevc|x265|x264|h264|h265|avc)\b/gi, '');
  s = s.replace(/\b(?:esubs?|mkv|mp4|avi|zip|rar)\b/gi, '');
  
  // Clean punctuation and excess whitespace
  s = s.replace(/[\(\)\[\]\{\}\-_.:|•+]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  return { query: s, year };
}

export async function searchTmdbMedia(query: string, year?: number) {
  if (!query || query.length < 2) return null;

  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const filtered = data.results.filter(
        (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
      );

      if (year && filtered.length > 0) {
        const yearMatch = filtered.find((r: any) => {
          const dateStr = r.release_date || r.first_air_date || '';
          return dateStr.startsWith(String(year));
        });
        if (yearMatch) return yearMatch;
      }

      return filtered[0] || data.results[0];
    }
  } catch (err) {
    console.error('TMDB Search error:', err);
  }
  return null;
}

export function saveLinkToServerDatabase(movieId: number, link: any) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let allLinks: Record<string, any[]> = {};
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      allLinks = JSON.parse(raw || '{}');
    }

    const key = String(movieId);
    const existing = allLinks[key] || [];
    allLinks[key] = [link, ...existing.filter((l: any) => l.id !== link.id && l.url !== link.url)];

    fs.writeFileSync(DATA_FILE, JSON.stringify(allLinks, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save link to serverLinks.json:', err);
    return false;
  }
}

export async function processTelegramMessage(fromId: number, rawText: string): Promise<ProcessResult> {
  const isAuthorized = AUTHORIZED_TELEGRAM_IDS.includes(fromId);

  // 1. Check commands
  const trimmed = rawText.trim();
  if (trimmed === '/start' || trimmed === '/help') {
    return {
      success: true,
      replyText: `🚀 *Welcome to CineFuel Auto-Uploader Bot!*

I automatically inspect links and titles, detect 4K/1080p quality, audio tracks, seasons, and publish them directly to your CineFuel website!

📌 *How to Upload:*
Simply send your title, quality, and link in a message. For example:

👉 *TV Series Complete Zip Pack:*
\`Loki S02 Complete 2160p 4K HDR Hindi English Zip Pack\`
\`https://drive.google.com/file/d/xxxx/view\`

👉 *Single Episode:*
\`Daredevil Born Again S01E01 1080p WEB-DL Hindi + Eng\`
\`https://cloud.mail.ru/public/xxxx\`

👉 *Movie 4K / 1080p:*
\`Deadpool & Wolverine (2024) 2160p 4K Remux Dual Audio\`
\`https://mega.nz/file/xxxx\`

✨ *Features:*
• Auto TMDB match & poster linking
• Auto 2160p / 1080p / 720p detection
• Auto Hindi / English / Dual Audio tagging
• Auto Zip Pack vs Single Episode detection
• Live instant website update!`,
    };
  }

  if (trimmed === '/status') {
    let count = 0;
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw || '{}');
        Object.values(parsed).forEach((arr: any) => {
          if (Array.isArray(arr)) count += arr.length;
        });
      }
    } catch {}
    return {
      success: true,
      replyText: `📊 *CineFuel Bot Status*
• Bot Status: 🟢 Online & Listening
• Server Database: Connected
• Total Active Links Uploaded: *${count}*
• Admin Authorized: ${isAuthorized ? '✅ Yes' : '❌ No'}`,
    };
  }

  if (!isAuthorized) {
    return {
      success: false,
      replyText: `⛔ *Unauthorized Access*
Your Telegram ID (${fromId}) is not registered as an Admin.
Please contact the site owner to authorize your account.`,
    };
  }

  // 2. Extract Link(s)
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const urls = trimmed.match(urlRegex);

  if (!urls || urls.length === 0) {
    return {
      success: false,
      replyText: `⚠️ *No URL Detected*
Please include at least one valid download or streaming URL (starting with \`http://\` or \`https://\`).

*Example:*
\`Loki S02 Complete 2160p 4K Zip Pack https://example.com/loki-s2.zip\``,
    };
  }

  const primaryUrl = urls[0];
  const { query, year } = cleanTitleForSearch(trimmed);

  if (!query || query.length < 2) {
    return {
      success: false,
      replyText: `⚠️ *Title Not Found*
Could not recognize a movie or TV show title in your message.
Please provide the title along with the link!`,
    };
  }

  // 3. Search TMDB
  const tmdbItem = await searchTmdbMedia(query, year);
  if (!tmdbItem) {
    return {
      success: false,
      replyText: `🔍 *Could Not Find Title on TMDB*
Searched for: \`${query}\` ${year ? `(${year})` : ''}
Please check the spelling and try again.`,
    };
  }

  const mediaType: 'movie' | 'tv' = tmdbItem.media_type === 'tv' ? 'tv' : 'movie';
  const officialTitle = tmdbItem.title || tmdbItem.name || query;
  const releaseDate = tmdbItem.release_date || tmdbItem.first_air_date || '';
  const releaseYear = releaseDate ? releaseDate.slice(0, 4) : '';
  const movieId = tmdbItem.id;

  // 4. Parse media quality, format, season, episode
  const meta = parseFullMediaTitle(trimmed);
  const isZip = meta.linkType === 'zip_pack';

  let displayTitle = '';
  let category: string = 'Streaming';

  if (mediaType === 'tv') {
    if (isZip) {
      category = 'ZipPack';
      displayTitle = `Season ${meta.seasonNumber} Complete (${meta.quality} • ${meta.audioLanguage})`;
    } else {
      category = 'SingleEpisode';
      const epStr = meta.episodeNumber ? `Episode ${meta.episodeNumber}` : 'Episode';
      displayTitle = `Season ${meta.seasonNumber} ${epStr} (${meta.quality} • ${meta.audioLanguage})`;
    }
  } else {
    displayTitle = `${meta.quality} • ${meta.audioLanguage}`;
  }

  if (meta.size) {
    displayTitle += ` [${meta.size}]`;
  }

  const customLinkId = `tg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const linkObj = {
    id: customLinkId,
    title: displayTitle,
    url: primaryUrl,
    category,
    seasonNumber: mediaType === 'tv' ? meta.seasonNumber : undefined,
    episodeNumber: mediaType === 'tv' ? meta.episodeNumber : undefined,
    linkType: mediaType === 'tv' ? meta.linkType : undefined,
    quality: meta.quality,
    audioLanguage: meta.audioLanguage,
    size: meta.size,
    createdAt: new Date().toISOString(),
  };

  // 5. Save to database
  const saved = saveLinkToServerDatabase(movieId, linkObj);

  if (!saved) {
    return {
      success: false,
      replyText: `❌ *Error Saving Link*
Failed to write link to the CineFuel database. Please check server logs.`,
    };
  }

  const websiteUrl = `${SITE_URL}/${mediaType}/${movieId}`;

  return {
    success: true,
    movie: tmdbItem,
    link: linkObj,
    replyText: `🎉 *Link Successfully Published to CineFuel!*

🎬 *Title:* ${officialTitle} ${releaseYear ? `(${releaseYear})` : ''}
📂 *Media Type:* ${mediaType === 'tv' ? '📺 TV Series' : '🎥 Movie'}
📦 *Format:* ${mediaType === 'tv' ? (isZip ? `📦 Season ${meta.seasonNumber} Complete Zip Pack` : `🎬 Season ${meta.seasonNumber} Ep ${meta.episodeNumber || 1}`) : '🎞️ Full Movie'}
💎 *Quality:* \`${meta.quality}\`
🔊 *Audio:* \`${meta.audioLanguage}\`
${meta.size ? `💾 *Size:* \`${meta.size}\`\n` : ''}🌐 *View on Website:*
[Open ${officialTitle} on CineFuel](${websiteUrl})

✅ *Direct Link Stored:*
\`${primaryUrl}\``,
  };
}
