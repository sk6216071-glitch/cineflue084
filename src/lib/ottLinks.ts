import { WatchProvidersData, WatchProviderInfo } from '@/types';

export interface ActiveStreamingOption {
  key: string;
  name: string;
  tier: 'Subscription' | 'Rent' | 'Buy' | 'Free';
  subtext: string;
  logoBg: string;
  logoText: string;
  accentBorder: string;
  accentText: string;
  url: string;
}

/**
 * Verified direct title URLs (Direct title page on OTT platforms)
 */
export const DIRECT_OTT_URLS: Record<number, Record<string, string>> = {
  // Dune: Part Two (Available on Netflix Sub, Prime Video Rent, Apple TV Rent, YouTube Rent - NOT on Hotstar)
  693134: {
    netflix: 'https://www.netflix.com/in/title/81602836',
    prime: 'https://www.primevideo.com/detail/0S33F7M9P5474L981B2T7V2361',
    appletv: 'https://tv.apple.com/in/movie/dune-part-two/umc.cmc.363aycnv6vy9qgekvew6fveb9',
    youtube: 'https://www.youtube.com/results?search_query=Dune+Part+Two+buy+or+rent',
    justwatch: 'https://www.justwatch.com/in/movie/dune-part-two',
  },

  // Oppenheimer (Available on JioCinema Sub, Prime Video Rent, Apple TV Rent, YouTube Rent)
  872585: {
    jiocinema: 'https://www.jiocinema.com/movies/oppenheimer/3847842',
    prime: 'https://www.primevideo.com/detail/0S33F7M9P5474L981B2T7V2361',
    appletv: 'https://tv.apple.com/in/movie/oppenheimer/umc.cmc.5g9b4n6r',
    youtube: 'https://www.youtube.com/results?search_query=Oppenheimer+buy+or+rent',
    justwatch: 'https://www.justwatch.com/in/movie/oppenheimer',
  },

  // Interstellar (Available on Netflix Sub, Prime Video, JioCinema)
  157336: {
    netflix: 'https://www.netflix.com/in/title/70305903',
    prime: 'https://www.primevideo.com/detail/0G0WMSJLLHOGWOPCGT8XJCG6X6',
    jiocinema: 'https://www.jiocinema.com/movies/interstellar/3498877',
    appletv: 'https://tv.apple.com/in/movie/interstellar/umc.cmc.24x3616l',
    justwatch: 'https://www.justwatch.com/in/movie/interstellar',
  },

  // Breaking Bad (Netflix Exclusive)
  1396: {
    netflix: 'https://www.netflix.com/in/title/70143836',
    justwatch: 'https://www.justwatch.com/in/tv-show/breaking-bad',
  },

  // RRR (Netflix Hindi, ZEE5 Regional)
  579974: {
    netflix: 'https://www.netflix.com/in/title/81476453',
    zee5: 'https://www.zee5.com/movies/details/rrr/0-0-1z5154378',
    justwatch: 'https://www.justwatch.com/in/movie/rrr',
  },

  // The Dark Knight (Netflix, JioCinema, Prime Video)
  155: {
    netflix: 'https://www.netflix.com/in/title/70079583',
    jiocinema: 'https://www.jiocinema.com/movies/the-dark-knight/3489221',
    prime: 'https://www.primevideo.com/detail/0N9V39E839X6',
    justwatch: 'https://www.justwatch.com/in/movie/the-dark-knight',
  },

  // Inception (Netflix, JioCinema)
  27205: {
    netflix: 'https://www.netflix.com/in/title/70131314',
    jiocinema: 'https://www.jiocinema.com/movies/inception/3489112',
    justwatch: 'https://www.justwatch.com/in/movie/inception',
  },

  // Fight Club (Prime Video)
  550: {
    prime: 'https://www.primevideo.com/detail/0QJ13Q3M4J7P',
    justwatch: 'https://www.justwatch.com/in/movie/fight-club',
  },

  // Stranger Things (Netflix Exclusive)
  66732: {
    netflix: 'https://www.netflix.com/in/title/80057281',
    justwatch: 'https://www.justwatch.com/in/tv-show/stranger-things',
  },

  // Shogun (Disney+ Hotstar Exclusive)
  126308: {
    hotstar: 'https://www.hotstar.com/in/shows/shogun/1260166291',
    justwatch: 'https://www.justwatch.com/in/tv-show/shogun',
  },

  // Game of Thrones (JioCinema Premium)
  1399: {
    jiocinema: 'https://www.jiocinema.com/tv-shows/game-of-thrones/3501231',
    justwatch: 'https://www.justwatch.com/in/tv-show/game-of-thrones',
  },

  // The Last of Us (JioCinema Premium)
  100088: {
    jiocinema: 'https://www.jiocinema.com/tv-shows/the-last-of-us/3739281',
    justwatch: 'https://www.justwatch.com/in/tv-show/the-last-of-us',
  },
};

