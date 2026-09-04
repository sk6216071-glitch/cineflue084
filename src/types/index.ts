export type MediaType = 'movie' | 'tv' | 'person';

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order?: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface VideoItem {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
}

export interface WatchProviderInfo {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority?: number;
}

export interface WatchProvidersData {
  link?: string;
  flatrate?: WatchProviderInfo[]; // Streaming subscription (e.g., Netflix, Prime, Hotstar)
  rent?: WatchProviderInfo[];
  buy?: WatchProviderInfo[];
  free?: WatchProviderInfo[];
  ads?: WatchProviderInfo[];
}

export interface MDBListRatingItem {
  source: string; // 'imdb' | 'tmdb' | 'trakt' | 'tomatoes' | 'tomatoes_audience' | 'metacritic' | 'letterboxd' | 'mal' | 'anilist'
  value: number; // Normalized (e.g., 8.4, 92%, etc.)
  score?: number; // 0 - 100
  votes?: number;
  url?: string;
}

export interface MDBListResponse {
  id?: number;
  title?: string;
  year?: number;
  type?: 'movie' | 'show';
  imdbid?: string;
  tmdbid?: number;
  traktid?: number;
  score?: number; // MDBList overall rating score (0 - 100)
  score_average?: number;
  ratings?: MDBListRatingItem[];
  certification?: string; // PG-13, R, TV-MA, U/A
  commonsense?: number;
  budget?: number;
  revenue?: number;
  runtime?: number;
}

export interface TitleDetails {
  id: number;
  title: string;
  original_title?: string;
  name?: string; // For TV
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genres: Genre[];
  genre_ids?: number[];
  media_type: 'movie' | 'tv';
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Array<{
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    poster_path?: string | null;
    air_date?: string;
  }>;
  tagline?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  external_ids?: {
    imdb_id?: string;
    tmdb_id?: number;
    tvdb_id?: number;
    simkl_id?: number;
    mdblist_id?: number;
    trakt_id?: number;
    instagram_id?: string;
    twitter_id?: string;
  };
  imdb_rating?: number;
  imdb_votes?: string;
  simkl_rating?: number;
  simkl_votes?: number;
  mdblist_score?: number;
  mdblist_ratings?: MDBListRatingItem[];
  trakt_rating?: number;
  trakt_votes?: number;
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
  videos?: {
    results: VideoItem[];
  };
  similar?: {
    results: TitleDetails[];
  };
  recommendations?: {
    results: TitleDetails[];
  };
  'watch/providers'?: {
    results: Record<string, WatchProvidersData>;
  };
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  combined_credits?: {
    cast: TitleDetails[];
    crew: TitleDetails[];
  };
  external_ids?: {
    imdb_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
}

export interface CustomLink {
  id: string;
  title: string;
  url: string;
  category: 'Recent' | 'Streaming' | 'Subtitles' | 'Discussion' | 'Review' | 'Download' | 'Official' | 'Other' | 'ZipPack' | 'SingleEpisode';
  createdAt: string;
  seasonNumber?: number;
  episodeNumber?: number;
  quality?: string; // '4K HDR' | '1080p' | '720p' | '480p' | '2160p HEVC' | 'BluRay'
  audioLanguage?: string; // 'Hindi + English' | 'English' | 'Dual Audio'
  size?: string; // '1.2 GB' | '4.5 GB' | '18 GB Zip'
  linkType?: 'zip_pack' | 'single_episode' | 'general';
}

export interface WatchlistItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  status: 'watchlist' | 'watched' | 'watching';
  isFavorite: boolean;
  personalRating?: number; // 1 - 10
  review?: string;
  watchedAt?: string;
  addedAt: string;
  genres?: string[];
  runtime?: number;
  customLinks: CustomLink[];
}

export interface CustomList {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  itemIds: number[];
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  bio?: string;
  favoriteGenres?: string[];
  createdAt: string;
  isGuest?: boolean;
}

export interface RecommendationItem {
  item: TitleDetails;
  reason: string;
  score: number;
  category: 'rated_match' | 'genre_affinity' | 'actor_director' | 'top_unwatched';
}

export interface SimklConfig {
  clientId: string;
  clientSecret?: string;
  userToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  username?: string;
  avatar?: string;
  isConnected: boolean;
  lastSyncedAt?: string;
}

export interface MdblistConfig {
  apiKey: string;
  isConnected: boolean;
  username?: string;
  lastSyncedAt?: string;
}

export interface AppSettings {
  tmdbApiKey: string;
  omdbApiKey: string;
  mdblistApiKey: string;
  defaultRegion: string; // 'IN' default
  theme: 'dark' | 'midnight' | 'oled';
  autoSyncSimkl: boolean;
  autoSyncMdblist: boolean;
}
