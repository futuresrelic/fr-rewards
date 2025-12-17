/**
 * Simple WaxJS implementation for WAX Cloud Wallet
 */
(function() {
  'use strict';

  class WaxJS {
    constructor(options = {}) {
      this.rpcEndpoint = options.rpcEndpoint || 'https://wax.greymass.com';
      this.tryAutoLogin = options.tryAutoLogin !== false;
      this.userAccount = null;
      this.pubKeys = [];
      this.api = null;
    }

    async login() {
      return new Promise((resolve, reject) => {
        const width = 350;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        // Check localStorage key that WAX Cloud Wallet uses
        const storageKey = `wax-cloud-wallet_${window.location.origin}`;

        // Open WAX Cloud Wallet login
        const loginWindow = window.open(
          'https://www.mycloudwallet.com/cloud-wallet/login/',
          'WAX Login',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!loginWindow) {
          reject(new Error('Popup blocked - please allow popups for this site'));
          return;
        }

        // Poll for localStorage changes (WAX Cloud Wallet stores session here)
        const checkLogin = setInterval(() => {
          try {
            // Check if popup is closed
            if (loginWindow.closed) {
              clearInterval(checkLogin);

              // Check if WAX stored session data
              const sessionData = localStorage.getItem(storageKey);

              if (sessionData) {
                try {
                  const session = JSON.parse(sessionData);
                  if (session && session.userAccount) {
                    this.userAccount = session.userAccount;
                    this.pubKeys = session.pubKeys || [];

                    console.log('✅ Logged in as:', this.userAccount);
                    resolve(this.userAccount);
                    return;
                  }
                } catch (e) {
                  console.error('Error parsing session:', e);
                }
              }

              // No session found
              reject(new Error('Login cancelled or failed'));
            }
          } catch (e) {
            clearInterval(checkLogin);
            reject(new Error('Login error: ' + e.message));
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!loginWindow.closed) {
            loginWindow.close();
          }
          clearInterval(checkLogin);
          if (!this.userAccount) {
            reject(new Error('Login timeout'));
          }
        }, 5 * 60 * 1000);
      });
    }

    async isAutoLoginAvailable() {
      const savedAccount = localStorage.getItem('wax_account');
      if (savedAccount) {
        this.userAccount = savedAccount;
        const savedKeys = localStorage.getItem('wax_pubkeys');
        if (savedKeys) {
          this.pubKeys = JSON.parse(savedKeys);
        }
        return true;
      }
      return false;
    }

    async api() {
      // Simple implementation - just return the RPC endpoint
      return {
        rpc: this.rpcEndpoint
      };
    }
  }

  // Expose to window
  window.waxjs = { WaxJS };
  window.WaxJS = WaxJS;

  console.log('✅ WaxJS wrapper loaded');
})();
