'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Film, Search, Bookmark, Sparkles, Settings, RefreshCw, Flame, Menu, X, User as UserIcon, Layers, Compass, Shield } from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAuth } from '@/context/AuthContext';
import SettingsModal from './SettingsModal';
import AuthModal from './AuthModal';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { stats, simklConfig, isMounted } = useWatchlist();
  const { userProfile, isLoggedIn } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hotkey listener for '/' or 'Ctrl+K'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        router.push('/search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navLinks = [
    { href: '/', label: 'Discover' },
    { href: '/recommendations', label: 'For You' },
    { href: '/movies', label: 'Movies' },
    { href: '/tv', label: 'TV Shows' },
    { href: '/lists', label: 'Lists' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/simkl', label: 'SIMKL' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#08090c]/90 backdrop-blur-md border-b border-white/10 shadow-2xl py-3'
            : 'bg-gradient-to-b from-[#08090c]/95 via-[#08090c]/60 to-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 p-0.5 shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#090b0e] rounded-[10px] flex items-center justify-center">
                <Flame className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
                CINE<span className="text-gradient-gold">FUEL</span>
              </span>
              <span className="text-[10px] tracking-wider uppercase text-zinc-400 font-medium -mt-1">
                Discover & Track
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                  {link.href === '/watchlist' && isMounted && stats.totalItems > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {stats.totalItems}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {/* Search Bar Input */}
            <form onSubmit={handleSearchSubmit} className="relative hidden sm:block w-40 md:w-52 lg:w-60">
              <input
                type="text"
                placeholder="Search... (Press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/80 hover:bg-zinc-900 focus:bg-zinc-900 text-xs text-zinc-100 placeholder-zinc-500 rounded-full pl-8 pr-8 py-1.5 border border-zinc-700/60 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                suppressHydrationWarning
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <kbd className="hidden md:inline-flex items-center absolute right-2.5 top-1/2 -translate-y-1/2 px-1 py-0.5 text-[9px] text-zinc-400 bg-zinc-800 rounded border border-zinc-700">
                /
              </kbd>
            </form>

            {/* Mobile Search Button */}
            <Link
              href="/search"
              className="sm:hidden p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:text-white border border-zinc-700"
              aria-label="Search"
              suppressHydrationWarning
            >
              <Search className="w-4 h-4" />
            </Link>

            {/* Admin Panel Button */}
            <Link
              href="/admin"
              className={`p-2 rounded-lg transition-colors border ${
                pathname === '/admin'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-800/70 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border-zinc-700/60'
              }`}
              title="Admin Control Panel"
              aria-label="Admin"
              suppressHydrationWarning
            >
              <Shield className="w-4 h-4" />
            </Link>

            {/* Settings Modal Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-700/60 transition-colors"
              title="Settings & API Keys"
              aria-label="Settings"
              suppressHydrationWarning
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile / Auth Button */}
            <Link
              href="/profile"
              className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-all hover:border-amber-400/50"
              title={isLoggedIn ? `Profile: ${userProfile.displayName}` : 'Sign In / Profile'}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-black font-black text-xs shrink-0">
                {userProfile.displayName ? userProfile.displayName[0].toUpperCase() : 'U'}
              </div>
              <span className="hidden md:inline text-xs font-semibold max-w-[90px] truncate">
                {userProfile.displayName}
              </span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
              aria-label="Menu"
              suppressHydrationWarning
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0e1117] border-b border-white/10 px-4 py-4 space-y-2 animate-fadeIn">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  pathname === link.href ? 'bg-amber-400/10 text-amber-400' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                pathname === '/admin' ? 'bg-amber-500 text-black' : 'text-amber-400 hover:bg-zinc-800'
              }`}
            >
              <Shield className="w-4 h-4" /> Admin Control Panel
            </Link>
          </div>
        )}
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}

      {/* Auth Modal */}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
    </>
  );
};

export default Header;
