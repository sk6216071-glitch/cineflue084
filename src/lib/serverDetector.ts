export interface ServerInfo {
  name: string;
  badge: string;
  badgeClass: string;
  host: string;
}

export function detectServer(url: string, serverIndex?: number, totalForGroup?: number): ServerInfo {
  if (!url) {
    return {
      name: 'Direct Server',
      badge: 'Server',
      badgeClass: 'text-zinc-300 bg-zinc-800/80 border-zinc-700/80',
      host: '',
    };
  }

  let host = '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    const m = url.match(/(?:https?:\/\/)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
    host = m ? m[1].toLowerCase() : '';
  }

  let name = 'Cloud Server';
  let icon = '⚡';
  let badgeClass = 'text-amber-300 bg-amber-500/10 border-amber-500/20';

  if (host.includes('hubcloud')) {
    name = 'HubCloud';
    icon = '⚡';
    badgeClass = 'text-amber-300 bg-amber-500/10 border-amber-500/20';
  } else if (host.includes('gdflix')) {
    name = 'GDFlix';
    icon = '🚀';
    badgeClass = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
  } else if (host.includes('drive.google.com') || host === 'drive.google') {
    name = 'Google Drive';
    icon = '📁';
    badgeClass = 'text-blue-300 bg-blue-500/10 border-blue-500/20';
  } else if (host.includes('gofile')) {
    name = 'GoFile';
    icon = '⚡';
    badgeClass = 'text-purple-300 bg-purple-500/10 border-purple-500/20';
  } else if (host.includes('mega.nz') || host.includes('mega.io')) {
    name = 'MEGA';
    icon = '🔴';
    badgeClass = 'text-rose-300 bg-rose-500/10 border-rose-500/20';
  } else if (host.includes('1fichier')) {
    name = '1Fichier';
    icon = '🗄️';
    badgeClass = 'text-orange-300 bg-orange-500/10 border-orange-500/20';
  } else if (host.includes('mediafire')) {
    name = 'MediaFire';
    icon = '🔥';
    badgeClass = 'text-sky-300 bg-sky-500/10 border-sky-500/20';
  } else if (host.includes('terabox')) {
    name = 'TeraBox';
    icon = '📦';
    badgeClass = 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20';
  } else if (host.includes('filepress')) {
    name = 'FilePress';
    icon = '⚡';
    badgeClass = 'text-teal-300 bg-teal-500/10 border-teal-500/20';
  } else if (host.includes('streamtape') || host.includes('dood') || host.includes('mixdrop') || host.includes('streamwish')) {
    name = 'Stream Player';
    icon = '▶️';
    badgeClass = 'text-pink-300 bg-pink-500/10 border-pink-500/20';
  } else if (host) {
    // Extract base domain name capitalized
    const parts = host.split('.');
    const baseName = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    name = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    icon = '🔗';
    badgeClass = 'text-zinc-300 bg-zinc-800 border-zinc-700';
  }

  const prefix = typeof serverIndex === 'number' && totalForGroup && totalForGroup > 1
    ? `Server ${serverIndex + 1}: `
    : 'Server: ';

  return {
    name,
    badge: `${icon} ${prefix}${name}`,
    badgeClass,
    host,
  };
}
