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

    return new Promise(async (resolve, reject) => {
      try {
        // Get transaction header info
        const info = await fetch(`${this.rpcEndpoint}/v1/chain/get_info`).then(r => r.json());

        const txHeader = {
          expiration: new Date(Date.now() + (options.expireSeconds || 90) * 1000).toISOString().split('.')[0],
          ref_block_num: info.head_block_num & 0xFFFF,
          ref_block_prefix: parseInt(info.head_block_id.substr(16, 8), 16),
          max_net_usage_words: 0,
          max_cpu_usage_ms: 0,
          delay_sec: 0,
          context_free_actions: [],
          actions: actions.actions || actions,
          transaction_extensions: []
        };

        // Open signing window
        const signingUrl = `https://all-access.wax.io/cloud-wallet/signing/?transaction=${encodeURIComponent(JSON.stringify(txHeader))}`;

        const messageHandler = (event) => {
          if (event.origin !== 'https://www.mycloudwallet.com' &&
              event.origin !== 'https://all-access.wax.io') {
            return;
          }

          if (event.data && event.data.type === 'TX_SIGNED') {
            window.removeEventListener('message', messageHandler);

            // Broadcast signed transaction
            fetch(`${this.rpcEndpoint}/v1/chain/push_transaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(event.data.data)
            })
            .then(r => r.json())
            .then(result => {
              resolve({
                transaction_id: result.transaction_id,
                processed: result.processed
              });
            })
            .catch(error => reject(error));
          } else if (event.data && event.data.type === 'TX_CANCELLED') {
            window.removeEventListener('message', messageHandler);
            reject(new Error('Transaction cancelled by user'));
          }
        };

        window.addEventListener('message', messageHandler);

        const width = 400;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const signingWindow = window.open(
          signingUrl,
          'WAX Signing',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!signingWindow) {
          window.removeEventListener('message', messageHandler);
          reject(new Error('Popup blocked'));
          return;
        }

        const checkClosed = setInterval(() => {
          if (signingWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            reject(new Error('Signing window closed'));
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
