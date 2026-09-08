import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import { Redis } from '@upstash/redis';
import { MongoClient } from 'mongodb';
import http from 'http';

// Ensure IPv4 lookup precedence for stable TMDB API and external cloud connections
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ FATAL: TELEGRAM_BOT_TOKEN is not set in environment or .env.local');
  process.exit(1);
}

// Global process crash shields: keep bot alive 24/7
process.on('uncaughtException', (err) => {
  console.error('🛡️ Process shielded from uncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('🛡️ Process shielded from unhandledRejection:', reason);
});

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '8265bd1679663a7ea12ac168da84d2e8';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cineflue084.vercel.app';
const DATA_FILE = path.join(rootDir, 'src', 'data', 'serverLinks.json');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

let redisClient = null;
if (REDIS_URL && REDIS_TOKEN) {
  try {
    redisClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
    console.log('⚡ Upstash Redis Cloud Database Connected!');
  } catch (e) {
    console.warn('Upstash Redis init warning:', e.message);
  }
}

let mongoDb = null;
if (MONGODB_URI) {
  try {
    const mongoClient = new MongoClient(MONGODB_URI);
    mongoClient.connect().then(() => {
      mongoDb = mongoClient.db('cinefuel');
      console.log('🍃 MongoDB Atlas Database Connected!');
    }).catch(err => {
      console.warn('MongoDB Atlas connection error:', err.message);
    });
  } catch (e) {
    console.warn('MongoDB Atlas client init error:', e.message);
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
          { command: 'domain', description: '1-Click switch HubCloud or GDFlix domain across all links' },
          { command: 'hubcloud', description: 'Update all HubCloud links (e.g. /hubcloud hubcloud.cx)' },
          { command: 'gdflix', description: 'Update all GDFlix links (e.g. /gdflix new1.gdflix.io)' },
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

async function sendChatAction(chatId, action = 'typing') {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

async function safeFetch(url, options = {}, retries = 2) {
  const timeoutMs = options.timeoutMs || 8000;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CineFuel/1.0', 'Accept': 'application/json', ...(options.headers || {}) },
        signal: controller.signal,
        ...options,
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 250 * attempt));
    }
  }
}