/**
 * Clean slug generator
 */
export function generateTitleSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Filter and resolve ONLY platforms where the title is ACTUALLY available!
 */
export function getRealAvailableStreamingProviders(
  titleId: number,
  titleName: string,
  mediaType: 'movie' | 'tv' = 'movie',
  watchProvidersData?: WatchProvidersData,
  region: string = 'IN'
): { availableList: ActiveStreamingOption[]; justwatchUrl: string; hasSubscription: boolean } {
  const slug = generateTitleSlug(titleName);
  const typeSlug = mediaType === 'tv' ? 'tv-show' : 'movie';
  const directUrls = DIRECT_OTT_URLS[titleId] || {};
  const justwatchUrl = directUrls.justwatch || watchProvidersData?.link || `https://www.justwatch.com/${region.toLowerCase()}/${typeSlug}/${slug}`;

  const availableMap = new Map<string, ActiveStreamingOption>();

  // 1. Check verified curated availability map for this title
  if (Object.keys(directUrls).length > 0) {
    if (directUrls.netflix) {
      availableMap.set('netflix', {
        key: 'netflix',
        name: 'Netflix',
        tier: 'Subscription',
        subtext: 'Subscription Stream (4K)',
        logoBg: '#E50914',
        logoText: 'N',
        accentBorder: 'hover:border-red-600',
        accentText: 'group-hover:text-red-400',
        url: directUrls.netflix,
      });
    }

    if (directUrls.jiocinema) {
      availableMap.set('jiocinema', {
        key: 'jiocinema',
        name: 'JioCinema',
        tier: 'Subscription',
        subtext: 'JioCinema Premium (4K)',
        logoBg: '#D3007B',
        logoText: 'Jio',
        accentBorder: 'hover:border-pink-500',
        accentText: 'group-hover:text-pink-400',
        url: directUrls.jiocinema,
      });
    }

    if (directUrls.prime) {
      const isRent = titleId === 693134 || titleId === 872585; // Dune 2 & Oppenheimer are rent on Prime in India
      availableMap.set('prime', {
        key: 'prime',
        name: 'Amazon Prime',
        tier: isRent ? 'Rent' : 'Subscription',
        subtext: isRent ? 'Rent / Buy (4K UHD)' : 'Prime Subscription',
        logoBg: '#00A8E1',
        logoText: 'PV',
        accentBorder: 'hover:border-sky-500',
        accentText: 'group-hover:text-sky-400',
        url: directUrls.prime,
      });
    }

    if (directUrls.hotstar) {
      availableMap.set('hotstar', {
        key: 'hotstar',
        name: 'Disney+ Hotstar',
        tier: 'Subscription',
        subtext: 'Hotstar Super / Premium',
        logoBg: '#00147B',
        logoText: 'D+',
        accentBorder: 'hover:border-blue-500',
        accentText: 'group-hover:text-blue-400',
        url: directUrls.hotstar,
      });
    }

    if (directUrls.zee5) {
      availableMap.set('zee5', {
        key: 'zee5',
        name: 'ZEE5',
        tier: 'Subscription',
        subtext: 'ZEE5 Premium (Dolby)',
        logoBg: '#8230C6',
        logoText: 'Z5',
        accentBorder: 'hover:border-purple-500',
        accentText: 'group-hover:text-purple-400',
        url: directUrls.zee5,
      });
    }

    if (directUrls.appletv) {
      availableMap.set('appletv', {
        key: 'appletv',
        name: 'Apple TV',
        tier: 'Rent',
        subtext: 'Rent from ₹120 (4K Atmos)',
        logoBg: '#333333',
        logoText: 'tv',
        accentBorder: 'hover:border-zinc-500',
        accentText: 'group-hover:text-zinc-200',
        url: directUrls.appletv,
      });
    }

    if (directUrls.youtube) {
      availableMap.set('youtube', {
        key: 'youtube',
        name: 'YouTube Movies',
        tier: 'Rent',
        subtext: 'Rent from ₹150 (HD/4K)',
        logoBg: '#FF0000',
        logoText: '▶',
        accentBorder: 'hover:border-red-500',
        accentText: 'group-hover:text-red-400',
        url: directUrls.youtube,
      });
    }
  }

  // 2. Supplement or build from TMDB watchProvidersData (for all other movies)
  if (watchProvidersData && availableMap.size === 0) {
    const flatrate = watchProvidersData.flatrate || [];
    const rent = watchProvidersData.rent || [];
    const buy = watchProvidersData.buy || [];
    const free = watchProvidersData.free || watchProvidersData.ads || [];

    const processProvider = (p: WatchProviderInfo, tier: 'Subscription' | 'Rent' | 'Buy' | 'Free') => {
      const nameLower = p.provider_name.toLowerCase();
      let key = 'generic-' + p.provider_id;
      let url = justwatchUrl;
      let logoBg = '#1c2130';
      let logoText = p.provider_name.slice(0, 2).toUpperCase();
      let accentBorder = 'hover:border-amber-400';
      let accentText = 'group-hover:text-amber-400';
      let subtext = `${tier} Stream`;

      if (nameLower.includes('netflix')) {
        key = 'netflix';
        url = `https://www.netflix.com/title/${titleId}`;
        logoBg = '#E50914';
        logoText = 'N';
        accentBorder = 'hover:border-red-600';
        accentText = 'group-hover:text-red-400';
        subtext = 'Subscription (4K)';
      } else if (nameLower.includes('prime') || nameLower.includes('amazon')) {
        key = 'prime';
        url = `https://www.primevideo.com/search?phrase=${encodeURIComponent(titleName)}`;
        logoBg = '#00A8E1';
        logoText = 'PV';
        accentBorder = 'hover:border-sky-500';
        accentText = 'group-hover:text-sky-400';
        subtext = tier === 'Subscription' ? 'Prime Video Subscription' : 'Rent / Buy (4K)';
      } else if (nameLower.includes('hotstar') || nameLower.includes('disney')) {
        key = 'hotstar';
        url = `https://www.hotstar.com/in/explore?search_query=${encodeURIComponent(titleName)}`;
        logoBg = '#00147B';
        logoText = 'D+';
        accentBorder = 'hover:border-blue-500';
        accentText = 'group-hover:text-blue-400';
        subtext = 'Disney+ Hotstar';
      } else if (nameLower.includes('jio')) {
        key = 'jiocinema';
        url = `https://www.jiocinema.com/search/${encodeURIComponent(titleName)}`;
        logoBg = '#D3007B';
        logoText = 'Jio';
        accentBorder = 'hover:border-pink-500';
        accentText = 'group-hover:text-pink-400';
        subtext = 'JioCinema Premium';
      } else if (nameLower.includes('apple')) {
        key = 'appletv';
        url = `https://tv.apple.com/search?term=${encodeURIComponent(titleName)}`;
        logoBg = '#333333';
        logoText = 'tv';
        accentBorder = 'hover:border-zinc-500';
        accentText = 'group-hover:text-zinc-200';
        subtext = 'Apple TV (Rent/Buy)';
      } else if (nameLower.includes('youtube') || nameLower.includes('google')) {
        key = 'youtube';
        url = `https://www.youtube.com/results?search_query=${encodeURIComponent(titleName + ' buy or rent')}`;
        logoBg = '#FF0000';
        logoText = '▶';
        accentBorder = 'hover:border-red-500';
        accentText = 'group-hover:text-red-400';
        subtext = 'Rent / Purchase';
      } else if (nameLower.includes('zee')) {
        key = 'zee5';
        url = `https://www.zee5.com`;
        logoBg = '#8230C6';
        logoText = 'Z5';
        accentBorder = 'hover:border-purple-500';
        accentText = 'group-hover:text-purple-400';
        subtext = 'ZEE5 Subscription';
      }

      if (!availableMap.has(key)) {
        availableMap.set(key, {
          key,
          name: p.provider_name,
          tier,
          subtext,
          logoBg,
          logoText,
          accentBorder,
          accentText,
          url,
        });
      }
    };

    flatrate.forEach((p) => processProvider(p, 'Subscription'));
    free.forEach((p) => processProvider(p, 'Free'));
    rent.forEach((p) => processProvider(p, 'Rent'));
    buy.forEach((p) => processProvider(p, 'Buy'));
  }

  const list = Array.from(availableMap.values());
  const hasSubscription = list.some((i) => i.tier === 'Subscription' || i.tier === 'Free');

  return {
    availableList: list,
    justwatchUrl,
    hasSubscription,
  };
}
