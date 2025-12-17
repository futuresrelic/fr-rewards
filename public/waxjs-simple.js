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
        // Listen for postMessage from WAX Cloud Wallet
        const messageHandler = (event) => {
          // Accept messages from WAX domains
          if (event.origin !== 'https://www.mycloudwallet.com' &&
              event.origin !== 'https://all-access.wax.io') {
            return;
          }

          console.log('📨 Received message from WAX:', event.data);

          // Handle different message formats
          if (event.data) {
            let account = null;
            let keys = [];

            // Try to extract account from various formats
            if (typeof event.data === 'string') {
              account = event.data;
            } else if (event.data.account) {
              account = event.data.account;
              keys = event.data.keys || event.data.pubKeys || [];
            } else if (event.data.userAccount) {
              account = event.data.userAccount;
              keys = event.data.pubKeys || [];
            }

            if (account) {
              this.userAccount = account;
              this.pubKeys = keys;

              window.removeEventListener('message', messageHandler);
              console.log('✅ Logged in as:', account);
              resolve(account);
            }
          }
        };

        window.addEventListener('message', messageHandler);

        // Open WAX Cloud Wallet
        const width = 400;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const loginWindow = window.open(
          'https://all-access.wax.io/cloud-wallet/login/',
          'WAX Login',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!loginWindow) {
          window.removeEventListener('message', messageHandler);
          reject(new Error('Popup blocked'));
          return;
        }

        // Check if window was closed
        const checkClosed = setInterval(() => {
          if (loginWindow.closed) {
            clearInterval(checkClosed);

            if (!this.userAccount) {
              window.removeEventListener('message', messageHandler);
              reject(new Error('Login cancelled'));
            }
          }
        }, 1000);
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
