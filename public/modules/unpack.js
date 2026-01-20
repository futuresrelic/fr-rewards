/**
 * Unpack Module
 * Self-contained module for unpacking mystery boxes/packs
 */

window.init_unpack = function(containerId, config = {}) {
  console.log(`✅ Unpack module initialized in #${containerId}`);
  console.log('Config:', config);

  const container = document.getElementById(containerId);
  const API_URL = window.location.origin;

  // Module state
  let currentAccount = null;
  let wax = null;
  let anchor = null;
  let currentWalletType = null;
  let userPacks = [];

  // Get module elements
  const notConnectedSection = container.querySelector('.unpack-not-connected');
  const connectedSection = container.querySelector('.unpack-connected');
  const loadingSection = container.querySelector('.unpack-loading');
  const packsSection = container.querySelector('.unpack-packs-section');
  const noPacksSection = container.querySelector('.unpack-no-packs');
  const errorSection = container.querySelector('.unpack-error');
  const connectedAccountEl = container.querySelector('.unpack-connected-account');
  const collectionInput = container.querySelector('.unpack-collection-input');
  const searchInput = container.querySelector('.unpack-search-input');
  const packsGrid = container.querySelector('.unpack-packs-grid');
  const packCountEl = container.querySelector('.unpack-pack-count');
  const unpackModal = container.querySelector('.unpack-modal');
  const processingModal = container.querySelector('.unpack-processing-modal');

  // Initialize
  (async function init() {
    await waitForLibraries();
    setupEventListeners();

    // Pre-fill collection if configured
    
    // Pre-fill template if configured
    if (config.template_id && searchInput) {
      searchInput.value = config.template_id;
    }
    if (config.collection && collectionInput) {
      collectionInput.value = config.collection;
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
    const connectWcwBtn = container.querySelector('.unpack-connect-wcw');
    const connectAnchorBtn = container.querySelector('.unpack-connect-anchor');
    const disconnectBtn = container.querySelector('.unpack-disconnect-btn');
    const loadPacksBtn = container.querySelector('.unpack-load-packs-btn');

    if (connectWcwBtn) connectWcwBtn.addEventListener('click', () => connectWallet('wcw'));
    if (connectAnchorBtn) connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
    if (loadPacksBtn) loadPacksBtn.addEventListener('click', loadUserPacks);
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
    userPacks = [];
    showNotConnectedState();
  }

  // Load user packs
  // Load user packs
  async function loadUserPacks() {
    try {
      hideError();
      loadingSection.style.display = 'block';
      packsSection.style.display = 'none';
      noPacksSection.style.display = 'none';

      const collection = collectionInput.value.trim();
      const searchTerm = searchInput.value.trim();

      if (!collection) {
        showError('Please enter a collection name');
        loadingSection.style.display = 'none';
        return;
      }

      console.log(`📦 Loading packs for ${currentAccount} in collection: ${collection}`);

      const rpc = 'https://aa-wax-public1.neftyblocks.com';
      let url = `${rpc}/atomicassets/v1/assets?owner=${currentAccount}&page=1&limit=1000&order=desc&sort=asset_id&collection_name=${collection}`;

      // Add template filter if search term is provided
      if (searchTerm) {
        url += `&template_id=${searchTerm}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }

      const ownedPacks = data.data || [];
      console.log(`📦 Found ${ownedPacks.length} owned packs`);

      // Fetch claimable packs (unpacked but not claimed) from atomicpacksx
      let claimablePacks = [];
      try {
        const claimUrl = `${API_URL}/api/user/claimable-packs/${currentAccount}`;
        const claimResponse = await fetch(claimUrl);

        if (claimResponse.ok) {
          const claimData = await claimResponse.json();
          if (claimData.success && claimData.claimable_packs) {
            claimablePacks = claimData.claimable_packs;
            console.log(`🎁 Found ${claimablePacks.length} claimable packs in atomicpacksx`);

            // Mark each as claimable and add required fields
            claimablePacks.forEach(pack => {
              pack.is_claimable = true;
              pack.asset_id = pack.pack_asset_id;
              pack.template = {
                template_id: pack.pack_template_id || 'Unknown'
              };
            });
          }
        }
      } catch (error) {
        console.warn('Could not fetch claimable packs:', error.message);
      }

      // Combine owned packs and claimable packs
      const allPacks = [...ownedPacks, ...claimablePacks];

      userPacks = allPacks;
      loadingSection.style.display = 'none';

      if (allPacks.length > 0) {
        displayPacks(allPacks);
      } else {
        noPacksSection.style.display = 'block';
      }
    } catch (error) {
      loadingSection.style.display = 'none';
      showError('Error loading packs: ' + error.message);
      console.error('Error:', error);
    }
  }

  // Check if a schema has unpack action
  async function checkIfUnpackable(collection, schemaName) {
    try {
      const rpc = 'https://aa-wax-public1.neftyblocks.com';
      const url = `${rpc}/atomicassets/v1/schemas/${collection}/${schemaName}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) return false;

      const schema = data.data;
      // Check if schema format includes unpackable or has specific attributes
      // Most unpackable items have "unpack" in their schema format or name
      const formatStr = JSON.stringify(schema.format || []).toLowerCase();
      return formatStr.includes('unpack') || schemaName.toLowerCase().includes('pack');
    } catch (error) {
      console.warn(`Could not check schema ${schemaName}:`, error);
      return false;
    }
  }

  // Display packs
  function displayPacks() {
    packCountEl.textContent = `(${userPacks.length} found)`;
    packsGrid.innerHTML = '';

    userPacks.forEach(pack => {
      const assetId = pack.asset_id;
      const name = pack.data?.name || pack.name || `Pack #${assetId}`;
      const templateId = pack.template?.template_id || 'N/A';

      // Get image/video
      let mediaHtml = '📦';
      if (pack.data?.img) {
        const imgUrl = pack.data.img.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${pack.data.img}`
          : pack.data.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<img src="${imgUrl}" alt="${name}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 6px 6px 0 0;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'height: 200px; display: flex; align-items: center; justify-content: center; font-size: 4rem;\\'>📦</div>';">`;
      } else if (pack.data?.video) {
        const videoUrl = pack.data.video.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${pack.data.video}`
          : pack.data.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<video src="${videoUrl}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 6px 6px 0 0;" autoplay loop muted playsinline></video>`;
      }

      const packCard = document.createElement('div');
      packCard.className = 'unpack-pack-card';
      packCard.style.cssText = 'background: var(--bg-dark); border-radius: 6px; border: 2px solid var(--border); transition: all 0.2s; cursor: pointer;';
      packCard.innerHTML = `
        ${mediaHtml}
        <div style="padding: 15px;">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 1rem;">${name}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
            Asset #${assetId}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
            Template #${templateId}
          </div>
          <button class="btn btn-success btn-sm" style="width: 100%;" onclick="event.stopPropagation();">
            🎁 Unpack Now
          </button>
        </div>
      `;

      // Hover effect
      packCard.addEventListener('mouseenter', () => {
        packCard.style.borderColor = 'var(--primary)';
        packCard.style.transform = 'translateY(-2px)';
      });
      packCard.addEventListener('mouseleave', () => {
        packCard.style.borderColor = 'var(--border)';
        packCard.style.transform = 'translateY(0)';
      });

      // Unpack button click
      const unpackBtn = packCard.querySelector('button');
      unpackBtn.addEventListener('click', () => showUnpackConfirmation(pack));

      packsGrid.appendChild(packCard);
    });
  }

  // Show unpack confirmation
  function showUnpackConfirmation(pack) {
    const name = pack.data?.name || pack.name || `Pack #${pack.asset_id}`;
    const modalContent = container.querySelector('.unpack-modal-content');
    const modalTitle = container.querySelector('.unpack-modal-title');

    modalTitle.textContent = 'Unpack Confirmation';
    modalContent.innerHTML = `
      <div style="margin: 20px 0;">
        <p style="margin-bottom: 15px;">You are about to unpack:</p>
        <div style="padding: 15px; background: var(--bg-dark); border-radius: 8px; margin-bottom: 15px;">
          <strong style="font-size: 1.1rem;">${name}</strong>
          <div style="color: var(--text-secondary); margin-top: 5px;">Asset #${pack.asset_id}</div>
        </div>
        <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border-left: 3px solid var(--error);">
          <strong>⚠️ Warning:</strong> Unpacking will burn this asset and reveal what's inside. This cannot be undone!
        </div>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="unpack-confirm-btn btn btn-success btn-lg" style="flex: 1;">
          🎁 Yes, Unpack!
        </button>
        <button class="unpack-cancel-btn btn btn-secondary" style="flex: 1;">
          Cancel
        </button>
      </div>
    `;

    const confirmBtn = modalContent.querySelector('.unpack-confirm-btn');
    const cancelBtn = modalContent.querySelector('.unpack-cancel-btn');

    confirmBtn.addEventListener('click', () => executeUnpack(pack));
    cancelBtn.addEventListener('click', hideUnpackModal);

    unpackModal.style.display = 'block';
  }

  // Execute unpack
  async function executeUnpack(pack) {
    try {
      hideUnpackModal();
      showProcessingModal('Unpacking...', 'Please sign the transaction in your wallet...');

      // Get wallet API
      const walletApi = currentWalletType === 'anchor' ? anchor.api : wax.api;

      // Prepare unpack transaction
      const actions = [{
        account: 'atomicassets',
        name: 'transfer',
        authorization: [{
          actor: currentAccount,
          permission: 'active'
        }],
        data: {
          from: currentAccount,
          to: 'atomicpacksx',
          asset_ids: [pack.asset_id],
          memo: 'unbox'
        }
      }];

      // Execute unpack
      const result = await walletApi.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      const txId = result.transaction_id;

      // Wait a moment for blockchain to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      showProcessingModal('✅ Unpack Complete!', `
        <p style="margin: 15px 0; color: #4ade80;">Successfully unpacked!</p>
        <p style="font-size: 0.85rem;">
          TX: <a href="https://waxblock.io/transaction/${txId}" target="_blank" style="color: var(--primary);">${txId.substr(0, 16)}...</a>
        </p>
        <p style="margin-top: 15px; color: var(--text-secondary); font-size: 0.9rem;">
          Check your wallet for the new assets! 🎉
        </p>
        <button class="btn btn-primary unpack-close-btn" style="margin-top: 15px;">Close & Refresh</button>
      `);

      // Close button
      const closeBtn = container.querySelector('.unpack-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          hideProcessingModal();
          loadUserPacks(); // Reload packs
        });
      }

    } catch (error) {
      hideProcessingModal();
      showError('Unpack failed: ' + error.message);
      console.error('Unpack error:', error);
    }
  }

  // Modal helpers
  function showUnpackModal() {
    unpackModal.style.display = 'block';
  }

  function hideUnpackModal() {
    unpackModal.style.display = 'none';
  }

  function showProcessingModal(title, content) {
    const titleEl = container.querySelector('.unpack-processing-title');
    const contentEl = container.querySelector('.unpack-processing-content');
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
