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
    // Wait for WaxJS to load (check multiple possible export names)
    let waxAttempts = 0;
    while (!(window.waxjs || window.WaxJS) && waxAttempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      waxAttempts++;
    }

    if (window.waxjs || window.WaxJS) {
      console.log('✅ WaxJS loaded');
    } else {
      console.error('❌ WaxJS not loaded after waiting');
    }

    // Wait for Anchor to load
    let anchorAttempts = 0;
    while (!window.AnchorWallet && anchorAttempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      anchorAttempts++;
    }

    if (window.AnchorWallet) {
      console.log('✅ Anchor wallet loaded');
    } else {
      console.warn('⚠️ Anchor wallet not loaded after waiting');
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
            showConnectedState();
          } else {
            // Session couldn't be restored, clear storage
            localStorage.removeItem('wax_account');
            localStorage.removeItem('wax_wallet');
          }
        } catch (error) {
          console.warn('Could not restore Anchor session:', error);
          localStorage.removeItem('wax_account');
          localStorage.removeItem('wax_wallet');
          return;
        }
      } else if (savedWallet === 'wcw') {
        // Initialize WaxJS for auto-login
        const WaxLib = window.waxjs || window.WaxJS;
        if (WaxLib) {
          try {
            wax = new WaxLib.WaxJS({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: true });
            const autoLoginAccount = await wax.login();
            if (autoLoginAccount === savedAccount) {
              currentAccount = autoLoginAccount;
              showConnectedState();
            } else {
              // Account mismatch, clear storage
              localStorage.removeItem('wax_account');
              localStorage.removeItem('wax_wallet');
            }
          } catch (error) {
            console.warn('Could not auto-login with WaxJS:', error);
            localStorage.removeItem('wax_account');
            localStorage.removeItem('wax_wallet');
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
    const WaxLib = window.waxjs || window.WaxJS;
    if (!WaxLib) throw new Error('WaxJS not loaded');

    wax = new WaxLib.WaxJS({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: false });
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

  // Display packs (matches packs.html beautiful layout)
  function displayPacks(packs) {
    packCountEl.textContent = `(${packs.length} found)`;
    packsGrid.innerHTML = '';
    packsSection.style.display = 'block';

    // Group packs by template
    const packsByTemplate = {};
    packs.forEach(pack => {
      const templateId = pack.template?.template_id || 'unknown';
      if (!packsByTemplate[templateId]) {
        packsByTemplate[templateId] = {
          template: pack.template,
          assets: []
        };
      }
      packsByTemplate[templateId].assets.push(pack);
    });

    // Display each template group
    Object.values(packsByTemplate).forEach(({ template, assets }) => {
      const packCard = document.createElement('div');
      packCard.className = 'nft-card';
      packCard.style.marginBottom = '25px';

      // Get pack image/video
      const packData = template?.immutable_data || assets[0]?.data || {};
      let mediaHtml = '📦';

      if (packData.video) {
        const videoUrl = packData.video.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${packData.video}`
          : packData.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<video src="${videoUrl}" class="nft-image" autoplay loop muted playsinline onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size: 4rem;\\'>📦</div>';"></video>`;
      } else if (packData.img) {
        const imgUrl = packData.img.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${packData.img}`
          : packData.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
        mediaHtml = `<img src="${imgUrl}" alt="${packData.name || 'Pack'}" class="nft-image" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size: 4rem;\\'>📦</div>';">`;
      }

      packCard.innerHTML = `
        <div class="nft-header">
          <div class="nft-icon">
            ${mediaHtml}
          </div>
          <div class="nft-info">
            <div class="nft-name">
              ${packData.name || 'Pack'}
              <span class="quantity-badge">×${assets.length}</span>
            </div>
            <div class="nft-template">Template ID: ${template?.template_id || 'Unknown'}</div>
          </div>
        </div>
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
          <h4 style="margin-bottom: 15px; color: var(--text-secondary); font-size: 0.95rem;">Available Packs:</h4>
          <div class="pack-instances" id="pack-instances-${template?.template_id || 'unknown'}"></div>
        </div>
      `;

      packsGrid.appendChild(packCard);

      // Add individual pack buttons
      const instancesContainer = packCard.querySelector(`#pack-instances-${template?.template_id || 'unknown'}`);
      assets.forEach((asset, index) => {
        const packInstance = document.createElement('div');
        packInstance.style.marginBottom = '10px';

        const isClaimable = asset.is_claimable === true;
        const rollCount = asset.roll_count || 0;

        packInstance.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div>
              <div style="font-size: 0.9rem; color: var(--text-secondary);">
                Pack #${index + 1}
                ${isClaimable ? `<span style="color: orange; margin-left: 8px;">● ${rollCount} rolls ready</span>` : ''}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Asset ID: ${asset.asset_id}</div>
              ${isClaimable ? '<div style="font-size: 0.75rem; color: orange; margin-top: 3px;">Already unpacked - click to claim contents</div>' : ''}
            </div>
            <button class="btn btn-sm ${isClaimable ? 'btn-warning' : 'btn-success'}" style="min-width: 160px;">
              ${isClaimable ? '🎁 Claim Contents' : '📦 Unpack'}
            </button>
          </div>
        `;

        instancesContainer.appendChild(packInstance);

        // Add event listener
        const actionBtn = packInstance.querySelector('button');
        if (isClaimable) {
          actionBtn.addEventListener('click', () => claimPack(asset, packData.name || 'Pack', packData, actionBtn));
        } else {
          actionBtn.addEventListener('click', () => showUnpackConfirmation(asset, packData.name || 'Pack'));
        }
      });
    });
  }

  // Show unpack confirmation
  function showUnpackConfirmation(pack, packName) {
    const name = packName || pack.data?.name || pack.name || `Pack #${pack.asset_id}`;
    const modalContent = container.querySelector('.unpack-modal-content');
    const modalTitle = container.querySelector('.unpack-modal-title');

    // Get pack image
    const packData = pack.template?.immutable_data || pack.data || {};
    let packImageHtml = '';
    if (packData.video) {
      const videoUrl = packData.video.startsWith('Qm')
        ? `https://ipfs.io/ipfs/${packData.video}`
        : packData.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
      packImageHtml = `<video src="${videoUrl}" style="width: 180px; height: 180px; object-fit: cover; border-radius: 8px; margin: 0 auto 20px; display: block;" autoplay loop muted playsinline></video>`;
    } else if (packData.img) {
      const imgUrl = packData.img.startsWith('Qm')
        ? `https://ipfs.io/ipfs/${packData.img}`
        : packData.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
      packImageHtml = `<img src="${imgUrl}" alt="${name}" style="width: 180px; height: 180px; object-fit: cover; border-radius: 8px; margin: 0 auto 20px; display: block;">`;
    } else {
      packImageHtml = `<div style="width: 180px; height: 180px; display: flex; align-items: center; justify-content: center; font-size: 4rem; margin: 0 auto 20px; background: var(--bg-dark); border-radius: 8px;">📦</div>`;
    }

    modalTitle.textContent = 'Unpack Confirmation';
    modalContent.innerHTML = `
      <div style="margin: 20px 0;">
        ${packImageHtml}
        <p style="margin-bottom: 15px;">You are about to unpack:</p>
        <div style="padding: 15px; background: var(--bg-dark); border-radius: 8px; margin-bottom: 15px;">
          <strong style="font-size: 1.1rem;">${name}</strong>
          <div style="color: var(--text-secondary); margin-top: 5px;">Asset #${pack.asset_id}</div>
          <div style="color: var(--text-secondary); margin-top: 5px;">Template #${pack.template?.template_id || 'Unknown'}</div>
        </div>
        <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border-left: 3px solid var(--error);">
          <strong>⚠️ Warning:</strong> Unpacking will transfer this pack to atomicpacksx and reveal what's inside!
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

    confirmBtn.addEventListener('click', () => executeUnpack(pack, name, packData));
    cancelBtn.addEventListener('click', hideUnpackModal);

    unpackModal.style.display = 'block';
  }

  // Execute unpack
  async function executeUnpack(pack, packName, packData) {
    try {
      hideUnpackModal();
      showProcessingModal('Unpacking...', 'Please sign the transaction in your wallet...');

      // Check wallet is connected
      if (!currentAccount || !currentWalletType) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      if (currentWalletType === 'anchor' && !anchor) {
        throw new Error('Anchor wallet not initialized. Please reconnect your wallet.');
      }

      if (currentWalletType === 'wcw' && !wax) {
        throw new Error('WaxJS wallet not initialized. Please reconnect your wallet.');
      }

      // Get wallet API
      const walletApi = currentWalletType === 'anchor' ? anchor.api : wax.api;

      // Prepare unpack transaction (transfer to atomicpacksx with memo 'unbox')
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
        expireSeconds: 90
      });

      const txId = result.transaction_id || result.transactionId || 'completed';

      // Wait for blockchain to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Build pack image HTML for success modal
      let packImageHtml = '';
      if (packData && packData.video) {
        const videoUrl = packData.video.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${packData.video}`
          : packData.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
        packImageHtml = `<video src="${videoUrl}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; margin: 0 auto 15px; display: block;" autoplay loop muted playsinline></video>`;
      } else if (packData && packData.img) {
        const imgUrl = packData.img.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${packData.img}`
          : packData.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
        packImageHtml = `<img src="${imgUrl}" alt="${packName}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; margin: 0 auto 15px; display: block;">`;
      } else {
        packImageHtml = `<div style="width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; font-size: 3rem; margin: 0 auto 15px; background: var(--bg-dark); border-radius: 8px;">📦</div>`;
      }

      showProcessingModal('✅ Unpack Complete!', `
        ${packImageHtml}
        <p style="margin: 15px 0; color: #4ade80; font-size: 1.1rem;">Successfully unpacked ${packName}!</p>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">Template #${pack.template?.template_id || 'Unknown'}</p>
        <p style="font-size: 0.85rem; margin-top: 15px;">
          TX: <a href="https://waxblock.io/transaction/${txId}" target="_blank" style="color: var(--primary);">${txId.substr(0, 16)}...</a>
        </p>
        <p style="margin-top: 15px; color: var(--text-secondary); font-size: 0.9rem;">
          The pack has been unpacked! Reload to claim the contents. 🎉
        </p>
        <button class="btn btn-primary unpack-close-btn" style="margin-top: 15px; width: 100%;">Close & Refresh</button>
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

  // Claim pack contents that have already been unpacked
  async function claimPack(asset, packName, packData, button) {
    try {
      button.disabled = true;
      button.textContent = 'Claiming...';

      console.log(`🎁 Claiming ${packName} (Asset ID: ${asset.asset_id})`);

      // Check wallet is connected
      if (!currentAccount || !currentWalletType) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      if (currentWalletType === 'anchor' && !anchor) {
        throw new Error('Anchor wallet not initialized. Please reconnect your wallet.');
      }

      if (currentWalletType === 'wcw' && !wax) {
        throw new Error('WaxJS wallet not initialized. Please reconnect your wallet.');
      }

      const rollIds = asset.roll_ids || [];

      // Fetch unbox details to see what we're claiming
      let claimableAssets = [];
      try {
        const unboxResponse = await fetch(`${API_URL}/api/pack/unbox-details/${asset.asset_id}`);
        if (unboxResponse.ok) {
          const unboxData = await unboxResponse.json();
          if (unboxData.success && unboxData.assets) {
            claimableAssets = unboxData.assets;
            console.log(`📦 Will claim ${claimableAssets.length} assets:`, claimableAssets);
          }
        }
      } catch (err) {
        console.warn('Could not fetch unbox details:', err);
      }

      // Get wallet API
      const walletApi = currentWalletType === 'anchor' ? anchor.api : wax.api;

      // Prepare claim transaction
      const actions = [{
        account: 'atomicpacksx',
        name: 'claimunboxed',
        authorization: [{
          actor: currentAccount,
          permission: 'active'
        }],
        data: {
          pack_asset_id: asset.asset_id.toString(),
          origin_roll_ids: rollIds
        }
      }];

      // Execute claim
      const result = await walletApi.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 90
      });

      const txId = result.transaction_id || result.transactionId || 'completed';

      // Success!
      button.textContent = '✅ Claimed!';
      button.style.background = '#4ade80';

      // Build pack image HTML
      let packImageHtml = '';
      if (packData && packData.video) {
        const videoUrl = packData.video.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${packData.video}`
          : packData.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
        packImageHtml = `<video src="${videoUrl}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; margin: 0 auto 15px; display: block;" autoplay loop muted playsinline></video>`;
      } else if (packData && packData.img) {
        const imgUrl = packData.img.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${packData.img}`
          : packData.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
        packImageHtml = `<img src="${imgUrl}" alt="${packName}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; margin: 0 auto 15px; display: block;">`;
      } else {
        packImageHtml = `<div style="width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; font-size: 3rem; margin: 0 auto 15px; background: var(--bg-dark); border-radius: 8px;">📦</div>`;
      }

      // Build claimed assets display HTML
      let assetsHtml = '';
      if (claimableAssets.length > 0) {
        assetsHtml = '<div style="margin-bottom: 10px; padding-bottom: 15px; border-bottom: 1px solid var(--border);"><p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 15px;">Claimed NFTs:</p><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">';
        claimableAssets.forEach(nft => {
          let mediaHtml = '🎁';
          if (nft.video) {
            const videoUrl = nft.video.startsWith('Qm')
              ? `https://ipfs.io/ipfs/${nft.video}`
              : nft.video.replace('ipfs://', 'https://ipfs.io/ipfs/');
            mediaHtml = `<video src="${videoUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px;" autoplay loop muted playsinline></video>`;
          } else if (nft.img) {
            const imgUrl = nft.img.startsWith('Qm')
              ? `https://ipfs.io/ipfs/${nft.img}`
              : nft.img.replace('ipfs://', 'https://ipfs.io/ipfs/');
            mediaHtml = `<img src="${imgUrl}" alt="${nft.name}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px;">`;
          }

          assetsHtml += `
            <div style="background: var(--bg-dark); border-radius: 8px; padding: 10px; text-align: center;">
              ${mediaHtml}
              <div style="margin-top: 8px; font-size: 0.85rem; font-weight: 600;">${nft.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">Template #${nft.template_id}</div>
            </div>
          `;
        });
        assetsHtml += '</div></div>';
      }

      showProcessingModal('✅ Claim Complete!', `
        ${packImageHtml}
        <p style="margin: 0 0 20px; color: #4ade80; font-size: 1.1rem;">Successfully claimed ${rollIds.length} NFT${rollIds.length > 1 ? 's' : ''} from ${packName}!</p>
        ${assetsHtml}
        <p style="font-size: 0.85rem; margin-top: 15px;">
          TX: <a href="https://waxblock.io/transaction/${txId}" target="_blank" style="color: var(--primary);">${txId.substr(0, 16)}...</a>
        </p>
        <button class="btn btn-primary unpack-close-btn" style="margin-top: 15px; width: 100%;">Close & Refresh</button>
      `);

      // Close button with refresh
      const closeBtn = container.querySelector('.unpack-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          hideProcessingModal();
          // Reload with multiple attempts (API needs time to update)
          let attempts = 0;
          const reloadInterval = setInterval(async () => {
            attempts++;
            console.log(`🔄 Refreshing pack list (attempt ${attempts}/3)...`);
            await loadUserPacks();

            if (attempts >= 3) {
              clearInterval(reloadInterval);
            }
          }, 4000);
        });
      }

    } catch (error) {
      button.disabled = false;
      button.textContent = '🎁 Claim Contents';
      hideProcessingModal();
      showError('Claim failed: ' + error.message);
      console.error('Claim error:', error);
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
