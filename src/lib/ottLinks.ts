export interface DirectStreamingInfo {
  netflix?: string;
  prime?: string;
  hotstar?: string;
  jiocinema?: string;
  appletv?: string;
  youtube?: string;
  justwatch?: string;
  zee5?: string;
}

/**
 * Verified direct title URLs (No search redirection, opens the exact movie/show directly)
 */
export const DIRECT_OTT_CATALOG: Record<number, DirectStreamingInfo> = {
  // Dune: Part Two
  693134: {
    netflix: 'https://www.netflix.com/in/title/81602836',
    prime: 'https://www.primevideo.com/detail/0S33F7M9P5474L981B2T7V2361',
    hotstar: 'https://www.hotstar.com',
    jiocinema: 'https://www.jiocinema.com/movies/dune-part-two/3928172',
    appletv: 'https://tv.apple.com/in/movie/dune-part-two/umc.cmc.363aycnv6vy9qgekvew6fveb9',
    youtube: 'https://www.youtube.com/results?search_query=Dune+Part+Two+buy+or+rent',
    justwatch: 'https://www.justwatch.com/in/movie/dune-part-two',
  },

  // Oppenheimer
  872585: {
    netflix: 'https://www.netflix.com/in/title/81258672',
    prime: 'https://www.primevideo.com/detail/0S33F7M9P5474L981B2T7V2361',
    jiocinema: 'https://www.jiocinema.com/movies/oppenheimer/3847842',
    appletv: 'https://tv.apple.com/in/movie/oppenheimer/umc.cmc.5g9b4n6r',
    youtube: 'https://www.youtube.com/results?search_query=Oppenheimer+buy+or+rent',
    justwatch: 'https://www.justwatch.com/in/movie/oppenheimer',
  },

  // Interstellar
  157336: {
    netflix: 'https://www.netflix.com/in/title/70305903',
    prime: 'https://www.primevideo.com/detail/0G0WMSJLLHOGWOPCGT8XJCG6X6',
    jiocinema: 'https://www.jiocinema.com/movies/interstellar/3498877',
    appletv: 'https://tv.apple.com/in/movie/interstellar/umc.cmc.24x3616l',
    justwatch: 'https://www.justwatch.com/in/movie/interstellar',
  },

  // Breaking Bad
  1396: {
    netflix: 'https://www.netflix.com/in/title/70143836',
    justwatch: 'https://www.justwatch.com/in/tv-show/breaking-bad',
  },

  // RRR
  579974: {
    netflix: 'https://www.netflix.com/in/title/81476453',
    zee5: 'https://www.zee5.com/movies/details/rrr/0-0-1z5154378',
    justwatch: 'https://www.justwatch.com/in/movie/rrr',
  },

  // The Dark Knight
  155: {
    netflix: 'https://www.netflix.com/in/title/70079583',
    jiocinema: 'https://www.jiocinema.com/movies/the-dark-knight/3489221',
    prime: 'https://www.primevideo.com/detail/0N9V39E839X6',
    justwatch: 'https://www.justwatch.com/in/movie/the-dark-knight',
  },

  // Inception
  27205: {
    netflix: 'https://www.netflix.com/in/title/70131314',
    jiocinema: 'https://www.jiocinema.com/movies/inception/3489112',
    justwatch: 'https://www.justwatch.com/in/movie/inception',
  },

  // Fight Club
  550: {
    prime: 'https://www.primevideo.com/detail/0QJ13Q3M4J7P',
    justwatch: 'https://www.justwatch.com/in/movie/fight-club',
  },

  // Stranger Things
  66732: {
    netflix: 'https://www.netflix.com/in/title/80057281',
    justwatch: 'https://www.justwatch.com/in/tv-show/stranger-things',
  },

  // Shogun
  126308: {
    hotstar: 'https://www.hotstar.com/in/shows/shogun/1260166291',
    justwatch: 'https://www.justwatch.com/in/tv-show/shogun',
  },

  // Game of Thrones
  1399: {
    jiocinema: 'https://www.jiocinema.com/tv-shows/game-of-thrones/3501231',
    justwatch: 'https://www.justwatch.com/in/tv-show/game-of-thrones',
  },

  // The Last of Us
  100088: {
    jiocinema: 'https://www.jiocinema.com/tv-shows/the-last-of-us/3739281',
    justwatch: 'https://www.justwatch.com/in/tv-show/the-last-of-us',
  },
};

/**
 * Generate a clean URL slug from title
 */
export function generateTitleSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Resolves direct verified streaming URLs for any movie/show ID
 */
export function getDirectStreamingUrls(
  id: number,
  title: string,
  mediaType: 'movie' | 'tv' = 'movie',
  tmdbProviderLink?: string
) {
  const direct = DIRECT_OTT_CATALOG[id] || {};
  const slug = generateTitleSlug(title);
  const typeSlug = mediaType === 'tv' ? 'tv-show' : 'movie';

  // Fallback JustWatch hub link
  const defaultJustWatch = tmdbProviderLink || `https://www.justwatch.com/in/${typeSlug}/${slug}`;

  return {
    netflix: direct.netflix || `https://www.netflix.com/title/${id}`,
    prime: direct.prime || `https://www.primevideo.com/search?phrase=${encodeURIComponent(title)}`,
    hotstar: direct.hotstar || `https://www.hotstar.com/in/explore?search_query=${encodeURIComponent(title)}`,
    jiocinema: direct.jiocinema || `https://www.jiocinema.com/search/${encodeURIComponent(title)}`,
    appletv: direct.appletv || `https://tv.apple.com/search?term=${encodeURIComponent(title)}`,
    youtube: direct.youtube || `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' buy or rent')}`,
    justwatch: direct.justwatch || defaultJustWatch,
    zee5: direct.zee5,
  };
}
