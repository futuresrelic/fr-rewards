'use client';

// ============================================
// WAX Wallet Context - WharfKit v1
// Supports: WAX Cloud Wallet + Anchor
// ============================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { WalletState, WalletType } from '@/lib/types';
import { debugLog } from '@/lib/utils';
import { WAX_CHAIN_ID, WAX_RPC_ENDPOINTS, APP_NAME } from '@/lib/constants';

// ---- Dynamic WharfKit Types (browser-only) ----
type SessionKit = import('@wharfkit/session').SessionKit;
type Session = import('@wharfkit/session').Session;

interface WalletContextType extends WalletState {
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  session: Session | null;
}

const defaultState: WalletContextType = {
  isConnected: false,
  account: null,
  walletType: null,
  isConnecting: false,
  error: null,
  session: null,
  connect: async () => {},
  disconnect: async () => {},
};

const WalletContext = createContext<WalletContextType>(defaultState);

// Storage key for persisting wallet state
const STORAGE_KEY = 'wax_wallet_viewer_session';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    account: null,
    walletType: null,
    isConnecting: false,
    error: null,
  });
  const [session, setSession] = useState<Session | null>(null);
  const kitRef = useRef<SessionKit | null>(null);
  const initialized = useRef(false);

  // ---- Initialize WharfKit (client-only) ----
  const initKit = useCallback(async () => {
    if (initialized.current || typeof window === 'undefined') return;
    initialized.current = true;

    try {
      debugLog('info', 'Initializing WharfKit session kit...');

      const { SessionKit } = await import('@wharfkit/session');
      const { WebRenderer } = await import('@wharfkit/web-renderer');
      const { WalletPluginCloudWallet } = await import(
        '@wharfkit/wallet-plugin-cloudwallet'
      );
      const { WalletPluginAnchor } = await import('@wharfkit/wallet-plugin-anchor');

      const chain = {
        id: WAX_CHAIN_ID,
        url: WAX_RPC_ENDPOINTS[0],
      };

      const kit = new SessionKit({
        appName: APP_NAME,
        chains: [chain],
        ui: new WebRenderer(),
        walletPlugins: [
          new WalletPluginCloudWallet(),
          new WalletPluginAnchor(),
        ],
      });

      kitRef.current = kit;
      debugLog('success', 'WharfKit initialized');

      // Try to restore existing session
      await restoreSession(kit);
    } catch (err) {
      debugLog('error', 'Failed to initialize WharfKit', err);
      setState((s) => ({
        ...s,
        error: `Wallet initialization failed: ${err instanceof Error ? err.message : String(err)}`,
      }));
    }
  }, []);

  // ---- Restore session from storage ----
  const restoreSession = async (kit: SessionKit) => {
    try {
      const restored = await kit.restore();
      if (restored) {
        const account = String(restored.actor);
        const walletName = restored.walletPlugin.id;
        const walletType: WalletType = walletName.includes('cloudwallet')
          ? 'wax-cloud-wallet'
          : 'anchor';

        setSession(restored);
        setState({
          isConnected: true,
          account,
          walletType,
          isConnecting: false,
          error: null,
        });
        debugLog('success', `Restored session for ${account} (${walletType})`);
      }
    } catch (err) {
      debugLog('info', 'No previous session to restore', err);
    }
  };

  useEffect(() => {
    initKit();
  }, [initKit]);

  // ---- Connect wallet ----
  const connect = useCallback(
    async (walletType: WalletType) => {
      if (!kitRef.current) {
        await initKit();
        if (!kitRef.current) {
          setState((s) => ({ ...s, error: 'Wallet kit not initialized' }));
          return;
        }
      }

      setState((s) => ({ ...s, isConnecting: true, error: null }));
      debugLog('info', `Connecting wallet: ${walletType}`);

      try {
        let result;

        if (walletType === 'wax-cloud-wallet') {
          // Login with WAX Cloud Wallet specifically
          result = await kitRef.current.login({
            walletPlugin: 'wallet-plugin-cloudwallet',
          });
        } else if (walletType === 'anchor') {
          result = await kitRef.current.login({
            walletPlugin: 'wallet-plugin-anchor',
          });
        } else {
          // Generic login (shows wallet picker)
          result = await kitRef.current.login();
        }

        const account = String(result.session.actor);
        setSession(result.session);
        setState({
          isConnected: true,
          account,
          walletType,
          isConnecting: false,
          error: null,
        });
        debugLog('success', `Connected: ${account} via ${walletType}`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Connection cancelled or failed';
        debugLog('error', `Wallet connection failed: ${msg}`, err);
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: msg,
        }));
      }
    },
    [initKit]
  );

  // ---- Disconnect wallet ----
  const disconnect = useCallback(async () => {
    try {
      if (kitRef.current && session) {
        await kitRef.current.logout(session);
      }
    } catch (err) {
      debugLog('warn', 'Error during logout', err);
    }
    setSession(null);
    setState({
      isConnected: false,
      account: null,
      walletType: null,
      isConnecting: false,
      error: null,
    });
    debugLog('info', 'Wallet disconnected');
  }, [session]);

  return (
    <WalletContext.Provider
      value={{ ...state, session, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
