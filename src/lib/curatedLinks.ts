import { CustomLink } from '@/types';

export const BUILTIN_CURATED_LINKS: Record<number, CustomLink[]> = {
  // Oppenheimer
  872585: [
    {
      id: 'link-oppenheimer-prime',
      title: 'Watch on Amazon Prime Video (4K HDR)',
      url: 'https://www.primevideo.com/detail/0S33F7M9P5474L981B2T7V2361',
      category: 'Streaming',
      createdAt: '2024-03-01T10:00:00Z',
    },
    {
      id: 'link-oppenheimer-jio',
      title: 'Stream on JioCinema Premium (Hindi / English)',
      url: 'https://www.jiocinema.com/movies/oppenheimer/3847842',
      category: 'Streaming',
      createdAt: '2024-03-02T11:00:00Z',
    },
    {
      id: 'link-oppenheimer-sub',
      title: 'Download Subscene Multi-Language Subtitles (SRT)',
      url: 'https://subscene.com/subtitles/oppenheimer',
      category: 'Subtitles',
      createdAt: '2024-03-05T12:00:00Z',
    },
    {
      id: 'link-oppenheimer-doc',
      title: 'The Story of Oppenheimer - Official NBC Doc',
      url: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
      category: 'Discussion',
      createdAt: '2024-03-06T15:30:00Z',
    },
    {
      id: 'link-oppenheimer-ost',
      title: 'Ludwig Göransson - Can You Hear The Music (OST)',
      url: 'https://open.spotify.com/album/43q3W4pM3h92r6Y4P6Q5W0',
      category: 'Official',
      createdAt: '2024-03-08T18:00:00Z',
    },
  ],

  // Dune: Part Two
  693134: [
    {
      id: 'link-dune2-jio',
      title: 'Watch on JioCinema / Max (4K Dolby Atmos)',
      url: 'https://www.jiocinema.com/movies/dune-part-two/3928172',
      category: 'Streaming',
      createdAt: '2024-04-10T10:00:00Z',
    },
    {
      id: 'link-dune2-book',
      title: 'Book vs Movie Deep Dive - CinemaStix',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      category: 'Review',
      createdAt: '2024-04-12T14:00:00Z',
    },
    {
      id: 'link-dune2-sub',
      title: 'English & Regional Subtitles (OpenSubtitles)',
      url: 'https://www.opensubtitles.org/en/search/sublanguageid-all/idmovie-1077759',
      category: 'Subtitles',
      createdAt: '2024-04-15T09:00:00Z',
    },
  ],

  // Interstellar
  157336: [
    {
      id: 'link-interstellar-netflix',
      title: 'Stream on Netflix (Ultra HD 4K)',
      url: 'https://www.netflix.com/title/70305903',
      category: 'Streaming',
      createdAt: '2024-01-10T08:00:00Z',
    },
    {
      id: 'link-interstellar-prime',
      title: 'Watch on Prime Video with Cinema Pass',
      url: 'https://www.primevideo.com',
      category: 'Streaming',
      createdAt: '2024-01-12T10:00:00Z',
    },
    {
      id: 'link-interstellar-score',
      title: 'Hans Zimmer - Interstellar Complete Live Score',
      url: 'https://www.youtube.com/watch?v=UDVtMYqUAyw',
      category: 'Official',
      createdAt: '2024-01-15T12:00:00Z',
    },
  ],

  // Breaking Bad
  1396: [
    {
      id: 'link-bb-netflix',
      title: 'Watch All 5 Seasons on Netflix India',
      url: 'https://www.netflix.com/title/70143836',
      category: 'Streaming',
      createdAt: '2024-01-05T09:00:00Z',
    },
    {
      id: 'link-bb-reddit',
      title: 'r/BreakingBad Official Discussion & Episode Guides',
      url: 'https://reddit.com/r/breakingbad',
      category: 'Discussion',
      createdAt: '2024-01-08T16:00:00Z',
    },
  ],

  // RRR
  579974: [
    {
      id: 'link-rrr-netflix',
      title: 'Stream Hindi Version in Dolby Vision on Netflix',
      url: 'https://www.netflix.com/title/81476453',
      category: 'Streaming',
      createdAt: '2024-02-01T12:00:00Z',
    },
    {
      id: 'link-rrr-zee5',
      title: 'Stream Original Telugu / Tamil / Malayalam on ZEE5',
      url: 'https://www.zee5.com/movies/details/rrr/0-0-1z5154378',
      category: 'Streaming',
      createdAt: '2024-02-03T14:00:00Z',
    },
    {
      id: 'link-rrr-naatu',
      title: 'Naatu Naatu Oscar Winning Official 4K Video Song',
      url: 'https://www.youtube.com/watch?v=OsU0CGZoV8E',
      category: 'Official',
      createdAt: '2024-02-05T18:00:00Z',
    },
  ],

  // The Dark Knight
  155: [
    {
      id: 'link-tdk-jio',
      title: 'Stream on JioCinema Premium / Max (4K)',
      url: 'https://www.jiocinema.com',
      category: 'Streaming',
      createdAt: '2024-01-01T12:00:00Z',
    },
    {
      id: 'link-tdk-netflix',
      title: 'Watch on Netflix HD',
      url: 'https://www.netflix.com/title/70079583',
      category: 'Streaming',
      createdAt: '2024-01-03T14:00:00Z',
    },
  ],

  // Inception
  27205: [
    {
      id: 'link-inception-netflix',
      title: 'Watch Inception on Netflix HD',
      url: 'https://www.netflix.com/title/70131314',
      category: 'Streaming',
      createdAt: '2024-01-02T10:00:00Z',
    },
    {
      id: 'link-inception-breakdown',
      title: 'Inception Ending & Totem Explained - In Depth Analysis',
      url: 'https://www.youtube.com/watch?v=ginQNMiEen8',
      category: 'Review',
      createdAt: '2024-01-04T16:00:00Z',
    },
  ],

  // Marvel's Daredevil (Season 1 - 13 Episodes 4K DV HDR)
  61889: [
    {
      id: 'link-daredevil-s01e01',
      title: "Marvel's Daredevil S01E01 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.36 GB]",
      url: 'https://hubcloud.foo/video/riiumrxiipiuup_',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:01:00Z',
      seasonNumber: 1,
      episodeNumber: 1,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.36 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e02',
      title: "Marvel's Daredevil S01E02 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.28 GB]",
      url: 'https://hubcloud.foo/video/66go8o8rvmvt19r',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:02:00Z',
      seasonNumber: 1,
      episodeNumber: 2,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.28 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e03',
      title: "Marvel's Daredevil S01E03 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.21 GB]",
      url: 'https://hubcloud.foo/video/ysnjngm9kglunqp',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:03:00Z',
      seasonNumber: 1,
      episodeNumber: 3,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.21 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e04',
      title: "Marvel's Daredevil S01E04 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.25 GB]",
      url: 'https://hubcloud.foo/video/3h_1qdhebag1ybs',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:04:00Z',
      seasonNumber: 1,
      episodeNumber: 4,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.25 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e05',
      title: "Marvel's Daredevil S01E05 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.66 GB]",
      url: 'https://hubcloud.foo/video/6wsy_pw6q66mja9',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:05:00Z',
      seasonNumber: 1,
      episodeNumber: 5,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.66 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e06',
      title: "Marvel's Daredevil S01E06 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [5.72 GB]",
      url: 'https://hubcloud.foo/video/vrvibqpe0bebimu',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:06:00Z',
      seasonNumber: 1,
      episodeNumber: 6,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '5.72 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e07',
      title: "Marvel's Daredevil S01E07 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [5.95 GB]",
      url: 'https://hubcloud.foo/video/qriaiuha1ugiei1',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:07:00Z',
      seasonNumber: 1,
      episodeNumber: 7,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '5.95 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e08',
      title: "Marvel's Daredevil S01E08 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.37 GB]",
      url: 'https://hubcloud.foo/video/wt3ulvq13lnto1d',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:08:00Z',
      seasonNumber: 1,
      episodeNumber: 8,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.37 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e09',
      title: "Marvel's Daredevil S01E09 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.83 GB]",
      url: 'https://hubcloud.foo/video/ylmkvvviil_vv_y',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:09:00Z',
      seasonNumber: 1,
      episodeNumber: 9,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.83 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e10',
      title: "Marvel's Daredevil S01E10 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.78 GB]",
      url: 'https://hubcloud.foo/video/cj2eoul8m7u1_k2',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:10:00Z',
      seasonNumber: 1,
      episodeNumber: 10,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.78 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e11',
      title: "Marvel's Daredevil S01E11 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.94 GB]",
      url: 'https://hubcloud.foo/video/uoteaf6attosq_m',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:11:00Z',
      seasonNumber: 1,
      episodeNumber: 11,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.94 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e12',
      title: "Marvel's Daredevil S01E12 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [7.09 GB]",
      url: 'https://hubcloud.foo/video/yqvuhzv7pcvwpiw',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:12:00Z',
      seasonNumber: 1,
      episodeNumber: 12,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '7.09 GB',
      linkType: 'single_episode',
    },
    {
      id: 'link-daredevil-s01e13',
      title: "Marvel's Daredevil S01E13 2160p 10bit DSNP WEB-DL Hybrid DV HDR x265 [Org Hindi DDP5.1 + English DDP5.1] ESub ~ (R3FL3X) HONE.mkv [6.64 GB]",
      url: 'https://hubcloud.foo/video/17li3rijmmowewj',
      category: 'SingleEpisode',
      createdAt: '2024-03-01T10:13:00Z',
      seasonNumber: 1,
      episodeNumber: 13,
      quality: '2160p 4K • WEB-DL • DV HDR • 10bit • HEVC',
      audioLanguage: 'Hindi + English 5.1',
      size: '6.64 GB',
      linkType: 'single_episode',
    },
  ],
};

