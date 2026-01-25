/**
 * Global Wallet Manager
 * Shared wallet authentication for all modules on a page
 *
 * This ensures that users only need to connect their wallet once,
 * and all modules on the page can use the same authenticated session.
 */

window.WalletManager = (function() {
  // Shared state
  let currentAccount = null;
  let wax = null;
  let anchor = null;
  let currentWalletType = null;
  let isInitialized = false;
  let isConnecting = false;

  // Event listeners for wallet state changes
  const listeners = new Set();

  // Storage keys
  const STORAGE_ACCOUNT = 'wax_account_shared';
  const STORAGE_WALLET = 'wax_wallet_shared';

  /**
   * Initialize the wallet manager
   * Only needs to be called once per page
   */
  async function init() {
    if (isInitialized) return;

    console.log('🔐 Initializing Global Wallet Manager');

    await waitForLibraries();
    isInitialized = true;

    // Try to restore existing session
    await restoreSession();
  }

  /**
   * Wait for wallet libraries to load
   */
  async function waitForLibraries() {
    // Check WaxJS
    if (window.WaxJS || window.waxjs?.WaxJS) {
      console.log('✅ WaxJS loaded');
    } else {
      console.error('❌ WaxJS not loaded');
    }

    // Wait for Anchor to load
    let attempts = 0;
    while (!window.AnchorWallet && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.AnchorWallet) {
      console.log('✅ Anchor wallet loaded');
    } else {
      console.warn('⚠️ Anchor wallet not loaded (will be disabled)');
    }
  }

  /**
   * Check if full WaxJS library is loaded (with transaction support)
   * Returns true if waxjs.js is loaded, false if waxjs-simple.js
   */
  function hasTransactionSupport() {
    // If WaxJS exists but doesn't have proper API initialization, it's the simple version
    // The simple version sets api as a method, not a property that gets initialized
    const WaxJS = window.waxjs?.WaxJS || window.WaxJS;
    if (!WaxJS) return false;

    // Create a test instance to check if it has transaction support
    // The real waxjs.js will have eosjs bundled, the simple one won't
    return typeof window.eosjs !== 'undefined' || WaxJS.toString().includes('eosjs');
  }

  /**
   * Dynamically load the full WaxJS library if not already loaded
   */
  async function ensureFullWaxJS() {
    // If already loaded, return
    if (hasTransactionSupport()) {
      console.log('✅ Full WaxJS library already loaded');
      return true;
    }

    console.log('⚠️ Transaction support not available, loading full WaxJS library...');

    return new Promise((resolve, reject) => {
      // Check if script already exists
      if (document.querySelector('script[src="/waxjs.js"]')) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = '/waxjs.js';
      script.onload = () => {
        console.log('✅ Full WaxJS library loaded successfully');
        resolve(true);
      };
      script.onerror = () => {
        console.error('❌ Failed to load full WaxJS library');
        reject(new Error('Failed to load waxjs.js'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Restore existing session from localStorage
   */
  async function restoreSession() {
    const savedAccount = localStorage.getItem(STORAGE_ACCOUNT);
    const savedWallet = localStorage.getItem(STORAGE_WALLET);

    if (!savedAccount || !savedWallet) {
      console.log('No saved session found');
      return false;
    }

    console.log(`🔄 Attempting to restore ${savedWallet} session for ${savedAccount}`);

    try {
      // Restore WCW session
      if (savedWallet === 'wcw') {
        const WaxJS = window.waxjs?.WaxJS || window.WaxJS;
        if (WaxJS) {
          wax = new WaxJS({
            rpcEndpoint: 'https://wax.greymass.com',
            tryAutoLogin: false
          });

          // Call login explicitly - this will use cached session if available
          const autoLoginAccount = await wax.login();

          if (autoLoginAccount) {
            currentAccount = autoLoginAccount;
            currentWalletType = 'wcw';
            console.log('✅ WCW session restored:', currentAccount);
            notifyListeners('connected');
            return true;
          } else {
            throw new Error('Auto-login failed');
          }
        }
      }

      // Restore Anchor session
      if (savedWallet === 'anchor' && window.AnchorWallet) {
        const restored = await window.AnchorWallet.restoreSession();
        if (restored) {
          anchor = window.AnchorWallet;
          currentAccount = restored;
          currentWalletType = 'anchor';
          console.log('✅ Anchor session restored:', currentAccount);
          notifyListeners('connected');
          return true;
        } else {
          throw new Error('Session restore failed');
        }
      }

      return false;

    } catch (error) {
      console.warn('Could not restore session:', error);
      // Clear invalid session
      clearSession();
      notifyListeners('disconnected');
      return false;
    }
  }

  /**
   * Connect wallet
   */
  async function connect(walletType) {
    if (isConnecting) {
      throw new Error('Connection already in progress');
    }

    // Allow multiple modules to use the same connection
    if (currentAccount) {
      console.log('Already connected to', currentAccount, '- reusing connection');
      return currentAccount;
    }

    isConnecting = true;

    try {
      if (walletType === 'wcw') {
        await connectWCW();
      } else if (walletType === 'anchor') {
        await connectAnchor();
      } else {
        throw new Error(`Unknown wallet type: ${walletType}`);
      }

      if (currentAccount) {
        currentWalletType = walletType;
        localStorage.setItem(STORAGE_ACCOUNT, currentAccount);
        localStorage.setItem(STORAGE_WALLET, walletType);
        console.log('✅ Wallet connected:', currentAccount, 'via', walletType);
        notifyListeners('connected');
      }

      return currentAccount;

    } finally {
      isConnecting = false;
    }
  }

  /**
   * Connect Wax Cloud Wallet
   */
  async function connectWCW() {
    const WaxJS = window.waxjs?.WaxJS || window.WaxJS;
    if (!WaxJS) throw new Error('WaxJS not loaded');

    wax = new WaxJS({
      rpcEndpoint: 'https://wax.greymass.com',
      tryAutoLogin: false
    });
    currentAccount = await wax.login();
    console.log('✅ WCW connected:', currentAccount);
  }

  /**
   * Connect Anchor
   */
  async function connectAnchor() {
    if (!window.AnchorWallet) {
      throw new Error('Anchor wallet not loaded. Please refresh the page or use WAX Cloud Wallet.');
    }

    anchor = window.AnchorWallet;
    currentAccount = await anchor.login();
  }

  /**
   * Disconnect wallet
   */
  async function disconnect() {
    // Logout from Anchor if connected
    if (currentWalletType === 'anchor' && anchor) {
      try {
        await anchor.logout();
      } catch (error) {
        console.error('Error logging out of Anchor:', error);
      }
    }

    clearSession();
    notifyListeners('disconnected');
    console.log('👋 Wallet disconnected');
  }

  /**
   * Clear session data
   */
  function clearSession() {
    currentAccount = null;
    wax = null;
    anchor = null;
    currentWalletType = null;
    localStorage.removeItem(STORAGE_ACCOUNT);
    localStorage.removeItem(STORAGE_WALLET);
  }

  /**
   * Execute a transaction
   */
  async function transact(actions, options = {}) {
    if (!currentAccount) {
      throw new Error('No wallet connected');
    }

    const transactOptions = {
      blocksBehind: 3,
      expireSeconds: 30,
      ...options
    };

    if (currentWalletType === 'wcw' && wax) {
      // If wax.api is not initialized, we might be using waxjs-simple.js
      // Try to load the full library and recreate the instance
      if (!wax.api) {
        console.warn('⚠️ WaxJS api not initialized, attempting to load full library...');

        try {
          // Load full WaxJS library
          await ensureFullWaxJS();

          // Recreate WaxJS instance with the full library
          const WaxJS = window.waxjs?.WaxJS || window.WaxJS;
          if (!WaxJS) {
            throw new Error('WaxJS not available after loading');
          }

          // Create new instance
          wax = new WaxJS({
            rpcEndpoint: 'https://wax.greymass.com',
            tryAutoLogin: false
          });

          // Login to restore session (will use cached credentials, no popup)
          const account = await wax.login();

          if (!account || account !== currentAccount) {
            throw new Error('Account mismatch after reinitializing WaxJS');
          }

          // Verify api is now initialized
          if (!wax.api) {
            throw new Error('WaxJS api still not initialized after loading full library');
          }

          console.log('✅ WaxJS instance recreated with full library support');
        } catch (error) {
          console.error('Failed to initialize transaction support:', error);
          throw new Error('Transaction support unavailable. ' + error.message);
        }
      }

      return await wax.api.transact({ actions }, transactOptions);
    } else if (currentWalletType === 'anchor' && anchor) {
      return await anchor.transact({ actions }, transactOptions);
    } else {
      throw new Error('No active wallet connection');
    }
  }

  /**
   * Get current connection state
   */
  function getState() {
    return {
      isConnected: !!currentAccount,
      account: currentAccount,
      walletType: currentWalletType,
      isInitialized: isInitialized
    };
  }

  /**
   * Subscribe to wallet state changes
   * @param {Function} callback - Called with event type ('connected' or 'disconnected')
   * @returns {Function} unsubscribe function
   */
  function subscribe(callback) {
    listeners.add(callback);

    // Immediately notify of current state if connected
    if (currentAccount) {
      setTimeout(() => callback('connected'), 0);
    }

    return () => listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  function notifyListeners(event) {
    listeners.forEach(callback => {
      try {
        callback(event, getState());
      } catch (error) {
        console.error('Error in wallet listener:', error);
      }
    });
  }

  // Public API
  return {
    init,
    connect,
    disconnect,
    transact,
    getState,
    subscribe,
    restoreSession
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.WalletManager.init();
  });
} else {
  window.WalletManager.init();
}
