'use client';

import Modal from '@/components/ui/Modal';
import AssetMedia from './AssetMedia';
import Badge from '@/components/ui/Badge';
import {
  getAssetMedia,
  getAssetRarity,
  formatMintNumber,
  formatDate,
  timeAgo,
  resolveIpfsUrl,
} from '@/lib/utils';
import type { AtomicAsset } from '@/lib/types';
import { ExternalLink, Copy, Check, Hash, Calendar, Box, Shield } from 'lucide-react';
import { ATOMICHUB_URL, WAX_EXPLORER_URL } from '@/lib/constants';
import { useState } from 'react';

interface AssetModalProps {
  asset: AtomicAsset | null;
  onClose: () => void;
}

export default function AssetModal({ asset, onClose }: AssetModalProps) {
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const media = getAssetMedia(asset.data);
  const rarity = getAssetRarity(asset.data);
  const assetName = (asset.data?.name as string) || asset.name || `Asset #${asset.asset_id}`;
  const mintNum = asset.template_mint ? formatMintNumber(asset.template_mint) : null;

  const copyId = async () => {
    await navigator.clipboard.writeText(asset.asset_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Collect all attributes (immutable + mutable data, excluding media fields)
  const mediaFields = new Set(['img', 'image', 'thumbnail', 'thumb', 'video', 'video_loop', 'vid', 'preview', 'icon', 'name']);
  const allData: Record<string, unknown> = { ...asset.immutable_data, ...asset.mutable_data };
  const attributes = Object.entries(allData).filter(
    ([key]) => !mediaFields.has(key.toLowerCase())
  );

  return (
    <Modal isOpen={!!asset} onClose={onClose} size="xl">
      <div className="flex flex-col md:flex-row min-h-[400px]">
        {/* Left: Media */}
        <div className="md:w-1/2 flex-shrink-0 bg-navy-800 rounded-tl-2xl rounded-bl-2xl md:rounded-tr-none rounded-tr-2xl overflow-hidden">
          <div className="relative aspect-square">
            <AssetMedia
              url={media.url}
              type={media.type}
              name={assetName}
              fill
              priority
            />
          </div>

          {/* Collection info below image */}
          <div className="p-4 flex items-center gap-3 border-t border-white/5">
            {asset.collection.img && (
              <div className="w-8 h-8 rounded-full overflow-hidden bg-navy-700 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveIpfsUrl(asset.collection.img)}
                  alt={asset.collection.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            <div>
              <div className="text-white/40 text-xs">Collection</div>
              <div className="text-white text-sm font-medium">
                {asset.collection.name || asset.collection.collection_name}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Name + rarity */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">{assetName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/40 text-sm">{asset.schema?.schema_name}</span>
                {rarity && <Badge variant="purple">{rarity}</Badge>}
              </div>
            </div>
            {mintNum && (
              <div className="text-right flex-shrink-0">
                <div className="text-white/30 text-xs">Mint</div>
                <div className="text-white font-mono font-bold">{mintNum}</div>
                {asset.template?.max_supply !== '0' && asset.template?.max_supply && (
                  <div className="text-white/30 text-xs">
                    / {parseInt(asset.template.max_supply).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatBox
              icon={<Hash size={14} />}
              label="Asset ID"
              value={asset.asset_id}
              action={
                <button onClick={copyId} className="text-white/40 hover:text-white transition-colors">
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                </button>
              }
            />
            <StatBox
              icon={<Box size={14} />}
              label="Template"
              value={asset.template?.template_id || 'None'}
            />
            <StatBox
              icon={<Calendar size={14} />}
              label="Minted"
              value={formatDate(asset.minted_at_time)}
              subtitle={timeAgo(asset.minted_at_time)}
            />
            <StatBox
              icon={<Shield size={14} />}
              label="Transferable"
              value={asset.is_transferable ? 'Yes' : 'No'}
            />
          </div>

          {/* Attributes */}
          {attributes.length > 0 && (
            <div className="mb-5">
              <div className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2">
                Attributes
              </div>
              <div className="grid grid-cols-2 gap-2">
                {attributes.map(([key, value]) => (
                  <div
                    key={key}
                    className="p-2.5 rounded-xl bg-navy-800/60 border border-white/5"
                  >
                    <div className="text-white/40 text-xs capitalize truncate">{key}</div>
                    <div className="text-white text-sm font-medium mt-0.5 truncate">
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* External links */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
            <a
              href={`${ATOMICHUB_URL}/explorer/asset/${asset.asset_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                         bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/30
                         text-white/60 hover:text-violet-300 transition-all"
            >
              <ExternalLink size={12} /> AtomicHub
            </a>
            <a
              href={`${WAX_EXPLORER_URL}/nfts/${asset.asset_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                         bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30
                         text-white/60 hover:text-cyan-300 transition-all"
            >
              <ExternalLink size={12} /> WAXBlock
            </a>
            {media.url && (
              <a
                href={media.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                           bg-white/5 hover:bg-white/10 border border-white/10
                           text-white/60 hover:text-white/80 transition-all"
              >
                <ExternalLink size={12} /> Raw Media
              </a>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function StatBox({
  icon,
  label,
  value,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-xl bg-navy-800/60 border border-white/5">
      <div className="flex items-center gap-1.5 text-white/40 text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-white text-sm font-medium truncate">{value}</span>
        {action}
      </div>
      {subtitle && (
        <div className="text-white/30 text-xs mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}
