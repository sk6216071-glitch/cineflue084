import fs from 'fs';
import path from 'path';
import { parseFullMediaTitle } from './seasonParser';
import { saveLinkToDatabase } from './redisDb';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '8265bd1679663a7ea12ac168da84d2e8';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cineflue084.vercel.app';
const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'serverLinks.json');

// Strict URL regex: matches http(s):// or www. or domain with path slash
// Never matches audio codec names like DTS-HD.MA or media file extensions!
export const STRICT_URL_REGEX = /(?:https?:\/\/[^\s<>'"`]+|www\.[^\s<>'"`]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|cx|in|co|cc|me|app|dev|to|is|pw|club|vip|link|xyz|live|pro|site|online|top|info|stream|ws|download|tech|click|cloud|movie|nz)\/[^\s<>'"`]*)/gi;

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
  let s = text.replace(new RegExp(STRICT_URL_REGEX.source, 'gi'), '');
  
  // Extract 4-digit year if present (19xx or 20xx)
  const yearMatch = s.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  // Remove common media release noise
  s = s.replace(/\b(19\d\d|20\d\d)\b/g, '');
  s = s.replace(/s\d{1,2}(?:\s*e\d{1,3})?/gi, '');
  s = s.replace(/\b(?:season|episode|ep|s|e)[\s._-]?\d{1,3}\b/gi, '');
  s = s.replace(/\b(?:director'?s\s*cut|extended(?:\s*cut)?|theatrical(?:\s*cut)?|unrated|remastered)\b/gi, '');
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

export async function searchTmdbMedia(query: string, year?: number, forcedType?: 'movie' | 'tv') {
  if (!query || query.length < 2) return null;

  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const filtered = data.results.filter(
        (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
      );

      if (forcedType) {
        const typeMatch = filtered.filter((r: any) => r.media_type === forcedType);
        if (typeMatch.length > 0) {
          if (year) {
            const yearMatch = typeMatch.find((r: any) => {
              const dateStr = r.release_date || r.first_air_date || '';
              return dateStr.startsWith(String(year));
            });
            if (yearMatch) return yearMatch;
          }
          return typeMatch[0];
        }
      }

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

export async function saveLinkToServerDatabase(movieId: number, link: any) {
  try {
    await saveLinkToDatabase(movieId, link);
    return true;
  } catch (err) {
    console.error('Failed to save link to database:', err);
    return false;
  }
}

export async function processTelegramMessage(fromId: number, rawText: string): Promise<ProcessResult> {
  const isAuthorized = AUTHORIZED_TELEGRAM_IDS.includes(fromId);

  if (!isAuthorized) {
    return {
      success: false,
      replyText: `⛔ *Unauthorized Access*\nYour Telegram ID (${fromId}) is not registered as an Admin.`,
    };
  }

  const trimmed = rawText.trim();

  // 1. Parse command if present
  let command: string | null = null;
  let commandArgs = '';
  const cmdMatch = trimmed.match(/^\/([a-zA-Z0-9_-]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (cmdMatch) {
    command = cmdMatch[1].toLowerCase();
    commandArgs = (cmdMatch[2] || '').trim();
  }

  if (command === 'start' || command === 'help' || command === 'commands') {
    return {
      success: true,
      replyText: `🚀 *Welcome to CineFuel Auto-Uploader Bot!*

Send any movie or TV series release to auto-upload directly to CineFuel!

⚡ *Slash Commands Menu:*
• \`/movie\` - Movie Upload Mode (4K / 1080p / BluRay)
• \`/episode\` or \`/ep\` - Single TV Episode Mode (S01E01)
• \`/bulk\` or \`/batch\` - Bulk TV Episodes Mode
• \`/zip\` or \`/pack\` - Full Season Zip / RAR / Pack Mode
• \`/auto\` - Full Auto-Sensing Mode (Default)
• \`/status\` - Server database & active link stats

💡 *Two Easy Ways to Use:*

1️⃣ *Direct Command with Links:*
• \`/movie Oppenheimer 2023 2160p UHD BluRay [15.4 GB] https://...\`
• \`/ep Daredevil S02E01 1080p WEB-DL Hindi DDP 5.1 https://...\`
• \`/zip Loki S02 Complete 2160p DV HDR Zip Pack https://...\`
• \`/bulk [Paste multiple episode lines with links]\`

2️⃣ *Or Just Send Releases Directly!*
The bot features **intelligent auto-sensing** — it will detect whether your message is a Movie, Single Episode, Zip Pack, or Bulk list without needing any slash command!`,
    };
  }

  if (command === 'status') {
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
• Admin Authorized: ✅ Yes`,
    };
  }

  // Interactive guidance when command sent alone
  if ((command === 'movie' || command === 'film') && !commandArgs) {
    return {
      success: true,
      replyText: `🎥 *Movie Upload Mode Active!*

Send your movie release text or link. I will auto-sense movie details, quality, audio, and upload it directly to CineFuel!

📌 *Example format:*
\`Oppenheimer 2023 2160p UHD BluRay Dual Audio [15.4 GB] https://hubcloud.foo/...\``,
    };
  }

  if ((command === 'episode' || command === 'ep' || command === 'single') && !commandArgs) {
    return {
      success: true,
      replyText: `🎬 *Single Episode Upload Mode Active!*

Send your single TV episode details. I will auto-sense show name, season, episode, quality, and audio!

📌 *Example format:*
\`Daredevil Born Again S01E01 1080p WEB-DL Hindi DDP 5.1 [6.36 GB] - https://hubcloud.foo/...\``,
    };
  }

  if ((command === 'bulk' || command === 'batch' || command === 'episodes') && !commandArgs) {
    return {
      success: true,
      replyText: `📦 *Bulk Episodes Upload Mode Active!*

Paste multiple TV episode lines or download URLs at once!

📌 *Example format:*
\`Oppenheimer S01E01 2160p WEB-DL Hindi DDP 5.1 [6.36 GB] - https://hubcloud.foo/1\`
\`Oppenheimer S01E02 2160p WEB-DL Hindi DDP 5.1 [6.28 GB] - https://hubcloud.foo/2\`
\`Oppenheimer S01E03 2160p WEB-DL Hindi DDP 5.1 [6.15 GB] - https://hubcloud.foo/3\``,
    };
  }

  if ((command === 'zip' || command === 'pack' || command === 'season') && !commandArgs) {
    return {
      success: true,
      replyText: `🗜️ *Season Zip/Pack Upload Mode Active!*

Send your full season zip pack or batch archive!

📌 *Example format:*
\`Oppenheimer S01 Complete 2160p UHD BluRay DV HDR [Hindi DDP 5.1 + English Atmos].zip https://mega.nz/file/...\``,
    };
  }

  let forcedMode: 'movie' | 'episode' | 'zip' | 'bulk' | null = null;
  let textToProcess = trimmed;

  if (command && ['movie', 'film'].includes(command)) {
    forcedMode = 'movie';
    textToProcess = commandArgs;
  } else if (command && ['episode', 'ep', 'single'].includes(command)) {
    forcedMode = 'episode';
    textToProcess = commandArgs;
  } else if (command && ['bulk', 'batch', 'episodes'].includes(command)) {
    forcedMode = 'bulk';
    textToProcess = commandArgs;
  } else if (command && ['zip', 'pack', 'season'].includes(command)) {
    forcedMode = 'zip';
    textToProcess = commandArgs;
  }

  // 2. Extract Link(s)
  const matches = textToProcess.match(new RegExp(STRICT_URL_REGEX.source, 'gi'));
  const urls = matches ? matches.map(u => u.replace(/[),.;\]]+$/, '')).map(u => u.startsWith('http') ? u : 'https://' + u) : [];

  if (!urls || urls.length === 0) {
    return {
      success: false,
      replyText: `⚠️ *No URL Detected*
Please include at least one valid download or streaming URL (starting with \`http://\` or \`https://\`).

*Example:*
\`Oppenheimer 2023 2160p UHD BluRay Dual Audio https://example.com/file\``,
    };
  }

  const primaryUrl = urls[0];
  const { query, year } = cleanTitleForSearch(textToProcess);

  if (!query || query.length < 2) {
    return {
      success: false,
      replyText: `⚠️ *Title Not Found*
Could not recognize a movie or TV show title in your message.
Please provide the title along with the link!`,
    };
  }

  // 3. Auto-sensing or forced mode detection
  let sensedType: 'movie' | 'tv' | undefined = undefined;
  if (forcedMode === 'movie') sensedType = 'movie';
  else if (forcedMode === 'episode' || forcedMode === 'zip' || forcedMode === 'bulk') sensedType = 'tv';
  else {
    // Auto-sensing
    if (/(?:s\d{1,2}|season|\.zip|\.rar|\.7z|pack|batch|episode|ep\d)/i.test(textToProcess)) {
      sensedType = 'tv';
    } else if (year) {
      sensedType = 'movie';
    }
  }

  // Search TMDB
  const tmdbItem = await searchTmdbMedia(query, year, sensedType);
  if (!tmdbItem) {
    return {
      success: false,
      replyText: `🔍 *Could Not Find Title on TMDB*
Searched for: \`${query}\` ${year ? `(${year})` : ''}
Please check the spelling and try again.`,
    };
  }

  const mediaType: 'movie' | 'tv' = (forcedMode === 'movie') 
    ? 'movie' 
    : (forcedMode ? 'tv' : (tmdbItem.media_type === 'tv' || sensedType === 'tv' ? 'tv' : 'movie'));
    
  const officialTitle = tmdbItem.title || tmdbItem.name || query;
  const releaseDate = tmdbItem.release_date || tmdbItem.first_air_date || '';
  const releaseYear = releaseDate ? releaseDate.slice(0, 4) : '';
  const movieId = tmdbItem.id;

  // 4. Parse media quality, format, season, episode
  const meta = parseFullMediaTitle(textToProcess);
  const isZip = forcedMode === 'zip' ? true : (forcedMode === 'episode' ? false : meta.linkType === 'zip_pack');

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
    episodeNumber: mediaType === 'tv' ? (isZip ? undefined : (meta.episodeNumber || 1)) : undefined,
    linkType: mediaType === 'tv' ? (isZip ? 'zip_pack' : 'single_episode') : undefined,
    quality: meta.quality,
    audioLanguage: meta.audioLanguage,
    size: meta.size,
    createdAt: new Date().toISOString(),
  };

  // 5. Save to database
  const saved = await saveLinkToServerDatabase(movieId, linkObj);

  if (!saved) {
    return {
      success: false,
      replyText: `❌ *Error Saving Link*
Failed to write link to the CineFuel database. Please check server logs.`,
    };
  }

  const websiteUrl = `${SITE_URL}/${mediaType}/${movieId}`;

  let modeBadge = '';
  if (mediaType === 'movie') {
    modeBadge = `🎥 Movie (${forcedMode ? 'Command' : 'Auto-Sensed'})`;
  } else if (isZip) {
    modeBadge = `🗜️ Season ${meta.seasonNumber} Complete Zip/Pack (${forcedMode ? 'Command' : 'Auto-Sensed'})`;
  } else {
    modeBadge = `🎬 Single Episode (Season ${meta.seasonNumber}, Ep ${meta.episodeNumber || 1}) (${forcedMode ? 'Command' : 'Auto-Sensed'})`;
  }

  return {
    success: true,
    movie: tmdbItem,
    link: linkObj,
    replyText: `🎉 *Link Successfully Published to CineFuel!*

🎬 *Title:* ${officialTitle} ${releaseYear ? `(${releaseYear})` : ''}
🏷️ *Upload Mode:* ${modeBadge}
💎 *Quality:* \`${meta.quality}\`
🔊 *Audio:* \`${meta.audioLanguage}\`
${meta.size ? `💾 *Size:* \`${meta.size}\`\n` : ''}🌐 *View on Website:*
[Open ${officialTitle} on CineFuel](${websiteUrl})

✅ *Direct Link Stored:*
\`${primaryUrl}\``,
  };
}
