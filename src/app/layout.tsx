import type { Metadata } from 'next';
import './globals.css';
import { WatchlistProvider } from '@/context/WatchlistContext';
import { AuthProvider } from '@/context/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'CineFuel - Discover Movies & TV, Where to Watch & Track Watchlist',
  description: 'Your ultimate cinema command center. Discover trending movies & TV shows, check India streaming availability on Hotstar, Netflix, JioCinema, and sync with Trakt.',
  keywords: 'movies, tv shows, streaming india, trakt sync, watchlist, hotstar, jiocinema, netflix, tmdb, imdb ratings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="bg-[#08090c] text-zinc-100 min-h-screen flex flex-col antialiased selection:bg-amber-500 selection:text-black"
        suppressHydrationWarning
      >
        <AuthProvider>
          <WatchlistProvider>
            <Header />
            <main className="flex-1 pt-16">{children}</main>
            <Footer />
          </WatchlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
