// Pack Unpacking System
// Handles connecting to WAX wallet and unpacking NFT packs

const API_URL = window.location.origin;

// Pack template IDs (can be configured later via admin panel)
const PACK_TEMPLATES = [204194]; // Help Wanted pack

// DOM Elements
const notConnectedSection = document.getElementById('not-connected');
const connectedSection = document.getElementById('connected');
const loadingSection = document.getElementById('loading');
const packsSection = document.getElementById('packs-section');
const noPacksSection = document.getElementById('no-packs');
const packListEl = document.getElementById('pack-list');
const packCountEl = document.getElementById('pack-count');
const connectedAccountEl = document.getElementById('connected-account');
const errorMessage = document.getElementById('error-message');

// State
let currentAccount = null;
let wax = null;
let anchor = null;
let currentWalletType = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📦 Pack unpacking page loaded');

  // Load branding
  await loadPublicConfig();

  // Wait for wallet libraries to load
  await waitForLibraries();

  // Connect wallet buttons
  document.getElementById('connect-wcw').addEventListener('click', () => connectWallet('wcw'));
  document.getElementById('connect-anchor').addEventListener('click', () => connectWallet('anchor'));
  document.getElementById('disconnect-btn').addEventListener('click', disconnectWallet);

  // Check for existing session
  await checkExistingSession();
});

