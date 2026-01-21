/**
 * Blend Array Module - Enhanced with NeftyBlocks Integration
 * Auto-detects available blends from NeftyBlocks schemas
 */

window.init_blend_array = function(containerId, config = {}) {
  console.log(`✅ Blend Array module initialized in #${containerId}`);
  console.log('Config:', config);

  const container = document.getElementById(containerId);
  const API_URL = window.location.origin;

  // Module state
  let currentAccount = null;
  let wax = null;
  let anchor = null;
  let currentWalletType = null;
  let userAssets = [];
  let availableBlends = [];
  let selectedBlend = null;
  let selectedAssetIds = new Set();

  // Get module elements
  const notConnectedSection = container.querySelector('.blend-not-connected');
  const connectedSection = container.querySelector('.blend-connected');
  const loadingSection = container.querySelector('.blend-loading');
  const blendsSection = container.querySelector('.blend-blends-section');
  const assetSelectionSection = container.querySelector('.blend-asset-selection');
  const noBlendsSection = container.querySelector('.blend-no-blends');
  const errorSection = container.querySelector('.blend-error');
  const connectedAccountEl = container.querySelector('.blend-connected-account');
  const collectionInput = container.querySelector('.blend-collection-input');
  const blendIdsInput = container.querySelector('.blend-ids-input');
  const blendsGrid = container.querySelector('.blend-blends-grid');
  const assetsGrid = container.querySelector('.blend-assets-grid');
  const processingModal = container.querySelector('.blend-processing-modal');

  // Initialize
  (async function init() {
    await waitForLibraries();
    setupEventListeners();

    // Pre-fill if configured
    if (config.collection && collectionInput) {
      collectionInput.value = config.collection;
    }
    if (config.blend_ids && blendIdsInput) {
      // Handle both string and array formats
      blendIdsInput.value = Array.isArray(config.blend_ids)
        ? config.blend_ids.join(',')
        : config.blend_ids;
    }

    // ALWAYS check for existing session to persist login
    checkExistingSession();
  })();

  // Wait for wallet libraries
  async function waitForLibraries() {
    if (window.WaxJS || window.waxjs?.WaxJS) {
      console.log('✅ WaxJS loaded');
    } else {
      console.error('❌ WaxJS not loaded');
    }

    let attempts = 0;
    while (!window.AnchorWallet && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.AnchorWallet) {
      console.log('✅ Anchor wallet loaded');
    } else {
      console.warn('⚠️ Anchor wallet not loaded');
    }

    return true;
  }

  // Setup event listeners
  function setupEventListeners() {
    const connectWcwBtn = container.querySelector('.blend-connect-wcw');
    const connectAnchorBtn = container.querySelector('.blend-connect-anchor');
    const disconnectBtn = container.querySelector('.blend-disconnect-btn');
    const loadBlendsBtn = container.querySelector('.blend-load-blends-btn');
    const backBtn = container.querySelector('.blend-back-btn');
    const executeBtn = container.querySelector('.blend-execute-btn');

    if (connectWcwBtn) connectWcwBtn.addEventListener('click', () => connectWallet('wcw'));
    if (connectAnchorBtn) connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
    if (loadBlendsBtn) loadBlendsBtn.addEventListener('click', loadBlends);
    if (backBtn) backBtn.addEventListener('click', () => showBlendsSection());
    if (executeBtn) executeBtn.addEventListener('click', executeBlend);
  }

  // Check for existing session
  async function checkExistingSession() {
    const savedAccount = localStorage.getItem('wax_account');
    const savedWallet = localStorage.getItem('wax_wallet');

    if (savedAccount && savedWallet) {
      currentAccount = savedAccount;
      currentWalletType = savedWallet;

      if (savedWallet === 'anchor' && window.AnchorWallet) {
        try {
          const restored = await window.AnchorWallet.restoreSession();
          if (restored) {
            anchor = window.AnchorWallet;
            currentAccount = restored;
            showConnectedState();
            console.log('✅ Auto-logged in with Anchor:', currentAccount);
          }
        } catch (error) {
          console.log('⚠️ Anchor auto-login not available');
          return;
        }
      } else if (savedWallet === 'wcw') {
        // Initialize WaxJS for auto-login
        const WaxLib = window.waxjs?.WaxJS || window.WaxJS;
        if (WaxLib) {
          try {
            wax = new WaxLib({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: true });
            const autoLoginAccount = await wax.login();
            if (autoLoginAccount) {
              currentAccount = autoLoginAccount;
              if (autoLoginAccount !== savedAccount) {
                localStorage.setItem('wax_account', autoLoginAccount);
              }
              showConnectedState();
              console.log('✅ Auto-logged in with WCW:', currentAccount);
            }
          } catch (error) {
            console.log('⚠️ WCW auto-login not available');
          }
        }
      }
    }
  }

  // Connect wallet
  async function connectWallet(walletType) {
    try {
      hideError();

      if (walletType === 'wcw') {
        await connectWCW();
      } else if (walletType === 'anchor') {
        await connectAnchor();
      }

      if (currentAccount) {
        currentWalletType = walletType;
        localStorage.setItem('wax_account', currentAccount);
        localStorage.setItem('wax_wallet', walletType);
        showConnectedState();
      }
    } catch (error) {
      showError('Failed to connect wallet: ' + error.message);
      console.error('Wallet connection error:', error);
    }
  }

  // Connect WCW
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
    localStorage.removeItem('wax_account');
    localStorage.removeItem('wax_wallet');
    userAssets = [];
    availableBlends = [];
    showNotConnectedState();
  }

  // Load blends from NeftyBlocks
  async function loadBlends() {
    try {
      hideError();

      const collection = collectionInput.value.trim();
      if (!collection) {
        showError('Please enter a collection name');
        return;
      }

      const blendIdsStr = blendIdsInput.value.trim();
      if (!blendIdsStr) {
        showError('Please enter blend IDs (comma-separated)');
        return;
      }

      const blendIds = blendIdsStr.split(',').map(id => id.trim()).filter(id => id);
      if (blendIds.length === 0) {
        showError('Please enter at least one blend ID');
        return;
      }

      loadingSection.style.display = 'block';
      blendsSection.style.display = 'none';
      noBlendsSection.style.display = 'none';

      // Fetch user's assets
      console.log(`📦 Fetching assets for ${currentAccount} from ${collection}...`);
      const assetsResponse = await fetch(`${API_URL}/api/assets/${currentAccount}?collection_name=${collection}&live=true`);
      const assetsData = await assetsResponse.json();

      if (!assetsData.success) {
        throw new Error('Failed to fetch assets');
      }

      userAssets = assetsData.data || [];
      console.log(`✅ Loaded ${userAssets.length} assets`);

      // Fetch blend schemas from NeftyBlocks
      console.log(`🔍 Fetching ${blendIds.length} blend schemas from NeftyBlocks...`);
      const blendsResponse = await fetch(`${API_URL}/api/blends/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: collection,
          blend_ids: blendIds,
          account: currentAccount
        })
      });

      const blendsData = await blendsResponse.json();

      if (!blendsResponse.ok) {
        throw new Error(blendsData.error || 'Failed to fetch blend data');
      }

      availableBlends = blendsData.blends || [];
      console.log(`✅ Analyzed ${availableBlends.length} blends`);

      loadingSection.style.display = 'none';

      if (availableBlends.length === 0) {
        noBlendsSection.style.display = 'block';
        return;
      }

      displayBlends();
      blendsSection.style.display = 'block';

    } catch (error) {
      loadingSection.style.display = 'none';
      showError('Failed to load blends: ' + error.message);
      console.error('Error loading blends:', error);
    }
  }

  // Display available blends
  function displayBlends() {
    blendsGrid.innerHTML = '';

    availableBlends.forEach(blend => {
      const canExecute = blend.can_execute;
      const missingCount = blend.missing_ingredients?.length || 0;

      const blendCard = document.createElement('div');
      blendCard.className = 'blend-blend-card';
      blendCard.style.cssText = `
        background: var(--bg-dark);
        border-radius: 8px;
        padding: 20px;
        border: 2px solid ${canExecute ? 'var(--success)' : 'var(--border)'};
        cursor: ${canExecute ? 'pointer' : 'not-allowed'};
        opacity: ${canExecute ? '1' : '0.6'};
        transition: all 0.2s;
      `;

      if (canExecute) {
        blendCard.addEventListener('mouseenter', () => {
          blendCard.style.transform = 'translateY(-2px)';
          blendCard.style.borderColor = 'var(--primary)';
        });
        blendCard.addEventListener('mouseleave', () => {
          blendCard.style.transform = 'translateY(0)';
          blendCard.style.borderColor = 'var(--success)';
        });
        blendCard.addEventListener('click', () => selectBlend(blend));
      }

      // Build ingredients display
      let ingredientsHtml = blend.ingredients.map(ing => {
        const hasEnough = ing.owned >= ing.amount;
        return `
          <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 5px;">
            <span>${ing.name || `Template #${ing.template_id}`}</span>
            <span style="color: ${hasEnough ? '#4ade80' : '#f87171'};">${ing.owned}/${ing.amount}</span>
          </div>
        `;
      }).join('');

      // Build result display
      let resultHtml = blend.results.map(res => {
        const probability = res.total_odds ? `${((res.odds / res.total_odds) * 100).toFixed(1)}%` : '100%';
        return `<div style="color: var(--success); font-weight: 600;">• ${res.name || `Template #${res.template_id}`} (${probability})</div>`;
      }).join('');

      blendCard.innerHTML = `
        <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 15px;">
          <div>
            <h3 style="margin: 0 0 5px 0;">Blend #${blend.blend_id}</h3>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              ${canExecute ? '✅ Can Execute' : `❌ Missing ${missingCount} ingredient(s)`}
            </div>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: var(--text-secondary);">Ingredients:</h4>
          ${ingredientsHtml}
        </div>

        <div>
          <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: var(--text-secondary);">Result:</h4>
          ${resultHtml}
        </div>

        ${canExecute ? `
          <button class="btn btn-success btn-sm" style="width: 100%; margin-top: 15px;" onclick="event.stopPropagation();">
            🔀 Select This Blend
          </button>
        ` : ''}
      `;

      blendsGrid.appendChild(blendCard);
    });
  }

  // Select a blend and show asset selection
  function selectBlend(blend) {
    selectedBlend = blend;
    selectedAssetIds.clear();

    const blendNameEl = container.querySelector('.blend-selected-name');
    const ingredientsListEl = container.querySelector('.blend-ingredients-list');
    const selectedCountEl = container.querySelector('.blend-selected-count');
    const requiredCountEl = container.querySelector('.blend-required-count');

    if (blendNameEl) blendNameEl.textContent = `Blend #${blend.blend_id}`;

    // Calculate total required assets
    const totalRequired = blend.ingredients.reduce((sum, ing) => sum + ing.amount, 0);
    if (requiredCountEl) requiredCountEl.textContent = totalRequired;
    if (selectedCountEl) selectedCountEl.textContent = '0';

    // Group user assets by template ID
    const assetsByTemplate = {};
    userAssets.forEach(asset => {
      const templateId = asset.template?.template_id;
      if (templateId) {
        if (!assetsByTemplate[templateId]) {
          assetsByTemplate[templateId] = [];
        }
        assetsByTemplate[templateId].push(asset);
      }
    });

    // Display ingredients with asset selection
    if (ingredientsListEl) {
      ingredientsListEl.innerHTML = '';

      blend.ingredients.forEach(ing => {
        const templateAssets = assetsByTemplate[ing.template_id] || [];

        const ingSection = document.createElement('div');
        ingSection.style.cssText = 'margin-bottom: 20px; padding: 15px; background: var(--bg-dark); border-radius: 8px;';
        ingSection.innerHTML = `
          <h4 style="margin: 0 0 10px 0;">Template #${ing.template_id} - Need ${ing.amount}</h4>
          <div class="template-assets-grid-${ing.template_id}" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;"></div>
        `;

        ingredientsListEl.appendChild(ingSection);

        const gridEl = ingSection.querySelector(`.template-assets-grid-${ing.template_id}`);

        // Show assets for this template
        templateAssets.slice(0, ing.amount * 2).forEach(asset => {
          const assetBox = document.createElement('div');
          assetBox.className = `blend-asset-box-${asset.asset_id}`;
          assetBox.dataset.assetId = asset.asset_id;
          assetBox.dataset.templateId = ing.template_id;
          assetBox.style.cssText = `
            padding: 8px;
            background: rgba(255,255,255,0.05);
            border: 2px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            text-align: center;
            font-size: 0.75rem;
            transition: all 0.2s;
          `;

          assetBox.innerHTML = `
            <div style="font-weight: 600;">#${asset.asset_id}</div>
            <div style="color: var(--text-secondary);">Mint #${asset.template_mint || 'N/A'}</div>
          `;

          assetBox.addEventListener('click', () => toggleAssetSelection(asset, ing));

          gridEl.appendChild(assetBox);
        });
      });
    }

    showAssetSelectionSection();
  }

  // Toggle asset selection
  function toggleAssetSelection(asset, ingredient) {
    const assetBox = container.querySelector(`.blend-asset-box-${asset.asset_id}`);
    if (!assetBox) return;

    // Count how many of this template are already selected
    const selectedFromTemplate = Array.from(selectedAssetIds).filter(id => {
      const box = container.querySelector(`.blend-asset-box-${id}`);
      return box && box.dataset.templateId === ingredient.template_id.toString();
    }).length;

    if (selectedAssetIds.has(asset.asset_id)) {
      // Deselect
      selectedAssetIds.delete(asset.asset_id);
      assetBox.style.borderColor = 'transparent';
      assetBox.style.background = 'rgba(255,255,255,0.05)';
    } else {
      // Check if we can select more of this template
      if (selectedFromTemplate >= ingredient.amount) {
        showError(`Can only select ${ingredient.amount} of Template #${ingredient.template_id}`);
        return;
      }

      selectedAssetIds.add(asset.asset_id);
      assetBox.style.borderColor = 'var(--primary)';
      assetBox.style.background = 'rgba(59, 130, 246, 0.2)';
    }

    updateSelectionCount();
  }

  // Update selection count
  function updateSelectionCount() {
    const selectedCountEl = container.querySelector('.blend-selected-count');
    const executeBtn = container.querySelector('.blend-execute-btn');

    if (selectedCountEl) {
      selectedCountEl.textContent = selectedAssetIds.size;
    }

    const totalRequired = selectedBlend.ingredients.reduce((sum, ing) => sum + ing.amount, 0);

    if (executeBtn) {
      executeBtn.disabled = selectedAssetIds.size !== totalRequired;
    }
  }

  // Execute blend
  async function executeBlend() {
    try {
      hideError();

      if (!selectedBlend) {
        showError('No blend selected');
        return;
      }

      const totalRequired = selectedBlend.ingredients.reduce((sum, ing) => sum + ing.amount, 0);
      if (selectedAssetIds.size !== totalRequired) {
        showError(`Please select exactly ${totalRequired} assets`);
        return;
      }

      showProcessingModal('Executing Blend', 'Please sign the transaction in your wallet...');

      // Get wallet API
      const walletApi = currentWalletType === 'anchor' ? anchor.api : wax.api;

      // Prepare blend transaction for NeftyBlocks contract
      const assetIdsArray = Array.from(selectedAssetIds);
      const actions = [{
        account: 'blend.nefty',
        name: 'claimblend',
        authorization: [{
          actor: currentAccount,
          permission: 'active'
        }],
        data: {
          claimer: currentAccount,
          blend_id: parseInt(selectedBlend.blend_id),
          asset_ids: assetIdsArray
        }
      }];

      console.log('Executing NeftyBlocks blend:', {
        blend_id: selectedBlend.blend_id,
        asset_count: assetIdsArray.length,
        assets: assetIdsArray
      });

      // Execute blend transaction
      const result = await walletApi.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      const txId = result.transaction_id;
      console.log('✅ Blend successful! TX:', txId);

      // Wait a moment for blockchain to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      showProcessingModal('✅ Blend Complete!', `
        <p style="margin: 15px 0; color: #4ade80;">Successfully executed blend!</p>
        <p style="font-size: 0.85rem;">
          TX: <a href="https://waxblock.io/transaction/${txId}" target="_blank" style="color: var(--primary);">${txId.substr(0, 16)}...</a>
        </p>
        <p style="margin-top: 10px;">Check your wallet for the new NFT! 🎉</p>
        <button class="btn btn-primary blend-close-btn" style="margin-top: 15px;">Close & Refresh</button>
      `);

      const closeBtn = container.querySelector('.blend-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          hideProcessingModal();
          loadBlends(); // Reload
        });
      }

    } catch (error) {
      hideProcessingModal();
      showError('Blend failed: ' + error.message);
      console.error('Blend error:', error);
    }
  }

  // Section navigation
  function showBlendsSection() {
    blendsSection.style.display = 'block';
    assetSelectionSection.style.display = 'none';
  }

  function showAssetSelectionSection() {
    blendsSection.style.display = 'none';
    assetSelectionSection.style.display = 'block';
  }

  // Modal helpers
  function showProcessingModal(title, content) {
    const titleEl = container.querySelector('.blend-processing-title');
    const contentEl = container.querySelector('.blend-processing-content');
    if (titleEl) titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = content;
    processingModal.style.display = 'block';
  }

  function hideProcessingModal() {
    processingModal.style.display = 'none';
  }

  // UI State functions
  function showNotConnectedState() {
    notConnectedSection.style.display = 'block';
    connectedSection.style.display = 'none';
  }

  function showConnectedState() {
    notConnectedSection.style.display = 'none';
    connectedSection.style.display = 'block';
    if (connectedAccountEl) connectedAccountEl.textContent = currentAccount;

    // If blend_ids are configured, auto-load blends
    if (config.blend_ids && config.collection) {
      setTimeout(() => {
        loadBlends();
      }, 100);
    }
  }

  function showError(message) {
    if (!errorSection) return;
    errorSection.textContent = message;
    errorSection.style.display = 'block';

    setTimeout(() => {
      errorSection.style.display = 'none';
    }, 5000);
  }

  function hideError() {
    if (errorSection) errorSection.style.display = 'none';
  }
};
