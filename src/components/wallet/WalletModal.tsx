'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useWallet } from '@/context/WalletContext';
import { AlertCircle, Zap, Anchor } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, isConnecting, error } = useWallet();
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (type: 'wax-cloud-wallet' | 'anchor') => {
    setConnecting(type);
    await connect(type);
    setConnecting(null);
    if (!error) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Wallet" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-white/60 text-sm">
          Choose your wallet to view your WAX NFT collection.
        </p>

        {/* WAX Cloud Wallet */}
        <button
          onClick={() => handleConnect('wax-cloud-wallet')}
          disabled={isConnecting}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10
                     hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="text-cyan-400" size={22} />
          </div>
          <div className="text-left">
            <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
              WAX Cloud Wallet
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              Login with email or social — no extension needed
            </div>
          </div>
          {connecting === 'wax-cloud-wallet' && (
            <div className="ml-auto w-5 h-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          )}
        </button>

        {/* Anchor */}
        <button
          onClick={() => handleConnect('anchor')}
          disabled={isConnecting}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10
                     hover:border-violet-500/40 hover:bg-violet-500/5 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Anchor className="text-violet-400" size={22} />
          </div>
          <div className="text-left">
            <div className="font-semibold text-white group-hover:text-violet-300 transition-colors">
              Anchor Wallet
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              Desktop/mobile app — scan QR or use extension
            </div>
          </div>
          {connecting === 'anchor' && (
            <div className="ml-auto w-5 h-5 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Connection failed</div>
              <div className="text-red-400/70 text-xs mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* Debug hint */}
        <p className="text-white/30 text-xs text-center">
          Having trouble? Check browser console for debug logs.
        </p>
      </div>
    </Modal>
  );
}