// Strict URL regex: matches http(s):// or www. or domain with path slash
// Never matches audio codec names like DTS-HD.MA or media file extensions!
const STRICT_URL_REGEX = /(?:https?:\/\/[^\s<>'"`]+|www\.[^\s<>'"`]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|cx|in|co|cc|me|app|dev|to|is|pw|club|vip|link|xyz|live|pro|site|online|top|info|stream|ws|download|tech|click|cloud|movie|nz)\/[^\s<>'"`]*)/gi;

function detectServer(url) {
  if (!url) return { name: 'Direct Server', badge: '⚡ Direct Server' };
  let host = '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    const m = url.match(/(?:https?:\/\/)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
    host = m ? m[1].toLowerCase() : '';
  }

  if (host.includes('hubcloud')) return { name: 'HubCloud', badge: '⚡ HubCloud' };
  if (host.includes('gdflix')) return { name: 'GDFlix', badge: '🚀 GDFlix' };
  if (host.includes('drive.google')) return { name: 'Google Drive', badge: '📁 Google Drive' };
  if (host.includes('gofile')) return { name: 'GoFile', badge: '⚡ GoFile' };
  if (host.includes('mega.nz') || host.includes('mega.io')) return { name: 'MEGA', badge: '🔴 MEGA' };
  if (host.includes('1fichier')) return { name: '1Fichier', badge: '🗄️ 1Fichier' };
  if (host.includes('mediafire')) return { name: 'MediaFire', badge: '🔥 MediaFire' };
  if (host.includes('terabox')) return { name: 'TeraBox', badge: '📦 TeraBox' };
  if (host.includes('filepress')) return { name: 'FilePress', badge: '⚡ FilePress' };
  if (host.includes('streamtape') || host.includes('dood') || host.includes('mixdrop') || host.includes('streamwish')) {
    return { name: 'Stream Player', badge: '▶️ Stream Player' };
  }
  if (host) {
    const parts = host.split('.');
    const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    const cap = base.charAt(0).toUpperCase() + base.slice(1);
    return { name: cap, badge: `🔗 ${cap}` };
  }
  return { name: 'Direct Server', badge: '⚡ Direct Server' };
}

/**
 * Splits multi-line releases into distinct blocks (1 block per link).
 * Each release block spans from the end of the previous URL up to the end of current URL.
 */
function splitMessageIntoReleaseBlocks(text) {
  const matches = [];
  let m;
  const regex = new RegExp(STRICT_URL_REGEX.source, 'gi');

  while ((m = regex.exec(text)) !== null) {
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
    const rawUrlMatch = text.match(STRICT_URL_REGEX);
    if (rawUrlMatch) {
      url = rawUrlMatch[0].startsWith('http') ? rawUrlMatch[0] : 'https://' + rawUrlMatch[0];
    }
  }

  let cleanText = text
    .replace(/\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/gi, ' ')
    .replace(new RegExp(STRICT_URL_REGEX.source, 'gi'), ' ')
    .replace(/(?:Link|URL)\s*[-:]\s*[^\s\r\n]+/gi, ' ')
    .replace(/https?:\/\/[^\s]+/gi, ' ')
    .replace(/www\.[^\s]+/gi, ' ');

  if (url) {
    cleanText = cleanText.split(url).join(' ');
  }

  // Strip release groups, website domains, and media container extensions from cleanText
  cleanText = cleanText
    .replace(/[-_.\s]*[a-zA-Z0-9_-]*(?:hub|mod|hd|flix|drive|cx|com|org|net|me|in|to)\.(?:com|org|net|mkv|mp4|avi)\b/gi, ' ')
    .replace(/\b(?:4khdhub|hdhub4u|moviesmod|bollyflix|dotmovies|vegamovies|katmoviehd|uhdmovies)[^\s]*\b/gi, ' ')
    .replace(/\.(mkv|mp4|avi|m4v)\b/gi, ' ');

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

  // 3. Audio detection (bracketed or inline)
  if (!explicitAudio) {
    const bracketAudioMatch = cleanText.match(/\[([^\]]*(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Dual|Multi|Audio|Dub|DDP|Atmos|TrueHD|DTS)[^\]]*)\]/i);
    if (bracketAudioMatch) {
      explicitAudio = bracketAudioMatch[1].trim();
      cleanText = cleanText.replace(bracketAudioMatch[0], ' ');
    }
  }

  if (!explicitAudio) {
    const langs = [];
    if (/\b(?:Dual[\s._-]?Audio)\b/i.test(cleanText)) langs.push('Dual Audio');
    else if (/\b(?:Multi[\s._-]?Audio)\b/i.test(cleanText)) langs.push('Multi Audio');

    if (/\bHindi\b/i.test(cleanText) && !langs.includes('Dual Audio')) langs.push('Hindi');
    if (/\bEnglish\b/i.test(cleanText) && !langs.includes('Dual Audio')) langs.push('English');
    if (/\bTamil\b/i.test(cleanText)) langs.push('Tamil');
    if (/\bTelugu\b/i.test(cleanText)) langs.push('Telugu');
    if (/\bMalayalam\b/i.test(cleanText)) langs.push('Malayalam');
    if (/\bKannada\b/i.test(cleanText)) langs.push('Kannada');

    const codecs = [];
    if (/\bAtmos\b/i.test(cleanText)) codecs.push('Atmos');
    if (/\bTrueHD\b/i.test(cleanText)) codecs.push('TrueHD');
    if (/DTS-HD(?:\.MA)?/i.test(cleanText)) codecs.push('DTS-HD MA');
    else if (/\bDTS\b/i.test(cleanText)) codecs.push('DTS');
    if (/DDP[\s._-]?5\.1/i.test(cleanText)) codecs.push('DDP 5.1');
    else if (/DD[\s._-]?5\.1/i.test(cleanText)) codecs.push('DD 5.1');

    if (langs.length > 0 || codecs.length > 0) {
      explicitAudio = [...langs, ...codecs].join(' ');
    }
  }

  // 4. Year
  const yearMatch = cleanText.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  // 5. TV Season & Episode detection (supports S01...S100+ and E01...E100+)
  let season = undefined;
  let episode = undefined;

  // A. Combined Season & Episode e.g. S01E05, S1 E1, S02-EP03, S01.E04, 2x05
  const seMatch = cleanText.match(/(?:^|[\s._\-[\]()])s0*(\d{1,3})[\s._\-]*(?:ep|episode|e)[\s._-]?0*(\d{1,4})(?:[\s._\-[\]()]|\b)/i) ||
                  cleanText.match(/(?:^|[\s._\-[\]()])(\d{1,3})x0*(\d{1,4})(?:[\s._\-[\]()]|\b)/i);
  if (seMatch) {
    season = parseInt(seMatch[1], 10);
    episode = parseInt(seMatch[2], 10);
  }

  // B. Standalone Season e.g. S01, Season 2, Season-03
  if (season === undefined) {
    const sMatch = cleanText.match(/(?:^|[\s._\-[\]()])s0*(\d{1,3})(?:[\s._\-[\]()]|\b)/i) ||
                  cleanText.match(/(?:^|[\s._\-[\]()])season[\s._-]?0*(\d{1,3})(?:[\s._\-[\]()]|\b)/i);
    if (sMatch) season = parseInt(sMatch[1], 10);
  }

  // C. Standalone Episode e.g. E05, Ep 12, Episode 3
  if (episode === undefined) {
    const eMatch = cleanText.match(/(?:^|[\s._\-[\]()])(?:ep|episode)[\s._-]?0*(\d{1,4})(?:[\s._\-[\]()]|\b)/i) ||
                  cleanText.match(/(?:^|[\s._\-[\]()])e0*(\d{1,4})(?:[\s._\-[\]()]|\b)(?![0-9]*p\b)/i);
    if (eMatch) episode = parseInt(eMatch[1], 10);
  }

  // 6. Mode Enforcement & Auto-sensing
  let isZip = false;
  if (forcedMode === 'zip') {
    isZip = true;
    explicitType = 'tv';
    if (!season) season = 1;
    episode = undefined;
  } else if (forcedMode === 'episode') {
    isZip = false;
    explicitType = 'tv';
    if (!season) season = 1;
    if (episode === undefined) episode = 1;
  } else if (forcedMode === 'movie') {
    isZip = false;
    explicitType = 'movie';
    season = undefined;
    episode = undefined;
  } else {
    // Auto-sensing:
    // S01..S100, E01..E100, Season, Episode, Zip Pack are 100% EXCLUSIVE TO TV SERIES!
    // Movies NEVER have Seasons or Episodes.
    const isTvBySeason = season !== undefined;
    const isTvByEpisode = episode !== undefined;
    const isTvByWord = /(?:^|[\s._\-[\]()])(?:s0*\d{1,3}|e0*\d{1,4}|season|episodes?|series)(?:[\s._\-[\]()]|\b)/i.test(cleanText);
    isZip = /(?:\.zip|\.rar|\.7z|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b|\ball\s*episodes\b|\bfull\s*season\b)/i.test(cleanText);

    if (isTvBySeason || isTvByEpisode || isTvByWord || isZip) {
      // DEFINITIVE TV SERIES: Any season S01..S100 or episode E01..E100 means TV show!
      explicitType = 'tv';
      if (!season) season = 1;
    } else {
      explicitType = 'movie';
      season = undefined;
      episode = undefined;
    }
  }

  // 7. Intelligent Title Extraction
  // Strip emojis, pictographs, and decorative channel bullets from text
  const textWithoutEmojis = cleanText.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ');

  let titleForSearch = '';
  // Rule A: If TV Season/Episode marker present, everything BEFORE it is the show title!
  const sMarker = textWithoutEmojis.match(/^(.*?)(?:[\s._\-[\]()]s0*\d{1,3}|[\s._\-[\]()]season[\s._-]?\d{1,3}|[\s._\-[\]()]e0*\d{1,4}|[\s._\-[\]()](?:ep|episode)[\s._-]?\d{1,4}|[\s._\-[\]()]\d{1,3}x\d{1,4})/i);
  if (sMarker && sMarker[1].trim().length >= 2) {
    titleForSearch = sMarker[1]
      .replace(/\b(19\d\d|20\d\d)\b/g, '')
      .replace(/[\(\)\[\]\{\}\-_.:|•+~#*@/\\=]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else if (year) {
    // Rule B: If movie with Year, everything BEFORE the year is the movie title!
    const yMarker = textWithoutEmojis.match(/^(.*?)(?:[\s._\-[\]()]|\b)(19\d\d|20\d\d)\b/i);
    if (yMarker && yMarker[1].trim().length >= 2) {
      titleForSearch = yMarker[1].replace(/[\(\)\[\]\{\}\-_.:|•+~#*@/\\=]/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  if (!titleForSearch) {
    titleForSearch = explicitTitle || textWithoutEmojis;
    titleForSearch = titleForSearch.replace(/\b(19\d\d|20\d\d)\b/g, '');
    titleForSearch = titleForSearch.replace(/\bs\d{1,3}(?:\s*e\d{1,4})?\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:season|episode|ep)[\s._-]?\d{1,4}\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:director'?s\s*cut|extended(?:\s*cut)?|theatrical(?:\s*cut)?|unrated|remastered)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:complete|zip\s*pack|zip|pack|batch)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:2160p|4k|1080p|720p|480p|uhd|fhd|hd|sd)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:remux|bluray|blu-ray|web-dl|webrip|web|hdtv|bdrip|dsnp|nf|amzn)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:hdr10\+|hdr10|hdr|dv|dolby\s*vision|10bit|hevc|x265|x264|h264|h265)\b/gi, '');
    titleForSearch = titleForSearch.replace(/\b(?:esubs?|mkv|mp4|avi|king-bhdstudio|dtins|r3fl3x|h0ne|hybrid)\b/gi, '');
    titleForSearch = titleForSearch.replace(/[\(\)\[\]\{\}\-_.:|•+~#*@/\\=]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Strip leading list numbers, indexes, or release prefixes e.g. "2.", "01.", "[1]", "1 - "
  titleForSearch = titleForSearch
    .replace(/^[\s(\[]*\d{1,3}[\s)\]]*[\s._\-:]+/i, '')
    .trim();

  // 7. Quality Detection
  let quality = explicitQuality;
  if (!quality) {
    const qTags = [];
    if (/\b(?:2160p|2160|4k|uhd)\b/i.test(cleanText)) qTags.push('2160p 4K');
    else if (/\b(?:1080p|1080|fhd)\b/i.test(cleanText)) qTags.push('1080p FHD');
    else if (/\b(?:720p|720|hd)\b/i.test(cleanText)) qTags.push('720p HD');
    else if (/\b(?:480p|480|sd)\b/i.test(cleanText)) qTags.push('480p SD');

    if (/\bhybrid\b/i.test(cleanText)) qTags.push('Hybrid');
    if (/dv[\s._-]*hdr|dolby[\s._-]*vision/i.test(cleanText)) qTags.push('DV HDR');
    else if (/\b(?:hdr10\+|hdr10|hdr)\b/i.test(cleanText)) qTags.push('HDR');
    if (/\b10bit\b/i.test(cleanText)) qTags.push('10bit');
    if (/\bremux\b/i.test(cleanText)) qTags.push('REMUX');
    if (/\b(?:bluray|blu-ray)\b/i.test(cleanText)) qTags.push('BluRay');
    if (/\bdsnp\b/i.test(cleanText)) qTags.push('DSNP');
    if (/\b(?:web-dl|webrip|web)\b/i.test(cleanText)) qTags.push('WEB-DL');
    if (/\b(?:hevc|x265|h265)\b/i.test(cleanText)) qTags.push('HEVC');

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

// Intelligent TMDB result ranking: prioritizes exact title, exact release year, and penalizes distant sequels
function rankTmdbResults(items, cleanQ, targetYear, forcedType) {
  if (!items || items.length === 0) return null;
  const normQ = cleanQ.toLowerCase().trim();
  const scored = items.map((item) => {
    let score = 0;
    const itemTitle = (item.title || item.name || '').toLowerCase().trim();
    const itemYear = (item.release_date || item.first_air_date || '').slice(0, 4);

    // Exact title match gets highest boost
    if (itemTitle === normQ) score += 120;
    else if (itemTitle.startsWith(normQ)) score += 40;

    // Exact year match
    if (targetYear && itemYear === String(targetYear)) score += 80;
    else if (targetYear && Math.abs(Number(itemYear) - Number(targetYear)) <= 1) score += 40;
    else if (targetYear && itemYear && Math.abs(Number(itemYear) - Number(targetYear)) > 2) {
      // Penalize titles with heavily mismatched release years (e.g. 1961 series when searching 2012 movie)
      score -= Math.min(80, Math.abs(Number(itemYear) - Number(targetYear)) * 2);
    }

    // Penalize far future sequels (e.g. 2027 in-production when searching 2025 release)
    if (targetYear && Number(itemYear) > Number(targetYear) + 1) score -= 60;

    // Type match
    if (forcedType && item.media_type === forcedType) score += 50;

    // Popularity tie-breaker
    score += Math.min(item.popularity || 0, 25);

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item || null;
}

// Global in-memory cache for TMDB results (persists across polls)
const globalTmdbCache = new Map();

async function searchTmdb(query, year, forcedType = null) {
  if (!query || query.trim().length < 2) return null;
  // Strip leading list numbers, indexes e.g. "2.", "01.", "[1]"
  const cleanQ = query.trim().replace(/^[\s(\[]*\d{1,3}[\s)\]]*[\s._\-:]+/i, '').trim();
  const cacheKey = `${cleanQ.toLowerCase()}_${year || 'any'}_${forcedType || 'any'}`;
  if (globalTmdbCache.has(cacheKey)) {
    return globalTmdbCache.get(cacheKey);
  }

  // 1. First attempt: exact cleaned title
  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanQ)}&include_adult=false`;
    const res = await safeFetch(url, { timeoutMs: 3500 }, 1);
    if (res && res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const filtered = data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
        const best = rankTmdbResults(filtered, cleanQ, year, forcedType);
        if (best) {
          globalTmdbCache.set(cacheKey, best);
          return best;
        }
      }
    }
  } catch (err) {
    console.error(`TMDB search attempt 1 failed for "${cleanQ}":`, err.message);
  }

  // 2. Second quick attempt: shortened if multi-word
  const words = cleanQ.split(/\s+/);
  if (words.length > 3) {
    const shortened = words.slice(0, 3).join(' ');
    try {
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(shortened)}&include_adult=false`;
      const res = await safeFetch(url, { timeoutMs: 3000 }, 1);
      if (res && res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const filtered = data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
          const best = rankTmdbResults(filtered, shortened, year, forcedType);
          if (best) {
            globalTmdbCache.set(cacheKey, best);
            return best;
          }
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Batch saves multiple links grouped by movieId to both local disk and Upstash Redis
 */
async function saveMultipleLinks(linksByMovieId) {
  // 1. Local disk backup (Single file read & single write for maximum speed)
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let all = {};
    if (fs.existsSync(DATA_FILE)) {
      try {
        all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8') || '{}');
      } catch {}
    }
    for (const [movieId, newLinks] of Object.entries(linksByMovieId)) {
      const existing = all[movieId] || [];
      const newIds = new Set(newLinks.map(l => l.id));
      const newUrls = new Set(newLinks.map(l => l.url));
      all[movieId] = [...newLinks, ...existing.filter(l => !newIds.has(l.id) && !newUrls.has(l.url))];
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('Local JSON batch write error:', err);
  }

  // 2. Upstash Redis Cloud save (Concurrent execution for zero lag)
  if (redisClient) {
    await Promise.allSettled(Object.entries(linksByMovieId).map(async ([movieId, newLinks]) => {
      try {
        let current = [];
        try {
          const fetched = await redisClient.hget('cinefuel:curated_links', movieId);
          if (Array.isArray(fetched)) current = fetched;
        } catch {}
        const newIds = new Set(newLinks.map(l => l.id));
        const newUrls = new Set(newLinks.map(l => l.url));
        const updated = [...newLinks, ...current.filter(l => !newIds.has(l.id) && !newUrls.has(l.url))];
        await redisClient.hset('cinefuel:curated_links', { [movieId]: updated });
        console.log(`☁️ Synced to Upstash Redis Cloud: [${movieId}] (${newLinks.length} links)`);
      } catch (redisErr) {
        console.warn(`Upstash Redis batch sync warning for ${movieId}:`, redisErr.message);
      }
    }));
  }

  // 3. MongoDB Atlas Cloud save (if configured)
  if (mongoDb) {
    try {
      const collection = mongoDb.collection('links');
      const operations = [];
      for (const [movieId, newLinks] of Object.entries(linksByMovieId)) {
        for (const link of newLinks) {
          operations.push({
            updateOne: {
              filter: { movieId: String(movieId), url: link.url },
              update: { $set: { ...link, movieId: String(movieId), updatedAt: new Date() } },
              upsert: true,
            },
          });
        }
      }
      if (operations.length > 0) {
        await collection.bulkWrite(operations);
        console.log(`🍃 Synced to MongoDB Atlas: (${operations.length} links)`);
      }
    } catch (mongoErr) {
      console.warn('MongoDB Atlas batch sync warning:', mongoErr.message);
    }
  }

  return true;
}

function getDomainFamily(host) {
  if (!host) return null;
  const h = host.toLowerCase().replace(/^www\./, '');
  if (h.includes('hubcloud')) return { family: 'hubcloud', name: 'HubCloud' };
  if (h.includes('gdflix')) return { family: 'gdflix', name: 'GDFlix' };
  return null;
}

/**
 * Migrates all links from oldDomain to newDomain across local JSON, Upstash Redis, and MongoDB Atlas.
 */
async function migrateDomain(oldDomain, newDomain) {
  const cleanOld = oldDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  const cleanNew = newDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  if (!cleanOld || !cleanNew || cleanOld === cleanNew) {
    return { success: false, updatedCount: 0, oldDomain: cleanOld, newDomain: cleanNew };
  }

  let totalUpdated = 0;

  // 1. Local JSON update
  try {
    if (fs.existsSync(DATA_FILE)) {
      const all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8') || '{}');
      let localCount = 0;
      for (const [movieId, links] of Object.entries(all)) {
        if (!Array.isArray(links)) continue;
        for (const link of links) {
          if (link.url && link.url.toLowerCase().includes(cleanOld)) {
            link.url = link.url.replace(new RegExp(cleanOld, 'gi'), cleanNew);
            const sInfo = detectServer(link.url);
            link.serverName = sInfo.name;
            link.serverBadge = sInfo.badge;
            link.updatedAt = new Date().toISOString();
            localCount++;
          }
        }
      }
      if (localCount > 0) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
        totalUpdated = Math.max(totalUpdated, localCount);
        console.log(`📁 Local JSON: migrated ${localCount} links from ${cleanOld} to ${cleanNew}`);
      }
    }
  } catch (err) {
    console.error('Local JSON domain migration error:', err);
  }

  // 2. Upstash Redis Cloud update
  if (redisClient) {
    try {
      const allKeys = await redisClient.hgetall('cinefuel:curated_links');
      if (allKeys && typeof allKeys === 'object') {
        let redisCount = 0;
        const toUpdate = {};
        for (const [movieId, linksVal] of Object.entries(allKeys)) {
          let links = [];
          if (Array.isArray(linksVal)) links = linksVal;
          else if (typeof linksVal === 'string') {
            try { links = JSON.parse(linksVal); } catch {}
          }
          let modified = false;
          for (const link of links) {
            if (link.url && link.url.toLowerCase().includes(cleanOld)) {
              link.url = link.url.replace(new RegExp(cleanOld, 'gi'), cleanNew);
              const sInfo = detectServer(link.url);
              link.serverName = sInfo.name;
              link.serverBadge = sInfo.badge;
              link.updatedAt = new Date().toISOString();
              modified = true;
              redisCount++;
            }
          }
          if (modified) {
            toUpdate[movieId] = links;
          }
        }
        if (Object.keys(toUpdate).length > 0) {
          await redisClient.hset('cinefuel:curated_links', toUpdate);
          totalUpdated = Math.max(totalUpdated, redisCount);
          console.log(`☁️ Upstash Redis: migrated ${redisCount} links to ${cleanNew}`);
        }
      }
    } catch (redisErr) {
      console.warn('Redis domain migration warning:', redisErr.message);
    }
  }

  // 3. MongoDB Atlas update
  if (mongoDb) {
    try {
      const collection = mongoDb.collection('links');
      const docs = await collection.find({ url: { $regex: cleanOld, $options: 'i' } }).toArray();
      if (docs && docs.length > 0) {
        const ops = docs.map((doc) => {
          const newUrl = doc.url.replace(new RegExp(cleanOld, 'gi'), cleanNew);
          const sInfo = detectServer(newUrl);
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: {
                  url: newUrl,
                  serverName: sInfo.name,
                  serverBadge: sInfo.badge,
                  updatedAt: new Date(),
                },
              },
            },
          };
        });
        if (ops.length > 0) {
          await collection.bulkWrite(ops);
          totalUpdated = Math.max(totalUpdated, ops.length);
          console.log(`🍃 MongoDB Atlas: migrated ${ops.length} links from ${cleanOld} to ${cleanNew}`);
        }
      }
    } catch (mongoErr) {
      console.warn('MongoDB Atlas domain migration warning:', mongoErr.message);
    }
  }

  return { success: true, updatedCount: totalUpdated, oldDomain: cleanOld, newDomain: cleanNew };
}

/**
 * Checks if incoming link is from a dynamic provider (HubCloud / GDFlix)
 * and automatically migrates any older links in the database to the new domain.
 */
async function autoDetectAndSyncDomain(newUrl) {
  if (!newUrl) return null;
  try {
    let newHost = '';
    try {
      const p = new URL(newUrl.startsWith('http') ? newUrl : `https://${newUrl}`);
      newHost = p.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      const m = newUrl.match(/(?:https?:\/\/)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      newHost = m ? m[1].toLowerCase().replace(/^www\./, '') : '';
    }

    const familyInfo = getDomainFamily(newHost);
    if (!familyInfo) return null;

    const oldHostsFound = new Set();

    // Check MongoDB Atlas for older domains under same family
    if (mongoDb) {
      try {
        const collection = mongoDb.collection('links');
        const regexStr = familyInfo.family === 'hubcloud' ? 'hubcloud\\.' : 'gdflix\\.';
        const docs = await collection.find({ url: { $regex: regexStr, $options: 'i' } }, { projection: { url: 1 } }).toArray();
        docs.forEach((d) => {
          try {
            const h = new URL(d.url).hostname.toLowerCase().replace(/^www\./, '');
            if (h && h !== newHost && getDomainFamily(h)?.family === familyInfo.family) {
              oldHostsFound.add(h);
            }
          } catch {}
        });
      } catch {}
    }

    // Also check local JSON
    try {
      if (fs.existsSync(DATA_FILE)) {
        const all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8') || '{}');
        Object.values(all).flat().forEach((l) => {
          try {
            const h = new URL(l.url).hostname.toLowerCase().replace(/^www\./, '');
            if (h && h !== newHost && getDomainFamily(h)?.family === familyInfo.family) {
              oldHostsFound.add(h);
            }
          } catch {}
        });
      }
    } catch {}

    if (oldHostsFound.size === 0) return null;

    const migrations = [];
    for (const oldHost of oldHostsFound) {
      const res = await migrateDomain(oldHost, newHost);
      if (res.updatedCount > 0) {
        migrations.push({ name: familyInfo.name, oldHost, newHost, count: res.updatedCount });
      }
    }

    return migrations.length > 0 ? migrations : null;
  } catch (err) {
    console.warn('Auto domain sync check warning:', err.message);
    return null;
  }
}

