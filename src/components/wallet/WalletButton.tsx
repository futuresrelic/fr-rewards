'use client';

import { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import WalletModal from './WalletModal';
import Button from '@/components/ui/Button';
import { Wallet, ChevronDown, LogOut, ExternalLink, Copy, Check } from 'lucide-react';
import { WAX_EXPLORER_URL } from '@/lib/constants';
import { useRouter } from 'next/navigation';

export default function WalletButton() {
  const { isConnected, account, walletType, disconnect, isConnecting } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const copyAccount = async () => {
    if (account) {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowModal(true)}
          loading={isConnecting}
          variant="primary"
          size="md"
        >
          <Wallet size={16} />
          Connect Wallet
        </Button>
        <WalletModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl
                   bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30
                   text-white/80 hover:text-white transition-all duration-200"
      >
        {/* Status dot */}
        <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
        {/* Account name */}
        <span className="font-mono text-sm font-medium">{account}</span>
        {/* Wallet type indicator */}
        <span className="text-xs text-white/40 bg-white/5 px-1.5 py-0.5 rounded-md">
          {walletType === 'wax-cloud-wallet' ? 'WCW' : 'Anchor'}
        </span>
        <ChevronDown size={14} className="text-white/40" />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-52 z-20
                          bg-navy-600 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            {/* View my wallet */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5
                         text-white/70 hover:text-white text-sm transition-colors"
              onClick={() => {
                router.push('/my-wallet');
                setShowDropdown(false);
              }}
            >
              <Wallet size={15} />
              My Wallet
            </button>

            {/* Copy account */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5
                         text-white/70 hover:text-white text-sm transition-colors"
              onClick={copyAccount}
            >
              {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy Account'}
            </button>

            {/* WAX Explorer */}
            <a
              href={`${WAX_EXPLORER_URL}/account/${account}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5
                         text-white/70 hover:text-white text-sm transition-colors"
              onClick={() => setShowDropdown(false)}
            >
              <ExternalLink size={15} />
              View on Explorer
            </a>

            <div className="border-t border-white/10" />

            {/* Disconnect */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10
                         text-red-400/70 hover:text-red-400 text-sm transition-colors"
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
            >
              <LogOut size={15} />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
