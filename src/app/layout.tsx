import type { Metadata } from 'next';
import { Space_Grotesk, Bebas_Neue, Manrope } from 'next/font/google';
import './globals.css';
import { WatchlistProvider } from '@/context/WatchlistContext';
import { AuthProvider } from '@/context/AuthContext';
import Header from '@/components/Header';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas-neue',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CineFuel - Discover Movies & TV, Where to Watch & Track Watchlist',
  description: 'Your ultimate cinema command center. Discover trending movies & TV shows, check India streaming availability on Hotstar, Netflix, and JioCinema.',
  keywords: 'movies, tv shows, streaming india, watchlist, hotstar, jiocinema, netflix, tmdb, imdb ratings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${bebasNeue.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-ui bg-[#08090c] text-zinc-100 min-h-screen flex flex-col antialiased selection:bg-amber-500 selection:text-black"
        suppressHydrationWarning
      >
        <AuthProvider>
          <WatchlistProvider>
            <Header />
            <main className="flex-1 pt-16">{children}</main>
          </WatchlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
