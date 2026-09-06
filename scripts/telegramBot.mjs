import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis } from '@upstash/redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment from .env.local if exists
const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        let k = trimmed.slice(0, idx).trim();
        let v = trimmed.slice(idx + 1).trim();
        v = v.replace(/^["']|["']$/g, '').trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8944564119:AAHB6ETpf7BgkPRFhum2BYBqpkSZFX40SSU';
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '8265bd1679663a7ea12ac168da84d2e8';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cineflue084.vercel.app';
const DATA_FILE = path.join(rootDir, 'src', 'data', 'serverLinks.json');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

let redisClient = null;
if (REDIS_URL && REDIS_TOKEN) {
  try {
    redisClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
    console.log('⚡ Upstash Redis Cloud Database Connected!');
  } catch (e) {
    console.warn('Upstash Redis init warning:', e.message);
  }
}

// Authorized Admin IDs (Shyam)
const AUTHORIZED_TELEGRAM_IDS = [930928310];

// Memory state for multi-message uploads & interactive modes
const pendingChatState = new Map();

console.log('🤖 Starting Resilient Batch CineFuel Telegram Polling Daemon...');
console.log(`📡 Connected to Bot: @CineFlue_bot`);
console.log(`📁 Database Path: ${DATA_FILE}`);

async function registerBotCommands() {
  try {
    const res = await safeFetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'movie', description: 'Upload a Movie link (4K / 1080p / BluRay)' },
          { command: 'episode', description: 'Upload a Single TV Episode (S01E01)' },
          { command: 'bulk', description: 'Bulk upload multiple TV episodes' },
          { command: 'zip', description: 'Upload a Full Season Zip/Pack' },
          { command: 'auto', description: 'Full Auto-Sensing Mode' },
          { command: 'status', description: 'Check database & bot status' },
          { command: 'help', description: 'Show commands and upload examples' },
        ],
      }),
    });
    const data = await res?.json();
    if (data?.ok) {
      console.log('🤖 Telegram Slash Commands Registered Successfully with Telegram API!');
    }
  } catch (err) {
    console.warn('Could not register bot commands:', err.message);
  }
}

async function safeFetch(url, options = {}, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CineFuel/1.0', 'Accept': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Network Retry ${attempt}/${retries}] ${err.message}`);
      await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
}

/**
 * Splits multi-line releases into distinct blocks (1 block per link).
 * Each release block spans from the end of the previous URL up to the end of current URL.
 */
