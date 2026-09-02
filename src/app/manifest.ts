import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CineFuel - Movie & TV Discovery',
    short_name: 'CineFuel',
    description: 'Your cinema command center for discovery, India streaming availability, and SIMKL tracking.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08090c',
    theme_color: '#f59e0b',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
