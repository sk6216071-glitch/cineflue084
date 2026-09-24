'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  Sparkles,
  Send,
  CheckCircle2,
  Film,
  Tv,
  Layers,
  Volume2,
  MessageSquare,
  AtSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { getImageURL } from '@/lib/tmdb';
import { UserRequest } from '@/types';

interface RequestLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillTitle?: string;
  prefillMediaType?: 'movie' | 'tv';
  prefillTmdbId?: number;
  prefillPosterPath?: string | null;
  prefillYear?: string;
  onSuccess?: (request: UserRequest) => void;
}

const QUALITY_OPTIONS = [
  '4K HDR (2160p)',
  '1080p Full HD',
  '720p HD',
  'BluRay / REMUX',
  'Any Quality',
];

const AUDIO_OPTIONS = [
  'Dual Audio [Hindi + English]',
  'Hindi Dubbed',
  'English (Original)',
  'Tamil / Telugu Dub',
  'Any Audio',
];

export default function RequestLinkModal({
  isOpen,
  onClose,
  prefillTitle = '',
  prefillMediaType = 'movie',
  prefillTmdbId,
  prefillPosterPath,
  prefillYear = '',
  onSuccess,
}: RequestLinkModalProps) {
  const [title, setTitle] = useState(prefillTitle);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(prefillMediaType);
  const [quality, setQuality] = useState('1080p Full HD');
  const [audioLanguage, setAudioLanguage] = useState('Dual Audio [Hindi + English]');
  const [seasonNumber, setSeasonNumber] = useState<string>('');
  const [episodeNumber, setEpisodeNumber] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [userContact, setUserContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(prefillTitle);
      setMediaType(prefillMediaType);
      setIsSuccess(false);
      setErrorMessage('');
    }
  }, [isOpen, prefillTitle, prefillMediaType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please provide a title name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          mediaType,
          tmdbId: prefillTmdbId,
          posterPath: prefillPosterPath,
          releaseYear: prefillYear,
          seasonNumber: seasonNumber ? parseInt(seasonNumber, 10) : undefined,
          episodeNumber: episodeNumber ? parseInt(episodeNumber, 10) : undefined,
          quality,
          audioLanguage,
          notes,
          userContact,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      // Save to localStorage so user can reference their requests
      try {
        const stored = localStorage.getItem('cinefuel_my_requests');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(data.request);
        localStorage.setItem('cinefuel_my_requests', JSON.stringify(list.slice(0, 30)));
      } catch {}

      setIsSuccess(true);
      if (onSuccess && data.request) {
        onSuccess(data.request);
      }

      setTimeout(() => {
        onClose();
        setIsSuccess(false);
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const posterUrl = prefillPosterPath ? getImageURL(prefillPosterPath, 'w200') : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0e1118] border border-blue-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-white my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          <div className="py-10 text-center space-y-4 animate-scaleIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Request Received!</h3>
              <p className="text-sm text-zinc-300 max-w-sm mx-auto">
                Our admin team has received your link request for <span className="text-amber-400 font-semibold">&quot;{title}&quot;</span> and will upload it shortly.
              </p>
            </div>
            <div className="pt-2 text-xs text-zinc-400 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>We fulfill verified custom requests quickly!</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header / Title Preview */}
            <div className="flex items-center gap-3.5 border-b border-zinc-800 pb-4">
              {posterUrl ? (
                <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-zinc-700 bg-zinc-900 shadow-md">
                  <Image
                    src={posterUrl}
                    alt={title || 'Poster'}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-16 sm:w-14 sm:h-20 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center shrink-0">
                  {mediaType === 'tv' ? (
                    <Tv className="w-6 h-6 text-zinc-400" />
                  ) : (
                    <Film className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    {mediaType === 'tv' ? <Tv className="w-2.5 h-2.5" /> : <Film className="w-2.5 h-2.5" />}
                    {mediaType === 'tv' ? 'TV Series' : 'Movie'}
                  </span>
                  {prefillYear && (
                    <span className="text-xs text-zinc-400 font-mono">({prefillYear})</span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {prefillTitle ? prefillTitle : 'Request a Title or Custom Link'}
                </h3>
                <p className="text-xs text-zinc-400 line-clamp-1">
                  Tell our admin which quality, audio, or episode you need.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Title input (if not prefilled) */}
            {!prefillTitle && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Movie or TV Show Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spider-Man: Brand New Day, Loki..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            )}

            {/* Quality Selector Chips */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Desired Quality / Resolution</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      quality === q
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 border border-blue-400'
                        : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 hover:border-zinc-600'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Language Selector Chips */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1.5">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Audio / Language Preference</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AUDIO_OPTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudioLanguage(a)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      audioLanguage === a
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 border border-blue-400'
                        : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 hover:border-zinc-600'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* TV Series Season & Episode Options */}
            {mediaType === 'tv' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                    Season (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1"
                    value={seasonNumber}
                    onChange={(e) => setSeasonNumber(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                    Episode (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 5 (or blank for pack)"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Optional User Notes */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Special Instructions / Notes (Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Need Google Drive or HubCloud fast link, English subtitles..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Optional User Contact */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                <AtSign className="w-3.5 h-3.5 text-blue-400" />
                <span>Telegram Username or Email (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="@username or your email"
                value={userContact}
                onChange={(e) => setUserContact(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Submitting Request...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
