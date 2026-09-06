import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'serverLinks.json');

function getStoredLinks(): Record<string, any[]> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (e) {
    console.error('Error reading serverLinks.json:', e);
  }
  return {};
}

function saveStoredLinks(data: Record<string, any[]>) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing serverLinks.json:', e);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get('movieId');
  const allLinks = getStoredLinks();

  if (movieId) {
    const links = allLinks[movieId] || [];
    return NextResponse.json({ success: true, links });
  }

  return NextResponse.json({ success: true, allLinks });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { movieId, link } = body;

    if (!movieId || !link || !link.url) {
      return NextResponse.json({ error: 'movieId and link.url are required' }, { status: 400 });
    }

    const allLinks = getStoredLinks();
    const key = String(movieId);
    const existing = allLinks[key] || [];

    const linkId = link.id || `server-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newLink = {
      ...link,
      id: linkId,
      createdAt: link.createdAt || new Date().toISOString(),
    };

    // Filter out duplicate url or id
    allLinks[key] = [newLink, ...existing.filter((l: any) => l.id !== linkId && l.url !== newLink.url)];
    saveStoredLinks(allLinks);

    return NextResponse.json({ success: true, link: newLink, total: allLinks[key].length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const movieId = searchParams.get('movieId');
    const linkId = searchParams.get('linkId');

    if (!movieId || !linkId) {
      return NextResponse.json({ error: 'movieId and linkId required' }, { status: 400 });
    }

    const allLinks = getStoredLinks();
    const key = String(movieId);
    if (allLinks[key]) {
      allLinks[key] = allLinks[key].filter((l: any) => l.id !== linkId);
      saveStoredLinks(allLinks);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
