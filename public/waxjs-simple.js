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

        // Listen for the login message
        const messageHandler = (event) => {
          // Security: verify origin
          if (event.origin !== 'https://www.mycloudwallet.com') {
            return;
          }

          if (event.data && event.data.type === 'cloud_wallet_login_response') {
            window.removeEventListener('message', messageHandler);

            if (event.data.data && event.data.data.userAccount) {
              this.userAccount = event.data.data.userAccount;
              this.pubKeys = event.data.data.pubKeys || [];

              // Store for auto-login
              localStorage.setItem('wax_account', this.userAccount);
              localStorage.setItem('wax_pubkeys', JSON.stringify(this.pubKeys));

              loginWindow.close();
              resolve(this.userAccount);
            } else {
              reject(new Error('Login failed - no account returned'));
            }
          }
        };

        window.addEventListener('message', messageHandler);

        // Check if window was closed without login
        const checkClosed = setInterval(() => {
          if (loginWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);

            // Check if we got an account
            if (!this.userAccount) {
              reject(new Error('Login cancelled'));
            }
          }
        }, 500);
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
