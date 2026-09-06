'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Tv, ExternalLink, Globe, Sparkles, CheckCircle2 } from 'lucide-react';
import { TitleDetails, WatchProvidersData, WatchProviderInfo } from '@/types';
import { getImageURL } from '@/lib/tmdb';
import { useWatchlist } from '@/context/WatchlistContext';
import { getRealAvailableStreamingProviders } from '@/lib/ottLinks';
import CollapsibleSection from './CollapsibleSection';

interface WhereToWatchProps {
  titleDetails: TitleDetails;
}

export const WhereToWatch: React.FC<WhereToWatchProps> = ({ titleDetails }) => {
  const { settings, isMounted } = useWatchlist();
  const [selectedRegion, setSelectedRegion] = useState<string>('IN');

  React.useEffect(() => {
    if (isMounted && settings.defaultRegion) {
      setSelectedRegion(settings.defaultRegion);
    }
  }, [isMounted, settings.defaultRegion]);

  const titleName = titleDetails.title || titleDetails.name || 'Title';
  const mediaType = titleDetails.media_type || (titleDetails.name ? 'tv' : 'movie');

  const watchProviders = titleDetails['watch/providers']?.results || {};
  const currentRegionData: WatchProvidersData = watchProviders[selectedRegion] || watchProviders['IN'] || {
    flatrate: [
      { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
      { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/emthp39XA2zhcoYLhp9ow8056vB.jpg' },
    ],
    rent: [
      { provider_id: 2, provider_name: 'Apple TV', logo_path: '/9ghgSC01vJ72.jpg' },
      { provider_id: 192, provider_name: 'YouTube', logo_path: '/pTnn5JwWr4p3.jpg' },
    ],
  };

  const { availableList, justwatchUrl } = React.useMemo(() => {
    return getRealAvailableStreamingProviders(
      titleDetails.id,
      titleName,
      mediaType as any,
      currentRegionData,
      selectedRegion
    );
  }, [titleDetails.id, titleName, mediaType, currentRegionData, selectedRegion]);

  const hasStream = currentRegionData.flatrate && currentRegionData.flatrate.length > 0;
  const hasRent = currentRegionData.rent && currentRegionData.rent.length > 0;
  const hasBuy = currentRegionData.buy && currentRegionData.buy.length > 0;
  const hasFree = currentRegionData.free && currentRegionData.free.length > 0;

  const getProviderUrl = (providerName: string) => {
    const nameLower = providerName.toLowerCase();
    const matched = availableList.find(
      (a) =>
        a.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(a.name.toLowerCase()) ||
        (nameLower.includes('prime') && a.key === 'prime') ||
        (nameLower.includes('netflix') && a.key === 'netflix') ||
        (nameLower.includes('jio') && a.key === 'jiocinema') ||
        (nameLower.includes('hotstar') && a.key === 'hotstar')
    );
    return matched?.url || justwatchUrl;
  };

  const renderProviderPills = (providers?: WatchProviderInfo[]) => {
    if (!providers || providers.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2.5">
        {providers.map((p) => {
          const logoUrl = getImageURL(p.logo_path, 'w200');
          const targetUrl = getProviderUrl(p.provider_name);
          return (
            <a
              key={p.provider_id}
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 hover:border-amber-400 hover:bg-zinc-800 transition-all shadow-md group"
            >
              <div className="relative w-6 h-6 rounded-md overflow-hidden bg-zinc-800 shrink-0">
                <Image
                  src={logoUrl}
                  alt={p.provider_name}
                  fill
                  sizes="24px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 transition-colors">
                {p.provider_name}
              </span>
              <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </a>
          );
        })}
      </div>
    );
  };

  const regionSwitcher = (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Globe className="w-3.5 h-3.5 text-zinc-400" />
      <select
        value={selectedRegion}
        onChange={(e) => setSelectedRegion(e.target.value)}
        className="bg-zinc-900 border border-zinc-700 text-[11px] font-semibold text-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
        suppressHydrationWarning
      >
        <option value="IN">🇮🇳 India</option>
        <option value="US">🇺🇸 USA</option>
        <option value="GB">🇬🇧 UK</option>
        <option value="CA">🇨🇦 Canada</option>
        <option value="AU">🇦🇺 Australia</option>
      </select>
    </div>
  );

  return (
    <CollapsibleSection
      title="Where to Watch"
      icon={<Tv className="w-5 h-5 text-amber-400" />}
      badge={hasStream ? 'Streaming' : (hasRent || hasBuy ? 'VOD / Rent' : 'Theatrical')}
      action={regionSwitcher}
      defaultOpen={false}
    >

      {/* Provider Categories */}
      <div className="space-y-4">
        {/* Flatrate / Streaming */}
        {hasStream && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Stream / Subscription ({selectedRegion === 'IN' ? 'India' : selectedRegion})
              </h4>
            </div>
            {renderProviderPills(currentRegionData.flatrate)}
          </div>
        )}

        {/* Free / Ads */}
        {hasFree && (
          <div className="space-y-2 pt-2 border-t border-zinc-800/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Free with Ads</h4>
            </div>
            {renderProviderPills(currentRegionData.free)}
          </div>
        )}

        {/* Rent */}
        {hasRent && (
          <div className="space-y-2 pt-2 border-t border-zinc-800/60">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rent from OTT</h4>
            {renderProviderPills(currentRegionData.rent)}
          </div>
        )}

        {/* Buy */}
        {hasBuy && (
          <div className="space-y-2 pt-2 border-t border-zinc-800/60">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Buy Digital</h4>
            {renderProviderPills(currentRegionData.buy)}
          </div>
        )}

        {!hasStream && !hasRent && !hasBuy && !hasFree && (
          <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 text-center text-zinc-400 text-xs">
            No digital release or active streaming service found for {selectedRegion === 'IN' ? 'India' : selectedRegion}. Check custom links below or theatrical availability.
          </div>
        )}

        {/* JustWatch Live Streaming & Price Guide Card */}
        <a
          href={currentRegionData.link || `https://www.justwatch.com/${selectedRegion.toLowerCase()}/search?q=${encodeURIComponent(titleDetails.title || titleDetails.name || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 transition-all group shadow-sm mt-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black text-xs shadow-md shrink-0">
              JW
            </div>
            <div>
              <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 transition-colors flex items-center gap-2">
                JustWatch Streaming & Price Guide
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] uppercase tracking-wider font-extrabold border border-amber-500/30">Live</span>
              </span>
              <span className="text-[10px] text-zinc-400 block">Live 4K streaming availability, rental prices & OTT plan tracker</span>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-amber-400 group-hover:text-amber-300 transition-colors shrink-0" />
        </a>
      </div>
    </CollapsibleSection>
  );
};

export default WhereToWatch;