// Wait for wallet libraries to load
async function waitForLibraries() {
  // Wait for WaxJS to load (check multiple possible export names)
  let waxAttempts = 0;
  while (!(window.waxjs || window.WaxJS) && waxAttempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    waxAttempts++;
  }

  const WaxLib = window.waxjs || window.WaxJS;

  if (WaxLib) {
    console.log('✅ WaxJS loaded');
    // Initialize WaxJS instance
    window.waxInstance = new WaxLib.WaxJS({
      rpcEndpoint: 'https://wax.greymass.com',
      tryAutoLogin: false
    });
  } else {
    console.error('❌ WaxJS not loaded. Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('wax')));
  }

  // Wait a bit for Anchor to load (it loads async)
  let anchorAttempts = 0;
  while (!window.AnchorWallet && anchorAttempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    anchorAttempts++;
  }

  if (window.AnchorWallet) {
    console.log('✅ Anchor wallet loaded');
  } else {
    console.warn('⚠️ Anchor wallet not available');
  }
}

// Load public branding config
async function loadPublicConfig() {
  try {
    const response = await fetch(`${API_URL}/api/config/public`);
    const config = await response.json();

    // Apply branding
    if (config.branding) {
      if (config.branding.title) {
        document.getElementById('page-title').textContent = `📦 ${config.branding.title} - Unpack`;
      }
      if (config.branding.subtitle) {
        document.getElementById('page-subtitle').textContent = config.branding.subtitle;
      }
      if (config.branding.logo_url) {
        const logo = document.getElementById('page-logo');
        logo.src = config.branding.logo_url;
        logo.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Check for existing session
async function checkExistingSession() {
  const savedAccount = localStorage.getItem('wax_account');
  const savedWallet = localStorage.getItem('wax_wallet');

  if (savedAccount && savedWallet) {
    console.log(`Found saved session: ${savedAccount} (${savedWallet})`);
    try {
      // Try auto-login
      if (savedWallet === 'wcw') {
        if (window.waxInstance) {
          wax = window.waxInstance;
          const isAvailable = await wax.isAutoLoginAvailable();
          if (isAvailable) {
            currentAccount = wax.userAccount;
            currentWalletType = 'wcw';
            showConnectedState();
            await loadUserPacks();
          }
        }
      } else if (savedWallet === 'anchor') {
        if (window.AnchorWallet) {
          anchor = window.AnchorWallet;
          const restored = await anchor.restoreSession();
          if (restored) {
            currentAccount = savedAccount;
            currentWalletType = 'anchor';
            showConnectedState();
            await loadUserPacks();
          }
        }
      }
    } catch (error) {
      console.log('Auto-login failed, user will need to reconnect:', error.message);
    }
  }
}

// Connect wallet
async function connectWallet(walletType) {
  try {
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
      await loadUserPacks();
    }
  } catch (error) {
    console.error('Connection error:', error);
    showError('Failed to connect wallet: ' + error.message);
  }
}

// Connect Wax Cloud Wallet
async function connectWCW() {
  if (!window.waxInstance) throw new Error('WAX API not loaded');

  wax = window.waxInstance;
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
async function disconnectWallet() {
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
  showNotConnectedState();
}

// Load user's packs
async function loadUserPacks() {
  try {
    loadingSection.style.display = 'block';
    packsSection.style.display = 'none';
    noPacksSection.style.display = 'none';

    // Fetch packs from backend API (avoids CORS issues)
    const response = await fetch(`${API_URL}/api/user/packs/${currentAccount}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch packs: ${response.statusText}`);
    }

    const data = await response.json();
    const packs = data.packs || [];

    loadingSection.style.display = 'none';

    if (packs.length > 0) {
      displayPacks(packs);
    } else {
      noPacksSection.style.display = 'block';
    }
  } catch (error) {
    loadingSection.style.display = 'none';
    showError('Error loading packs: ' + error.message);
    console.error('Error:', error);
  }
}

// Display packs
function displayPacks(packs) {
  packsSection.style.display = 'block';
  packListEl.innerHTML = '';

  // Count unique templates
  const packsByTemplate = {};
  packs.forEach(pack => {
    const templateId = pack.template.template_id;
    if (!packsByTemplate[templateId]) {
      packsByTemplate[templateId] = {
        template: pack.template,
        assets: []
      };
    }
    packsByTemplate[templateId].assets.push(pack);
  });

  packCountEl.textContent = `You have ${packs.length} pack${packs.length > 1 ? 's' : ''}!`;

  // Display each pack template
  Object.values(packsByTemplate).forEach(({ template, assets }) => {
    const packCard = document.createElement('div');
    packCard.className = 'nft-card';

    // Get pack image/video
    const packData = template.immutable_data || {};
    let mediaHtml = '📦';

    if (packData.video) {
      const videoUrl = packData.video.startsWith('Qm')
        ? `https://ipfs.io/ipfs/${packData.video}`
        : packData.video;
      mediaHtml = `<video src="${videoUrl}" class="nft-image" autoplay loop muted playsinline onerror="this.style.display='none'; this.parentElement.innerHTML='📦';"></video>`;
    } else if (packData.img) {
      const imgUrl = packData.img.startsWith('Qm')
        ? `https://ipfs.io/ipfs/${packData.img}`
        : packData.img;
      mediaHtml = `<img src="${imgUrl}" alt="${packData.name}" class="nft-image" onerror="this.style.display='none'; this.parentElement.innerHTML='📦';">`;
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
          <div class="nft-template">Template ID: ${template.template_id}</div>
        </div>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
        <h4 style="margin-bottom: 15px; color: var(--text-secondary); font-size: 0.95rem;">Available Packs:</h4>
        <div class="pack-instances" id="pack-instances-${template.template_id}"></div>
      </div>
    `;

    packListEl.appendChild(packCard);

    // Add individual pack buttons
    const instancesContainer = packCard.querySelector(`#pack-instances-${template.template_id}`);
    assets.forEach((asset, index) => {
      const packInstance = document.createElement('div');
      packInstance.style.marginBottom = '10px';
      packInstance.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div>
            <div style="font-size: 0.9rem; color: var(--text-secondary);">Pack #${index + 1}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Asset ID: ${asset.asset_id}</div>
          </div>
          <button class="btn btn-sm btn-success unpack-btn" data-asset-id="${asset.asset_id}" data-asset-name="${packData.name || 'Pack'}">
            🎁 Unpack
          </button>
        </div>
      `;
      instancesContainer.appendChild(packInstance);

      // Add event listener
      const unpackBtn = packInstance.querySelector('.unpack-btn');
      unpackBtn.addEventListener('click', () => unpackPack(asset.asset_id, packData.name || 'Pack', unpackBtn));
    });
  });
}

// Unpack a pack by transferring to atomicpacksx
async function unpackPack(assetId, packName, button) {
  try {
    button.disabled = true;
    button.textContent = 'Unpacking...';

    console.log(`🎁 Unpacking ${packName} (Asset ID: ${assetId})`);

    let transactionId;

    if (currentWalletType === 'anchor' && anchor) {
      const result = await anchor.transact({
        actions: [{
          account: 'atomicassets',
          name: 'transfer',
          authorization: [{
            actor: currentAccount,
            permission: 'active'
          }],
          data: {
            from: currentAccount,
            to: 'atomicpacksx',
            asset_ids: [assetId],
            memo: 'unbox'
          }
        }]
      }, {
        blocksBehind: 3,
        expireSeconds: 90
      });
      transactionId = result.transaction_id || result.transactionId || result.processed?.id;
    } else if (currentWalletType === 'wcw') {
      // Use official WaxJS API
      const result = await wax.api.transact({
        actions: [{
          account: 'atomicassets',
          name: 'transfer',
          authorization: [{
            actor: wax.userAccount,
            permission: 'active'
          }],
          data: {
            from: wax.userAccount,
            to: 'atomicpacksx',
            asset_ids: [assetId],
            memo: 'unbox'
          }
        }]
      }, {
        blocksBehind: 3,
        expireSeconds: 1200
      });
      transactionId = result.transaction_id || 'completed';
    } else {
      throw new Error('No wallet connected');
    }

    showError(`Success! Pack unpacked. TX: ${transactionId}`, 'success');

    // Reload packs after a delay
    setTimeout(() => loadUserPacks(), 3000);

  } catch (error) {
    console.error('Unpack error:', error);
    showError('Unpack failed: ' + (error.message || 'Unknown error'));
    button.disabled = false;
    button.textContent = '🎁 Unpack';
  }
}

// UI State functions
function showNotConnectedState() {
  notConnectedSection.style.display = 'block';
  connectedSection.style.display = 'none';
}

function showConnectedState() {
  notConnectedSection.style.display = 'none';
  connectedSection.style.display = 'block';
  connectedAccountEl.textContent = currentAccount;
}

function showError(message, type = 'error') {
  errorMessage.textContent = message;
  errorMessage.className = `alert alert-${type}`;
  errorMessage.style.display = 'block';

  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
