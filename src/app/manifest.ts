import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CiNEPHiLE - Movie & TV Discovery',
    short_name: 'CiNEPHiLE',
    description: 'Your cinema command center for discovery and direct streaming.',
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
