'use client';

import AssetGrid from '@/components/assets/AssetGrid';
import { useAccountStats } from '@/hooks/useAssets';
import { Package, Database, Grid3X3, LayoutTemplate, ExternalLink, User } from 'lucide-react';
import { WAX_EXPLORER_URL } from '@/lib/constants';

interface Props {
  account: string;
}

export default function WalletViewerClient({ account }: Props) {
  const { data: stats, isLoading: statsLoading } = useAccountStats(account);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500
                              flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{account}</h1>
            </div>
            <div className="flex items-center gap-2 ml-13 pl-1">
              <a
                href={`${WAX_EXPLORER_URL}/account/${account}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white/40 hover:text-violet-400 text-sm transition-colors"
              >
                View on WAXBlock <ExternalLink size={12} />
              </a>
              <span className="text-white/20">·</span>
              <a
                href={`https://wax.atomichub.io/profile/${account}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white/40 hover:text-cyan-400 text-sm transition-colors"
              >
                View on AtomicHub <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Package size={18} className="text-violet-400" />}
            label="Total Assets"
            value={statsLoading ? '...' : (stats?.assets ?? 0).toLocaleString()}
          />
          <StatCard
            icon={<Database size={18} className="text-cyan-400" />}
            label="Collections"
            value={statsLoading ? '...' : (stats?.collections ?? 0).toLocaleString()}
          />
          <StatCard
            icon={<Grid3X3 size={18} className="text-blue-400" />}
            label="Schemas"
            value={statsLoading ? '...' : (stats?.schemas ?? 0).toLocaleString()}
          />
          <StatCard
            icon={<LayoutTemplate size={18} className="text-pink-400" />}
            label="Templates"
            value={statsLoading ? '...' : (stats?.templates ?? 0).toLocaleString()}
          />
        </div>
      </div>

      {/* Asset grid */}
      <AssetGrid account={account} totalAssets={stats?.assets} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-navy-700/50 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-white/50 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
