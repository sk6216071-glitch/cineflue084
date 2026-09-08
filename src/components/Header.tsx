'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Film, Search, Bookmark, Sparkles, Settings, RefreshCw, Flame, Menu, X, User as UserIcon, Layers, Compass, Shield, ChevronDown } from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAuth } from '@/context/AuthContext';
import SettingsModal from './SettingsModal';
import AuthModal from './AuthModal';

interface NavDropdownItem {
  label: string;
  href: string;
  badge?: string;
}

interface NavItem {
  label: string;
  href?: string;
  children?: NavDropdownItem[];
}

const NAVIGATION_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Movies',
    href: '/movies',
    children: [
      { label: 'All Movies', href: '/movies' },
      { label: 'Bollywood / Hindi', href: '/search?q=Bollywood' },
      { label: 'Hollywood / English', href: '/search?q=Hollywood' },
      { label: 'South Hindi Dubbed', href: '/search?q=South+Hindi+Dubbed' },
      { label: 'Dual Audio (Hindi + Eng)', href: '/search?q=Dual+Audio' },
      { label: 'Action Movies', href: '/search?genre=28&name=Action' },
      { label: 'Sci-Fi & Fantasy', href: '/search?genre=878&name=Sci-Fi' },
    ],
  },
  {
    label: 'Web Series',
    href: '/tv',
    children: [
      { label: 'All Web Series', href: '/tv' },
      { label: 'Hindi Web Series', href: '/search?q=Hindi+Series' },
      { label: 'English Web Series', href: '/search?q=English+Series' },
      { label: 'Korean Dramas (K-Drama)', href: '/search?q=Korean+Drama' },
      { label: 'Anime Series', href: '/search?q=Anime+Series' },
    ],
  },
  {
    label: 'OTT',
    children: [
      { label: 'Netflix', href: '/search?q=Netflix', badge: '🔴' },
      { label: 'Disney+ Hotstar', href: '/search?q=Hotstar', badge: '⭐' },
      { label: 'Amazon Prime Video', href: '/search?q=Prime+Video', badge: '📦' },
      { label: 'JioCinema', href: '/search?q=JioCinema', badge: '🎬' },
      { label: 'Zee5', href: '/search?q=Zee5', badge: '⚡' },
      { label: 'SonyLIV', href: '/search?q=SonyLIV', badge: '📺' },
      { label: 'Apple TV+', href: '/search?q=Apple+TV', badge: '🍎' },
    ],
  },
  { label: 'Anime', href: '/search?genre=16&name=Anime' },
  { label: '4K HDR', href: '/search?q=4K+HDR' },
  { label: 'Top IMDb', href: '/search?sort=top_rated&q=Top+Rated' },
];

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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const dropdownTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (label: string) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setOpenDropdown(label);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
  };

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
            {NAVIGATION_ITEMS.map((item) => {
              if (item.children) {
                const isChildActive = item.children.some((c) => pathname === c.href);
                const isDirectActive = item.href && pathname === item.href;
                const isOpen = openDropdown === item.label;

                return (
                  <div
                    key={item.label}
                    className="relative group"
                    onMouseEnter={() => handleMouseEnter(item.label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isDirectActive || isChildActive || isOpen
                            ? 'text-amber-400 bg-amber-400/10'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{item.label}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-amber-400 opacity-100' : ''
                          }`}
                        />
                      </Link>
                    ) : (
                      <button
                        onClick={() => setOpenDropdown(isOpen ? null : item.label)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isChildActive || isOpen
                            ? 'text-amber-400 bg-amber-400/10'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{item.label}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-amber-400 opacity-100' : ''
                          }`}
                        />
                      </button>
                    )}

                    {isOpen && (
                      <div
                        className="absolute top-full left-0 mt-1 w-52 bg-[#0c0e14]/95 backdrop-blur-xl border border-zinc-800/90 rounded-xl shadow-2xl p-1.5 z-50 animate-fadeIn"
                        onMouseEnter={() => handleMouseEnter(item.label)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {item.children.map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.label}
                              href={sub.href}
                              onClick={() => setOpenDropdown(null)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                isSubActive
                                  ? 'bg-amber-500/15 text-amber-400 font-bold'
                                  : 'text-zinc-300 hover:text-white hover:bg-amber-500/10 hover:text-amber-400'
                              }`}
                            >
                              <span>{sub.label}</span>
                              {sub.badge && <span className="text-[11px]">{sub.badge}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href || '/'}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
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

            {/* Watchlist Quick Button */}
            <Link
              href="/watchlist"
              className={`p-2 rounded-lg transition-colors border relative ${
                pathname === '/watchlist'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-800/70 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border-zinc-700/60'
              }`}
              title="My Watchlist"
              aria-label="Watchlist"
              suppressHydrationWarning
            >
              <Bookmark className="w-4 h-4" />
              {isMounted && stats.totalItems > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-amber-500 text-black shadow-sm">
                  {stats.totalItems}
                </span>
              )}
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
          <div className="lg:hidden bg-[#0e1117] border-b border-white/10 px-4 py-4 space-y-1.5 max-h-[80vh] overflow-y-auto animate-fadeIn">
            {NAVIGATION_ITEMS.map((item) => {
              if (item.children) {
                const isExpanded = mobileExpanded === item.label;
                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      onClick={() => setMobileExpanded(isExpanded ? null : item.label)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-400 transition-transform ${
                          isExpanded ? 'rotate-180 text-amber-400' : ''
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="pl-3 space-y-1 border-l border-zinc-800 ml-3">
                        {item.children.map((sub) => (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`block px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                              pathname === sub.href
                                ? 'bg-amber-400/10 text-amber-400 font-bold'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                          >
                            <span>{sub.label}</span>
                            {sub.badge && <span className="text-[10px]">{sub.badge}</span>}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href || '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-amber-400/10 text-amber-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="pt-2 border-t border-zinc-800/80 space-y-1">
              <Link
                href="/watchlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800"
              >
                <span className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-400" /> My Watchlist
                </span>
                {isMounted && stats.totalItems > 0 && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500 text-black font-bold">
                    {stats.totalItems}
                  </span>
                )}
              </Link>

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