/**
 * Automatically detects the provider (HubCloud / GDFlix) from the given input (domain or URL)
 * and replaces ALL existing links of that provider across the entire database with the new domain.
 */
async function migrateProviderToNewDomain(input, forcedProvider = null) {
  if (!input) return { success: false, error: 'No domain or link provided' };

  let cleanHost = '';
  try {
    const p = new URL(input.startsWith('http') ? input : `https://${input}`);
    cleanHost = p.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    cleanHost = input.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').trim();
  }

  if (!cleanHost || !cleanHost.includes('.')) {
    return { success: false, error: `Invalid domain: "${input}"` };
  }

  let family = null;
  if (forcedProvider === 'hubcloud' || cleanHost.includes('hubcloud')) {
    family = { id: 'hubcloud', name: 'HubCloud', regexStr: 'hubcloud\\.' };
  } else if (forcedProvider === 'gdflix' || cleanHost.includes('gdflix')) {
    family = { id: 'gdflix', name: 'GDFlix', regexStr: 'gdflix\\.' };
  } else {
    return {
      success: false,
      error: `Could not auto-detect provider for "${cleanHost}". Please use \`/hubcloud ${cleanHost}\` or \`/gdflix ${cleanHost}\``,
    };
  }

  const oldHostsMap = new Map();

  // 1. Find all older hosts currently stored in MongoDB Atlas
  if (mongoDb) {
    try {
      const docs = await mongoDb
        .collection('links')
        .find({ url: { $regex: family.regexStr, $options: 'i' } }, { projection: { url: 1 } })
        .toArray();
      docs.forEach((d) => {
        try {
          const h = new URL(d.url).hostname.toLowerCase().replace(/^www\./, '');
          if (h && h !== cleanHost) {
            oldHostsMap.set(h, (oldHostsMap.get(h) || 0) + 1);
          }
        } catch {}
      });
    } catch (e) {
      console.warn('MongoDB query error in migrateProviderToNewDomain:', e.message);
    }
  }

  // 2. Also check local JSON fallback
  if (fs.existsSync(DATA_FILE)) {
    try {
      const all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8') || '{}');
      Object.values(all)
        .flat()
        .forEach((l) => {
          try {
            const h = new URL(l.url).hostname.toLowerCase().replace(/^www\./, '');
            if (h && h !== cleanHost && getDomainFamily(h)?.family === family.id) {
              if (!oldHostsMap.has(h)) {
                oldHostsMap.set(h, (oldHostsMap.get(h) || 0) + 1);
              }
            }
          } catch {}
        });
    } catch {}
  }

  if (oldHostsMap.size === 0) {
    return {
      success: true,
      provider: family.name,
      newDomain: cleanHost,
      oldHosts: [],
      updatedCount: 0,
      alreadyUpToDate: true,
    };
  }

  let grandTotal = 0;
  const replacedDetails = [];

  for (const [oldHost, expectedCount] of oldHostsMap.entries()) {
    const res = await migrateDomain(oldHost, cleanHost);
    if (res.updatedCount > 0) {
      grandTotal += res.updatedCount;
      replacedDetails.push({ oldHost, count: res.updatedCount });
    }
  }

  return {
    success: true,
    provider: family.name,
    newDomain: cleanHost,
    oldHosts: replacedDetails,
    updatedCount: grandTotal,
    alreadyUpToDate: false,
  };
}

