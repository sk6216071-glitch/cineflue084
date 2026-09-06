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

// Memory state for multi-message uploads
const pendingChatState = new Map();

console.log('🤖 Starting Resilient Batch CineFuel Telegram Polling Daemon...');
console.log(`📡 Connected to Bot: @CineFlue_bot`);
console.log(`📁 Database Path: ${DATA_FILE}`);

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

function extractBlockMetadata(text, fallbackUrl) {
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
  const explicitType = getField(/(?:^|\n)\s*Media\s*Type\s*[-:]\s*([^\n\r]+)/i);

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

  // 5. TV Season & Episode
  let season = 1;
  const sMatch = cleanText.match(/s0*(\d{1,2})/i) || cleanText.match(/season[\s._-]?0*(\d{1,2})/i);
  if (sMatch) season = parseInt(sMatch[1], 10);

  let episode = undefined;
  const eMatch = cleanText.match(/s\d{1,2}[\s._\-]*(?:ep|episode|e)[\s._-]?0*(\d{1,3})/i) ||
                cleanText.match(/(?:^|[\s._\-[\]()])e0*(\d{1,3})(?:[\s._\-[\]()]|\b)(?![0-9]*p\b)/i) ||
                cleanText.match(/(?:^|[\s._\-[\]()])episode[\s._-]?0*(\d{1,3})/i);
  if (eMatch) episode = parseInt(eMatch[1], 10);

  const isZip = /(?:\.zip|\.rar|\.7z|\bzip\b|\bpack\b|\bbatch\b|\bcomplete\b|\ball\s*episodes\b|\bfull\s*season\b)/i.test(cleanText) || (!episode);

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

async function searchTmdb(query, year) {
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

  // 1. Slash Commands & Help
  if (rawText === '/start' || rawText === '/help') {
    return sendTelegram(chatId, `🚀 *Welcome to CineFuel Auto-Uploader Bot!*

Send any movie or TV series release (single, bulk episodes, or collection) to auto-upload to CineFuel!

📌 *Single Release:*
\`Marvel's Daredevil S02E01 2160p Hybrid DV HDR [Org Hindi DDP5.1 + English DDP5.1] [5.75 GB] https://hubcloud.foo/...\`

📌 *Batch / Multi-Episode in 1 Message:*
Paste all 8, 10, or 13 episodes together! The bot automatically detects each episode, quality, audio, and size individually!

✨ *Features:*
• Auto TMDB match & poster linking
• Multi-release & TV Season batch detection
• Auto 2160p 4K / Hybrid DV HDR / 10bit tagging
• Instant site publication!`);
  }

  if (rawText === '/status') {
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
• Admin Authorized: ${AUTHORIZED_TELEGRAM_IDS.includes(fromId) ? '✅ Yes' : '❌ No'}`);
  }

  // 2. Authorization check
  if (!AUTHORIZED_TELEGRAM_IDS.includes(fromId)) {
    return sendTelegram(chatId, `⛔ *Unauthorized*\nYour Telegram ID (${fromId}) is not registered as an Admin.`);
  }

  // 3. Split message into individual release blocks
  const blocks = splitMessageIntoReleaseBlocks(rawText);

  // If no URLs found in message
  if (blocks.length === 1 && !blocks[0].url) {
    if (/^(?:hi|hello|hey|start)\b/i.test(rawText)) {
      return sendTelegram(chatId, `👋 *Hello ${msg.from?.first_name || 'Shyam'}!*

CineFuel Auto-Uploader is online! Send any movie or TV series link with details to auto-upload to your site.`);
    }

    const meta = extractBlockMetadata(rawText);
    if (meta.titleQuery && meta.titleQuery.length >= 3) {
      pendingChatState.set(chatId, {
        rawText,
        meta,
        time: Date.now(),
      });
      return sendTelegram(chatId, `⏳ *Received Details for:* "${meta.titleQuery}"\n👉 Now send the link to publish it to CineFuel!`);
    }

    return sendTelegram(chatId, `⚠️ *No Link Detected*\nPlease include a download/stream URL with your title.`);
  }

  // Check pending state if this message is just a link
  if (blocks.length === 1 && blocks[0].url && blocks[0].text === blocks[0].url) {
    const pending = pendingChatState.get(chatId);
    if (pending) {
      blocks[0].text = `${pending.rawText}\n${blocks[0].url}`;
      pendingChatState.delete(chatId);
    }
  }

  // 4. Process all blocks with in-memory TMDB cache
  const publishedItems = [];
  const tmdbCache = new Map();

  for (const block of blocks) {
    if (!block.url) continue;

    const meta = extractBlockMetadata(block.text, block.url);
    if (!meta.titleQuery || meta.titleQuery.length < 2) continue;

    const cacheKey = `${meta.titleQuery.toLowerCase()}_${meta.year || 'any'}`;
    let tmdbItem = tmdbCache.get(cacheKey);

    if (!tmdbItem) {
      console.log(`🔍 Searching TMDB for: "${meta.titleQuery}" (Year: ${meta.year || 'any'})`);
      tmdbItem = await searchTmdb(meta.titleQuery, meta.year);
      if (tmdbItem) tmdbCache.set(cacheKey, tmdbItem);
    }

    if (!tmdbItem) {
      console.warn(`Could not find TMDB match for: ${meta.titleQuery}`);
      continue;
    }

    const isTv = meta.mediaType?.toLowerCase().includes('tv') ||
                 (!meta.mediaType && (tmdbItem.media_type === 'tv' || meta.episode !== undefined || /s\d{1,2}/i.test(block.text)));
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
    return sendTelegram(chatId, `🎉 *Link Successfully Published to CineFuel!*

🎬 *Title:* ${item.title} ${item.year ? `(${item.year})` : ''}
📂 *Media Type:* ${item.mediaType === 'tv' ? '📺 TV Series' : '🎥 Movie'}
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

    let tvMsg = `🎉 *TV Season Batch Upload Successful!*\n\n`;
    tvMsg += `🎬 *Show:* ${first.title} (${first.year})\n`;
    tvMsg += `📺 *Season:* Season ${first.season} (${publishedItems.length} Episodes Live: \`${epRange}\`)\n`;
    tvMsg += `💎 *Quality:* \`${first.quality}\`\n`;
    tvMsg += `🔊 *Audio:* \`${first.audio}\`\n\n`;
    tvMsg += `🌐 *View Season on Website:*\n[Open ${first.title} Season ${first.season} on CineFuel](${first.pageUrl})\n\n`;
    tvMsg += `✅ All ${publishedItems.length} episodes are now live on your site!`;

    return sendTelegram(chatId, tvMsg);
  }

  // Case C: Multi-Movie Collection / Trilogy Batch
  let batchMsg = `🎉 *Batch Upload Successful! (${publishedItems.length} Releases Published)*\n\n`;

  publishedItems.forEach((item, index) => {
    batchMsg += `${index + 1}️⃣ *${item.title} (${item.year})*\n`;
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

pollUpdates();
