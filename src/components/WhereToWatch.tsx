'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Tv, ExternalLink, Globe, Sparkles, CheckCircle2 } from 'lucide-react';
import { TitleDetails, WatchProvidersData, WatchProviderInfo } from '@/types';
import { getImageURL } from '@/lib/tmdb';
import { useWatchlist } from '@/context/WatchlistContext';

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

  const hasStream = currentRegionData.flatrate && currentRegionData.flatrate.length > 0;
  const hasRent = currentRegionData.rent && currentRegionData.rent.length > 0;
  const hasBuy = currentRegionData.buy && currentRegionData.buy.length > 0;
  const hasFree = currentRegionData.free && currentRegionData.free.length > 0;

  const renderProviderPills = (providers?: WatchProviderInfo[]) => {
    if (!providers || providers.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2.5">
        {providers.map((p) => {
          const logoUrl = getImageURL(p.logo_path, 'w200');
          return (
            <div
              key={p.provider_id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 hover:border-amber-400/50 transition-colors shadow-md"
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
              <span className="text-xs font-semibold text-zinc-200">{p.provider_name}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-[#0f121a] border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header with Region Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Where to Watch</h3>
        </div>

        {/* Region Switcher */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-zinc-400" />
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            suppressHydrationWarning
          >
            <option value="IN">🇮🇳 India (Hotstar, JioCinema, Netflix, Prime)</option>
            <option value="US">🇺🇸 United States</option>
            <option value="GB">🇬🇧 United Kingdom</option>
            <option value="CA">🇨🇦 Canada</option>
            <option value="AU">🇦🇺 Australia</option>
          </select>
        </div>
      </div>

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

        {currentRegionData.link && (
          <div className="pt-2 flex justify-end">
            <a
              href={currentRegionData.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-400/90 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
            >
              Verify availability on JustWatch <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhereToWatch;
