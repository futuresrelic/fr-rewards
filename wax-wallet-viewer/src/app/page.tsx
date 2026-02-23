'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import WalletModal from '@/components/wallet/WalletModal';
import Button from '@/components/ui/Button';
import {
  Search, Wallet, Zap, Shield, Filter, Layers, ArrowRight, Hexagon
} from 'lucide-react';
import { isValidWaxAccount } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

export default function HomePage() {
  const [searchInput, setSearchInput] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [searchError, setSearchError] = useState('');
  const router = useRouter();
  const { isConnected, account } = useWallet();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const acc = searchInput.trim().toLowerCase();
    if (!acc) {
      setSearchError('Please enter a WAX wallet address');
      return;
    }
    if (!isValidWaxAccount(acc)) {
      setSearchError('Invalid WAX account name (1-12 chars: a-z, 1-5)');
      return;
    }
    setSearchError('');
    router.push(`/wallet/${acc}`);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="w-full max-w-screen-xl mx-auto px-4 py-20 md:py-28 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                        bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-8">
          <Hexagon size={14} fill="currentColor" />
          Powered by AtomicAssets Protocol
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Your WAX NFT Collection
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Beautifully Organized
          </span>
        </h1>

        <p className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10">
          View, filter, sort and explore any WAX wallet&apos;s AtomicAssets NFT collection.
          Connect your wallet or search any account.
        </p>

        {/* Search box */}
        <form onSubmit={handleSearch} className="max-w-lg mx-auto mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Enter WAX wallet address..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchError('');
                }}
                className="w-full pl-12 pr-4 py-3.5 bg-navy-700 border border-white/10 rounded-2xl
                           text-white placeholder:text-white/30
                           focus:outline-none focus:border-violet-500/50 focus:ring-2
                           focus:ring-violet-500/20"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" className="flex-shrink-0 px-5">
              <Search size={18} />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>
          {searchError && (
            <p className="text-red-400 text-sm mt-2 text-left">{searchError}</p>
          )}
        </form>

        {/* Connect wallet button */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-white/30 text-sm">or</span>
          {isConnected && account ? (
            <Button onClick={() => router.push('/my-wallet')} variant="secondary">
              <Wallet size={16} />
              View My Wallet ({account})
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={() => setShowWalletModal(true)} variant="secondary">
              <Wallet size={16} />
              Connect Your Wallet
            </Button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="w-full max-w-screen-xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Filter className="text-violet-400" size={22} />}
            title="Smart Filtering"
            desc="Filter by collection, schema, template, or search by name. Find any NFT instantly."
          />
          <FeatureCard
            icon={<Layers className="text-cyan-400" size={22} />}
            title="Full Attributes"
            desc="View all on-chain attributes, mint numbers, images, videos, and metadata."
          />
          <FeatureCard
            icon={<Zap className="text-yellow-400" size={22} />}
            title="WAX Cloud Wallet"
            desc="One-click login with email, Google, or social via WAX Cloud Wallet."
          />
          <FeatureCard
            icon={<Shield className="text-green-400" size={22} />}
            title="Anchor Wallet"
            desc="Secure hardware-level authentication via Anchor desktop or mobile."
          />
          <FeatureCard
            icon={<Search className="text-blue-400" size={22} />}
            title="Any Wallet"
            desc="Search and inspect any public WAX wallet — no login required."
          />
          <FeatureCard
            icon={<Hexagon className="text-pink-400" size={22} />}
            title="AtomicAssets Standard"
            desc="Fully compatible with the AtomicAssets NFT protocol on WAX blockchain."
          />
        </div>
      </section>

      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-navy-700/40 border border-white/5 hover:border-white/10
                    transition-colors group">
      <div className="w-10 h-10 rounded-xl bg-navy-600 flex items-center justify-center mb-3
                      group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
