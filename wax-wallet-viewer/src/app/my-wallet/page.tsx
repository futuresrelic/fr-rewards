'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import AssetGrid from '@/components/assets/AssetGrid';
import WalletModal from '@/components/wallet/WalletModal';
import Button from '@/components/ui/Button';
import { useAccountStats } from '@/hooks/useAssets';
import { Wallet, Package, Database, Grid3X3, LayoutTemplate } from 'lucide-react';

export default function MyWalletPage() {
  const { isConnected, account } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const { data: stats, isLoading: statsLoading } = useAccountStats(account);

  // Auto-prompt connect if not connected
  useEffect(() => {
    if (!isConnected) {
      const timer = setTimeout(() => setShowModal(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  if (!isConnected || !account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="w-16 h-16 rounded-2xl bg-navy-700 flex items-center justify-center">
          <Wallet size={28} className="text-violet-400" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
          <p className="text-white/40 max-w-sm">
            Connect your WAX wallet to view your NFT collection.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} size="lg">
          <Wallet size={18} />
          Connect Wallet
        </Button>
        <WalletModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">My Wallet</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
              <span className="font-mono text-white/60 text-sm">{account}</span>
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
