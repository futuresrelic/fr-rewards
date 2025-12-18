/**
 * Simplified WAX helper for pack unpacking
 * Handles WCW login and transactions without complex dependencies
 */

class SimpleWaxAPI {
  constructor() {
    this.userAccount = null;
    this.pubKeys = [];
    this.rpcEndpoint = 'https://wax.greymass.com';
  }

  async login() {
    return new Promise((resolve, reject) => {
      const messageHandler = (event) => {
        if (event.origin !== 'https://www.mycloudwallet.com' &&
            event.origin !== 'https://all-access.wax.io') {
          return;
        }

        if (event.data) {
          let account = null;
          if (typeof event.data === 'string') {
            account = event.data;
          } else if (event.data.account) {
            account = event.data.account;
          } else if (event.data.userAccount) {
            account = event.data.userAccount;
          }

          if (account) {
            this.userAccount = account;
            window.removeEventListener('message', messageHandler);
            console.log('✅ Logged in as:', account);
            resolve(account);
          }
        }
      };

      window.addEventListener('message', messageHandler);

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
      return true;
    }
    return false;
  }

  async transact(actions, options) {
    if (!this.userAccount) {
      throw new Error('Not logged in');
    }

    return new Promise((resolve, reject) => {
      try {
        // Simplified: Let WAX Cloud Wallet build the transaction
        const actionsArray = actions.actions || actions;
        const action = actionsArray[0]; // For single action (pack unpack)

        // Build URL with action parameters
        const params = new URLSearchParams({
          account: this.userAccount,
          contract: action.account,
          action: action.name,
          from: action.data.from,
          to: action.data.to,
          asset_ids: action.data.asset_ids.join(','),
          memo: action.data.memo
        });

        const url = `https://all-access.wax.io/cloud-wallet/signing/sign-transaction?${params.toString()}`;

        const signingWindow = window.open(url, 'WAX Signing', 'width=400,height=600');

        if (!signingWindow) {
          reject(new Error('Popup blocked'));
          return;
        }

        // Listen for completion
        const messageHandler = (event) => {
          if (event.origin !== 'https://www.mycloudwallet.com' &&
              event.origin !== 'https://all-access.wax.io') {
            return;
          }

          console.log('Received message:', event.data);

          if (event.data && typeof event.data === 'object') {
            if (event.data.type === 'TX_SIGNED' || event.data.transaction_id) {
              window.removeEventListener('message', messageHandler);
              clearInterval(checkClosed);
              resolve({
                transaction_id: event.data.transaction_id || 'completed'
              });
            } else if (event.data.type === 'TX_CANCELLED') {
              window.removeEventListener('message', messageHandler);
              clearInterval(checkClosed);
              reject(new Error('Transaction cancelled'));
            }
          }
        };

        window.addEventListener('message', messageHandler);

        // Check if window closed
        const checkClosed = setInterval(() => {
          if (signingWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            // Assume success if window closed
            resolve({ transaction_id: 'completed' });
          }
        }, 1000);

      } catch (error) {
        reject(error);
      }
    });
  }

  get api() {
    return {
      transact: this.transact.bind(this)
    };
  }
}

// Expose globally
window.SimpleWaxAPI = SimpleWaxAPI;
console.log('✅ Simple WAX API loaded');
