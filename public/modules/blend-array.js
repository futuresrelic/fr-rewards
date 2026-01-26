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
    // NOTE: WalletManager now auto-loads WaxJS when needed for transactions.
    // We don't need to wait for libraries here - they'll be loaded on-demand.
    // This function kept for compatibility but is effectively a no-op.
    console.log('ℹ️ Using WalletManager for on-demand library loading');
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
    // Wait for WalletManager to initialize
    let attempts = 0;
    while (!window.WalletManager && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.WalletManager) {
      console.warn('⚠️ WalletManager not available');
      return;
    }

    // Get state from global WalletManager
    const walletState = window.WalletManager.getState();

    if (walletState.isConnected) {
      currentAccount = walletState.account;
      currentWalletType = walletState.walletType;
      wax = walletState.wax;
      anchor = walletState.anchor;
      showConnectedState();
      console.log('✅ Session restored from WalletManager:', currentAccount);
    }
  }

  // Connect wallet (use WalletManager)
  async function connectWallet(walletType) {
    try {
      hideError();

      if (!window.WalletManager) {
        throw new Error('WalletManager not initialized. Please refresh the page.');
      }

      // Use global WalletManager to connect
      await window.WalletManager.connect(walletType);

      // Get updated state from WalletManager
      const walletState = window.WalletManager.getState();

      if (walletState.isConnected) {
        currentAccount = walletState.account;
        currentWalletType = walletState.walletType;
        wax = walletState.wax;
        anchor = walletState.anchor;
        showConnectedState();
      }
    } catch (error) {
      showError('Failed to connect wallet: ' + error.message);
      console.error('Wallet connection error:', error);
    }
  }

  // Disconnect wallet (use WalletManager)
  async function disconnect() {
    if (!window.WalletManager) {
      console.warn('WalletManager not available');
      return;
    }

    await window.WalletManager.disconnect();

    // Clear local state
    currentAccount = null;
    wax = null;
    anchor = null;
    currentWalletType = null;
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

      // Build result image display (show first result's image)
      let resultImageHtml = '';
      if (blend.results && blend.results[0]) {
        const result = blend.results[0];
        if (result.img) {
          const imgUrl = result.img.startsWith('Qm')
            ? `https://ipfs.io/ipfs/${result.img}`
            : result.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
          resultImageHtml = `
            <div style="text-align: center; margin-bottom: 15px;">
              <img src="${imgUrl}" alt="${result.name}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 2px solid var(--primary);">
            </div>
          `;
        }
      }

      // Build ingredients display with small images
      let ingredientsHtml = blend.ingredients.map(ing => {
        const hasEnough = ing.owned >= ing.amount;
        let imgHtml = '';
        if (ing.img) {
          const imgUrl = ing.img.startsWith('Qm')
            ? `https://ipfs.io/ipfs/${ing.img}`
            : ing.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
          imgHtml = `<img src="${imgUrl}" alt="${ing.name}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; margin-right: 8px;">`;
        }
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 5px;">
            <div style="display: flex; align-items: center; flex: 1;">
              ${imgHtml}
              <span style="font-size: 0.85rem;">${ing.name || `Template #${ing.template_id}`}</span>
            </div>
            <span style="color: ${hasEnough ? '#4ade80' : '#f87171'}; font-weight: 600;">${ing.owned}/${ing.amount}</span>
          </div>
        `;
      }).join('');

      // Build result display
      let resultHtml = blend.results.map(res => {
        const probability = res.total_odds ? `${((res.odds / res.total_odds) * 100).toFixed(1)}%` : '100%';
        return `<div style="color: var(--success); font-weight: 600; font-size: 0.9rem;">• ${res.name || `Template #${res.template_id}`} (${probability})</div>`;
      }).join('');

      blendCard.innerHTML = `
        ${resultImageHtml}

        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0 0 5px 0;">Blend #${blend.blend_id}</h3>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            ${canExecute ? '✅ Can Execute' : `❌ Missing ${missingCount} ingredient(s)`}
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

        // Sort by mint number DESCENDING (highest first - low mints are valuable!)
        const sortedAssets = templateAssets.sort((a, b) => {
          const mintA = parseInt(a.template_mint) || 0;
          const mintB = parseInt(b.template_mint) || 0;
          return mintB - mintA; // Descending (highest mint first)
        });

        // Show at least 5 assets or more if available (minimum of needed + 3 extra)
        const assetsToShow = Math.max(5, ing.amount + 3);
        const displayAssets = sortedAssets.slice(0, Math.min(assetsToShow, sortedAssets.length));

        const ingSection = document.createElement('div');
        ingSection.style.cssText = 'margin-bottom: 20px; padding: 15px; background: var(--bg-dark); border-radius: 8px;';

        // Get image for ingredient
        let ingImg = '';
        if (ing.img) {
          const imgUrl = ing.img.startsWith('Qm')
            ? `https://ipfs.io/ipfs/${ing.img}`
            : ing.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
          ingImg = `<img src="${imgUrl}" alt="${ing.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; margin-right: 10px; vertical-align: middle;">`;
        }

        ingSection.innerHTML = `
          <h4 style="margin: 0 0 10px 0; display: flex; align-items: center;">
            ${ingImg}
            <span>${ing.name || `Template #${ing.template_id}`} - Need ${ing.amount}</span>
          </h4>
          <div class="template-assets-grid-${ing.template_id}" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;"></div>
        `;

        ingredientsListEl.appendChild(ingSection);

        const gridEl = ingSection.querySelector(`.template-assets-grid-${ing.template_id}`);

        // Show assets for this template with images
        displayAssets.forEach(asset => {
          const assetBox = document.createElement('div');
          assetBox.className = `blend-asset-box-${asset.asset_id}`;
          assetBox.dataset.assetId = asset.asset_id;
          assetBox.dataset.templateId = ing.template_id;
          assetBox.style.cssText = `
            padding: 10px;
            background: rgba(255,255,255,0.05);
            border: 2px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            text-align: center;
            font-size: 0.75rem;
            transition: all 0.2s;
          `;

          // Get asset image
          let assetImgHtml = '';
          if (asset.data && (asset.data.img || asset.data.video)) {
            const mediaUrl = (asset.data.img || asset.data.video).startsWith('Qm')
              ? `https://ipfs.io/ipfs/${asset.data.img || asset.data.video}`
              : (asset.data.img || asset.data.video).replace('ipfs://', 'https://ipfs.io/ipfs/');

            if (asset.data.video) {
              assetImgHtml = `<video src="${mediaUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 5px;" muted loop autoplay playsinline></video>`;
            } else {
              assetImgHtml = `<img src="${mediaUrl}" alt="Asset" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 5px;">`;
            }
          }

          assetBox.innerHTML = `
            ${assetImgHtml}
            <div style="font-weight: 600; font-size: 0.7rem;">#${asset.asset_id}</div>
            <div style="color: var(--text-secondary); font-size: 0.7rem;">Mint #${asset.template_mint || 'N/A'}</div>
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

  // Extract new asset ID from transaction result
  function extractNewAssetId(result) {
    try {
      // Look through transaction traces for logmint or lognewasset action
      const traces = result.processed?.action_traces || [];

      for (const trace of traces) {
        // Check inline traces as well
        const allTraces = [trace, ...(trace.inline_traces || [])];

        for (const t of allTraces) {
          if (t.act?.account === 'atomicassets' &&
              (t.act?.name === 'logmint' || t.act?.name === 'lognewasset')) {
            // Extract asset_id from the action data
            const assetId = t.act?.data?.asset_id;
            if (assetId) {
              return assetId;
            }
          }
        }
      }

      console.warn('Could not find new asset ID in transaction result');
      return null;
    } catch (error) {
      console.error('Error extracting asset ID:', error);
      return null;
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

      // Use global WalletManager for transaction
      if (!window.WalletManager) {
        throw new Error('WalletManager not initialized. Please refresh the page.');
      }

      // Prepare NeftyBlocks blend transaction (3 actions)
      // Action 1: announcedepo - Announce deposit to contract
      // Action 2: atomicassets::transfer - Transfer assets to blend.nefty with memo "deposit"
      // Action 3: nosecfuse - Execute the blend
      const assetIdsArray = Array.from(selectedAssetIds);
      const actions = [
        {
          account: 'blend.nefty',
          name: 'announcedepo',
          authorization: [{
            actor: currentAccount,
            permission: 'active'
          }],
          data: {
            owner: currentAccount,
            count: assetIdsArray.length
          }
        },
        {
          account: 'atomicassets',
          name: 'transfer',
          authorization: [{
            actor: currentAccount,
            permission: 'active'
          }],
          data: {
            from: currentAccount,
            to: 'blend.nefty',
            asset_ids: assetIdsArray,
            memo: 'deposit'
          }
        },
        {
          account: 'blend.nefty',
          name: 'nosecfuse',
          authorization: [{
            actor: currentAccount,
            permission: 'active'
          }],
          data: {
            claimer: currentAccount,
            blend_id: parseInt(selectedBlend.blend_id),
            own_assets: [],
            transferred_assets: assetIdsArray
          }
        }
      ];

      console.log('Executing NeftyBlocks blend:', {
        blend_id: selectedBlend.blend_id,
        asset_count: assetIdsArray.length,
        assets: assetIdsArray
      });

      // Execute blend transaction using WalletManager (auto-loads full library if needed)
      const result = await window.WalletManager.transact(actions, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      const txId = result.transaction_id;
      console.log('✅ Blend successful! TX:', txId);

      // Wait a moment for blockchain to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to fetch the newly minted NFT
      let newAssetHtml = '';
      try {
        // Extract new asset ID from transaction result
        const newAssetId = extractNewAssetId(result);

        if (newAssetId) {
          console.log('🎨 Fetching new asset:', newAssetId);

          // Fetch the new asset data
          const assetResponse = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets/${newAssetId}`);
          const assetData = await assetResponse.json();

          if (assetData.success && assetData.data) {
            const asset = assetData.data;
            const imgData = asset.data?.img || asset.data?.video;

            if (imgData) {
              const imgUrl = imgData.startsWith('Qm')
                ? `https://ipfs.io/ipfs/${imgData}`
                : imgData.replace('ipfs://', 'https://ipfs.io/ipfs/');

              const assetName = asset.name || asset.data?.name || `Asset #${newAssetId}`;
              const mintNumber = asset.template_mint || 'N/A';

              newAssetHtml = `
                <div style="text-align: center; margin: 20px 0;">
                  <img src="${imgUrl}" alt="${assetName}"
                       style="max-width: 200px; max-height: 200px; object-fit: contain; border-radius: 12px; border: 3px solid var(--success); box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);">
                  <div style="margin-top: 12px; font-weight: 600; font-size: 1.1rem; color: var(--success);">${assetName}</div>
                  <div style="font-size: 0.85rem; color: var(--text-secondary);">Mint #${mintNumber}</div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">Asset #${newAssetId}</div>
                </div>
              `;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch new asset image:', error);
        // Continue without image - not critical
      }

      showProcessingModal('✅ Blend Complete!', `
        <p style="margin: 15px 0; color: #4ade80; font-weight: 600;">Successfully executed blend!</p>
        ${newAssetHtml}
        <p style="font-size: 0.85rem; margin-top: 15px;">
          TX: <a href="https://waxblock.io/transaction/${txId}" target="_blank" style="color: var(--primary);">${txId.substr(0, 16)}...</a>
        </p>
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