async function saveLink(movieId, link) {
  return saveMultipleLinks({ [String(movieId)]: [link] });
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
      timeoutMs: 5000,
    });
    return await res?.json();
  } catch (e) {
    console.error('Telegram reply error:', e.message);
  }
}

async function handleMessage(msg) {
  const fromId = msg.from ? msg.from.id : msg.chat.id;
  const chatId = msg.chat.id;
  const rawText = (msg.text || msg.caption || '').trim();

  // Send instant typing indicator so Telegram user sees instant response (<50ms)
  sendChatAction(chatId, 'typing').catch(() => {});

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
• \`/domain\` or \`/hubcloud\` / \`/gdflix\` - 1-Click switch mirror across all links & website
• \`/status\` - Server database & active link stats

💡 *Two Easy Ways to Use:*

1️⃣ *Direct Command with Links:*
• \`/movie Oppenheimer 2023 2160p UHD BluRay [15.4 GB] https://...\`
• \`/ep Daredevil S02E01 1080p WEB-DL Hindi DDP 5.1 https://...\`
• \`/zip Loki S02 Complete 2160p DV HDR Zip Pack https://...\`
• \`/bulk [Paste 5, 8, 10 or more episode lines with links]\`
• \`/hubcloud hubcloud.cx\` (Swaps ALL HubCloud links on your entire website)
• \`/gdflix new1.gdflix.io\` (Swaps ALL GDFlix links on your entire website)

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

  if (command === 'domain' || command === 'setdomain' || command === 'hubcloud' || command === 'gdflix' || command === 'updatedomain' || command === 'migrate') {
    let forced = null;
    if (command === 'hubcloud') forced = 'hubcloud';
    if (command === 'gdflix') forced = 'gdflix';

    const parts = (commandArgs || '').trim().split(/\s+/).filter(Boolean);

    // Case 1: Two domains provided explicitly (/updatedomain old new)
    if (parts.length >= 2) {
      const oldDom = parts[0];
      const newDom = parts[1];
      sendChatAction(chatId, 'typing');
      const res = await migrateDomain(oldDom, newDom);
      if (res.updatedCount > 0) {
        return sendTelegram(chatId, `🎉 *Domain Migration Successful!*
• Provider: \`${res.oldDomain}\` ➡️ \`${res.newDomain}\`
• Total Links Updated: *${res.updatedCount}*
• Synced across MongoDB Atlas, Upstash Redis & local cache.
🌐 All movies on CineFuel will now use \`${res.newDomain}\`!`);
      } else {
        return sendTelegram(chatId, `⚠️ *No Links Matched \`${oldDom}\`*
No links in the database currently use \`${oldDom}\`.
Use \`/domain\` without arguments to see all active domains in your database.`);
      }
    }

    // Case 2: One domain or link provided (/domain hubcloud.cx or /hubcloud hubcloud.cx or /gdflix new1.gdflix.io)
    if (parts.length === 1) {
      sendChatAction(chatId, 'typing');
      const res = await migrateProviderToNewDomain(parts[0], forced);

      if (!res.success) {
        return sendTelegram(chatId, `⚠️ *Domain Migration Error:*\n${res.error}`);
      }

      if (res.alreadyUpToDate) {
        return sendTelegram(chatId, `✅ *${res.provider} is Already Up To Date!*
All existing ${res.provider} links in your database and on CineFuel already use \`${res.newDomain}\`.`);
      }

      if (res.updatedCount > 0) {
        const details = res.oldHosts.map(h => `• \`${h.oldHost}\` ➡️ \`${res.newDomain}\` (*${h.count}* links)`).join('\n');
        return sendTelegram(chatId, `🎉 *${res.provider} Domain Updated Across Entire Website!*

• *New Active Domain:* \`${res.newDomain}\`
• *Replaced Older Mirrors:*
${details}

• *Total Links Migrated in Database:* *${res.updatedCount}*
• *Databases Synced:* MongoDB Atlas, Upstash Redis & local storage

🌐 *Live on Website:* All download buttons on CineFuel now open with \`${res.newDomain}\`!`);
      }

      return sendTelegram(chatId, `⚠️ No links found to update for ${res.provider}.`);
    }

    // Case 3: No arguments provided - show current database summary & quick examples
    sendChatAction(chatId, 'typing');
    const hostCounts = {};
    if (mongoDb) {
      try {
        const docs = await mongoDb.collection('links').find({}, { projection: { url: 1 } }).toArray();
        docs.forEach(d => {
          try {
            const h = new URL(d.url).hostname.toLowerCase().replace(/^www\./, '');
            if (h) hostCounts[h] = (hostCounts[h] || 0) + 1;
          } catch {}
        });
      } catch {}
    }
    if (Object.keys(hostCounts).length === 0 && fs.existsSync(DATA_FILE)) {
      try {
        const all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8') || '{}');
        Object.values(all).flat().forEach(l => {
          try {
            const h = new URL(l.url).hostname.toLowerCase().replace(/^www\./, '');
            if (h) hostCounts[h] = (hostCounts[h] || 0) + 1;
          } catch {}
        });
      } catch {}
    }

    const hubcloudHosts = Object.entries(hostCounts).filter(([h]) => h.includes('hubcloud')).map(([h, c]) => `  • \`${h}\`: *${c}* links`).join('\n') || '  • No HubCloud links yet';
    const gdflixHosts = Object.entries(hostCounts).filter(([h]) => h.includes('gdflix')).map(([h, c]) => `  • \`${h}\`: *${c}* links`).join('\n') || '  • No GDFlix links yet';
    const otherHosts = Object.entries(hostCounts).filter(([h]) => !h.includes('hubcloud') && !h.includes('gdflix')).slice(0, 5).map(([h, c]) => `  • \`${h}\`: *${c}* links`).join('\n');

    return sendTelegram(chatId, `🔄 *1-Click Domain Switcher*

Send the new domain (or any link from it), and the bot will auto-detect the provider and update ALL existing links in your database and on your website in 1 second!

📌 *How to use:*
• \`/domain <new_domain_or_link>\`
• \`/hubcloud <new_domain_or_link>\`
• \`/gdflix <new_domain_or_link>\`

💡 *Examples (tap to copy):*
• \`/hubcloud hubcloud.cx\`
• \`/gdflix new1.gdflix.io\`
• \`/domain https://hubcloud.cx/drive/4luzeji9zlxioea\`

📊 *Domains Currently Stored in Database:*
*⚡ HubCloud:*
${hubcloudHosts}

*🚀 GDFlix:*
${gdflixHosts}
${otherHosts ? `\n*📁 Other Hosts:*\n${otherHosts}` : ''}

💡 *Smart Auto-Sync Active:* When you upload any release with a newer mirror, older links are also upgraded automatically!`);
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
    if (/(?:\.zip|\.rar|\.7z|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b|\ball\s*episodes\b|\bfull\s*season\b)/i.test(textToProcess)) sensedOverall = 'zip';
    else if (/(?:s\d{1,2}[\s._-]*(?:ep|episode|e)[\s._-]?\d{1,3}|\be\d{1,3}\b|\bepisode[\s._-]?\d{1,3}\b)/i.test(textToProcess)) sensedOverall = 'episode';
    else if (/\b(19\d\d|20\d\d)\b/.test(textToProcess) && !/s\d{1,2}/i.test(textToProcess)) sensedOverall = 'movie';
    else sensedOverall = 'auto';
  }

  // 4. High-Performance Parallel Block Processing
  const publishedItems = [];
  const linksByMovieId = {};

  const blockItems = blocks
    .filter(b => b.url)
    .map(block => {
      const blockMode = activeMode || (sensedOverall !== 'auto' ? sensedOverall : null);
      const meta = extractBlockMetadata(block.text, block.url, blockMode);
      return { block, meta };
    })
    .filter(item => item.meta.titleQuery && item.meta.titleQuery.length >= 2);

  // Group by titleQuery to query TMDB once per unique title in the batch
  const uniqueSearches = new Map();
  for (const item of blockItems) {
    const key = `${item.meta.titleQuery.toLowerCase()}_${item.meta.year || 'any'}_${item.meta.mediaType || 'any'}`;
    if (!uniqueSearches.has(key)) {
      uniqueSearches.set(key, item.meta);
    }
  }

  // Fetch TMDB concurrently
  const searchResults = new Map();
  await Promise.all(
    Array.from(uniqueSearches.entries()).map(async ([key, meta]) => {
      const result = await searchTmdb(meta.titleQuery, meta.year, meta.mediaType);
      if (result) searchResults.set(key, result);
    })
  );

  for (const { block, meta } of blockItems) {
    const key = `${meta.titleQuery.toLowerCase()}_${meta.year || 'any'}_${meta.mediaType || 'any'}`;
    const tmdbItem = searchResults.get(key);
    if (!tmdbItem) {
      console.warn(`Could not find TMDB match for: ${meta.titleQuery}`);
      continue;
    }

    // Strict Movie vs TV Classification:
    // 1. Explicit user commands (/episode, /zip, /movie) take priority
    // 2. TMDB result is authoritative: if TMDB found a movie, it is a MOVIE
    // 3. If TMDB found a TV series, it is a TV SERIES
    // 4. Otherwise, auto-sensed metadata is used
    let isTv = false;
    if (activeMode === 'episode' || activeMode === 'zip') {
      isTv = true;
    } else if (activeMode === 'movie') {
      isTv = false;
    } else if (tmdbItem.media_type === 'movie') {
      isTv = false;
    } else if (tmdbItem.media_type === 'tv') {
      isTv = true;
    } else {
      isTv = meta.mediaType === 'tv';
    }

    const mediaType = isTv ? 'tv' : 'movie';
    const officialTitle = tmdbItem.title || tmdbItem.name || meta.titleQuery;
    const releaseDate = tmdbItem.release_date || tmdbItem.first_air_date || '';
    const releaseYear = releaseDate ? releaseDate.slice(0, 4) : (meta.year ? String(meta.year) : '');
    const movieId = tmdbItem.id;

    let displayTitle = '';
    let category = 'Streaming';

    if (mediaType === 'tv') {
      const tvSeason = meta.season || 1;
      if (meta.isZip) {
        category = 'ZipPack';
        displayTitle = `Season ${tvSeason} Complete (${meta.quality} • ${meta.audio})`;
      } else {
        category = 'SingleEpisode';
        const epStr = meta.episode ? `Episode ${meta.episode}` : 'Episode 1';
        displayTitle = `Season ${tvSeason} ${epStr} (${meta.quality} • ${meta.audio})`;
      }
    } else {
      category = 'Streaming';
      displayTitle = `${meta.quality} • ${meta.audio}`;
    }

    if (meta.size) displayTitle += ` [${meta.size}]`;

    const serverInfo = detectServer(meta.url);

    const linkObj = {
      id: `tg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      movieId: String(movieId),
      mediaType,
      title: displayTitle,
      movieTitle: officialTitle,
      posterPath: tmdbItem.poster_path || null,
      backdropPath: tmdbItem.backdrop_path || null,
      releaseDate: releaseDate || '',
      voteAverage: tmdbItem.vote_average || 0,
      url: meta.url,
      category,
      seasonNumber: mediaType === 'tv' ? (meta.season || 1) : undefined,
      episodeNumber: mediaType === 'tv' ? (meta.episode || (meta.isZip ? undefined : 1)) : undefined,
      linkType: mediaType === 'tv' ? (meta.isZip ? 'zip_pack' : 'single_episode') : 'general',
      quality: meta.quality,
      audioLanguage: meta.audio,
      size: meta.size,
      serverName: serverInfo.name,
      serverBadge: serverInfo.badge,
      createdAt: new Date().toISOString(),
    };

    const strMovieId = String(movieId);
    if (!linksByMovieId[strMovieId]) linksByMovieId[strMovieId] = [];
    linksByMovieId[strMovieId].push(linkObj);

    publishedItems.push({
      title: officialTitle,
      year: releaseYear,
      mediaType,
      movieId,
      season: mediaType === 'tv' ? (meta.season || 1) : undefined,
      episode: mediaType === 'tv' ? (meta.episode || (meta.isZip ? undefined : 1)) : undefined,
      isZip: mediaType === 'tv' ? meta.isZip : false,
      quality: meta.quality,
      audio: meta.audio,
      size: meta.size,
      serverName: serverInfo.name,
      serverBadge: serverInfo.badge,
      url: meta.url,
      pageUrl: `${SITE_URL}/${mediaType}/${movieId}`,
    });
  }

  // Save all links in a single high-speed batch
  if (Object.keys(linksByMovieId).length > 0) {
    await saveMultipleLinks(linksByMovieId);
    console.log(`✅ Batch published ${publishedItems.length} links across ${Object.keys(linksByMovieId).length} titles!`);
  }

  // Auto-detect and sync newer filehost domains across the database
  const domainMigrations = [];
  const checkedHosts = new Set();
  for (const item of publishedItems) {
    if (item.url) {
      try {
        const h = new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`).hostname.toLowerCase().replace(/^www\./, '');
        if (!checkedHosts.has(h)) {
          checkedHosts.add(h);
          const migs = await autoDetectAndSyncDomain(item.url);
          if (migs && migs.length > 0) {
            domainMigrations.push(...migs);
          }
        }
      } catch {}
    }
  }

  let autoMigrationNotice = '';
  if (domainMigrations.length > 0) {
    const lines = domainMigrations.map(m => `• *${m.name}*: \`${m.oldHost}\` ➡️ \`${m.newHost}\` (*${m.count}* links upgraded)`).join('\n');
    autoMigrationNotice = `\n\n🔄 *Smart Domain Auto-Sync:*\n${lines}\n_All older releases were auto-upgraded to the new mirror!_`;
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
🖥️ *Host Server:* \`${item.serverBadge || '⚡ Cloud Server'}\`
💎 *Quality:* \`${item.quality}\`
🔊 *Audio:* \`${item.audio}\`
${item.size ? `💾 *Size:* \`${item.size}\`\n` : ''}🌐 *View on Website:*
[Open ${item.title} on CineFuel](${item.pageUrl})

