import { TitleDetails, WatchlistItem, RecommendationItem } from '@/types';
import { MOCK_TITLES, TOP_RATED_LIST, TRENDING_LIST } from './mockData';
import { getPopularMovies, getPopularTV, getTopRated, getDiscover } from './tmdb';

export interface PersonalizedRecommendationsResult {
  forYou: RecommendationItem[];
  basedOnTopRatings: RecommendationItem[];
  topGenrePicks: { genreName: string; items: RecommendationItem[] };
  actorDirectorPicks: RecommendationItem[];
  topUnwatchedMasterpieces: RecommendationItem[];
}

export async function getPersonalizedRecommendations(
  watchlist: WatchlistItem[]
): Promise<PersonalizedRecommendationsResult> {
  const watchedItems = watchlist.filter((item) => item.status === 'watched');
  const watchedIds = new Set(watchedItems.map((item) => item.id));

  // 1. Calculate Genre Affinity
  const genreWeights: Record<string, number> = {};
  const ratedHighTitles = watchedItems.filter((i) => (i.personalRating || 0) >= 8);

  watchedItems.forEach((item) => {
    const ratingWeight = item.personalRating
      ? item.personalRating >= 9
        ? 3.0
        : item.personalRating >= 8
        ? 2.2
        : item.personalRating >= 7
        ? 1.5
        : 1.0
      : item.isFavorite
      ? 2.0
      : 1.0;

    item.genres?.forEach((genre) => {
      genreWeights[genre] = (genreWeights[genre] || 0) + ratingWeight;
    });
  });

  // Find top favorite genre
  let topGenreName = 'Sci-Fi';
  let topGenreScore = 0;
  Object.entries(genreWeights).forEach(([gName, score]) => {
    if (score > topGenreScore) {
      topGenreScore = score;
      topGenreName = gName;
    }
  });

  // 2. Fetch candidate titles from TMDB / Mock Catalog
  const [popularMovies, popularTV, topRatedMovies, topRatedTV] = await Promise.all([
    getPopularMovies(1),
    getPopularTV(1),
    getTopRated('movie', 1),
    getTopRated('tv', 1),
  ]);

  const allCandidatesMap = new Map<number, TitleDetails>();
  [
    ...Object.values(MOCK_TITLES),
    ...popularMovies,
    ...popularTV,
    ...topRatedMovies,
    ...topRatedTV,
    ...TRENDING_LIST,
    ...TOP_RATED_LIST,
  ].forEach((candidate) => {
    if (!watchedIds.has(candidate.id) && !allCandidatesMap.has(candidate.id)) {
      allCandidatesMap.set(candidate.id, candidate);
    }
  });

  const candidates = Array.from(allCandidatesMap.values());

  // 3. Multi-Factor Scoring
  const scoredItems: RecommendationItem[] = candidates.map((candidate) => {
    let score = (candidate.vote_average || 7.0) * 1.5;
    let primaryReason = 'Highly acclaimed title suited to your taste';
    let category: RecommendationItem['category'] = 'top_unwatched';

    // A. Genre Overlap
    let genreMatchBonus = 0;
    candidate.genres?.forEach((g) => {
      if (genreWeights[g.name]) {
        genreMatchBonus += genreWeights[g.name] * 3.5;
      }
    });
    score += genreMatchBonus;

    // B. Match with High-Rated Seed Title
    if (ratedHighTitles.length > 0) {
      const highestRated = ratedHighTitles[0];
      const sharedGenres = candidate.genres?.filter((cg) =>
        highestRated.genres?.includes(cg.name)
      );

      if (sharedGenres && sharedGenres.length >= 2) {
        score += 15;
        primaryReason = `Because you rated "${highestRated.title}" ${highestRated.personalRating}★`;
        category = 'rated_match';
      } else if (genreMatchBonus > 10) {
        primaryReason = `Top match for your interest in ${topGenreName}`;
        category = 'genre_affinity';
      }
    } else if (genreMatchBonus > 0) {
      primaryReason = `Recommended based on your interest in ${topGenreName}`;
      category = 'genre_affinity';
    }

    // C. Director / Actor Affinity (Nolan, Denis Villeneuve, Cillian Murphy, etc.)
    const candidateCast = candidate.credits?.cast?.map((c) => c.name) || [];
    const candidateCrew = candidate.credits?.crew?.map((c) => c.name) || [];

    if (
      candidateCrew.some((name) => name.includes('Nolan') || name.includes('Villeneuve') || name.includes('Rajamouli'))
    ) {
      score += 20;
      primaryReason = `From visionary directors you enjoy watching`;
      category = 'actor_director';
    }

    return {
      item: candidate,
      reason: primaryReason,
      score,
      category,
    };
  });

  // Sort candidates by score descending
  scoredItems.sort((a, b) => b.score - a.score);

  // Group into curated reels
  const forYou = scoredItems.slice(0, 10);
  const basedOnTopRatings = scoredItems.filter((i) => i.category === 'rated_match').slice(0, 8);
  const topGenreItems = scoredItems
    .filter((i) => i.item.genres?.some((g) => g.name.toLowerCase() === topGenreName.toLowerCase()))
    .slice(0, 8);
  const actorDirectorPicks = scoredItems.filter((i) => i.category === 'actor_director').slice(0, 8);
  const topUnwatchedMasterpieces = scoredItems
    .filter((i) => i.item.vote_average >= 8.2)
    .slice(0, 8);

  return {
    forYou,
    basedOnTopRatings: basedOnTopRatings.length > 0 ? basedOnTopRatings : forYou.slice(0, 6),
    topGenrePicks: {
      genreName: topGenreName,
      items: topGenreItems.length > 0 ? topGenreItems : forYou.slice(2, 8),
    },
    actorDirectorPicks: actorDirectorPicks.length > 0 ? actorDirectorPicks : forYou.slice(1, 7),
    topUnwatchedMasterpieces: topUnwatchedMasterpieces.length > 0 ? topUnwatchedMasterpieces : forYou.slice(0, 8),
  };
}
