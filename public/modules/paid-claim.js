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
    wallet_limit_cooldown: config.wallet_limit_cooldown || null,
    supply_limit_cooldown: config.supply_limit_cooldown || null,
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

      // Try to restore WCW session
      if (savedWallet === 'wcw') {
        try {
          const WaxJS = window.waxjs?.WaxJS || window.WaxJS;
          if (WaxJS) {
            wax = new WaxJS({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: true });
            const autoLoginAccount = await wax.login();
            if (autoLoginAccount) {
              currentAccount = autoLoginAccount;
            } else {
              // Auto-login failed, clear saved session
              localStorage.removeItem('wax_account_paid');
              localStorage.removeItem('wax_wallet_paid');
              return;
            }
          }
        } catch (error) {
          console.warn('Could not restore WCW session:', error);
          localStorage.removeItem('wax_account_paid');
          localStorage.removeItem('wax_wallet_paid');
          return;
        }
      }

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

      // Fetch template data from AtomicAssets if name or image is missing
      if (!moduleConfig.template_name || !moduleConfig.template_image ||
          moduleConfig.template_name === 'NFT' || moduleConfig.template_image === '') {
        await fetchTemplateMetadata();
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

  // Fetch template metadata from AtomicAssets API (fallback)
  async function fetchTemplateMetadata() {
    const endpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax.api.atomicassets.io'
    ];

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}/atomicassets/v1/templates/${moduleConfig.collection_name}/${moduleConfig.template_id}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const templateData = data.data;

            // Use fetched name as fallback if not set or is default
            if (!moduleConfig.template_name || moduleConfig.template_name === 'NFT') {
              const name = templateData.immutable_data?.name || templateData.name;
              if (name) {
                moduleConfig.template_name = name;
              }
            }

            // Use fetched image/video as fallback if not set
            if (!moduleConfig.template_image || moduleConfig.template_image === '') {
              const img = templateData.immutable_data?.img ||
                         templateData.immutable_data?.image ||
                         templateData.immutable_data?.video;
              if (img) {
                // Convert IPFS hash to gateway URL
                moduleConfig.template_image = img.startsWith('Qm') ? `https://ipfs.io/ipfs/${img}` : img;
              }
            }

            console.log('✅ Fetched template metadata from AtomicAssets API');
            return;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch template from ${endpoint}:`, err);
        continue;
      }
    }

    console.warn('⚠️ Could not fetch template metadata, using configured values');
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
        mediaHtml = `<video src="${moduleConfig.template_image}" class="nft-image" autoplay loop muted playsinline preload="metadata" style="width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;"></video>`;
      } else {
        mediaHtml = `<img src="${moduleConfig.template_image}" alt="${moduleConfig.template_name}" class="nft-image" style="width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;">`;
      }
    }

    // Format WAX price for display
    const waxAmount = parseFloat(moduleConfig.price_wax).toFixed(8);
    const waxDisplay = parseFloat(waxAmount).toString(); // Remove trailing zeros for display

    // Check cooldowns
    const walletCooldown = moduleConfig.wallet_limit_cooldown ? checkCooldown('wallet', moduleConfig.wallet_limit_cooldown) : { active: false };
    const supplyCooldown = moduleConfig.supply_limit_cooldown ? checkCooldown('supply', moduleConfig.supply_limit_cooldown) : { active: false };

    // Check wallet purchase count
    const purchaseCount = getWalletPurchaseCount();
    const walletLimitReached = moduleConfig.per_wallet_limit && purchaseCount >= parseInt(moduleConfig.per_wallet_limit);

    // Determine if purchase is disabled
    const isPurchaseDisabled = walletCooldown.active || supplyCooldown.active || (walletLimitReached && !moduleConfig.wallet_limit_cooldown);

    // Build cooldown/limit info
    let limitInfoHtml = '';
    if (moduleConfig.per_wallet_limit) {
      if (walletCooldown.active) {
        limitInfoHtml += `<div style="font-size: 0.85rem; color: var(--warning); margin-bottom: 15px;">⏳ Cooldown: ${walletCooldown.remainingTime} remaining</div>`;
      } else if (moduleConfig.wallet_limit_cooldown) {
        limitInfoHtml += `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Limit: ${moduleConfig.per_wallet_limit} per ${moduleConfig.wallet_limit_cooldown}h (${purchaseCount}/${moduleConfig.per_wallet_limit} used)</div>`;
      } else {
        limitInfoHtml += `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Limit: ${moduleConfig.per_wallet_limit} per wallet (${purchaseCount}/${moduleConfig.per_wallet_limit} used)</div>`;
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
        <h3 style="margin: 15px 0 10px;">${moduleConfig.template_name}</h3>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px;">
          Template ID: ${moduleConfig.template_id}
        </div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin: 20px 0;">
          ${waxDisplay} WAX
        </div>
        ${moduleConfig.max_supply ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">Max Supply: ${moduleConfig.max_supply}</div>` : ''}
        ${limitInfoHtml}
        <button class="btn btn-success purchase-btn" style="width: 100%; font-size: 1.1rem; padding: 15px;" data-template="${moduleConfig.template_id}" ${isPurchaseDisabled ? 'disabled' : ''}>
          ${isPurchaseDisabled ? '🔒 Purchase Unavailable' : `💰 Purchase for ${waxDisplay} WAX`}
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

    // Auto-refresh cooldown display if active
    if (walletCooldown.active || supplyCooldown.active) {
      setTimeout(() => displayPurchaseCard(), 1000); // Refresh every second
    }
  }

  // Process the purchase
  async function processPurchase(button, statusEl) {
    let paymentResult = null;

    try {
      button.disabled = true;
      button.textContent = 'Processing...';
      statusEl.innerHTML = '<div style="color: var(--primary);">⏳ Preparing transaction...</div>';

      // Step 1: User signs token transfer transaction
      statusEl.innerHTML = '<div style="color: var(--primary);">💳 Please sign the payment transaction in your wallet...</div>';

      paymentResult = await executeTokenTransfer();

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
      if (moduleConfig.wallet_limit_cooldown) {
        const walletCooldown = checkCooldown('wallet', moduleConfig.wallet_limit_cooldown);
        if (!walletCooldown.active) {
          // Reset count and start new cooldown period
          resetWalletPurchaseCount();
          setLastPurchaseTime('wallet');
        }
        incrementWalletPurchaseCount();
      } else if (moduleConfig.per_wallet_limit) {
        // No cooldown, just increment count
        incrementWalletPurchaseCount();
      }

      if (moduleConfig.supply_limit_cooldown) {
        setLastPurchaseTime('supply');
      }

      // Reload purchase history
      if (moduleConfig.show_purchase_history) {
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
          <button class="btn btn-sm btn-warning" onclick="window.retryFailedPurchase('${paymentResult.transaction_id}')" style="margin-top: 10px; font-size: 0.9rem;">
            ♻️ Retry Verification
          </button>
        `;
      }

      statusEl.innerHTML = errorHtml;
      showMessage('Purchase failed: ' + error.message, 'error');
      button.disabled = false;
      button.textContent = `💰 Purchase for ${parseFloat(moduleConfig.price_wax).toString()} WAX`;
    }

    // Global retry function (for inline retry button)
    window.retryFailedPurchase = async (txId) => {
      try {
        statusEl.innerHTML = '<div style="color: var(--primary);">♻️ Retrying verification...</div>';

        const response = await fetch(`${API_URL}/api/user/purchase/recover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            payment_transaction_id: txId,
            payment_wallet: moduleConfig.payment_wallet
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
        if (moduleConfig.wallet_limit_cooldown) {
          const walletCooldown = checkCooldown('wallet', moduleConfig.wallet_limit_cooldown);
          if (!walletCooldown.active) {
            resetWalletPurchaseCount();
            setLastPurchaseTime('wallet');
          }
          incrementWalletPurchaseCount();
        } else if (moduleConfig.per_wallet_limit) {
          incrementWalletPurchaseCount();
        }

        if (moduleConfig.supply_limit_cooldown) {
          setLastPurchaseTime('supply');
        }

        // Reload purchase history
        if (moduleConfig.show_purchase_history) {
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
          <button class="btn btn-sm btn-warning" onclick="window.retryFailedPurchase('${txId}')" style="margin-top: 10px; font-size: 0.9rem;">
            ♻️ Try Again
          </button>
        `;
      }
    };
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
        quantity: `${moduleConfig.price_wax} WAX`,
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
  function getCooldownKey(type) {
    return `paid_claim_cooldown_${type}_${currentAccount}_${moduleConfig.template_id}`;
  }

  function getLastPurchaseTime(type) {
    const key = getCooldownKey(type);
    const timestamp = localStorage.getItem(key);
    return timestamp ? parseInt(timestamp) : null;
  }

  function setLastPurchaseTime(type) {
    const key = getCooldownKey(type);
    localStorage.setItem(key, Date.now().toString());
  }

  function checkCooldown(type, cooldownHours) {
    if (!cooldownHours || !currentAccount) return { active: false };

    const lastPurchase = getLastPurchaseTime(type);
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

  function getWalletPurchaseCount() {
    // Get count from purchase history
    if (!currentAccount) return 0;

    const key = `paid_claim_count_${currentAccount}_${moduleConfig.template_id}`;
    const count = localStorage.getItem(key);
    return count ? parseInt(count) : 0;
  }

  function incrementWalletPurchaseCount() {
    if (!currentAccount) return;

    const key = `paid_claim_count_${currentAccount}_${moduleConfig.template_id}`;
    const count = getWalletPurchaseCount();
    localStorage.setItem(key, (count + 1).toString());
  }

  function resetWalletPurchaseCount() {
    if (!currentAccount) return;

    const key = `paid_claim_count_${currentAccount}_${moduleConfig.template_id}`;
    localStorage.removeItem(key);
  }
};
