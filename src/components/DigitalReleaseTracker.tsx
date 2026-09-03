'use client';

import React from 'react';
import {
  Calendar,
  Film,
  Tv,
  Disc,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Hourglass,
  Layers,
} from 'lucide-react';
import { getReleaseTimeline, ReleaseTimeline } from '@/lib/releaseDates';

interface DigitalReleaseTrackerProps {
  titleId: number;
  releaseDate?: string;
  titleName?: string;
}

export const DigitalReleaseTracker: React.FC<DigitalReleaseTrackerProps> = ({
  titleId,
  releaseDate,
  titleName,
}) => {
  const timeline: ReleaseTimeline = getReleaseTimeline(titleId, releaseDate, titleName);

  return (
    <div className="bg-[#0f121a] border border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
      {/* Header with Live Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white">Digital & OTT Release Timeline</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Track theatrical premiere, digital VOD rental window, 4K Blu-ray, and OTT subscription dates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black shadow-md ${timeline.statusColor}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {timeline.statusLabel}
          </span>
        </div>
      </div>

      {/* 4-Step Visual Timeline Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
        {/* Step 1: Theatrical */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-amber-400/50 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Step 1</span>
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-300 block">Theatrical Premiere</span>
            <p className="text-base font-black text-white mt-0.5">{timeline.theatricalFormatted}</p>
          </div>
          <p className="text-[11px] text-zinc-400">Original cinema theatre release</p>
        </div>

        {/* Step 2: Digital VOD (PVOD) */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-purple-400/50 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <Tv className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Step 2</span>
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-300 block">Digital VOD (Rent/Buy)</span>
            <p className="text-base font-black text-purple-300 mt-0.5">{timeline.digitalVodFormatted}</p>
          </div>
          <p className="text-[11px] text-zinc-400">Apple TV, Prime Video & YouTube 4K</p>
        </div>

        {/* Step 3: Physical Disc */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-sky-400/50 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <Disc className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Step 3</span>
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-300 block">4K Ultra HD & Blu-ray</span>
            <p className="text-base font-black text-sky-300 mt-0.5">{timeline.physicalFormatted}</p>
          </div>
          <p className="text-[11px] text-zinc-400">Physical collector discs & steelbooks</p>
        </div>

        {/* Step 4: OTT Subscription Premiere */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-emerald-400/50 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Step 4</span>
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-300 block">OTT Subscription Release</span>
            <p className="text-base font-black text-emerald-300 mt-0.5">{timeline.ottSubscriptionFormatted}</p>
          </div>
          <p className="text-[11px] text-emerald-400/90 font-medium truncate">{timeline.ottPlatformName}</p>
        </div>
      </div>

      {/* Theatrical Window Analysis Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-[#121622] to-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-white block">Theatrical-to-Digital Window:</span>
            <span className="text-zinc-400 text-[11px]">
              This title had a <strong className="text-amber-300 font-bold">{timeline.theatricalWindowDays}-day exclusive theatrical window</strong> before reaching digital VOD/OTT.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono self-end sm:self-auto shrink-0">
          <span>Region:</span>
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold">IN (India)</span>
        </div>
      </div>
    </div>
  );
};

export default DigitalReleaseTracker;
