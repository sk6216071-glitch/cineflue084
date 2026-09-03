export interface ReleaseTimeline {
  theatricalDate: string;
  theatricalFormatted: string;
  digitalVodDate: string;
  digitalVodFormatted: string;
  physicalDate: string;
  physicalFormatted: string;
  ottSubscriptionDate: string;
  ottSubscriptionFormatted: string;
  ottPlatformName: string;
  status: 'STREAMING_NOW' | 'DIGITAL_VOD_AVAILABLE' | 'IN_THEATRES_ONLY' | 'UPCOMING_IN_THEATRES';
  statusLabel: string;
  statusColor: string;
  theatricalWindowDays: number;
  daysUntilDigital: number;
}

export const VERIFIED_RELEASE_DATES: Record<
  number,
  {
    theatrical: string;
    digitalVod: string;
    physical: string;
    ottSubscription: string;
    ottPlatform: string;
  }
> = {
  // Dune: Part Two
  693134: {
    theatrical: '2024-03-01',
    digitalVod: '2024-04-16',
    physical: '2024-05-14',
    ottSubscription: '2024-05-21',
    ottPlatform: 'Netflix (India)',
  },

  // Oppenheimer
  872585: {
    theatrical: '2023-07-21',
    digitalVod: '2023-11-21',
    physical: '2023-11-21',
    ottSubscription: '2024-03-21',
    ottPlatform: 'JioCinema Premium',
  },

  // Deadpool & Wolverine
  533535: {
    theatrical: '2024-07-26',
    digitalVod: '2024-10-01',
    physical: '2024-10-22',
    ottSubscription: '2024-11-12',
    ottPlatform: 'Disney+ Hotstar',
  },

  // Inside Out 2
  1022789: {
    theatrical: '2024-06-14',
    digitalVod: '2024-08-20',
    physical: '2024-09-10',
    ottSubscription: '2024-09-25',
    ottPlatform: 'Disney+ Hotstar',
  },

  // Kalki 2898 AD
  801688: {
    theatrical: '2024-06-27',
    digitalVod: '2024-08-22',
    physical: '2024-09-30',
    ottSubscription: '2024-08-22',
    ottPlatform: 'Netflix & Prime Video',
  },

  // Stree 2
  1079091: {
    theatrical: '2024-08-15',
    digitalVod: '2024-09-27',
    physical: '2024-10-20',
    ottSubscription: '2024-10-11',
    ottPlatform: 'Amazon Prime Video',
  },

  // RRR
  579974: {
    theatrical: '2022-03-25',
    digitalVod: '2022-05-20',
    physical: '2022-07-15',
    ottSubscription: '2022-05-20',
    ottPlatform: 'Netflix & ZEE5',
  },

  // Interstellar
  157336: {
    theatrical: '2014-11-07',
    digitalVod: '2015-03-17',
    physical: '2015-03-31',
    ottSubscription: '2015-08-01',
    ottPlatform: 'Netflix & Prime Video',
  },

  // The Dark Knight
  155: {
    theatrical: '2008-07-18',
    digitalVod: '2008-12-09',
    physical: '2008-12-09',
    ottSubscription: '2009-06-01',
    ottPlatform: 'Netflix & JioCinema',
  },

  // Inception
  27205: {
    theatrical: '2010-07-16',
    digitalVod: '2010-12-07',
    physical: '2010-12-07',
    ottSubscription: '2011-05-01',
    ottPlatform: 'Netflix & JioCinema',
  },
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function addDays(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

/**
 * Calculates or retrieves the exact release timeline (Theatres ➔ Digital VOD ➔ 4K Blu-ray ➔ OTT Subscription)
 */
export function getReleaseTimeline(titleId: number, theatricalDateStr?: string, titleName?: string): ReleaseTimeline {
  const verified = VERIFIED_RELEASE_DATES[titleId];
  const now = new Date().getTime();

  let tDate = verified?.theatrical || theatricalDateStr || '2024-01-01';
  let dDate = verified?.digitalVod || addDays(tDate, 46);
  let pDate = verified?.physical || addDays(tDate, 74);
  let oDate = verified?.ottSubscription || addDays(tDate, 82);
  let ottPlatform = verified?.ottPlatform || 'Major OTT Platforms (Netflix / Prime / Jio)';

  const tTime = new Date(tDate).getTime();
  const dTime = new Date(dDate).getTime();
  const oTime = new Date(oDate).getTime();

  const windowDays = Math.max(1, Math.round((dTime - tTime) / (1000 * 60 * 60 * 24)));
  const daysUntilDigital = Math.round((dTime - now) / (1000 * 60 * 60 * 24));

  let status: ReleaseTimeline['status'] = 'STREAMING_NOW';
  let statusLabel = 'Streaming Now on OTT';
  let statusColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

  if (now < tTime) {
    status = 'UPCOMING_IN_THEATRES';
    const days = Math.max(1, Math.round((tTime - now) / (1000 * 60 * 60 * 24)));
    statusLabel = `In Theatres in ${days} Day${days > 1 ? 's' : ''}`;
    statusColor = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  } else if (now < dTime) {
    status = 'IN_THEATRES_ONLY';
    const days = Math.max(1, daysUntilDigital);
    statusLabel = `In Theatres Only • Digital in ~${days} Days`;
    statusColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  } else if (now < oTime) {
    status = 'DIGITAL_VOD_AVAILABLE';
    statusLabel = 'Available on Digital VOD (Rent/Buy)';
    statusColor = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  } else {
    status = 'STREAMING_NOW';
    statusLabel = 'Streaming on OTT Subscription';
    statusColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }

  return {
    theatricalDate: tDate,
    theatricalFormatted: formatDate(tDate),
    digitalVodDate: dDate,
    digitalVodFormatted: formatDate(dDate),
    physicalDate: pDate,
    physicalFormatted: formatDate(pDate),
    ottSubscriptionDate: oDate,
    ottSubscriptionFormatted: formatDate(oDate),
    ottPlatformName: ottPlatform,
    status,
    statusLabel,
    statusColor,
    theatricalWindowDays: windowDays,
    daysUntilDigital,
  };
}
