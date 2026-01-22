/**
 * Paid Claim Module
 * Self-contained module for purchasing NFTs with WAX tokens
 */

window.init_paid_claim = function(containerId, config = {}) {
  console.log(`✅ Paid Claim module initialized in #${containerId}`);
  console.log('Config:', config);

  const container = document.getElementById(containerId);
  const API_URL = window.location.origin;

  // Check if this is a grouped configuration
  const isGrouped = config.grouped === true && Array.isArray(config.templates);

  // Module configuration with defaults
  let moduleConfigs = [];

  if (isGrouped) {
    // Grouped mode: multiple templates
    moduleConfigs = config.templates.map(cfg => ({
      template_id: cfg.template_id || null,
      price_wax: cfg.price_wax || "10.00000000",
      payment_wallet: cfg.payment_wallet || 'futuresrelic',
      collection_name: cfg.collection_name || 'futuresrelic',
      template_name: cfg.template_name || 'NFT',
      template_image: cfg.template_image || null,
      max_supply: cfg.max_supply || null,
      per_wallet_limit: cfg.per_wallet_limit || null,
      wallet_limit_cooldown: cfg.wallet_limit_cooldown || null,
      supply_limit_cooldown: cfg.supply_limit_cooldown || null,
      auto_connect: cfg.auto_connect || false,
      show_purchase_history: cfg.show_purchase_history !== false
    }));
  } else {
    // Single mode: one template
    moduleConfigs = [{
      template_id: config.template_id || null,
      price_wax: config.price_wax || "10.00000000",
      payment_wallet: config.payment_wallet || 'futuresrelic',
      collection_name: config.collection_name || 'futuresrelic',
      template_name: config.template_name || 'NFT',
      template_image: config.template_image || null,
      max_supply: config.max_supply || null,
      per_wallet_limit: config.per_wallet_limit || null,
      wallet_limit_cooldown: config.wallet_limit_cooldown || null,
      supply_limit_cooldown: config.supply_limit_cooldown || null,
      auto_connect: config.auto_connect || false,
      show_purchase_history: config.show_purchase_history !== false
    }];
  }

  // For backward compatibility, keep moduleConfig pointing to the first one
  const moduleConfig = moduleConfigs[0];

  // Determine if we should show purchase history (only if at least one config enables it)
  const shouldShowPurchaseHistory = isGrouped
    ? moduleConfigs.some(cfg => cfg.show_purchase_history)
    : moduleConfig.show_purchase_history;

  // Module state
  let currentAccount = null;
  let unsubscribe = null; // Wallet manager subscription cleanup

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
    // Wait for WalletManager to be initialized
    await waitForWalletManager();

    setupEventListeners();

    // Subscribe to wallet state changes
    unsubscribe = window.WalletManager.subscribe((event, state) => {
      console.log(`[${containerId}] Wallet event:`, event, state);

      if (event === 'connected' && state.account) {
        currentAccount = state.account;
        showConnectedState();
        loadTemplateData();
      } else if (event === 'disconnected') {
        currentAccount = null;
        showNotConnectedState();
      }
    });

    // Check if already connected
    const state = window.WalletManager.getState();
    if (state.isConnected && state.account) {
      currentAccount = state.account;
      showConnectedState();

      // Auto-load data if configured
      if (moduleConfig.auto_connect) {
        loadTemplateData();
      }
    }
  })();

  // Wait for WalletManager to be initialized
  async function waitForWalletManager() {
    let attempts = 0;
    while (!window.WalletManager && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.WalletManager) {
      console.error('❌ WalletManager not available');
      throw new Error('WalletManager not loaded');
    }

    // Wait for WalletManager to be initialized
    attempts = 0;
    while (!window.WalletManager.getState().isInitialized && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    console.log('✅ WalletManager ready');
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

  // Connect wallet
  async function connectWallet(walletType) {
    try {
      hideMessage();

      // Use global WalletManager
      const account = await window.WalletManager.connect(walletType);

      if (account) {
        currentAccount = account;
        // State changes will be handled by the subscription
      }
    } catch (error) {
      showMessage('Failed to connect wallet: ' + error.message, 'error');
      console.error('Wallet connection error:', error);
    }
  }

  // Disconnect wallet
  async function disconnect() {
    try {
      // Use global WalletManager
      await window.WalletManager.disconnect();
      // State changes will be handled by the subscription
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      showMessage('Failed to disconnect: ' + error.message, 'error');
    }
  }

  // Load template data and display purchase options
  async function loadTemplateData() {
    try {
      loadingSection.style.display = 'block';
      connectedSection.style.display = 'none';

      // Validate configuration and fetch template metadata for all configs
      for (let cfg of moduleConfigs) {
        if (!cfg.template_id) {
          throw new Error('No template_id configured for this module');
        }

        // Fetch template data from AtomicAssets if name or image is missing
        if (!cfg.template_name || !cfg.template_image ||
            cfg.template_name === 'NFT' || cfg.template_image === '') {
          await fetchTemplateMetadata(cfg);
        }
      }

      loadingSection.style.display = 'none';
      connectedSection.style.display = 'block';

      // Display purchase card(s)
      displayPurchaseCard();

      // Load purchase history if enabled (only once for grouped mode)
      if (shouldShowPurchaseHistory) {
        await loadPurchaseHistory();
      }

    } catch (error) {
      loadingSection.style.display = 'none';
      showMessage('Error loading data: ' + error.message, 'error');
      console.error('Error:', error);
    }
  }

  // Fetch template metadata from AtomicAssets API (fallback)
  async function fetchTemplateMetadata(cfg) {
    const endpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax.api.atomicassets.io'
    ];

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}/atomicassets/v1/templates/${cfg.collection_name}/${cfg.template_id}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const templateData = data.data;

            // Use fetched name as fallback if not set or is default
            if (!cfg.template_name || cfg.template_name === 'NFT') {
              const name = templateData.immutable_data?.name || templateData.name;
              if (name) {
                cfg.template_name = name;
              }
            }

            // Use fetched image/video as fallback if not set
            if (!cfg.template_image || cfg.template_image === '') {
              const img = templateData.immutable_data?.img ||
                         templateData.immutable_data?.image ||
                         templateData.immutable_data?.video;
              if (img) {
                // Convert IPFS hash to gateway URL
                cfg.template_image = img.startsWith('Qm') ? `https://ipfs.io/ipfs/${img}` : img;
              }
            }

            console.log(`✅ Fetched template metadata for ${cfg.template_id} from AtomicAssets API`);
            return;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch template ${cfg.template_id} from ${endpoint}:`, err);
        continue;
      }
    }

    console.warn(`⚠️ Could not fetch template metadata for ${cfg.template_id}, using configured values`);
  }

  // Display the purchase card(s)
  function displayPurchaseCard() {
    nftListEl.innerHTML = '';

    if (isGrouped) {
      // Create a grid container for multiple cards
      const gridContainer = document.createElement('div');
      gridContainer.className = 'paid-claim-cards-grid';

      // Render each template as a card
      let hasActiveCooldown = false;
      moduleConfigs.forEach(cfg => {
        const cardResult = createPurchaseCard(cfg);
        gridContainer.appendChild(cardResult.card);
        if (cardResult.hasActiveCooldown) {
          hasActiveCooldown = true;
        }
      });

      nftListEl.appendChild(gridContainer);

      // Auto-refresh if any card has active cooldown
      if (hasActiveCooldown) {
        setTimeout(() => displayPurchaseCard(), 1000);
      }
    } else {
      // Single card mode (backward compatible)
      const cardResult = createPurchaseCard(moduleConfig);
      cardResult.card.style.maxWidth = '500px';
      cardResult.card.style.margin = '0 auto';
      nftListEl.appendChild(cardResult.card);

      // Auto-refresh if cooldown is active
      if (cardResult.hasActiveCooldown) {
        setTimeout(() => displayPurchaseCard(), 1000);
      }
    }
  }

  // Create a single purchase card
  function createPurchaseCard(cfg) {
    const purchaseCard = document.createElement('div');
    purchaseCard.className = 'nft-card';

    // Build media element
    let mediaHtml = '🎨';
    if (cfg.template_image) {
      const isVideo = cfg.template_image.match(/\.(mp4|webm|mov)$/i);
      if (isVideo) {
        mediaHtml = `<video src="${cfg.template_image}" class="nft-image" autoplay loop muted playsinline preload="metadata" style="width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;"></video>`;
      } else {
        mediaHtml = `<img src="${cfg.template_image}" alt="${cfg.template_name}" class="nft-image" style="width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;">`;
      }
    }

    // Format WAX price for display
    const waxAmount = parseFloat(cfg.price_wax).toFixed(8);
    const waxDisplay = parseFloat(waxAmount).toString(); // Remove trailing zeros for display

    // Check cooldowns (use cfg for this specific template)
    const walletCooldown = cfg.wallet_limit_cooldown ? checkCooldown('wallet', cfg.wallet_limit_cooldown, cfg) : { active: false };
    const supplyCooldown = cfg.supply_limit_cooldown ? checkCooldown('supply', cfg.supply_limit_cooldown, cfg) : { active: false };

    // Check wallet purchase count
    const purchaseCount = getWalletPurchaseCount(cfg);
    const walletLimitReached = cfg.per_wallet_limit && purchaseCount >= parseInt(cfg.per_wallet_limit);

    // Determine if purchase is disabled
    const isPurchaseDisabled = walletCooldown.active || supplyCooldown.active || (walletLimitReached && !cfg.wallet_limit_cooldown);

    // Build cooldown/limit info
    let limitInfoHtml = '';
    if (cfg.per_wallet_limit) {
      if (walletCooldown.active) {
        limitInfoHtml += `<div style="font-size: 0.85rem; color: var(--warning); margin-bottom: 15px;">⏳ Cooldown: ${walletCooldown.remainingTime} remaining</div>`;
      } else if (cfg.wallet_limit_cooldown) {
        limitInfoHtml += `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Limit: ${cfg.per_wallet_limit} per ${cfg.wallet_limit_cooldown}h (${purchaseCount}/${cfg.per_wallet_limit} used)</div>`;
      } else {
        limitInfoHtml += `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Limit: ${cfg.per_wallet_limit} per wallet (${purchaseCount}/${cfg.per_wallet_limit} used)</div>`;
      }
    }

    if (supplyCooldown.active) {
      limitInfoHtml += `<div style="font-size: 0.85rem; color: var(--warning); margin-bottom: 15px;">⏳ Supply cooldown: ${supplyCooldown.remainingTime} remaining</div>`;
    }

    purchaseCard.innerHTML = `
      <div style="text-align: center;">
        <div class="nft-icon" style="margin-bottom: 15px;">
          ${mediaHtml}
        </div>
        <h3 style="margin: 15px 0 10px;">${cfg.template_name}</h3>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px;">
          Template ID: ${cfg.template_id}
        </div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin: 20px 0;">
          ${waxDisplay} WAX
        </div>
        ${cfg.max_supply ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Max Supply: ${cfg.max_supply}</div>` : ''}
        ${limitInfoHtml}
        <button class="btn btn-success purchase-btn" style="width: 100%; font-size: 1.1rem; padding: 15px;" data-template="${cfg.template_id}" ${isPurchaseDisabled ? 'disabled' : ''}>
          ${isPurchaseDisabled ? '🔒 Purchase Unavailable' : `💰 Purchase for ${waxDisplay} WAX`}
        </button>
        <div class="purchase-status" style="margin-top: 15px; min-height: 20px;"></div>
      </div>
    `;

    // Add purchase button listener
    const purchaseBtn = purchaseCard.querySelector('.purchase-btn');
    const statusEl = purchaseCard.querySelector('.purchase-status');

    purchaseBtn.addEventListener('click', () => {
      processPurchase(purchaseBtn, statusEl, cfg);
    });

    return {
      card: purchaseCard,
      hasActiveCooldown: walletCooldown.active || supplyCooldown.active
    };
  }

  // Process the purchase
  async function processPurchase(button, statusEl, cfg) {
    let paymentResult = null;

    try {
      button.disabled = true;
      button.textContent = 'Processing...';
      statusEl.innerHTML = '<div style="color: var(--primary);">⏳ Preparing transaction...</div>';

      // Step 1: User signs token transfer transaction
      statusEl.innerHTML = '<div style="color: var(--primary);">💳 Please sign the payment transaction in your wallet...</div>';

      paymentResult = await executeTokenTransfer(cfg);

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
          template_id: cfg.template_id,
          payment_transaction_id: paymentResult.transaction_id,
          price_wax: cfg.price_wax,
          payment_wallet: cfg.payment_wallet
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || 'Purchase failed');
        error.can_retry = data.can_retry;
        throw error;
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

      // Update cooldown timestamps
      if (cfg.wallet_limit_cooldown) {
        const walletCooldown = checkCooldown('wallet', cfg.wallet_limit_cooldown, cfg);
        if (!walletCooldown.active) {
          // Reset count and start new cooldown period
          resetWalletPurchaseCount(cfg);
          setLastPurchaseTime('wallet', cfg);
        }
        incrementWalletPurchaseCount(cfg);
      } else if (cfg.per_wallet_limit) {
        // No cooldown, just increment count
        incrementWalletPurchaseCount(cfg);
      }

      if (cfg.supply_limit_cooldown) {
        setLastPurchaseTime('supply', cfg);
      }

      // Reload purchase history
      if (shouldShowPurchaseHistory) {
        setTimeout(() => loadPurchaseHistory(), 2000);
      }

      // Refresh display to show updated cooldown status
      setTimeout(() => {
        displayPurchaseCard();
      }, 10000);

    } catch (error) {
      console.error('Purchase error:', error);

      // Check if we can retry (verification failed or other recoverable error)
      const canRetry = error.can_retry || (error.message && error.message.includes('verification'));

      let errorHtml = `<div style="color: var(--error);">❌ ${error.message}</div>`;

      if (canRetry && paymentResult && paymentResult.transaction_id) {
        errorHtml += `
          <button class="btn btn-sm btn-warning retry-verification-btn" data-tx-id="${paymentResult.transaction_id}" data-template-id="${cfg.template_id}" style="margin-top: 10px; font-size: 0.9rem;">
            ♻️ Retry Verification
          </button>
        `;
      }

      statusEl.innerHTML = errorHtml;

      // Add event listener to retry button if it exists
      const retryBtn = statusEl.querySelector('.retry-verification-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          const txId = retryBtn.getAttribute('data-tx-id');
          const templateId = retryBtn.getAttribute('data-template-id');
          window[`retryFailedPurchase_${containerId}`](txId, templateId);
        });
      }

      showMessage('Purchase failed: ' + error.message, 'error');
      button.disabled = false;
      button.textContent = `💰 Purchase for ${parseFloat(cfg.price_wax).toString()} WAX`;
    }

    // Global retry function (for inline retry button)
    window[`retryFailedPurchase_${containerId}`] = async (txId, templateId) => {
      try {
        // Find the config for this template
        const cfg = moduleConfigs.find(c => c.template_id === templateId) || moduleConfig;

        statusEl.innerHTML = '<div style="color: var(--primary);">♻️ Retrying verification...</div>';

        const response = await fetch(`${API_URL}/api/user/purchase/recover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            payment_transaction_id: txId,
            payment_wallet: cfg.payment_wallet
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Recovery failed');
        }

        // Success!
        statusEl.innerHTML = `
          <div style="color: var(--success); font-weight: 600;">
            ✅ Recovery successful!
          </div>
          <div style="font-size: 0.85rem; margin-top: 8px;">
            <a href="https://waxblock.io/transaction/${data.mint_transaction_id}" target="_blank" style="color: var(--primary);">
              View NFT Mint Transaction →
            </a>
          </div>
        `;

        showMessage(`🎉 Recovery completed! NFT minted successfully.`, 'success');

        // Update cooldown timestamps
        if (cfg.wallet_limit_cooldown) {
          const walletCooldown = checkCooldown('wallet', cfg.wallet_limit_cooldown, cfg);
          if (!walletCooldown.active) {
            resetWalletPurchaseCount(cfg);
            setLastPurchaseTime('wallet', cfg);
          }
          incrementWalletPurchaseCount(cfg);
        } else if (cfg.per_wallet_limit) {
          incrementWalletPurchaseCount(cfg);
        }

        if (cfg.supply_limit_cooldown) {
          setLastPurchaseTime('supply', cfg);
        }

        // Reload purchase history
        if (shouldShowPurchaseHistory) {
          setTimeout(() => loadPurchaseHistory(), 2000);
        }

        // Refresh display to show updated cooldown status
        setTimeout(() => {
          displayPurchaseCard();
        }, 10000);

      } catch (retryError) {
        console.error('Retry error:', retryError);
        statusEl.innerHTML = `
          <div style="color: var(--error);">❌ Retry failed: ${retryError.message}</div>
          <button class="btn btn-sm btn-warning retry-again-btn" data-tx-id="${txId}" data-template-id="${templateId}" style="margin-top: 10px; font-size: 0.9rem;">
            ♻️ Try Again
          </button>
        `;

        // Add event listener to retry button
        const retryAgainBtn = statusEl.querySelector('.retry-again-btn');
        if (retryAgainBtn) {
          retryAgainBtn.addEventListener('click', () => {
            const txId = retryAgainBtn.getAttribute('data-tx-id');
            const templateId = retryAgainBtn.getAttribute('data-template-id');
            window[`retryFailedPurchase_${containerId}`](txId, templateId);
          });
        }
      }
    };
  }

  // Execute token transfer transaction
  async function executeTokenTransfer(cfg) {
    const actions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{
        actor: currentAccount,
        permission: 'active',
      }],
      data: {
        from: currentAccount,
        to: cfg.payment_wallet,
        quantity: `${cfg.price_wax} WAX`,
        memo: `NFT Purchase - Template ${cfg.template_id}`
      },
    }];

    // Use global WalletManager to execute transaction
    return await window.WalletManager.transact(actions, {
      blocksBehind: 3,
      expireSeconds: 30,
    });
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

          // Show retry button for failed purchases
          const canRetry = (purchase.status === 'failed' || purchase.verification_status === 'verification_failed') &&
                          purchase.status !== 'completed';

          const retryButton = canRetry
            ? `<button class="btn btn-sm btn-warning retry-purchase-btn" data-tx-id="${purchase.payment_transaction_id}" style="margin-left: 10px; font-size: 0.75rem; padding: 4px 8px;">♻️ Retry</button>`
            : '';

          const errorMsg = purchase.error_message && canRetry
            ? `<div style="font-size: 0.75rem; color: var(--error); margin-top: 4px;">${purchase.error_message}</div>`
            : '';

          historyItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
              <div style="flex: 1;">
                <div style="font-weight: 600;">${status} Template ${purchase.template_id}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                  ${purchase.price_wax} • ${formatDate(purchase.purchased_at)}
                </div>
                ${errorMsg}
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${mintLink}
                ${retryButton}
              </div>
            </div>
          `;
          historyListEl.appendChild(historyItem);

          // Add retry button listener
          if (canRetry) {
            const retryBtn = historyItem.querySelector('.retry-purchase-btn');
            if (retryBtn) {
              retryBtn.addEventListener('click', async () => {
                await retryPurchase(purchase.payment_transaction_id, retryBtn);
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Error loading purchase history:', error);
    }
  }

  // Retry failed purchase
  async function retryPurchase(payment_transaction_id, button) {
    try {
      button.disabled = true;
      button.textContent = 'Retrying...';

      const response = await fetch(`${API_URL}/api/user/purchase/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_transaction_id: payment_transaction_id,
          payment_wallet: moduleConfig.payment_wallet
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Recovery failed');
      }

      // Success!
      showMessage(`🎉 Recovery successful! NFT minted.`, 'success');

      // Reload purchase history
      setTimeout(() => {
        loadPurchaseHistory();
      }, 1000);

    } catch (error) {
      console.error('Recovery error:', error);
      showMessage('Recovery failed: ' + error.message, 'error');
      button.disabled = false;
      button.textContent = '♻️ Retry';
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

  // Cooldown management functions
  function getCooldownKey(type, cfg) {
    return `paid_claim_cooldown_${type}_${currentAccount}_${cfg.template_id}`;
  }

  function getLastPurchaseTime(type, cfg) {
    const key = getCooldownKey(type, cfg);
    const timestamp = localStorage.getItem(key);
    return timestamp ? parseInt(timestamp) : null;
  }

  function setLastPurchaseTime(type, cfg) {
    const key = getCooldownKey(type, cfg);
    localStorage.setItem(key, Date.now().toString());
  }

  function checkCooldown(type, cooldownHours, cfg) {
    if (!cooldownHours || !currentAccount) return { active: false };

    const lastPurchase = getLastPurchaseTime(type, cfg);
    if (!lastPurchase) return { active: false };

    const cooldownMs = parseFloat(cooldownHours) * 60 * 60 * 1000; // Convert hours to milliseconds
    const elapsedMs = Date.now() - lastPurchase;
    const remainingMs = cooldownMs - elapsedMs;

    if (remainingMs > 0) {
      return {
        active: true,
        remainingMs: remainingMs,
        remainingTime: formatCooldownTime(remainingMs)
      };
    }

    return { active: false };
  }

  function formatCooldownTime(ms) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function getWalletPurchaseCount(cfg) {
    // Get count from purchase history
    if (!currentAccount) return 0;

    const key = `paid_claim_count_${currentAccount}_${cfg.template_id}`;
    const count = localStorage.getItem(key);
    return count ? parseInt(count) : 0;
  }

  function incrementWalletPurchaseCount(cfg) {
    if (!currentAccount) return;

    const key = `paid_claim_count_${currentAccount}_${cfg.template_id}`;
    const count = getWalletPurchaseCount(cfg);
    localStorage.setItem(key, (count + 1).toString());
  }

  function resetWalletPurchaseCount(cfg) {
    if (!currentAccount) return;

    const key = `paid_claim_count_${currentAccount}_${cfg.template_id}`;
    localStorage.removeItem(key);
  }
};
