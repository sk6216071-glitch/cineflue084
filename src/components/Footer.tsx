import React from 'react';
import Link from 'next/link';
import { Flame, Heart, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-800/80 bg-[#06080b] text-zinc-400 text-sm mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 p-0.5">
                <div className="w-full h-full bg-[#090b0e] rounded-[6px] flex items-center justify-center">
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                CINE<span className="text-gradient-gold">FUEL</span>
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Your all-in-one cinema command center. Discover movies and TV shows, check India streaming availability, track your watchlist, and sync with Trakt.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-3">Discover</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/" className="hover:text-amber-400 transition-colors">Trending Today</Link></li>
              <li><Link href="/movies" className="hover:text-amber-400 transition-colors">Popular Movies</Link></li>
              <li><Link href="/tv" className="hover:text-amber-400 transition-colors">Top TV Shows</Link></li>
              <li><Link href="/search" className="hover:text-amber-400 transition-colors">Search & Filter</Link></li>
            </ul>
          </div>

          {/* Watch & Track */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-3">Tracking & Sync</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/watchlist" className="hover:text-amber-400 transition-colors">My Watchlist</Link></li>
              <li><Link href="/watchlist?tab=watched" className="hover:text-amber-400 transition-colors">Watched History</Link></li>
              <li><Link href="/watchlist?tab=favorites" className="hover:text-amber-400 transition-colors">Favorites & Ratings</Link></li>
              <li><Link href="/simkl" className="hover:text-sky-400 transition-colors">SIMKL Cloud Sync</Link></li>
              <li><Link href="/mdblist" className="hover:text-emerald-400 transition-colors">MDBList Ratings</Link></li>
              <li><Link href="/admin" className="hover:text-amber-400 transition-colors font-semibold text-amber-500/90">🛡️ Admin Panel</Link></li>
            </ul>
          </div>

          {/* Streaming & Region */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-3">India OTT Platforms</h4>
            <p className="text-xs text-zinc-500 mb-2">
              Streaming data powered by JustWatch / TMDB for Indian platforms:
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-400">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">Disney+ Hotstar</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">JioCinema</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">Netflix</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">Prime Video</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">Zee5</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">SonyLIV</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">Apple TV+</span>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800/60 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-3">
          <p suppressHydrationWarning>© {new Date().getFullYear()} CineFuel. Built for cinema lovers.</p>
          <div className="flex items-center gap-4 text-xs">
            <span>Data from TMDB, IMDb, SIMKL & MDBList</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
