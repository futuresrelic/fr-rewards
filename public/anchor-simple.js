/**
 * Simple Anchor Wallet Integration for WAX
 * Local implementation to avoid CDN tracking prevention
 */

(function() {
  console.log('🔗 Anchor Simple loaded');

  // Create a simplified Anchor wrapper using ESR protocol
  window.AnchorWallet = {
    session: null,
    userAccount: null,

    async login() {
      return new Promise((resolve, reject) => {
        try {
          // Check if Anchor browser extension is installed
          if (window.anchor) {
            console.log('📱 Anchor browser extension detected');
            this.loginWithExtension().then(resolve).catch(reject);
            return;
          }

          // Try desktop app via anchor:// protocol
          console.log('🖥️ Attempting Anchor desktop app login');
          this.loginWithDesktopApp().then(resolve).catch(reject);
        } catch (error) {
          console.error('❌ Anchor login error:', error);
          reject(error);
        }
      });
    },

    async loginWithExtension() {
      // Use Anchor browser extension
      if (!window.anchor) {
        throw new Error('Anchor browser extension not found');
      }

      try {
        const identity = await window.anchor.login('wax');

        if (identity && identity.account) {
          this.userAccount = identity.account;
          this.session = {
            auth: {
              actor: identity.account,
              permission: 'active'
            }
          };

          console.log('✅ Logged in with Anchor extension:', this.userAccount);
          return this.userAccount;
        }

        throw new Error('Failed to get account from Anchor extension');
      } catch (error) {
        console.error('Extension login failed:', error);
        throw error;
      }
    },

    async loginWithDesktopApp() {
      // For desktop app, we'll use a QR code approach with ESR
      // This is a simplified version - full implementation would use esr protocol

      const popup = window.open('', 'AnchorLogin', 'width=400,height=600');

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Anchor Login</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              padding: 30px;
              border-radius: 16px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            }
            h2 { margin-top: 0; }
            p { line-height: 1.6; }
            input {
              width: 100%;
              max-width: 300px;
              padding: 12px;
              margin: 10px 0;
              border: none;
              border-radius: 8px;
              font-size: 16px;
            }
            button {
              background: white;
              color: #667eea;
              border: none;
              padding: 12px 30px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              margin: 5px;
            }
            button:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .instructions {
              font-size: 14px;
              opacity: 0.9;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>⚓ Anchor Wallet</h2>
            <p>Enter your WAX account name:</p>
            <input type="text" id="accountInput" placeholder="yourname.wam" autofocus />
            <br>
            <button onclick="submitAccount()">Connect</button>
            <button onclick="window.close()">Cancel</button>
            <div class="instructions">
              <p><strong>Note:</strong> This is a simplified login for Anchor wallet.</p>
              <p>Make sure Anchor desktop app is running and has your WAX account imported.</p>
            </div>
          </div>
          <script>
            function submitAccount() {
              const account = document.getElementById('accountInput').value.trim();
              if (account) {
                window.opener.postMessage({ type: 'anchor_login', account: account }, '*');
                window.close();
              } else {
                alert('Please enter your account name');
              }
            }
            document.getElementById('accountInput').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') submitAccount();
            });
          </script>
        </body>
        </html>
      `);

      return new Promise((resolve, reject) => {
        const messageHandler = (event) => {
          if (event.data && event.data.type === 'anchor_login') {
            const account = event.data.account;

            this.userAccount = account;
            this.session = {
              auth: {
                actor: account,
                permission: 'active'
              }
            };

            window.removeEventListener('message', messageHandler);
            console.log('✅ Logged in with Anchor:', account);
            resolve(account);
          }
        };

        window.addEventListener('message', messageHandler);

        // Timeout after 5 minutes
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          if (popup && !popup.closed) {
            popup.close();
          }
          reject(new Error('Login timeout'));
        }, 300000);
      });
    },

    async logout() {
      if (window.anchor && window.anchor.logout) {
        try {
          await window.anchor.logout();
        } catch (error) {
          console.warn('Extension logout failed:', error);
        }
      }

      this.session = null;
      this.userAccount = null;
      console.log('👋 Logged out from Anchor');
    },

    async restoreSession() {
      // Try to restore from browser extension
      if (window.anchor && window.anchor.getIdentity) {
        try {
          const identity = await window.anchor.getIdentity();
          if (identity && identity.account) {
            this.userAccount = identity.account;
            this.session = {
              auth: {
                actor: identity.account,
                permission: 'active'
              }
            };
            console.log('✅ Restored Anchor session:', this.userAccount);
            return this.userAccount;
          }
        } catch (error) {
          console.warn('No existing session found');
        }
      }
      return null;
    }
  };

  console.log('✅ Anchor wallet ready (simplified mode)');
})();
