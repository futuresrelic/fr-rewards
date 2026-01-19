/**
 * Blend Array Module
 * Self-contained module for flexible NFT blending
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
  let selectedAssetIds = new Set();
  let requiredCount = 3;

  // Get module elements
  const notConnectedSection = container.querySelector('.blend-not-connected');
  const connectedSection = container.querySelector('.blend-connected');
  const loadingSection = container.querySelector('.blend-loading');
  const assetsSection = container.querySelector('.blend-assets-section');
  const noAssetsSection = container.querySelector('.blend-no-assets');
  const errorSection = container.querySelector('.blend-error');
  const connectedAccountEl = container.querySelector('.blend-connected-account');
  const collectionInput = container.querySelector('.blend-collection-input');
  const resultTemplateInput = container.querySelector('.blend-result-template-input');
  const requiredCountInput = container.querySelector('.blend-required-count-input');
  const assetsGrid = container.querySelector('.blend-assets-grid');
  const assetCountEl = container.querySelector('.blend-asset-count');
  const selectedCountEl = container.querySelector('.blend-selected-count');
  const requiredCountEl = container.querySelector('.blend-required-count');
  const processingModal = container.querySelector('.blend-processing-modal');

  // Initialize
  (async function init() {
    await waitForLibraries();
    setupEventListeners();

    // Pre-fill if configured
    if (config.collection && collectionInput) {
      collectionInput.value = config.collection;
    }
    if (config.result_template && resultTemplateInput) {
      resultTemplateInput.value = config.result_template;
    }
    if (config.required_count && requiredCountInput) {
      requiredCountInput.value = config.required_count;
      requiredCount = config.required_count;
    }

    // Auto-connect if configured
    if (config.auto_connect) {
      checkExistingSession();
    }
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
    const loadAssetsBtn = container.querySelector('.blend-load-assets-btn');
    const clearSelectionBtn = container.querySelector('.blend-clear-selection-btn');
    const executeBtn = container.querySelector('.blend-execute-btn');

    if (connectWcwBtn) connectWcwBtn.addEventListener('click', () => connectWallet('wcw'));
    if (connectAnchorBtn) connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
    if (loadAssetsBtn) loadAssetsBtn.addEventListener('click', loadUserAssets);
    if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', clearSelection);
    if (executeBtn) executeBtn.addEventListener('click', executeBlend);

    if (requiredCountInput) {
      requiredCountInput.addEventListener('change', (e) => {
        requiredCount = parseInt(e.target.value) || 3;
        updateRequiredCount();
      });
    }
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
          }
        } catch (error) {
          console.warn('Could not restore Anchor session:', error);
          localStorage.removeItem('wax_account');
          localStorage.removeItem('wax_wallet');
          return;
        }
      }

      showConnectedState();
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
    selectedAssetIds.clear();
    showNotConnectedState();
  }

  // Load user assets
  async function loadUserAssets() {
    try {
      hideError();

      const collection = collectionInput.value.trim();
      if (!collection) {
        showError('Please enter a collection name');
        return;
      }

      const resultTemplate = resultTemplateInput.value.trim();
      if (!resultTemplate) {
        showError('Please enter a result template ID');
        return;
      }

      requiredCount = parseInt(requiredCountInput.value) || 3;
      if (requiredCount < 2) {
        showError('Required count must be at least 2');
        return;
      }

      loadingSection.style.display = 'block';
      assetsSection.style.display = 'none';
      noAssetsSection.style.display = 'none';

      // Fetch user's assets
      const rpc = 'https://aa-wax-public1.neftyblocks.com';
      let url = `${rpc}/atomicassets/v1/assets?owner=${currentAccount}&collection_name=${collection}&page=1&limit=1000&order=desc&sort=asset_id`;

      console.log(`Fetching assets from: ${url}`);
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }

      userAssets = data.data || [];

      loadingSection.style.display = 'none';

      if (userAssets.length === 0) {
        noAssetsSection.style.display = 'block';
        return;
      }

      displayAssets();
      assetsSection.style.display = 'block';

    } catch (error) {
      loadingSection.style.display = 'none';
      showError('Failed to load assets: ' + error.message);
      console.error('Error loading assets:', error);
    }
  }

  // Display assets
  function displayAssets() {
    assetCountEl.textContent = `(${userAssets.length} found)`;
    requiredCountEl.textContent = requiredCount;
    assetsGrid.innerHTML = '';

    userAssets.forEach(asset => {
      const assetId = asset.asset_id;
      const name = asset.data?.name || asset.name || `Asset #${assetId}`;
      const templateId = asset.template?.template_id || 'N/A';

      // Get image/video
      let mediaHtml = '📦';
      if (asset.data?.img) {
        const imgUrl = asset.data.img.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${asset.data.img}`
          : asset.data.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<img src="${imgUrl}" alt="${name}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px 6px 0 0;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'height: 120px; display: flex; align-items: center; justify-content: center; font-size: 2rem;\\'>📦</div>';">`;
      } else if (asset.data?.video) {
        const videoUrl = asset.data.video.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${asset.data.video}`
          : asset.data.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<video src="${videoUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px 6px 0 0;" autoplay loop muted playsinline></video>`;
      }

      const assetCard = document.createElement('div');
      assetCard.className = 'blend-asset-card';
      assetCard.dataset.assetId = assetId;
      assetCard.style.cssText = 'background: var(--bg-dark); border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;';
      assetCard.innerHTML = `
        ${mediaHtml}
        <div style="padding: 8px;">
          <div style="font-weight: 600; margin-bottom: 3px; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">
            #${assetId}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">
            Mint #${asset.template_mint || 'N/A'}
          </div>
        </div>
      `;

      assetCard.addEventListener('click', () => toggleAssetSelection(assetId));
      assetsGrid.appendChild(assetCard);
    });

    updateSelectedCount();
  }

  // Toggle asset selection
  function toggleAssetSelection(assetId) {
    const card = container.querySelector(`.blend-asset-card[data-asset-id="${assetId}"]`);
    if (!card) return;

    if (selectedAssetIds.has(assetId)) {
      selectedAssetIds.delete(assetId);
      card.style.borderColor = 'transparent';
      card.style.background = 'var(--bg-dark)';
    } else {
      // Check if we can add more
      if (selectedAssetIds.size >= requiredCount) {
        showError(`You can only select ${requiredCount} NFTs for this blend`);
        return;
      }
      selectedAssetIds.add(assetId);
      card.style.borderColor = 'var(--primary)';
      card.style.background = 'rgba(59, 130, 246, 0.1)';
    }

    updateSelectedCount();
  }

  // Clear selection
  function clearSelection() {
    selectedAssetIds.clear();
    container.querySelectorAll('.blend-asset-card').forEach(card => {
      card.style.borderColor = 'transparent';
      card.style.background = 'var(--bg-dark)';
    });
    updateSelectedCount();
  }

  // Update selected count
  function updateSelectedCount() {
    selectedCountEl.textContent = selectedAssetIds.size;
    const executeBtn = container.querySelector('.blend-execute-btn');
    if (executeBtn) {
      executeBtn.disabled = selectedAssetIds.size !== requiredCount;
    }
  }

  // Update required count
  function updateRequiredCount() {
    requiredCountEl.textContent = requiredCount;
    clearSelection();
  }

  // Execute blend
  async function executeBlend() {
    try {
      hideError();

      const collection = collectionInput.value.trim();
      const resultTemplate = parseInt(resultTemplateInput.value.trim());

      if (!collection || !resultTemplate) {
        showError('Please fill in collection and result template');
        return;
      }

      if (selectedAssetIds.size !== requiredCount) {
        showError(`Please select exactly ${requiredCount} NFTs`);
        return;
      }

      showProcessingModal('Step 1: Burning NFTs', 'Please sign the transaction in your wallet...');

      // Get wallet API
      const walletApi = currentWalletType === 'anchor' ? anchor.api : wax.api;

      // Prepare burn actions for all selected assets
      const assetIds = Array.from(selectedAssetIds);
      const burnActions = assetIds.map(assetId => ({
        account: 'atomicassets',
        name: 'burnasset',
        authorization: [{
          actor: currentAccount,
          permission: 'active'
        }],
        data: {
          asset_owner: currentAccount,
          asset_id: assetId
        }
      }));

      // Execute burns
      const burnResult = await walletApi.transact({ actions: burnActions }, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      const burnTxId = burnResult.transaction_id;
      console.log(`✅ Burned ${assetIds.length} NFTs: ${burnTxId}`);

      // Wait for blockchain confirmation
      showProcessingModal('Step 2: Minting Result', 'Creating your new NFT...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Call backend to mint result
      const mintResponse = await fetch(`${API_URL}/api/blend/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: currentAccount,
          collection: collection,
          template_id: resultTemplate,
          burn_transaction_id: burnTxId,
          burned_asset_ids: assetIds
        })
      });

      const mintData = await mintResponse.json();

      if (!mintResponse.ok) {
        throw new Error(mintData.error || 'Mint failed');
      }

      showProcessingModal('✅ Blend Complete!', `
        <p style="margin: 15px 0; color: #4ade80;">Successfully blended ${assetIds.length} NFTs!</p>
        <p style="font-size: 0.85rem;">
          Burn TX: <a href="https://waxblock.io/transaction/${burnTxId}" target="_blank" style="color: var(--primary);">${burnTxId.substr(0, 16)}...</a>
        </p>
        <p style="font-size: 0.85rem;">
          Mint TX: <a href="https://waxblock.io/transaction/${mintData.transaction_id}" target="_blank" style="color: var(--primary);">${mintData.transaction_id.substr(0, 16)}...</a>
        </p>
        <button class="btn btn-primary blend-close-btn" style="margin-top: 15px;">Close & Refresh</button>
      `);

      // Close button
      const closeBtn = container.querySelector('.blend-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          hideProcessingModal();
          clearSelection();
          loadUserAssets();
        });
      }

    } catch (error) {
      hideProcessingModal();
      showError('Blend failed: ' + error.message);
      console.error('Blend error:', error);
    }
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
