'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import AssetMedia from './AssetMedia';
import { getAssetMedia, getAssetRarity, getRarityColor, formatMintNumber, cn } from '@/lib/utils';
import type { AtomicAsset } from '@/lib/types';
import { ExternalLink, Info } from 'lucide-react';
import { ATOMICHUB_URL } from '@/lib/constants';

interface AssetCardProps {
  asset: AtomicAsset;
  onClick: (asset: AtomicAsset) => void;
  view?: 'grid' | 'list';
}

export default function AssetCard({ asset, onClick, view = 'grid' }: AssetCardProps) {
  const [hovered, setHovered] = useState(false);
  const media = getAssetMedia(asset.data);
  const rarity = getAssetRarity(asset.data);
  const rarityColor = getRarityColor(rarity);
  const assetName = (asset.data?.name as string) || asset.name || `Asset #${asset.asset_id}`;
  const mintNum = asset.template_mint ? formatMintNumber(asset.template_mint) : '';

  if (view === 'list') {
    return (
      <div
        onClick={() => onClick(asset)}
        className="flex items-center gap-4 p-3 rounded-xl bg-navy-700/50 hover:bg-navy-600/70
                   border border-white/5 hover:border-violet-500/20 cursor-pointer
                   transition-all duration-200 group"
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-navy-600">
          <AssetMedia url={media.thumbnail} type={media.type} name={assetName} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-sm truncate">{assetName}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/40 text-xs truncate">
              {asset.collection.name || asset.collection.collection_name}
            </span>
            {rarity && (
              <Badge variant="purple" className={cn('text-xs', rarityColor)}>
                {rarity}
              </Badge>
            )}
          </div>
        </div>

        {/* Mint + Links */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {mintNum && (
            <span className="text-white/40 text-xs font-mono">{mintNum}</span>
          )}
          <a
            href={`${ATOMICHUB_URL}/explorer/asset/${asset.asset_id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
          >
            <ExternalLink size={14} />
          </a>
          <Info size={16} className="text-white/20 group-hover:text-violet-400 transition-colors" />
        </div>
      </div>
    );
  }

  // Grid card
  return (
    <div
      onClick={() => onClick(asset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative rounded-2xl overflow-hidden cursor-pointer
                 bg-navy-700 border border-white/5 hover:border-violet-500/30
                 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/20
                 hover:-translate-y-0.5"
    >
      {/* Media */}
      <div className="relative aspect-square overflow-hidden bg-navy-600">
        <AssetMedia
          url={media.url}
          type={media.type}
          name={assetName}
          fill
          className="transition-transform duration-500 group-hover:scale-105"
        />

        {/* Rarity badge */}
        {rarity && (
          <div className="absolute top-2 left-2">
            <Badge variant="purple" className={cn('text-xs backdrop-blur-sm bg-black/40', rarityColor)}>
              {rarity}
            </Badge>
          </div>
        )}

        {/* Mint number */}
        {mintNum && (
          <div className="absolute top-2 right-2">
            <span className="text-xs font-mono bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-white/70">
              {mintNum}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent',
            'transition-opacity duration-300',
            hovered ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* Quick action on hover */}
        {hovered && (
          <div className="absolute bottom-3 right-3 flex gap-2">
            <a
              href={`${ATOMICHUB_URL}/explorer/asset/${asset.asset_id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm hover:bg-white/20
                         text-white/70 hover:text-white transition-colors"
            >
              <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3">
        <div className="text-white font-medium text-sm truncate">{assetName}</div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-white/40 text-xs truncate max-w-[70%]">
            {asset.collection.name || asset.collection.collection_name}
          </span>
          <span className="text-white/30 text-xs font-mono">
            {asset.schema?.schema_name}
          </span>
        </div>
      </div>

      {/* Bottom glow on hover */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-500',
          'transition-opacity duration-300',
          hovered ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}