function splitMessageIntoReleaseBlocks(text) {
  const urlRegex = /(?:https?:\/\/|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}(?:\/[^\s<>'"`]+)?)/gi;
  const matches = [];
  let m;

  while ((m = urlRegex.exec(text)) !== null) {
    let clean = m[0].replace(/[),.;\]]+$/, '');
    const host = clean.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    if (!host.includes('.')) continue;
    if (/\.(mkv|mp4|avi|zip|rar|7z|tar|srt|txt|sub)$/i.test(host)) continue;

    const fullUrl = clean.startsWith('http') ? clean : 'https://' + clean;
    matches.push({
      url: fullUrl,
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  if (matches.length <= 1) {
    return [{ text: text.trim(), url: matches[0]?.url }];
  }

  const blocks = [];
  let prevEnd = 0;

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const blockText = text.substring(prevEnd, cur.end).trim();
    blocks.push({
      text: blockText,
      url: cur.url,
    });
    prevEnd = cur.end;
  }

  return blocks;
}

function extractBlockMetadata(text, fallbackUrl, forcedMode = null) {
  let url = fallbackUrl;
  const mdMatch = text.match(/\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/i);
  if (mdMatch) {
    url = mdMatch[2];
  } else if (!url) {
    const rawUrlMatch = text.match(/(https?:\/\/[^\s<>"'\]\)]+)/i) ||
                        text.match(/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}\/[^\s<>"'\]\)]+/i);
    if (rawUrlMatch) {
      url = rawUrlMatch[0].startsWith('http') ? rawUrlMatch[0] : 'https://' + rawUrlMatch[0];
    }
  }

  let cleanText = text
    .replace(/\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/gi, ' ')
    .replace(/https?:\/\/[^\s<>"'\]\)]+/gi, ' ')
    .replace(/(?:Link|URL)\s*[-:]\s*[^\s\r\n]+/gi, ' ');

  // 1. Explicit key-value labels if present
  const getField = (pattern) => {
    const m = cleanText.match(pattern);
    return m ? m[1].replace(/^[-\s:]+/, '').trim() : undefined;
  };

  const explicitTitle = getField(/(?:^|\n)\s*Title\s*[-:]\s*([^\n\r]+)/i);
  const explicitQuality = getField(/(?:^|\n)\s*Quality\s*[-:]\s*([^\n\r]+)/i);
  let explicitAudio = getField(/(?:^|\n)\s*(?:Language|Audio)\s*[-:]\s*([^\n\r]+)/i);
  let explicitSize = getField(/(?:^|\n)\s*(?:File\s*size|Size)\s*[-:]\s*([^\n\r]+)/i);
  let explicitType = getField(/(?:^|\n)\s*Media\s*Type\s*[-:]\s*([^\n\r]+)/i);

  // 2. Bracketed file size e.g. [5.75 GB] or [15.42 GB]
  if (!explicitSize) {
    const sizeMatch = cleanText.match(/\[?\b(\d+(?:\.\d+)?\s*(?:GB|MB|TB))\b\]?/i);
    if (sizeMatch) {
      explicitSize = sizeMatch[1].toUpperCase();
      cleanText = cleanText.replace(sizeMatch[0], ' ');
    }
  }

  // 3. Bracketed audio e.g. [Org Hindi DDP5.1 + English DDP5.1]
  if (!explicitAudio) {
    const bracketAudioMatch = cleanText.match(/\[([^\]]*(?:Hindi|English|Tamil|Telugu|Dual|Multi|Audio|Dub|DDP|Atmos|TrueHD)[^\]]*)\]/i);
    if (bracketAudioMatch) {
      explicitAudio = bracketAudioMatch[1].trim();
      cleanText = cleanText.replace(bracketAudioMatch[0], ' ');
    }
  }

  // 4. Year
  const yearMatch = cleanText.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  // 5. TV Season & Episode detection
  let season = 1;
  const sMatch = cleanText.match(/s0*(\d{1,2})/i) || cleanText.match(/season[\s._-]?0*(\d{1,2})/i);
  if (sMatch) season = parseInt(sMatch[1], 10);

  let episode = undefined;
  const eMatch = cleanText.match(/s\d{1,2}[\s._\-]*(?:ep|episode|e)[\s._-]?0*(\d{1,3})/i) ||
                cleanText.match(/(?:^|[\s._\-[\]()])e0*(\d{1,3})(?:[\s._\-[\]()]|\b)(?![0-9]*p\b)/i) ||
                cleanText.match(/(?:^|[\s._\-[\]()])episode[\s._-]?0*(\d{1,3})/i);
  if (eMatch) episode = parseInt(eMatch[1], 10);

  // 6. Mode Enforcement & Auto-sensing
  let isZip = false;
  if (forcedMode === 'zip') {
    isZip = true;
    explicitType = 'tv';
    episode = undefined;
  } else if (forcedMode === 'episode') {
    isZip = false;
    explicitType = 'tv';
    if (episode === undefined) episode = 1;
  } else if (forcedMode === 'movie') {
    isZip = false;
    explicitType = 'movie';
    season = undefined;
    episode = undefined;
  } else {
    // Auto-sensing
    isZip = /(?:\.zip|\.rar|\.7z|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b|\ball\s*episodes\b|\bfull\s*season\b)/i.test(cleanText) || (!episode && /(?:season|s0*\d)/i.test(cleanText) && !year);
    if (isZip || episode !== undefined || /(?:season|s0*\d)/i.test(cleanText)) {
      explicitType = 'tv';
    } else if (year && !explicitType) {
      explicitType = 'movie';
    }
  }

  // 6. Intelligent Title Extraction
  let titleForSearch = '';
  // Rule A: If TV Season/Episode marker present (e.g. S02E01, Season 2), everything BEFORE it is the show title!
  const sMarker = cleanText.match(/^(.*?)(?:[\s._\-[\]()]s0*\d{1,2}|[\s._\-[\]()]season[\s._-]?\d{1,2}|[\s._\-[\]()]\d{1,2}x\d{1,2})/i);
  if (sMarker && sMarker[1].trim().length >= 2) {
    titleForSearch = sMarker[1].replace(/[\(\)\[\]\{\}\-_.:|•+~]/g, ' ').replace(/\s+/g, ' ').trim();
  } else if (year) {
    // Rule B: If movie with Year, everything BEFORE the year is the movie title!
    const yMarker = cleanText.match(/^(.*?)(?:[\s._\-[\]()]|\b)(19\d\d|20\d\d)\b/i);
    if (yMarker && yMarker[1].trim().length >= 2) {
      titleForSearch = yMarker[1].replace(/[\(\)\[\]\{\}\-_.:|•+~]/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  if (!titleForSearch) {
    titleForSearch = explicitTitle || cleanText;
    titleForSearch = titleForSearch.replace(/\b(19\d\d|20\d\d)\b/g, '');
    titleForSearch = titleForSearch.replace(/\bs\d{1,2}(?:\s*e\d{1,3})?\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:season|episode|ep)[\s._-]?\d{1,3}\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:complete|zip\s*pack|zip|pack|batch|unrated|extended)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:2160p|4k|1080p|720p|480p|uhd|fhd|hd|sd)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:remux|bluray|blu-ray|web-dl|webrip|web|hdtv|bdrip|dsnp|nf|amzn)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:hdr10\+|hdr10|hdr|dv|dolby\s*vision|10bit|hevc|x265|x264|h264|h265)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:esubs?|mkv|mp4|avi|king-bhdstudio|dtins|r3fl3x|h0ne|hybrid)\b/gi, '');
    titleForSearch = titleForSearch.replace(/[\(\)\[\]\{\}\-_.:|•+~]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // 7. Quality Detection
  let quality = explicitQuality;
  if (!quality) {
    const qTags = [];
    if (/2160p|2160\b|4k|uhd/i.test(cleanText)) qTags.push('2160p 4K');
    else if (/1080p|1080\b|fhd/i.test(cleanText)) qTags.push('1080p FHD');
    else if (/720p|720\b|hd/i.test(cleanText)) qTags.push('720p HD');
    else if (/480p|480\b|sd/i.test(cleanText)) qTags.push('480p SD');

    if (/hybrid/i.test(cleanText)) qTags.push('Hybrid');
    if (/dv\s*hdr|dolby\s*vision/i.test(cleanText)) qTags.push('DV HDR');
    else if (/hdr10\+|hdr10|hdr/i.test(cleanText)) qTags.push('HDR');
    if (/10bit/i.test(cleanText)) qTags.push('10bit');
    if (/remux/i.test(cleanText)) qTags.push('REMUX');
    if (/bluray|blu-ray/i.test(cleanText)) qTags.push('BluRay');
    if (/dsnp/i.test(cleanText)) qTags.push('DSNP');
    if (/web-dl|webrip/i.test(cleanText)) qTags.push('WEB-DL');
    if (/hevc|x265/i.test(cleanText)) qTags.push('HEVC');

    quality = qTags.length > 0 ? qTags.join(' • ') : '1080p WEB-DL';
  }

  return {
    url,
    titleQuery: titleForSearch,
    year,
    quality,
    audio: explicitAudio ? explicitAudio.replace(/[\[\]]/g, '').trim() : 'Hindi + English',
    size: explicitSize ? explicitSize.replace(/[\[\]]/g, '').trim() : undefined,
    mediaType: explicitType,
    season,
    episode,
    isZip,
  };
}

async function searchTmdb(query, year, forcedType = null) {
  const searchQueries = [query];

  const colonParts = query.split(/[:\-]/);
  if (colonParts.length > 1 && colonParts[0].trim().length >= 3) {
    searchQueries.push(colonParts[0].trim());
  }
  const words = query.split(/\s+/);
  if (words.length > 4) {
    searchQueries.push(words.slice(0, 4).join(' '));
  }

  for (const q of searchQueries) {
    try {
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}&include_adult=false`;
      const res = await safeFetch(url);
      if (res && res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const filtered = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');

          // If forced type (e.g. 'movie' or 'tv'), prioritize that media type
          if (forcedType) {
            const typeMatch = filtered.filter(r => r.media_type === forcedType);
            if (typeMatch.length > 0) {
              if (year) {
                const ym = typeMatch.find(r => (r.release_date || r.first_air_date || '').startsWith(String(year)));
                if (ym) return ym;
              }
              return typeMatch[0];
            }
          }

          if (year && filtered.length > 0) {
            const yearMatch = filtered.find(r => (r.release_date || r.first_air_date || '').startsWith(String(year)));
            if (yearMatch) return yearMatch;
          }
          if (filtered.length > 0) return filtered[0];
          return data.results[0];
        }
      }
    } catch (err) {
      console.error(`TMDB search attempt failed for "${q}":`, err.message);
    }
  }

  return null;
}

async function saveLink(movieId, link) {
  const key = String(movieId);
  let savedLocal = false;

  // 1. Local disk backup
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let all = {};
    if (fs.existsSync(DATA_FILE)) {
      all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8') || '{}');
    }
    const existing = all[key] || [];
    all[key] = [link, ...existing.filter(l => l.id !== link.id && l.url !== link.url)];
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
    savedLocal = true;
  } catch (err) {
    console.error('Local JSON file write error:', err);
  }

  // 2. Upstash Redis Cloud save
  if (redisClient) {
    try {
      let current = [];
      try {
        const fetched = await redisClient.hget('cinefuel:curated_links', key);
        if (Array.isArray(fetched)) current = fetched;
      } catch {}
      const updated = [link, ...current.filter(l => l.id !== link.id && l.url !== link.url)];
      await redisClient.hset('cinefuel:curated_links', { [key]: updated });
      console.log(`☁️ Synced to Upstash Redis Cloud: [${movieId}] ${link.title}`);
    } catch (redisErr) {
      console.warn('Upstash Redis sync warning:', redisErr.message);
    }
  }

  // 3. Post to Live Website API for instant cloud update
  if (SITE_URL && !SITE_URL.includes('localhost')) {
    try {
      safeFetch(`${SITE_URL}/api/curated-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId, link }),
      }).catch(() => {});
    } catch {}
  }

  return savedLocal || Boolean(redisClient);
}

