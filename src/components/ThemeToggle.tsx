'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('cinefuel_theme');
      if (saved === 'light') {
        setTheme('light');
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        setTheme('dark');
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
    } catch (e) {
      // localStorage unavailable (e.g. incognito restriction)
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cinefuel_theme' && e.newValue) {
        const newTheme = e.newValue === 'light' ? 'light' : 'dark';
        setTheme(newTheme);
        if (newTheme === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        } else {
          document.documentElement.classList.remove('light');
          document.documentElement.classList.add('dark');
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('cinefuel_theme', nextTheme);
    } catch (e) {}

    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }

    window.dispatchEvent(new CustomEvent('cinefuel_theme_changed', { detail: nextTheme }));
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className={`p-2 rounded-xl bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 ${className}`}
        aria-label="Toggle theme"
      >
        <Moon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition-all cursor-pointer ${
        theme === 'light'
          ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 shadow-sm'
          : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-zinc-700/80 hover:border-zinc-600'
      } ${className}`}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? (
        <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