✅ *Direct Link Stored:*
\`${item.url}\`${autoMigrationNotice}`);
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
    tvMsg += `🖥️ *Host Server:* \`${first.serverBadge || '⚡ Cloud Server'}\`\n`;
    tvMsg += `💎 *Quality:* \`${first.quality}\`\n`;
    tvMsg += `🔊 *Audio:* \`${first.audio}\`\n\n`;
    tvMsg += `🌐 *View Season on Website:*\n[Open ${first.title} Season ${first.season} on CineFuel](${first.pageUrl})\n\n`;
    tvMsg += `✅ All ${publishedItems.length} episodes are now live in their respective Season ${first.season} slots!${autoMigrationNotice}`;

    return sendTelegram(chatId, tvMsg);
  }

  // Case C: Multi-Movie Collection / Trilogy Batch
  let batchMsg = `🎉 *Batch Upload Successful! (${publishedItems.length} Releases Published)*\n\n`;

  publishedItems.forEach((item, index) => {
    const typeIcon = item.mediaType === 'tv' ? (item.isZip ? '🗜️' : '🎬') : '🎥';
    batchMsg += `${index + 1}️⃣ ${typeIcon} *${item.title} (${item.year})*\n`;
    batchMsg += `🖥️ \`${item.serverBadge || '⚡ Cloud Server'}\`\n`;
    batchMsg += `💎 \`${item.quality}\`${item.size ? ` [${item.size}]` : ''}\n`;
    batchMsg += `🔊 \`${item.audio}\`\n`;
    batchMsg += `🌐 [Open on CineFuel](${item.pageUrl})\n\n`;
  });

  batchMsg += `✅ All ${publishedItems.length} titles are now live on your site!${autoMigrationNotice}`;

  return sendTelegram(chatId, batchMsg);
}

