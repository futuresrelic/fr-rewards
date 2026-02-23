'use client';

import { useState, useCallback } from 'react';
import AssetCard from './AssetCard';
import AssetModal from './AssetModal';
import AssetFilters from './AssetFilters';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { useInfiniteAssets } from '@/hooks/useAssets';
import { useFilterStore } from '@/store/filterStore';
import type { AtomicAsset } from '@/lib/types';
import { AlertCircle, PackageOpen, RefreshCw } from 'lucide-react';

interface AssetGridProps {
  account: string;
  totalAssets?: number;
}

export default function AssetGrid({ account, totalAssets }: AssetGridProps) {
  const [selectedAsset, setSelectedAsset] = useState<AtomicAsset | null>(null);
  const { viewMode } = useFilterStore();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteAssets(account);

  const assets = data?.pages.flatMap((p) => p.assets) ?? [];

  const handleCardClick = useCallback((asset: AtomicAsset) => {
    setSelectedAsset(asset);
  }, []);

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="space-y-4">
        <AssetFilters account={account} />
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
              : 'space-y-2'
          }
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <SkeletonCard key={i} view={viewMode} />
          ))}
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="space-y-4">
        <AssetFilters account={account} />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle size={40} className="text-red-400" />
          <div className="text-white/70 text-center max-w-sm">
            <div className="font-semibold mb-1">Failed to load assets</div>
            <div className="text-sm text-white/40">
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw size={14} />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // --- Empty ---
  if (assets.length === 0) {
    return (
      <div className="space-y-4">
        <AssetFilters account={account} totalCount={0} />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <PackageOpen size={48} className="text-white/20" />
          <div className="text-center">
            <div className="text-white/50 font-medium">No assets found</div>
            <div className="text-white/30 text-sm mt-1">
              This wallet has no NFTs matching your filters.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AssetFilters account={account} totalCount={totalAssets ?? assets.length} />

      {/* Asset grid or list */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {assets.map((asset) => (
            <AssetCard
              key={asset.asset_id}
              asset={asset}
              onClick={handleCardClick}
              view="grid"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <AssetCard
              key={asset.asset_id}
              asset={asset}
              onClick={handleCardClick}
              view="list"
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-6">
          <Button
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
            variant="outline"
            size="lg"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More Assets'}
          </Button>
        </div>
      )}

      {/* Asset detail modal */}
      <AssetModal
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  );
}

function SkeletonCard({ view }: { view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl bg-navy-700/30 animate-pulse">
        <div className="w-14 h-14 rounded-lg bg-navy-600" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-navy-600 rounded w-2/3" />
          <div className="h-2 bg-navy-600 rounded w-1/3" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl overflow-hidden bg-navy-700/30 animate-pulse">
      <div className="aspect-square bg-navy-600" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-navy-600 rounded" />
        <div className="h-2 bg-navy-600 rounded w-2/3" />
      </div>
    </div>
  );
}