/**
 * Get all consolidated custom links for a title across:
 * 1. Built-in curated catalog (if not deleted by Admin)
 * 2. LocalStorage global custom links added by Admin
 * (NO fake or auto-generated search links!)
 */
export function getConsolidatedCustomLinks(titleId: number, watchlistCustomLinks?: CustomLink[]): CustomLink[] {
  const linksMap = new Map<string, CustomLink>();
  let deletedIds = new Set<string>();

  if (typeof window !== 'undefined') {
    try {
      const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
      if (delStored) {
        deletedIds = new Set(JSON.parse(delStored));
      }
    } catch {
      // ignore
    }
  }

  // 1. Built-in curated links (only if not deleted by Admin)
  const builtin = BUILTIN_CURATED_LINKS[titleId] || [];
  builtin.forEach((l) => {
    if (!deletedIds.has(l.id)) {
      linksMap.set(l.id, l);
    }
  });

  // 2. Storage links added by Admin
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cinefuel_custom_links');
      if (stored) {
        const parsed = JSON.parse(stored);
        const forTitle = parsed[String(titleId)] || parsed[titleId];
        if (Array.isArray(forTitle)) {
          forTitle.forEach((l: CustomLink) => {
            if (!deletedIds.has(l.id)) {
              linksMap.set(l.id, l);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(linksMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Save a new custom link into global storage (Admin only)
 */
export function saveGlobalCustomLink(movieId: number, link: CustomLink): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('cinefuel_custom_links');
    const parsed = stored ? JSON.parse(stored) : {};
    const key = String(movieId);
    const existing = parsed[key] || [];
    parsed[key] = [link, ...existing.filter((l: CustomLink) => l.id !== link.id && l.url !== link.url)];
    localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
    window.dispatchEvent(new Event('cinefuel_links_updated'));
  } catch (err) {
    console.error('Failed to save global custom link:', err);
  }
}

/**
 * Update an existing custom link (Admin only)
 */
export function updateGlobalCustomLink(movieId: number, updatedLink: CustomLink): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('cinefuel_custom_links');
    const parsed = stored ? JSON.parse(stored) : {};
    const key = String(movieId);
    const existing: CustomLink[] = parsed[key] || [];

    const index = existing.findIndex((l) => l.id === updatedLink.id);
    if (index >= 0) {
      existing[index] = { ...existing[index], ...updatedLink };
      parsed[key] = existing;
    } else {
      parsed[key] = [updatedLink, ...existing];
    }

    localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
    window.dispatchEvent(new Event('cinefuel_links_updated'));
  } catch (err) {
    console.error('Failed to update global custom link:', err);
  }
}

/**
 * Get the set of permanently deleted link IDs
 */
export function getDeletedLinkIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
    if (delStored) {
      return new Set(JSON.parse(delStored));
    }
  } catch {
    // ignore
  }
  return new Set();
}

/**
 * Delete a custom link permanently (Admin only)
 */
export function deleteGlobalCustomLink(movieId: number, linkId: string): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Mark as deleted in deleted links registry
    const delStored = localStorage.getItem('cinefuel_deleted_curated_links');
    const delList: string[] = delStored ? JSON.parse(delStored) : [];
    if (!delList.includes(linkId)) {
      delList.push(linkId);
      localStorage.setItem('cinefuel_deleted_curated_links', JSON.stringify(delList));
    }

    // 2. Remove from custom links storage
    const stored = localStorage.getItem('cinefuel_custom_links');
    if (stored) {
      const parsed = JSON.parse(stored);
      const key = String(movieId);
      if (parsed[key]) {
        parsed[key] = parsed[key].filter((l: CustomLink) => l.id !== linkId);
        localStorage.setItem('cinefuel_custom_links', JSON.stringify(parsed));
      }
    }

    // 3. Also remove from watchlist storage if present
    const watchStored = localStorage.getItem('cinefuel_watchlist');
    if (watchStored) {
      try {
        const watchParsed = JSON.parse(watchStored);
        if (Array.isArray(watchParsed)) {
          const updatedWatch = watchParsed.map((item: any) => {
            if (item.id === movieId && Array.isArray(item.customLinks)) {
              return {
                ...item,
                customLinks: item.customLinks.filter((l: CustomLink) => l.id !== linkId),
              };
            }
            return item;
          });
          localStorage.setItem('cinefuel_watchlist', JSON.stringify(updatedWatch));
        }
      } catch {
        // ignore
      }
    }

    window.dispatchEvent(new Event('cinefuel_links_updated'));
  } catch (err) {
    console.error('Failed to delete global custom link:', err);
  }
}