async function sendTelegram(chatId, text) {
  try {
    const res = await safeFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    return await res.json();
  } catch (e) {
    console.error('Telegram reply error:', e.message);
  }
}

async function handleMessage(msg) {
  const fromId = msg.from ? msg.from.id : msg.chat.id;
  const chatId = msg.chat.id;
  const rawText = (msg.text || msg.caption || '').trim();

  if (!rawText) return;

  console.log(`📩 Received message from ${msg.from?.first_name || 'User'} (${fromId}):\n"${rawText}"`);

  // 1. Authorization check
  if (!AUTHORIZED_TELEGRAM_IDS.includes(fromId)) {
    return sendTelegram(chatId, `⛔ *Unauthorized*\nYour Telegram ID (${fromId}) is not registered as an Admin.`);
  }

  // 2. Parse command if present
  let command = null;
  let commandArgs = '';
  const cmdMatch = rawText.match(/^\/([a-zA-Z0-9_-]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (cmdMatch) {
    command = cmdMatch[1].toLowerCase();
    commandArgs = (cmdMatch[2] || '').trim();
  }

  // Handle Command Menu & Help
  if (command === 'start' || command === 'help' || command === 'commands') {
    return sendTelegram(chatId, `🚀 *Welcome to CineFuel Auto-Uploader Bot!*

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
• \`/bulk [Paste 5, 8, 10 or more episode lines with links]\`

2️⃣ *Or Just Send Releases Directly!*
The bot features **intelligent auto-sensing** — it will detect whether your message is a Movie, Single Episode, Zip Pack, or Bulk list without needing any slash command!`);
  }

  if (command === 'status') {
    let count = 0;
    try {
      if (fs.existsSync(DATA_FILE)) {
        const all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8') || '{}');
        Object.values(all).forEach(arr => { if (Array.isArray(arr)) count += arr.length; });
      }
    } catch {}
    return sendTelegram(chatId, `📊 *CineFuel Bot Status*
• Bot Status: 🟢 Online & Listening
• Server Database: Connected
• Total Active Links Uploaded: *${count}*
• Admin Authorized: ✅ Yes (${msg.from?.first_name || 'Shyam'})`);
  }

  if (command === 'auto' || command === 'reset') {
    pendingChatState.delete(chatId);
    return sendTelegram(chatId, `🔄 *Auto-Sensing Mode Activated!*

You can now send any movie, single episode, bulk list, or zip pack without commands — the bot will automatically sense the release type and upload it!`);
  }

  // Interactive Command Modes (when command is sent alone)
  if ((command === 'movie' || command === 'film') && !commandArgs) {
    pendingChatState.set(chatId, { mode: 'movie', time: Date.now() });
    return sendTelegram(chatId, `🎥 *Movie Upload Mode Active!*

Send your movie release text or link. I will auto-sense movie details, quality, audio, and upload it directly to CineFuel!

📌 *Example format:*
\`Oppenheimer 2023 2160p UHD BluRay Dual Audio [15.4 GB] https://hubcloud.foo/...\`

👉 *Send your movie release now:*`);
  }

  if ((command === 'episode' || command === 'ep' || command === 'single') && !commandArgs) {
    pendingChatState.set(chatId, { mode: 'episode', time: Date.now() });
    return sendTelegram(chatId, `🎬 *Single Episode Upload Mode Active!*

Send your single TV episode details. I will auto-sense show name, season, episode, quality, and audio!

📌 *Example format:*
\`Daredevil Born Again S01E01 1080p WEB-DL Hindi DDP 5.1 [6.36 GB] - https://hubcloud.foo/...\`

👉 *Send your episode release now:*`);
  }

  if ((command === 'bulk' || command === 'batch' || command === 'episodes') && !commandArgs) {
    pendingChatState.set(chatId, { mode: 'bulk', time: Date.now() });
    return sendTelegram(chatId, `📦 *Bulk Episodes Upload Mode Active!*

Paste multiple TV episode lines or download URLs at once!

📌 *Example format:*
\`Oppenheimer S01E01 2160p WEB-DL Hindi DDP 5.1 [6.36 GB] - https://hubcloud.foo/1\`
\`Oppenheimer S01E02 2160p WEB-DL Hindi DDP 5.1 [6.28 GB] - https://hubcloud.foo/2\`
\`Oppenheimer S01E03 2160p WEB-DL Hindi DDP 5.1 [6.15 GB] - https://hubcloud.foo/3\`

👉 *Paste your multiple episode lines now:*`);
  }

  if ((command === 'zip' || command === 'pack' || command === 'season') && !commandArgs) {
    pendingChatState.set(chatId, { mode: 'zip', time: Date.now() });
    return sendTelegram(chatId, `🗜️ *Season Zip/Pack Upload Mode Active!*

Send your full season zip pack or batch archive!

📌 *Example format:*
\`Oppenheimer S01 Complete 2160p UHD BluRay DV HDR [Hindi DDP 5.1 + English Atmos].zip https://mega.nz/file/...\`

I will auto-sense the Season number, quality, audio, and publish it under the Season Zip/Pack tab!

👉 *Send your season zip pack now:*`);
  }

  // Determine active mode & text to process
  let activeMode = null;
  let textToProcess = rawText;

  if (command && ['movie', 'film'].includes(command)) {
    activeMode = 'movie';
    textToProcess = commandArgs;
  } else if (command && ['episode', 'ep', 'single'].includes(command)) {
    activeMode = 'episode';
    textToProcess = commandArgs;
  } else if (command && ['bulk', 'batch', 'episodes'].includes(command)) {
    activeMode = 'bulk';
    textToProcess = commandArgs;
  } else if (command && ['zip', 'pack', 'season'].includes(command)) {
    activeMode = 'zip';
    textToProcess = commandArgs;
  } else {
    // Check if user had a previous mode set
    const pending = pendingChatState.get(chatId);
    if (pending && pending.mode) {
      activeMode = pending.mode;
      pendingChatState.delete(chatId);
    }
  }

  // 3. Split message into individual release blocks
  const blocks = splitMessageIntoReleaseBlocks(textToProcess);

  // If no URLs found in message
  if (blocks.length === 1 && !blocks[0].url) {
    if (/^(?:hi|hello|hey)\b/i.test(textToProcess)) {
      return sendTelegram(chatId, `👋 *Hello ${msg.from?.first_name || 'Shyam'}!*

CineFuel Auto-Uploader is online! Send any movie or TV series link with details to auto-upload to your site.`);
    }

    const meta = extractBlockMetadata(textToProcess, null, activeMode);
    if (meta.titleQuery && meta.titleQuery.length >= 3) {
      pendingChatState.set(chatId, {
        rawText: textToProcess,
        meta,
        mode: activeMode,
        time: Date.now(),
      });
      return sendTelegram(chatId, `⏳ *Received Details for:* "${meta.titleQuery}"\n👉 Now send the download/stream link to publish it to CineFuel!`);
    }

    return sendTelegram(chatId, `⚠️ *No Link Detected*\nPlease include a download/stream URL with your title.`);
  }

  // Check pending state if this message is just a link
  if (blocks.length === 1 && blocks[0].url && blocks[0].text === blocks[0].url) {
    const pending = pendingChatState.get(chatId);
    if (pending) {
      blocks[0].text = `${pending.rawText}\n${blocks[0].url}`;
      if (pending.mode) activeMode = pending.mode;
      pendingChatState.delete(chatId);
    }
  }

  // Detect sensed mode if not forced
  let sensedOverall = activeMode;
  if (!sensedOverall) {
    if (blocks.length > 1) sensedOverall = 'bulk';
    else if (/(?:\.zip|\.rar|\.7z|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b|\ball\s*episodes\b|\bfull\s*season\b)/i.test(textToProcess)) sensedOverall = 'zip';
    else if (/(?:s\d{1,2}[\s._-]*(?:ep|episode|e)[\s._-]?\d{1,3}|\be\d{1,3}\b|\bepisode[\s._-]?\d{1,3}\b)/i.test(textToProcess)) sensedOverall = 'episode';
    else if (/\b(19\d\d|20\d\d)\b/.test(textToProcess) && !/s\d{1,2}/i.test(textToProcess)) sensedOverall = 'movie';
    else sensedOverall = 'auto';
  }

  // 4. Process all blocks with in-memory TMDB cache
  const publishedItems = [];
  const tmdbCache = new Map();

  for (const block of blocks) {
    if (!block.url) continue;

    const blockMode = activeMode || (sensedOverall === 'bulk' ? 'episode' : (sensedOverall !== 'auto' ? sensedOverall : null));
    const meta = extractBlockMetadata(block.text, block.url, blockMode);
    if (!meta.titleQuery || meta.titleQuery.length < 2) continue;

    const cacheKey = `${meta.titleQuery.toLowerCase()}_${meta.year || 'any'}_${meta.mediaType || 'any'}`;
    let tmdbItem = tmdbCache.get(cacheKey);

    if (!tmdbItem) {
      console.log(`🔍 Searching TMDB for: "${meta.titleQuery}" (Year: ${meta.year || 'any'}, Type: ${meta.mediaType || 'any'})`);
      tmdbItem = await searchTmdb(meta.titleQuery, meta.year, meta.mediaType);
      if (tmdbItem) tmdbCache.set(cacheKey, tmdbItem);
    }

    if (!tmdbItem) {
      console.warn(`Could not find TMDB match for: ${meta.titleQuery}`);
      continue;
    }

    const isTv = meta.mediaType === 'tv' ||
                 (meta.mediaType !== 'movie' && (tmdbItem.media_type === 'tv' || meta.episode !== undefined || /s\d{1,2}/i.test(block.text)));
    const mediaType = isTv ? 'tv' : 'movie';
    const officialTitle = tmdbItem.title || tmdbItem.name || meta.titleQuery;
    const releaseDate = tmdbItem.release_date || tmdbItem.first_air_date || '';
    const releaseYear = releaseDate ? releaseDate.slice(0, 4) : (meta.year ? String(meta.year) : '');
    const movieId = tmdbItem.id;

    let displayTitle = '';
    let category = 'Streaming';

    if (mediaType === 'tv') {
      if (meta.isZip) {
        category = 'ZipPack';
        displayTitle = `Season ${meta.season} Complete (${meta.quality} • ${meta.audio})`;
      } else {
        category = 'SingleEpisode';
        const epStr = meta.episode ? `Episode ${meta.episode}` : 'Episode';
        displayTitle = `Season ${meta.season} ${epStr} (${meta.quality} • ${meta.audio})`;
      }
    } else {
      displayTitle = `${meta.quality} • ${meta.audio}`;
    }

    if (meta.size) displayTitle += ` [${meta.size}]`;

    const linkObj = {
      id: `tg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: displayTitle,
      url: meta.url,
      category,
      seasonNumber: mediaType === 'tv' ? meta.season : undefined,
      episodeNumber: mediaType === 'tv' ? meta.episode : undefined,
      linkType: mediaType === 'tv' ? (meta.isZip ? 'zip_pack' : 'single_episode') : undefined,
      quality: meta.quality,
      audioLanguage: meta.audio,
      size: meta.size,
      createdAt: new Date().toISOString(),
    };

    const saved = await saveLink(movieId, linkObj);
    if (saved) {
      console.log(`✅ Published: ${officialTitle} (${movieId}) -> ${displayTitle}`);
      publishedItems.push({
        title: officialTitle,
        year: releaseYear,
        mediaType,
        movieId,
        season: meta.season,
        episode: meta.episode,
        isZip: meta.isZip,
        quality: meta.quality,
        audio: meta.audio,
        size: meta.size,
        url: meta.url,
        pageUrl: `${SITE_URL}/${mediaType}/${movieId}`,
      });
    }
  }

  // 5. Send Confirmation Message back to Telegram
  if (publishedItems.length === 0) {
    return sendTelegram(chatId, `⚠️ *Could Not Process Releases*\nCould not find TMDB matches for the titles provided. Please verify spelling.`);
  }

  // Case A: Single Release
  if (publishedItems.length === 1) {
    const item = publishedItems[0];
    let modeBadge = '';
    if (item.mediaType === 'movie') {
      modeBadge = `🎥 Movie (${activeMode ? 'Command' : 'Auto-Sensed'})`;
    } else if (item.isZip) {
      modeBadge = `🗜️ Season ${item.season} Complete Zip/Pack (${activeMode ? 'Command' : 'Auto-Sensed'})`;
    } else {
      modeBadge = `🎬 Single Episode (Season ${item.season}, Ep ${item.episode || 1}) (${activeMode ? 'Command' : 'Auto-Sensed'})`;
    }

    return sendTelegram(chatId, `🎉 *Link Successfully Published to CineFuel!*

🎬 *Title:* ${item.title} ${item.year ? `(${item.year})` : ''}
🏷️ *Upload Mode:* ${modeBadge}
💎 *Quality:* \`${item.quality}\`
🔊 *Audio:* \`${item.audio}\`
${item.size ? `💾 *Size:* \`${item.size}\`\n` : ''}🌐 *View on Website:*
[Open ${item.title} on CineFuel](${item.pageUrl})

✅ *Direct Link Stored:*
\`${item.url}\``);
  }

  // Case B: Batch of TV Episodes for the SAME show and season (e.g. Daredevil Season 2 E01-E13)
  const allSameTvSeason = publishedItems.length > 1 &&
    publishedItems.every(i => i.mediaType === 'tv' && i.movieId === publishedItems[0].movieId && i.season === publishedItems[0].season);

  if (allSameTvSeason) {
    const first = publishedItems[0];
    const epNumbers = publishedItems.map(i => i.episode).filter(Boolean).sort((a, b) => a - b);
    const epRange = epNumbers.length > 0 
      ? `E${String(epNumbers[0]).padStart(2, '0')} - E${String(epNumbers[epNumbers.length - 1]).padStart(2, '0')}` 
      : `${publishedItems.length} Episodes`;

    let tvMsg = `🎉 *Bulk TV Episodes Upload Successful!*\n\n`;
    tvMsg += `🎬 *Show:* ${first.title} (${first.year})\n`;
    tvMsg += `🏷️ *Upload Mode:* 📦 Bulk Episodes (${publishedItems.length} Episodes: \`${epRange}\`)\n`;
    tvMsg += `📺 *Season:* Season ${first.season}\n`;
    tvMsg += `💎 *Quality:* \`${first.quality}\`\n`;
    tvMsg += `🔊 *Audio:* \`${first.audio}\`\n\n`;
    tvMsg += `🌐 *View Season on Website:*\n[Open ${first.title} Season ${first.season} on CineFuel](${first.pageUrl})\n\n`;
    tvMsg += `✅ All ${publishedItems.length} episodes are now live in their respective Season ${first.season} slots!`;

    return sendTelegram(chatId, tvMsg);
  }

  // Case C: Multi-Movie Collection / Trilogy Batch
  let batchMsg = `🎉 *Batch Upload Successful! (${publishedItems.length} Releases Published)*\n\n`;

  publishedItems.forEach((item, index) => {
    const typeIcon = item.mediaType === 'tv' ? (item.isZip ? '🗜️' : '🎬') : '🎥';
    batchMsg += `${index + 1}️⃣ ${typeIcon} *${item.title} (${item.year})*\n`;
    batchMsg += `💎 \`${item.quality}\`${item.size ? ` [${item.size}]` : ''}\n`;
    batchMsg += `🔊 \`${item.audio}\`\n`;
    batchMsg += `🌐 [Open on CineFuel](${item.pageUrl})\n\n`;
  });

  batchMsg += `✅ All ${publishedItems.length} titles are now live on your site!`;

  return sendTelegram(chatId, batchMsg);
}

// Long-polling loop
let lastUpdateId = 0;

async function pollUpdates() {
  while (true) {
    try {
      const res = await safeFetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`);
      if (res && res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = update.update_id;
            const message = update.message || update.edited_message;
            if (message) {
              try {
                await handleMessage(message);
              } catch (msgErr) {
                console.error('Error handling message:', msgErr);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Polling loop error (retry in 3s):', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function main() {
  await registerBotCommands();
  pollUpdates();
}

main();

