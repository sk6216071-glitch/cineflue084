'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import AdminLoginGate from '@/components/admin/AdminLoginGate';

// Lazy-load the heavy authenticated dashboard so unauthenticated visitors (and PageSpeed Insights)
// download ONLY the lightweight login screen (< 15 KB JS instead of 485 KB!).
const AdminDashboard = dynamic(
  () => import('@/components/admin/AdminDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#08090c] flex flex-col items-center justify-center gap-3 text-amber-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-400">Loading Master Control Panel...</span>
      </div>
    ),
  }
);

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('cinefuel_admin_pass');
      localStorage.removeItem('cinefuel_admin_key');
      localStorage.removeItem('cinefuel_admin_user');
      sessionStorage.removeItem('cinefuel_admin_pass');
      sessionStorage.removeItem('cinefuel_admin_auth');
      sessionStorage.removeItem('cinefuel_admin_user');
    } catch {}

    const sessionToken =
      sessionStorage.getItem('cinefuel_admin_token') ||
      localStorage.getItem('cinefuel_id_token');

    if (!sessionToken) {
      setIsAuthenticated(false);
      return;
    }

    fetch('/api/admin/auth', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem('cinefuel_admin_token');
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  if (isAuthenticated === null) {
    return <AdminLoginGate checkingAuth={true} />;
  }

  if (!isAuthenticated) {
    return <AdminLoginGate onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return <AdminDashboard onLogout={() => setIsAuthenticated(false)} />;
}
