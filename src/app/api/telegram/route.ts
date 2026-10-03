import { NextRequest, NextResponse } from 'next/server';
import { processTelegramMessage } from '@/lib/telegramBotCore';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

function escapeHtml(str: string) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramReply(chatId: number, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
    return await res.json();
  } catch (e) {
    console.error('Error sending reply to Telegram:', e);
  }
}

async function sendTelegramPhotoCard(chatId: number, card: any) {
  const versionsLines = (card.versions || []).map((v: any) => {
    let q = v.quality || '1080p';
    if (/\b(?:2160p|2160|4k|uhd)\b/i.test(q)) q = '2160p';
    else if (/\b(?:1080p|1080|fhd)\b/i.test(q)) q = '1080p';
    else if (/\b(?:720p|720|hd)\b/i.test(q)) q = '720p';
    else if (/\b(?:480p|480|sd)\b/i.test(q)) q = '480p';
    const s = v.size ? `\n  ${v.size}` : '';
    return `• ${q} :${s}`;
  }).join('\n');

  const versionsText = versionsLines || '• 1080p :\n  WEB-DL';

  let cleanOutline = (card.outline || 'Every release brings the cinema home.').trim();
  if (cleanOutline.length > 240) {
    cleanOutline = cleanOutline.slice(0, 237) + '...';
  }

  const caption = 
`⚡ <b>${escapeHtml(card.title?.toUpperCase())} ${card.year ? `(${card.year})` : ''}</b>
─────────────────────────────
⭐ <b>Rating:</b> ${card.rating || '6.5'}/10
🎭 <b>Genres:</b> ${escapeHtml(card.genres || 'Drama, Cinema')}
─────────────────────────────

📖 <b>Plot Outline:</b>
<blockquote>${escapeHtml(cleanOutline)}</blockquote>

📦 <b>Available Versions:</b>
<pre>${escapeHtml(versionsText)}</pre>

🔊 <b>Audio Track:</b> ${escapeHtml(card.audio || 'Hindi, English')}

👤 <b>Uploaded by:</b> #${(card.uploadedBy || 'Shyam').replace(/^#/, '')}

🚀 ${card.channelHandle || '@cinflue'}${card.autoMigrationNotice ? `\n\n${card.autoMigrationNotice}` : ''}`;

  const destinationUrl = card.pageUrl || `https://cineflue084.sk6216071.workers.dev/${card.mediaType || 'movie'}/${card.movieId}`;
  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: `🚀 Download ${card.title}`,
          url: destinationUrl,
        },
      ],
    ],
  };

  // 1. Try sending Photo with styled HTML Caption & Inline Keyboard (matches reference)
  if (card.photoUrl) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: card.photoUrl,
          caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        }),
      });
      const data = await res.json();
      if (data?.ok) return data;
      console.warn('sendPhoto failed in webhook, falling back to sendMessage:', data?.description);
    } catch (e: any) {
      console.warn('sendPhoto error in webhook, falling back to sendMessage:', e?.message);
    }
  }

  // 2. Fallback to HTML Message with Inline Keyboard
  return await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: caption,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
      disable_web_page_preview: false,
    }),
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');

  if (!webhookSecret || !headerSecret || headerSecret !== webhookSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: invalid or missing telegram webhook secret token' },
      { status: 401 }
    );
  }

  try {
    const update = await request.json();

    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true, note: 'No text message' });
    }

    const chatId = message.chat.id;
    const fromId = message.from ? message.from.id : chatId;
    const text = message.text;

    // Send typing status immediately to Telegram
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});

    const result = await processTelegramMessage(fromId, text);

    if ((result as any).cards && (result as any).cards.length > 0) {
      for (const card of (result as any).cards) {
        await sendTelegramPhotoCard(chatId, card);
      }
    } else if (result.card) {
      await sendTelegramPhotoCard(chatId, result.card);
    } else {
      await sendTelegramReply(chatId, result.replyText);
    }

    return NextResponse.json({ ok: true, processed: result.success });
  } catch (error: any) {
    console.error('Error in Telegram Webhook route:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    bot: 'CineFlue_bot',
    service: 'CineFuel Telegram Auto-Uploader API',
    diagnostics: {
      mongoUriConfigured: !!process.env.MONGODB_URI,
      redisUrlConfigured: !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL),
      redisTokenConfigured: !!(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
      adminKeyConfigured: !!(process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD),
      tgWebhookSecretConfigured: !!process.env.TELEGRAM_WEBHOOK_SECRET,
      env: process.env.APP_ENV || process.env.CINEFUEL_ENV || 'unknown',
    },
  });
}
