/**
 * Anchor Wallet Integration for WAX Blockchain
 * Simplified wrapper using anchor-link
 */

(async function() {
  console.log('🔗 Loading Anchor Link...');

  // Try multiple CDNs for better compatibility
  const cdns = [
    {
      link: 'https://cdn.jsdelivr.net/npm/anchor-link@3.4.4/dist/anchor-link.min.js',
      transport: 'https://cdn.jsdelivr.net/npm/anchor-link-browser-transport@3.4.1/dist/anchor-link-browser-transport.min.js'
    },
    {
      link: 'https://unpkg.com/anchor-link@3.4.4/dist/anchor-link.min.js',
      transport: 'https://unpkg.com/anchor-link-browser-transport@3.4.1/dist/anchor-link-browser-transport.min.js'
    }
  ];

  let cdnIndex = 0;
  let loadFailed = false;

  function tryLoadScripts() {
    if (cdnIndex >= cdns.length) {
      console.error('❌ All Anchor CDNs failed');
      disableAnchorButton();
      return;
    }

    const cdn = cdns[cdnIndex];
    console.log(`📦 Trying CDN ${cdnIndex + 1}/${cdns.length}...`);

    // Load anchor-link from CDN
    const anchorLinkScript = document.createElement('script');
    anchorLinkScript.src = cdn.link;
    anchorLinkScript.onload = () => {
      console.log('✅ Anchor Link library loaded');
      loadTransport(cdn.transport);
    };
    anchorLinkScript.onerror = () => {
      console.warn(`❌ Failed to load Anchor Link from CDN ${cdnIndex + 1}`);
      cdnIndex++;
      tryLoadScripts();
    };
    document.head.appendChild(anchorLinkScript);
  }

  function loadTransport(transportUrl) {
    // Load anchor-link-browser-transport
    const transportScript = document.createElement('script');
    transportScript.src = transportUrl;
    transportScript.onload = () => {
      console.log('✅ Anchor Transport loaded');
      initAnchor();
    };
    transportScript.onerror = () => {
      console.warn(`❌ Failed to load Anchor transport from CDN ${cdnIndex + 1}`);
      cdnIndex++;
      tryLoadScripts();
    };
    document.head.appendChild(transportScript);
  }

  function disableAnchorButton() {
    // Disable Anchor button if loading fails
    const anchorBtn = document.getElementById('connect-anchor');
    if (anchorBtn) {
      anchorBtn.disabled = true;
      anchorBtn.style.opacity = '0.5';
      anchorBtn.title = 'Anchor wallet unavailable - use WAX Cloud Wallet';
    }
  }

  // Start loading
  tryLoadScripts();

  function initAnchor() {
    // Wait for both libraries to load
    const checkLibraries = setInterval(() => {
      if (window.AnchorLink && window.AnchorLinkBrowserTransport) {
        clearInterval(checkLibraries);
        setupAnchor();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkLibraries);
      if (!window.AnchorLink || !window.AnchorLinkBrowserTransport) {
        console.warn('⚠️ Anchor libraries timeout');
      }
    }, 10000);
  }

  function setupAnchor() {
    console.log('🔗 Setting up Anchor...');

    // Create Anchor Link instance
    const transport = new AnchorLinkBrowserTransport();

    const link = new AnchorLink({
      transport,
      chains: [
        {
          chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
          nodeUrl: 'https://wax.greymass.com',
        }
      ],
    });

    // Expose Anchor wrapper
    window.AnchorWallet = {
      link: link,
      session: null,
      userAccount: null,

      async login() {
        try {
          console.log('🔗 Opening Anchor login...');

          // Restore existing session or create new one
          const identity = await this.link.login('fr-rewards');

          this.session = identity.session;
          this.userAccount = String(identity.session.auth.actor);

          console.log('✅ Anchor logged in as:', this.userAccount);
          return this.userAccount;
        } catch (error) {
          console.error('❌ Anchor login failed:', error);
          throw error;
        }
      },

      async transact(actions) {
        if (!this.session) {
          throw new Error('No active Anchor session');
        }

        try {
          const result = await this.session.transact(
            { actions },
            {
              blocksBehind: 3,
              expireSeconds: 30,
            }
          );

          return result;
        } catch (error) {
          console.error('❌ Anchor transaction failed:', error);
          throw error;
        }
      },

      async logout() {
        try {
          if (this.session) {
            await this.link.removeSession('fr-rewards', this.session.auth);
          }
          this.session = null;
          this.userAccount = null;
          console.log('👋 Anchor logged out');
        } catch (error) {
          console.error('Error logging out of Anchor:', error);
        }
      },

      // Check if user has existing session
      async restoreSession() {
        try {
          const identity = await this.link.restoreSession('fr-rewards');
          if (identity) {
            this.session = identity.session;
            this.userAccount = String(identity.session.auth.actor);
            console.log('✅ Restored Anchor session:', this.userAccount);
            return this.userAccount;
          }
          return null;
        } catch (error) {
          console.warn('No existing Anchor session');
          return null;
        }
      }
    };

    console.log('✅ Anchor wallet ready');
  }
})();