// Long-polling loop
let lastUpdateId = 0;

async function pollUpdates() {
  while (true) {
    try {
      const res = await safeFetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`, { timeoutMs: 32000 });
      if (res && res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = update.update_id;
            const message = update.message || update.edited_message;
            if (message) {
              // Execute message handler concurrently so polling is never blocked
              handleMessage(message).catch(msgErr => {
                console.error('Error handling message:', msgErr);
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Polling loop error (retry in 1s):', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function main() {
  const PORT = process.env.PORT || 3001;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      service: 'Cinefuel Telegram Bot',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
  });

  server.on('error', (err) => {
    console.warn(`Health check server note (${err.code}), continuing Telegram polling...`);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Health check HTTP server ready on port ${PORT}`);
  });

  // Render Free Tier Keep-Alive: Ping external URL every 10 minutes to prevent container sleep
  const renderExternalUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_SERVICE_URL;
  if (renderExternalUrl) {
    console.log(`⏱️ Setting up 10-minute keep-alive ping for ${renderExternalUrl}`);
    setInterval(async () => {
      try {
        await safeFetch(renderExternalUrl, { timeoutMs: 10000 });
        console.log('💓 Keep-alive ping sent to prevent Render sleep');
      } catch (pingErr) {
        console.warn('Keep-alive ping notice:', pingErr.message);
      }
    }, 10 * 60 * 1000);
  }

  await registerBotCommands();
  pollUpdates();
}

main();


