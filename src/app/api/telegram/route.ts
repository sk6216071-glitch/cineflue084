import { NextRequest, NextResponse } from 'next/server';
import { processTelegramMessage } from '@/lib/telegramBotCore';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8944564119:AAHB6ETpf7BgkPRFhum2BYBqpkSZFX40SSU';

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

export async function POST(request: NextRequest) {
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
    await sendTelegramReply(chatId, result.replyText);

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
  });
}
