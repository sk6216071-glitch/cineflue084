'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User as UserIcon,
  Mail,
  Edit3,
  Check,
  Star,
  Clock,
  Eye,
  Bookmark,
  Heart,
  Layers,
  Sparkles,
  ShieldCheck,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWatchlist } from '@/context/WatchlistContext';
import AuthModal from '@/components/AuthModal';

export default function ProfilePage() {
  const { userProfile, updateProfileData, isLoggedIn, logout } = useAuth();
  const { stats, watchlist } = useWatchlist();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(userProfile.displayName || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Compute Rating Distribution (1★ to 10★)
  const ratingDistribution = Array.from({ length: 10 }, (_, i) => i + 1).map((star) => {
    const count = watchlist.filter((item) => Math.round(item.personalRating || 0) === star).length;
    return { star, count };
  });

  const maxRatingCount = Math.max(...ratingDistribution.map((r) => r.count), 1);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileData({
      displayName: displayName.trim(),
      bio: bio.trim(),
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* 1. Profile Header Card */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-red-600 p-1 shadow-xl shadow-amber-500/20 shrink-0">
              <div className="w-full h-full bg-[#090b0e] rounded-full flex items-center justify-center text-white font-black text-3xl">
                {userProfile.displayName ? userProfile.displayName[0].toUpperCase() : 'U'}
              </div>
            </div>

            {/* Name & Bio */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{userProfile.displayName}</h1>
                {isLoggedIn ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Cloud Synced
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold">
                    Guest Mode
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-zinc-500" /> {userProfile.email}
              </p>

              <p className="text-xs sm:text-sm text-zinc-300 max-w-xl pt-1 leading-relaxed">
                {userProfile.bio || 'Cinema enthusiast tracking films and discovering stories on CineFuel.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>

            {!isLoggedIn ? (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In / Sync
              </button>
            ) : (
              <button
                onClick={logout}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="pt-4 border-t border-zinc-800 space-y-4 animate-fadeIn">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Update Profile Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Bio / Slogan</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Lifetime Cinema Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-zinc-400">Total Logged</span>
          <div className="my-1.5 text-3xl font-black text-white">{stats.totalItems}</div>
          <span className="text-[11px] text-zinc-500">Movies & shows</span>
        </div>

        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Watched Count
          </span>
          <div className="my-1.5 text-3xl font-black text-emerald-400">{stats.watchedCount}</div>
          <span className="text-[11px] text-zinc-500">Completed titles</span>
        </div>

        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Screen Time
          </span>
          <div className="my-1.5 text-3xl font-black text-amber-400">
            {Math.floor(stats.totalRuntimeMinutes / 60)}h {stats.totalRuntimeMinutes % 60}m
          </div>
          <span className="text-[11px] text-zinc-500">Logged viewing duration</span>
        </div>

        <div className="bg-[#0f121a] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" /> Favorites
          </span>
          <div className="my-1.5 text-3xl font-black text-rose-400">{stats.favoritesCount}</div>
          <span className="text-[11px] text-zinc-500">Avg score: {stats.averageRating > 0 ? `${stats.averageRating}★` : '—'}</span>
        </div>
      </div>

      {/* 3. Star Rating Distribution Histogram */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="text-lg font-bold text-white">Your Star Rating Distribution</h2>
          </div>
          <span className="text-xs text-zinc-400 font-semibold">1★ to 10★ Scores</span>
        </div>

        <div className="space-y-2.5">
          {ratingDistribution.map(({ star, count }) => {
            const percentage = Math.round((count / maxRatingCount) * 100);
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-right font-bold text-zinc-300">{star}★</span>
                <div className="flex-1 bg-zinc-900 rounded-full h-3 overflow-hidden border border-zinc-800">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${count > 0 ? Math.max(8, percentage) : 0}%` }}
                  />
                </div>
                <span className="w-8 text-left font-semibold text-zinc-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
