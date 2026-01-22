/**
 * Paid Claim Module
 * Self-contained module for purchasing NFTs with WAX tokens
 */

window.init_paid_claim = function(containerId, config = {}) {
  console.log(`✅ Paid Claim module initialized in #${containerId}`);
  console.log('Config:', config);

  const container = document.getElementById(containerId);
  const API_URL = window.location.origin;

  // Module configuration with defaults
  const moduleConfig = {
    template_id: config.template_id || null,
    price_wax: config.price_wax || "10.00000000",
    payment_wallet: config.payment_wallet || 'futuresrelic',
    collection_name: config.collection_name || 'futuresrelic',
    template_name: config.template_name || 'NFT',
    template_image: config.template_image || null,
    max_supply: config.max_supply || null,
    per_wallet_limit: config.per_wallet_limit || null,
    auto_connect: config.auto_connect || false,
    show_purchase_history: config.show_purchase_history !== false
  };

  // Module state
  let currentAccount = null;
  let wax = null;
  let anchor = null;
  let currentWalletType = null;

  // Get module elements
  const notConnectedSection = container.querySelector('.paid-claim-not-connected');
  const loadingSection = container.querySelector('.paid-claim-loading');
  const connectedSection = container.querySelector('.paid-claim-connected');
  const connectedAccountEl = container.querySelector('.paid-claim-connected-account');
  const nftListEl = container.querySelector('.paid-claim-nft-list');
  const historyListEl = container.querySelector('.paid-claim-history-list');
  const historySection = container.querySelector('.paid-claim-history');
  const messageEl = container.querySelector('.paid-claim-message');
  const walletInfoDiv = container.querySelector('.paid-claim-wallet-info');

  // Initialize
  (async function init() {
    await waitForLibraries();
    setupEventListeners();

    // Auto-connect if configured
    if (moduleConfig.auto_connect) {
      checkExistingSession();
    }
  })();

  // Wait for wallet libraries to load
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

    return true;
  }

  // Setup event listeners
  function setupEventListeners() {
    const connectWcwBtn = container.querySelector('.paid-claim-connect-wcw');
    const connectAnchorBtn = container.querySelector('.paid-claim-connect-anchor');
    const disconnectBtn = container.querySelector('.paid-claim-disconnect-btn');

    if (connectWcwBtn) {
      connectWcwBtn.addEventListener('click', () => connectWallet('wcw'));
    }
    if (connectAnchorBtn) {
      connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    }
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', disconnect);
    }
  }

  // Check for existing session
  async function checkExistingSession() {
    const savedAccount = localStorage.getItem('wax_account_paid');
    const savedWallet = localStorage.getItem('wax_wallet_paid');

    if (savedAccount && savedWallet) {
      currentAccount = savedAccount;
      currentWalletType = savedWallet;

      // Try to restore Anchor session
      if (savedWallet === 'anchor' && window.AnchorWallet) {
        try {
          const restored = await window.AnchorWallet.restoreSession();
          if (restored) {
            anchor = window.AnchorWallet;
            currentAccount = restored;
          }
        } catch (error) {
          console.warn('Could not restore Anchor session:', error);
          localStorage.removeItem('wax_account_paid');
          localStorage.removeItem('wax_wallet_paid');
          return;
        }
      }

      showConnectedState();
      loadTemplateData();
    }
  }

  // Connect wallet
  async function connectWallet(walletType) {
    try {
      hideMessage();

      if (walletType === 'wcw') {
        await connectWCW();
      } else if (walletType === 'anchor') {
        await connectAnchor();
      }

      if (currentAccount) {
        currentWalletType = walletType;
        localStorage.setItem('wax_account_paid', currentAccount);
        localStorage.setItem('wax_wallet_paid', walletType);
        showConnectedState();
        await loadTemplateData();
      }
    } catch (error) {
      showMessage('Failed to connect wallet: ' + error.message, 'error');
      console.error('Wallet connection error:', error);
    }
  }

  // Connect Wax Cloud Wallet
  async function connectWCW() {
    const WaxJS = window.waxjs?.WaxJS || window.WaxJS;
    if (!WaxJS) throw new Error('WaxJS not loaded');

    wax = new WaxJS({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: false });
    currentAccount = await wax.login();
  }

  // Connect Anchor
  async function connectAnchor() {
    if (!window.AnchorWallet) {
      throw new Error('Anchor wallet not loaded. Please refresh the page or use WAX Cloud Wallet.');
    }

    anchor = window.AnchorWallet;
    currentAccount = await anchor.login();
  }

  // Disconnect wallet
  async function disconnect() {
    // Logout from Anchor if connected
    if (currentWalletType === 'anchor' && anchor) {
      try {
        await anchor.logout();
      } catch (error) {
        console.error('Error logging out of Anchor:', error);
      }
    }

    currentAccount = null;
    wax = null;
    anchor = null;
    currentWalletType = null;
    localStorage.removeItem('wax_account_paid');
    localStorage.removeItem('wax_wallet_paid');
    showNotConnectedState();
  }

  // Load template data and display purchase options
  async function loadTemplateData() {
    try {
      loadingSection.style.display = 'block';
      connectedSection.style.display = 'none';

      // Validate configuration
      if (!moduleConfig.template_id) {
        throw new Error('No template_id configured for this module');
      }

      loadingSection.style.display = 'none';
      connectedSection.style.display = 'block';

      // Display purchase card
      displayPurchaseCard();

      // Load purchase history if enabled
      if (moduleConfig.show_purchase_history) {
        await loadPurchaseHistory();
      }

    } catch (error) {
      loadingSection.style.display = 'none';
      showMessage('Error loading data: ' + error.message, 'error');
      console.error('Error:', error);
    }
  }

  // Display the purchase card
  function displayPurchaseCard() {
    nftListEl.innerHTML = '';

    const purchaseCard = document.createElement('div');
    purchaseCard.className = 'nft-card';
    purchaseCard.style.maxWidth = '500px';
    purchaseCard.style.margin = '0 auto';

    // Build media element
    let mediaHtml = '🎨';
    if (moduleConfig.template_image) {
      const isVideo = moduleConfig.template_image.match(/\.(mp4|webm|mov)$/i);
      if (isVideo) {
        mediaHtml = `<video src="${moduleConfig.template_image}" class="nft-image" autoplay loop muted playsinline style="max-width: 100%; border-radius: 8px;"></video>`;
      } else {
        mediaHtml = `<img src="${moduleConfig.template_image}" alt="${moduleConfig.template_name}" class="nft-image" style="max-width: 100%; border-radius: 8px;">`;
      }
    }

    // Format WAX price for display
    const waxAmount = parseFloat(moduleConfig.price_wax).toFixed(8);
    const waxDisplay = parseFloat(waxAmount).toString(); // Remove trailing zeros for display

    purchaseCard.innerHTML = `
      <div style="text-align: center;">
        <div class="nft-icon" style="margin-bottom: 15px;">
          ${mediaHtml}
        </div>
        <h3 style="margin: 15px 0 10px;">${moduleConfig.template_name}</h3>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px;">
          Template ID: ${moduleConfig.template_id}
        </div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin: 20px 0;">
          ${waxDisplay} WAX
        </div>
        ${moduleConfig.max_supply ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Max Supply: ${moduleConfig.max_supply}</div>` : ''}
        ${moduleConfig.per_wallet_limit ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Limit: ${moduleConfig.per_wallet_limit} per wallet</div>` : ''}
        <button class="btn btn-success purchase-btn" style="width: 100%; font-size: 1.1rem; padding: 15px;" data-template="${moduleConfig.template_id}">
          💰 Purchase for ${waxDisplay} WAX
        </button>
        <div class="purchase-status" style="margin-top: 15px; min-height: 20px;"></div>
      </div>
    `;

    nftListEl.appendChild(purchaseCard);

    // Add purchase button listener
    const purchaseBtn = purchaseCard.querySelector('.purchase-btn');
    const statusEl = purchaseCard.querySelector('.purchase-status');

    purchaseBtn.addEventListener('click', () => {
      processPurchase(purchaseBtn, statusEl);
    });
  }

  // Process the purchase
  async function processPurchase(button, statusEl) {
    try {
      button.disabled = true;
      button.textContent = 'Processing...';
      statusEl.innerHTML = '<div style="color: var(--primary);">⏳ Preparing transaction...</div>';

      // Step 1: User signs token transfer transaction
      statusEl.innerHTML = '<div style="color: var(--primary);">💳 Please sign the payment transaction in your wallet...</div>';

      const paymentResult = await executeTokenTransfer();

      statusEl.innerHTML = '<div style="color: var(--primary);">✅ Payment sent! Verifying transaction...</div>';

      // Step 2: Send payment TX to backend for verification and minting
      statusEl.innerHTML = '<div style="color: var(--primary);">🔍 Verifying payment...</div>';

      const response = await fetch(`${API_URL}/api/user/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account: currentAccount,
          template_id: moduleConfig.template_id,
          payment_transaction_id: paymentResult.transaction_id,
          price_wax: moduleConfig.price_wax,
          payment_wallet: moduleConfig.payment_wallet
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      // Success!
      statusEl.innerHTML = `
        <div style="color: var(--success); font-weight: 600;">
          ✅ Purchase successful!
        </div>
        <div style="font-size: 0.85rem; margin-top: 8px;">
          <a href="https://waxblock.io/transaction/${data.mint_transaction_id}" target="_blank" style="color: var(--primary);">
            View NFT Mint Transaction →
          </a>
        </div>
      `;

      showMessage(`🎉 Purchase completed! NFT minted successfully.`, 'success');

      // Reload purchase history
      if (moduleConfig.show_purchase_history) {
        setTimeout(() => loadPurchaseHistory(), 2000);
      }

      // Re-enable button after delay
      setTimeout(() => {
        button.disabled = false;
        button.textContent = `💰 Purchase for ${parseFloat(moduleConfig.price_wax).toString()} WAX`;
        statusEl.innerHTML = '';
      }, 10000);

    } catch (error) {
      console.error('Purchase error:', error);
      statusEl.innerHTML = `<div style="color: var(--error);">❌ ${error.message}</div>`;
      showMessage('Purchase failed: ' + error.message, 'error');
      button.disabled = false;
      button.textContent = `💰 Purchase for ${parseFloat(moduleConfig.price_wax).toString()} WAX`;

      setTimeout(() => {
        statusEl.innerHTML = '';
      }, 10000);
    }
  }

  // Execute token transfer transaction
  async function executeTokenTransfer() {
    const actions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{
        actor: currentAccount,
        permission: 'active',
      }],
      data: {
        from: currentAccount,
        to: moduleConfig.payment_wallet,
        quantity: moduleConfig.price_wax,
        memo: `NFT Purchase - Template ${moduleConfig.template_id}`
      },
    }];

    // Execute transaction based on wallet type
    if (currentWalletType === 'wcw' && wax) {
      return await wax.api.transact({
        actions: actions
      }, {
        blocksBehind: 3,
        expireSeconds: 30,
      });
    } else if (currentWalletType === 'anchor' && anchor) {
      return await anchor.transact({
        actions: actions
      }, {
        blocksBehind: 3,
        expireSeconds: 30,
      });
    } else {
      throw new Error('No wallet connected');
    }
  }

  // Load purchase history
  async function loadPurchaseHistory() {
    try {
      const response = await fetch(`${API_URL}/api/user/purchases/${currentAccount}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load purchase history');
      }

      if (data.purchases && data.purchases.length > 0 && historySection && historyListEl) {
        historySection.style.display = 'block';
        historyListEl.innerHTML = '';

        // Show last 5 purchases
        data.purchases.slice(0, 5).forEach(purchase => {
          const historyItem = document.createElement('div');
          historyItem.className = 'history-item';

          const status = purchase.status === 'completed' ? '✅' :
                        purchase.status === 'failed' ? '❌' : '⏳';

          const mintLink = purchase.mint_transaction_id
            ? `<a href="https://waxblock.io/transaction/${purchase.mint_transaction_id}" target="_blank" style="color: var(--primary); font-size: 0.85rem;">View TX</a>`
            : '';

          historyItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
              <div>
                <div style="font-weight: 600;">${status} Template ${purchase.template_id}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                  ${purchase.price_wax} • ${formatDate(purchase.purchased_at)}
                </div>
              </div>
              <div>
                ${mintLink}
              </div>
            </div>
          `;
          historyListEl.appendChild(historyItem);
        });
      }
    } catch (error) {
      console.error('Error loading purchase history:', error);
    }
  }

  // UI State functions
  function showNotConnectedState() {
    notConnectedSection.style.display = 'block';
    loadingSection.style.display = 'none';
    connectedSection.style.display = 'none';
  }

  function showConnectedState() {
    notConnectedSection.style.display = 'none';
    if (connectedAccountEl) connectedAccountEl.textContent = currentAccount;
    if (walletInfoDiv) walletInfoDiv.style.display = 'block';
  }

  function showMessage(message, type = 'error') {
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.style.display = 'block';

    if (type === 'success') {
      messageEl.style.color = 'var(--success)';
      messageEl.style.background = 'rgba(16, 185, 129, 0.1)';
      messageEl.style.border = '1px solid var(--success)';
    } else {
      messageEl.style.color = 'var(--error)';
      messageEl.style.background = 'rgba(239, 68, 68, 0.1)';
      messageEl.style.border = '1px solid var(--error)';
    }

    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 8000);
  }

  function hideMessage() {
    if (messageEl) messageEl.style.display = 'none';
  }

  // Utility functions
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
