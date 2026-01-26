/**
 * Unified Module - Single module with dropdown to select functionality
 * Combines all existing module types into one unified interface
 *
 * Module Types:
 * - claim-rewards: NFT claim rewards
 * - factory-craft: Craft NFTs from ingredients
 * - transfer-mode: Transfer NFTs to other wallets
 * - unpack: Open mystery packs
 * - blend-array: NeftyBlocks blend detector
 * - paid-claim: Sell NFTs for WAX tokens
 * - gated-paid-claim: Sell NFTs to verified holders
 * - nefty-drop: Embed NeftyBlocks drops
 * - text-block: Display text content
 * - image-block: Display images
 */

(function() {
  'use strict';

  console.log('✅ Unified Module loaded');

  // Configuration
  const CONFIG = {
    module_type: 'paid-claim', // Default type
    // Config values will be populated based on module_type
    ...window.UNIFIED_MODULE_CONFIG || {}
  };

  const MODULE_TYPE = CONFIG.module_type;
  console.log(`🎯 Unified Module Type: ${MODULE_TYPE}`);

  // Shared state
  let currentAccount = null;
  let currentWalletType = null;

  // Initialize module based on type
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Container not found:', containerId);
      return;
    }

    console.log(`✅ Initializing unified module (type: ${MODULE_TYPE}) in ${containerId}`);

    // Route to appropriate module initializer
    switch (MODULE_TYPE) {
      case 'paid-claim':
        initPaidClaim(container);
        break;
      case 'gated-paid-claim':
        initGatedPaidClaim(container);
        break;
      case 'claim-rewards':
        initClaimRewards(container);
        break;
      case 'factory-craft':
        initFactoryCraft(container);
        break;
      case 'transfer-mode':
        initTransferMode(container);
        break;
      case 'unpack':
        initUnpack(container);
        break;
      case 'blend-array':
        initBlendArray(container);
        break;
      case 'nefty-drop':
        initNeftyDrop(container);
        break;
      case 'text-block':
        initTextBlock(container);
        break;
      case 'image-block':
        initImageBlock(container);
        break;
      default:
        container.innerHTML = `
          <div class="module-error" style="padding: 20px; background: var(--bg-dark); border-radius: 8px; text-align: center;">
            <p style="color: #ef4444; font-weight: 600;">⚠️ Unknown Module Type</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Module type "${MODULE_TYPE}" is not recognized.</p>
          </div>
        `;
    }
  }

  /**
   * PAID CLAIM MODULE
   * Sell NFTs directly with WAX token payments
   */
  function initPaidClaim(container) {
    console.log('💰 Initializing Paid Claim module');

    const config = {
      template_id: CONFIG.template_id || '',
      template_name: CONFIG.template_name || 'NFT',
      template_image: CONFIG.template_image || '',
      price_wax: CONFIG.price_wax || '10',
      payment_wallet: CONFIG.payment_wallet || 'futuresrelic',
      collection_name: CONFIG.collection_name || 'futuresrelic',
      max_supply: CONFIG.max_supply || '',
      per_wallet_limit: CONFIG.per_wallet_limit || '',
      wallet_limit_cooldown: CONFIG.wallet_limit_cooldown || '',
      supply_limit_cooldown: CONFIG.supply_limit_cooldown || '',
      auto_connect: CONFIG.auto_connect !== false,
      show_purchase_history: CONFIG.show_purchase_history !== false
    };

    console.log('Config:', config);

    // Build UI
    container.innerHTML = `
      <div class="paid-claim-container">
        <div class="nft-display" style="text-align: center; margin-bottom: 20px;">
          ${config.template_image ?
            `<img src="${config.template_image}" alt="${config.template_name}" style="width: 100%; max-width: 300px; border-radius: 12px; margin: 0 auto; display: block;">`
            : '<div style="width: 200px; height: 200px; background: var(--bg-dark); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 4rem;">💎</div>'}
          <h2 style="margin: 15px 0 5px;">${config.template_name}</h2>
          <p style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin: 10px 0;">
            ${config.price_wax} WAX
          </p>
          ${config.max_supply ? `<p style="font-size: 0.9rem; color: var(--text-secondary);">Max Supply: ${config.max_supply}</p>` : ''}
        </div>

        <div class="wallet-section" style="margin: 20px 0;">
          <div id="wallet-status" style="text-align: center;">
            <button id="connect-wcw-btn" class="btn btn-primary" style="margin: 5px;">☁️ Wax Cloud Wallet</button>
            <button id="connect-anchor-btn" class="btn btn-primary" style="margin: 5px;">⚓ Anchor Wallet</button>
          </div>
        </div>

        <div id="claim-section" style="display: none;">
          <button id="purchase-btn" class="btn btn-success" style="width: 100%; padding: 15px; font-size: 1.1rem; font-weight: 700;">
            💰 Purchase for ${config.price_wax} WAX
          </button>
          <div id="purchase-info" style="margin-top: 15px; padding: 15px; background: var(--bg-dark); border-radius: 8px;">
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">Connected: <span id="account-name" style="color: var(--primary); font-weight: 600;"></span></p>
          </div>
          ${config.show_purchase_history ? '<div id="purchase-history" style="margin-top: 20px;"></div>' : ''}
        </div>

        <div id="error-msg" style="display: none; margin: 15px 0; padding: 12px; background: #fee; border-left: 4px solid #f44; border-radius: 6px; color: #c33;"></div>
      </div>
    `;

    // Get elements
    const walletStatus = container.querySelector('#wallet-status');
    const connectWCWBtn = container.querySelector('#connect-wcw-btn');
    const connectAnchorBtn = container.querySelector('#connect-anchor-btn');
    const claimSection = container.querySelector('#claim-section');
    const purchaseBtn = container.querySelector('#purchase-btn');
    const accountName = container.querySelector('#account-name');
    const errorMsg = container.querySelector('#error-msg');

    // Wallet connection using WalletManager
    async function connectWallet(walletType) {
      try {
        console.log(`🔗 Connecting ${walletType} wallet...`);

        if (!window.WalletManager) {
          throw new Error('WalletManager not initialized. Please refresh the page.');
        }

        const account = await window.WalletManager.connect(walletType);
        currentAccount = account;
        currentWalletType = walletType;

        // Update UI
        walletStatus.innerHTML = `<p style="color: #4ade80; font-weight: 600;">✅ Connected: ${account}</p>`;
        accountName.textContent = account;
        claimSection.style.display = 'block';

        console.log('✅ Wallet connected:', account);

        // Load purchase history if enabled
        if (config.show_purchase_history) {
          loadPurchaseHistory();
        }

      } catch (error) {
        console.error('Wallet connection error:', error);
        showError('Wallet connection failed: ' + error.message);
      }
    }

    // Purchase NFT
    async function purchaseNFT() {
      try {
        purchaseBtn.disabled = true;
        purchaseBtn.textContent = 'Processing...';
        errorMsg.style.display = 'none';

        if (!window.WalletManager) {
          throw new Error('WalletManager not initialized. Please refresh the page.');
        }

        if (!currentAccount) {
          throw new Error('Please connect your wallet first.');
        }

        // Prepare transaction
        const actions = [{
          account: 'eosio.token',
          name: 'transfer',
          authorization: [{
            actor: currentAccount,
            permission: 'active'
          }],
          data: {
            from: currentAccount,
            to: config.payment_wallet,
            quantity: `${parseFloat(config.price_wax).toFixed(8)} WAX`,
            memo: `claim:${config.template_id}`
          }
        }];

        console.log('💳 Executing purchase transaction...');

        // Execute transaction using WalletManager
        const result = await window.WalletManager.transact(actions, {
          blocksBehind: 3,
          expireSeconds: 90
        });

        const txId = result.transaction_id || result.transactionId || 'completed';
        console.log('✅ Purchase complete! TX:', txId);

        // Show success
        purchaseBtn.style.background = '#4ade80';
        purchaseBtn.textContent = '✅ Purchase Complete!';

        // Show success message
        showError(`✅ Success! TX: ${txId.substr(0, 16)}...`, false);

        // Reload purchase history
        if (config.show_purchase_history) {
          setTimeout(() => loadPurchaseHistory(), 2000);
        }

        // Reset button after delay
        setTimeout(() => {
          purchaseBtn.disabled = false;
          purchaseBtn.textContent = `💰 Purchase for ${config.price_wax} WAX`;
          purchaseBtn.style.background = '';
        }, 3000);

      } catch (error) {
        console.error('Purchase error:', error);
        purchaseBtn.disabled = false;
        purchaseBtn.textContent = `💰 Purchase for ${config.price_wax} WAX`;
        showError('Purchase failed: ' + error.message);
      }
    }

    // Load purchase history
    async function loadPurchaseHistory() {
      const historyContainer = container.querySelector('#purchase-history');
      if (!historyContainer || !currentAccount) return;

      try {
        const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:3000'
          : 'https://claim.futuresrelic.com';

        const response = await fetch(`${API_URL}/api/paid-claim/history/${currentAccount}/${config.template_id}`);
        if (!response.ok) throw new Error('Failed to load history');

        const data = await response.json();

        if (data.purchases && data.purchases.length > 0) {
          historyContainer.innerHTML = `
            <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--text-secondary);">Your Purchases (${data.purchases.length})</h3>
            <div style="display: grid; gap: 10px;">
              ${data.purchases.map(purchase => `
                <div style="padding: 12px; background: var(--bg-dark); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 0.9rem; color: var(--text-primary);">${new Date(purchase.timestamp).toLocaleDateString()}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${purchase.tx_id?.substr(0, 16)}...</div>
                  </div>
                  <div style="font-size: 0.9rem; font-weight: 600; color: var(--primary);">${purchase.price_wax} WAX</div>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          historyContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">No purchases yet.</p>';
        }
      } catch (error) {
        console.error('Error loading purchase history:', error);
        historyContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Unable to load purchase history.</p>';
      }
    }

    // Show error/success message
    function showError(message, isError = true) {
      errorMsg.textContent = message;
      errorMsg.style.display = 'block';
      errorMsg.style.background = isError ? '#fee' : '#efe';
      errorMsg.style.borderColor = isError ? '#f44' : '#4a4';
      errorMsg.style.color = isError ? '#c33' : '#383';
    }

    // Event listeners
    connectWCWBtn.addEventListener('click', () => connectWallet('wcw'));
    connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    purchaseBtn.addEventListener('click', purchaseNFT);

    // Auto-connect if enabled
    if (config.auto_connect) {
      setTimeout(async () => {
        try {
          if (!window.WalletManager) {
            console.log('⏳ WalletManager not ready yet, waiting...');
            return;
          }

          const state = window.WalletManager.getState();
          if (state.account) {
            console.log('🔄 Auto-connecting wallet:', state.account);
            currentAccount = state.account;
            currentWalletType = state.walletType;
            walletStatus.innerHTML = `<p style="color: #4ade80; font-weight: 600;">✅ Connected: ${state.account}</p>`;
            accountName.textContent = state.account;
            claimSection.style.display = 'block';

            if (config.show_purchase_history) {
              loadPurchaseHistory();
            }
          }
        } catch (error) {
          console.warn('Auto-connect failed:', error);
        }
      }, 500);
    }
  }

  /**
   * NEFTY DROP MODULE
   * Embed NeftyBlocks drops
   */
  function initNeftyDrop(container) {
    console.log('🎁 Initializing NeftyBlocks Drop module');

    const config = {
      collection: CONFIG.collection || 'futuresrelic',
      drop_id: CONFIG.drop_id || '',
      limit: CONFIG.limit || '1'
    };

    console.log('✅ NeftyBlocks Drop initialized:', `${config.collection} - Drop #${config.drop_id}`);

    container.innerHTML = `
      <div class="nefty-drop-container">
        <iframe
          src="https://neftyblocks.com/c/${config.collection}/drops/${config.drop_id}/embed"
          width="100%"
          height="800"
          style="border: none; border-radius: 8px;"
          allow="payment"
        ></iframe>
      </div>
    `;
  }

  /**
   * TEXT BLOCK MODULE
   * Display text content
   */
  function initTextBlock(container) {
    const config = {
      heading: CONFIG.heading || '',
      content: CONFIG.content || 'Enter your text here...',
      style: CONFIG.style || 'normal'
    };

    const styleClasses = {
      normal: 'text-block-normal',
      narrative: 'text-block-narrative',
      alert: 'text-block-alert',
      quote: 'text-block-quote'
    };

    container.innerHTML = `
      <div class="text-block ${styleClasses[config.style]}">
        ${config.heading ? `<h2>${config.heading}</h2>` : ''}
        <div>${config.content}</div>
      </div>
    `;
  }

  /**
   * IMAGE BLOCK MODULE
   * Display images
   */
  function initImageBlock(container) {
    const config = {
      image_url: CONFIG.image_url || '',
      alt_text: CONFIG.alt_text || 'Image',
      caption: CONFIG.caption || '',
      width: CONFIG.width || 'auto',
      alignment: CONFIG.alignment || 'center'
    };

    container.innerHTML = `
      <div class="image-block" style="text-align: ${config.alignment};">
        <img src="${config.image_url}" alt="${config.alt_text}" style="width: ${config.width}; border-radius: 8px;">
        ${config.caption ? `<p style="margin-top: 10px; font-size: 0.9rem; color: var(--text-secondary);">${config.caption}</p>` : ''}
      </div>
    `;
  }

  /**
   * PLACEHOLDER INITIALIZERS
   * These will be implemented with full code from their respective modules
   */
  function initGatedPaidClaim(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;"><p>🔐 Gated Paid Claim - Coming Soon</p></div>`;
  }

  function initClaimRewards(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;"><p>🎁 Claim Rewards - Coming Soon</p></div>`;
  }

  function initFactoryCraft(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;"><p>🏭 Factory Craft - Coming Soon</p></div>`;
  }

  function initTransferMode(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;"><p>↔️ Transfer Mode - Coming Soon</p></div>`;
  }

  function initUnpack(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;"><p>📦 Unpack - Coming Soon</p></div>`;
  }

  function initBlendArray(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;"><p>🔀 Blend Array - Coming Soon</p></div>`;
  }

  // Export initialization function
  window.UnifiedModule = { init };

})();
