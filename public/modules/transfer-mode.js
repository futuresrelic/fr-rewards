/**
 * Transfer Mode Module
 * Self-contained module for NFT transfers
 */

window.init_transfer_mode = function(containerId, config = {}) {
  console.log(`✅ Transfer Mode module initialized in #${containerId}`);
  console.log('Config:', config);

  const container = document.getElementById(containerId);
  const API_URL = window.location.origin;

  // Module state (scoped to this instance)
  let currentAccount = null;
  let wax = null;
  let anchor = null;
  let currentWalletType = null;
  let userAssets = [];
  let selectedAssetIds = new Set();

  // Get module elements
  const notConnectedSection = container.querySelector('.transfer-not-connected');
  const connectedSection = container.querySelector('.transfer-connected');
  const loadingSection = container.querySelector('.transfer-loading');
  const assetsSection = container.querySelector('.transfer-assets-section');
  const noAssetsSection = container.querySelector('.transfer-no-assets');
  const errorSection = container.querySelector('.transfer-error');
  const connectedAccountEl = container.querySelector('.transfer-connected-account');
  const recipientInput = container.querySelector('.transfer-recipient-input');
  const memoInput = container.querySelector('.transfer-memo-input');
  const collectionFilterInput = container.querySelector('.transfer-collection-filter');
  const assetsGrid = container.querySelector('.transfer-assets-grid');
  const assetCountEl = container.querySelector('.transfer-asset-count');
  const selectedCountEl = container.querySelector('.transfer-selected-count');
  const processingModal = container.querySelector('.transfer-processing-modal');

  // Initialize
  (async function init() {
    await waitForLibraries();
    setupEventListeners();

    // Pre-fill collection if configured
    if (config.collection && collectionFilterInput) {
      collectionFilterInput.value = config.collection;
    }

    // Auto-connect if configured
    if (config.auto_connect) {
      checkExistingSession();
    }
  })();

  // Wait for wallet libraries to load
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
    const connectWcwBtn = container.querySelector('.transfer-connect-wcw');
    const connectAnchorBtn = container.querySelector('.transfer-connect-anchor');
    const disconnectBtn = container.querySelector('.transfer-disconnect-btn');
    const loadAssetsBtn = container.querySelector('.transfer-load-assets-btn');
    const selectAllBtn = container.querySelector('.transfer-select-all-btn');
    const clearSelectionBtn = container.querySelector('.transfer-clear-selection-btn');
    const sendBtn = container.querySelector('.transfer-send-btn');

    if (connectWcwBtn) connectWcwBtn.addEventListener('click', () => connectWallet('wcw'));
    if (connectAnchorBtn) connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
    if (loadAssetsBtn) loadAssetsBtn.addEventListener('click', loadUserAssets);
    if (selectAllBtn) selectAllBtn.addEventListener('click', selectAll);
    if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', clearSelection);
    if (sendBtn) sendBtn.addEventListener('click', sendTransfer);
  }

  // Check for existing session (use WalletManager)
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
    selectedAssetIds.clear();
    showNotConnectedState();
  }

  // Load user assets
  async function loadUserAssets() {
    try {
      hideError();
      loadingSection.style.display = 'block';
      assetsSection.style.display = 'none';
      noAssetsSection.style.display = 'none';

      const collectionFilter = collectionFilterInput.value.trim();

      // Use AtomicAssets API to fetch user's NFTs
      const rpc = 'https://aa-wax-public1.neftyblocks.com';
      let url = `${rpc}/atomicassets/v1/assets?owner=${currentAccount}&page=1&limit=1000&order=desc&sort=asset_id`;

      if (collectionFilter) {
        url += `&collection_name=${collectionFilter}`;
      }

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
    assetsGrid.innerHTML = '';

    userAssets.forEach(asset => {
      const assetId = asset.asset_id;
      const templateId = asset.template?.template_id || 'N/A';
      const name = asset.data?.name || asset.name || `Asset #${assetId}`;

      // Get image/video
      let mediaHtml = '📦';
      if (asset.data?.img) {
        const imgUrl = asset.data.img.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${asset.data.img}`
          : asset.data.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<img src="${imgUrl}" alt="${name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px 6px 0 0;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'height: 150px; display: flex; align-items: center; justify-content: center; font-size: 3rem;\\'>📦</div>';">`;
      } else if (asset.data?.video) {
        const videoUrl = asset.data.video.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${asset.data.video}`
          : asset.data.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<video src="${videoUrl}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px 6px 0 0;" autoplay loop muted playsinline></video>`;
      }

      const assetCard = document.createElement('div');
      assetCard.className = 'transfer-asset-card';
      assetCard.dataset.assetId = assetId;
      assetCard.style.cssText = 'background: var(--bg-dark); border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;';
      assetCard.innerHTML = `
        ${mediaHtml}
        <div style="padding: 10px;">
          <div style="font-weight: 600; margin-bottom: 5px; font-size: 0.9rem;">${name}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">
            Asset #${assetId}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">
            Template #${templateId}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">
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
    const card = container.querySelector(`.transfer-asset-card[data-asset-id="${assetId}"]`);
    if (!card) return;

    if (selectedAssetIds.has(assetId)) {
      selectedAssetIds.delete(assetId);
      card.style.borderColor = 'transparent';
      card.style.background = 'var(--bg-dark)';
    } else {
      selectedAssetIds.add(assetId);
      card.style.borderColor = 'var(--primary)';
      card.style.background = 'rgba(59, 130, 246, 0.1)';
    }

    updateSelectedCount();
  }

  // Select all assets
  function selectAll() {
    userAssets.forEach(asset => {
      selectedAssetIds.add(asset.asset_id);
      const card = container.querySelector(`.transfer-asset-card[data-asset-id="${asset.asset_id}"]`);
      if (card) {
        card.style.borderColor = 'var(--primary)';
        card.style.background = 'rgba(59, 130, 246, 0.1)';
      }
    });
    updateSelectedCount();
  }

  // Clear selection
  function clearSelection() {
    selectedAssetIds.clear();
    container.querySelectorAll('.transfer-asset-card').forEach(card => {
      card.style.borderColor = 'transparent';
      card.style.background = 'var(--bg-dark)';
    });
    updateSelectedCount();
  }

  // Update selected count
  function updateSelectedCount() {
    selectedCountEl.textContent = selectedAssetIds.size;
    const sendBtn = container.querySelector('.transfer-send-btn');
    if (sendBtn) {
      sendBtn.disabled = selectedAssetIds.size === 0;
    }
  }

  // Validate WAX account name
  function isValidWaxAccount(account) {
    return /^[a-z1-5.]{1,12}$/.test(account);
  }

  // Send transfer
  async function sendTransfer() {
    try {
      hideError();

      // Validate recipient
      const recipient = recipientInput.value.trim();
      if (!recipient) {
        showError('Please enter a recipient wallet address');
        return;
      }

      if (!isValidWaxAccount(recipient)) {
        showError('Invalid WAX account name. Must be 1-12 characters (a-z, 1-5, and .)');
        return;
      }

      if (recipient === currentAccount) {
        showError('Cannot send to yourself!');
        return;
      }

      if (selectedAssetIds.size === 0) {
        showError('Please select at least one NFT to send');
        return;
      }

      const memo = memoInput.value.trim() || '';
      const assetIds = Array.from(selectedAssetIds);

      showProcessingModal('Preparing Transfer', 'Please sign the transaction in your wallet...');

      // Use global WalletManager for transaction
      if (!window.WalletManager) {
        throw new Error('WalletManager not initialized. Please refresh the page.');
      }

      // Prepare transfer transaction
      const actions = [{
        account: 'atomicassets',
        name: 'transfer',
        authorization: [{
          actor: currentAccount,
          permission: 'active'
        }],
        data: {
          from: currentAccount,
          to: recipient,
          asset_ids: assetIds,
          memo: memo
        }
      }];

      // Execute transfer using WalletManager (auto-loads full library if needed)
      const result = await window.WalletManager.transact(actions, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      const txId = result.transaction_id;

      showProcessingModal('✅ Transfer Complete!', `
        <p style="margin: 15px 0; color: #4ade80;">Successfully sent ${assetIds.length} NFT(s) to ${recipient}!</p>
        <p style="font-size: 0.85rem;">
          TX: <a href="https://waxblock.io/transaction/${txId}" target="_blank" style="color: var(--primary);">${txId.substr(0, 16)}...</a>
        </p>
        <button class="btn btn-primary transfer-close-modal-btn" style="margin-top: 15px;">Close</button>
      `);

      // Add close button listener
      const closeBtn = container.querySelector('.transfer-close-modal-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          hideProcessingModal();
          clearSelection();
          loadUserAssets(); // Reload assets
        });
      }

    } catch (error) {
      hideProcessingModal();
      showError('Transfer failed: ' + error.message);
      console.error('Transfer error:', error);
    }
  }

  // Modal helpers
  function showProcessingModal(title, content) {
    const titleEl = container.querySelector('.transfer-processing-title');
    const contentEl = container.querySelector('.transfer-processing-content');
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
