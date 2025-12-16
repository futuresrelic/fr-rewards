// Simple browser wrapper for WaxJS
(function(window) {
  'use strict';

  // WaxJS browser implementation
  class WaxJS {
    constructor(options = {}) {
      this.rpcEndpoint = options.rpcEndpoint || 'https://wax.greymass.com';
      this.tryAutoLogin = options.tryAutoLogin !== false;
      this.userAccount = null;
      this.pubKeys = null;
    }

    async login() {
      const waxCloudUrl = 'https://www.mycloudwallet.com';

      return new Promise((resolve, reject) => {
        const loginUrl = `${waxCloudUrl}/cloud-wallet/login/`;
        const width = 400;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
          loginUrl,
          'WAX Cloud Wallet',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
          reject(new Error('Popup blocked. Please allow popups for this site.'));
          return;
        }

        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);

            // Check localStorage for the account
            const account = localStorage.getItem('waxCloudWallet_account');
            const pubKeys = localStorage.getItem('waxCloudWallet_pubKeys');

            if (account) {
              this.userAccount = account;
              this.pubKeys = pubKeys ? JSON.parse(pubKeys) : null;
              resolve(account);
            } else {
              reject(new Error('Login cancelled or failed'));
            }
          }
        }, 500);
      });
    }

    async isAutoLoginAvailable() {
      return !!localStorage.getItem('waxCloudWallet_account');
    }
  }

  // Expose to window
  window.waxjs = { WaxJS };
  window.WaxJS = WaxJS;

  console.log('✅ WaxJS browser wrapper loaded');
})(window);
