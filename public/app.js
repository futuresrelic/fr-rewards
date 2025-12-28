const API_URL = window.location.origin;

// State
let currentAccount = null;
let wax = null;
let anchor = null;
let currentWalletType = null;
let config = null;
let countdownIntervals = [];

// Elements
const notConnectedSection = document.getElementById('not-connected');
const connectedSection = document.getElementById('connected');
const loadingSection = document.getElementById('loading');
const eligibleSection = document.getElementById('eligible');
const notEligibleSection = document.getElementById('not-eligible');
const errorMessage = document.getElementById('error-message');
const connectedAccountEl = document.getElementById('connected-account');
const nftListEl = document.getElementById('nft-list');
const historyListEl = document.getElementById('history-list');
const whitelistInfoEl = document.getElementById('whitelist-info');
const claimHistorySection = document.getElementById('claim-history');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadPublicConfig();
  await waitForLibraries();
  setupEventListeners();
  checkExistingSession();
});

// Wait for wallet libraries to load
async function waitForLibraries() {
  // Check WaxJS
  if (window.WaxJS) {
    console.log('✅ WaxJS loaded');
  } else {
    console.error('❌ WaxJS not loaded');
  }

  // Wait a bit for Anchor to load (it loads async)
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

// Load public configuration
async function loadPublicConfig() {
  try {
    const response = await fetch(`${API_URL}/api/config/public`);
    const data = await response.json();
    if (data.success) {
      config = data.config;

      // Apply branding
      if (config.page_title) {
        document.getElementById('page-title').textContent = config.page_title;
        document.title = config.page_title;
      }
      if (config.page_subtitle) {
        document.getElementById('page-subtitle').textContent = config.page_subtitle;
      }
      if (config.logo_url) {
        const logoImg = document.getElementById('page-logo');
        logoImg.src = config.logo_url;
        logoImg.alt = config.page_title || 'Logo';
        logoImg.style.display = 'block';
      }
      // Update favicon if configured
      if (config.favicon_url) {
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = config.favicon_url;
      }
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('connect-wcw').addEventListener('click', () => connectWallet('wcw'));
  document.getElementById('connect-anchor').addEventListener('click', () => connectWallet('anchor'));
  document.getElementById('disconnect-btn').addEventListener('click', disconnect);
}

// Check for existing session
async function checkExistingSession() {
  const savedAccount = localStorage.getItem('wax_account');
  const savedWallet = localStorage.getItem('wax_wallet');

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
        // Clear invalid session
        localStorage.removeItem('wax_account');
        localStorage.removeItem('wax_wallet');
        return;
      }
    }

    showConnectedState();
    loadUserData();
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
      await loadUserData();
    }
  } catch (error) {
    showError('Failed to connect wallet: ' + error.message);
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
  localStorage.removeItem('wax_account');
  localStorage.removeItem('wax_wallet');
  clearCountdowns();
  showNotConnectedState();
}

// Load user data
async function loadUserData() {
  try {
    // Clear existing countdowns before refreshing
    clearCountdowns();

    loadingSection.style.display = 'block';
    eligibleSection.style.display = 'none';
    notEligibleSection.style.display = 'none';

    const [eligibilityData, cooldownData, claimsData] = await Promise.all([
      fetch(`${API_URL}/api/user/eligibility/${currentAccount}`).then(r => r.json()),
      fetch(`${API_URL}/api/user/cooldowns/${currentAccount}`).then(r => r.json()),
      fetch(`${API_URL}/api/user/claims/${currentAccount}`).then(r => r.json())
    ]);

    loadingSection.style.display = 'none';

    if (eligibilityData.eligible) {
      showEligibleState(eligibilityData, cooldownData, claimsData);
    } else {
      showNotEligibleState(eligibilityData);
    }
  } catch (error) {
    loadingSection.style.display = 'none';
    showError('Error loading user data: ' + error.message);
    console.error('Error:', error);
  }
}

// Show eligible state
function showEligibleState(eligibilityData, cooldownData, claimsData) {
  eligibleSection.style.display = 'block';
  nftListEl.innerHTML = '';

  // Build cooldown map by template_id + reward_id
  const cooldownMap = {};
  cooldownData.cooldowns.forEach(cd => {
    const key = `${cd.template_id}-${cd.reward_id}`;
    cooldownMap[key] = cd;
  });

  // Display each eligible template with its rewards
  eligibilityData.eligibleAssets.forEach(asset => {
    const templateId = parseInt(asset.template_id);
    const quantity = asset.quantity_owned;

    const nftCard = document.createElement('div');
    nftCard.className = 'nft-card';

    // Get image/video URLs
    const nftMediaUrl = asset.image_url;
    const isVideo = asset.is_video;

    // Build media element (video or image)
    let nftMediaHtml = '📦';
    if (nftMediaUrl) {
      if (isVideo) {
        nftMediaHtml = `<video src="${nftMediaUrl}" class="nft-image" autoplay loop muted playsinline onerror="this.style.display='none'; this.parentElement.innerHTML='📦';"></video>`;
      } else {
        nftMediaHtml = `<img src="${nftMediaUrl}" alt="NFT" class="nft-image" onerror="this.style.display='none'; this.parentElement.innerHTML='📦';">`;
      }
    }

    // Build rewards buttons
    let rewardsHtml = '';
    if (asset.rewards && asset.rewards.length > 0) {
      asset.rewards.forEach((reward, index) => {
        const cooldownKey = `${templateId}-${reward.reward_id}`;
        const cooldown = cooldownMap[cooldownKey];
        const canClaim = cooldown ? cooldown.can_claim : true;
        const remainingSeconds = cooldown ? cooldown.remaining_seconds : 0;

        const rewardName = reward.reward_name || `Template #${reward.reward_template_id}`;
        const quantityInfo = reward.match_quantity ? `×${reward.available_quantity}` : `(max ${reward.max_claims || 1})`;

        rewardsHtml += `
          <div style="margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
              ${reward.reward_image_url
                ? `<img src="${reward.reward_image_url}" alt="${rewardName}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: rgba(16, 185, 129, 0.1); padding: 2px;">`
                : ''}
              <div>
                <div style="font-weight: 600;">${rewardName}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                  ${quantityInfo} • ${reward.cooldown_hours}h cooldown
                </div>
              </div>
            </div>
            <div class="nft-status ${canClaim ? 'ready' : 'cooldown'}" style="margin-bottom: 8px;">
              ${canClaim ? '✅ Ready to claim!' : `⏰ Next claim in: <span class="countdown reward-countdown-${templateId}-${reward.reward_id}" data-seconds="${remainingSeconds}"></span>`}
            </div>
            <button class="btn btn-sm ${canClaim ? 'btn-success' : 'btn-primary'} reward-claim-btn"
                    data-template="${templateId}"
                    data-reward="${reward.reward_id}"
                    ${canClaim ? '' : 'disabled'}>
              ${canClaim ? `🎁 Claim ${rewardName}` : 'Cooldown Active'}
            </button>
          </div>
        `;
      });
    } else {
      rewardsHtml = '<p style="color: var(--text-secondary); font-size: 0.9rem;">No rewards configured for this template.</p>';
    }

    nftCard.innerHTML = `
      <div class="nft-header">
        <div class="nft-icon">
          ${nftMediaHtml}
        </div>
        <div class="nft-info">
          <div class="nft-name">
            ${asset.name || 'Template #' + templateId}
            ${quantity > 1 ? `<span class="quantity-badge">×${quantity}</span>` : ''}
          </div>
          <div class="nft-template">Template ID: ${templateId}</div>
        </div>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
        <h4 style="margin-bottom: 15px; color: var(--text-secondary); font-size: 0.95rem;">Available Rewards:</h4>
        ${rewardsHtml}
      </div>
    `;

    nftListEl.appendChild(nftCard);

    // Add claim button listeners for each reward
    nftCard.querySelectorAll('.reward-claim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const templateId = btn.dataset.template;
        const rewardId = btn.dataset.reward;
        claimReward(templateId, rewardId, btn);
      });
    });

    // Start countdowns for each reward
    nftCard.querySelectorAll('[class*="reward-countdown-"]').forEach(countdownEl => {
      const seconds = parseInt(countdownEl.dataset.seconds);
      if (seconds > 0) {
        startCountdown(countdownEl, seconds, () => {
          loadUserData();
        });
      }
    });
  });

  // Show claim history
  if (claimsData.claims.length > 0) {
    claimHistorySection.style.display = 'block';
    historyListEl.innerHTML = '';

    claimsData.claims.slice(0, 5).forEach(claim => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <span>Template ${claim.template_id}</span>
        <span class="history-date">${formatDate(claim.claimed_at)}</span>
      `;
      historyListEl.appendChild(historyItem);
    });
  }
}

// Show not eligible state
function showNotEligibleState(eligibilityData) {
  notEligibleSection.style.display = 'block';
  whitelistInfoEl.innerHTML = '';

  if (eligibilityData && eligibilityData.whitelistTemplates && eligibilityData.whitelistTemplates.length > 0) {
    eligibilityData.whitelistTemplates.forEach(templateId => {
      const item = document.createElement('div');
      item.className = 'whitelist-item';
      item.textContent = `Template ID: ${templateId}`;
      whitelistInfoEl.appendChild(item);
    });
  } else {
    whitelistInfoEl.innerHTML = '<p>No templates configured. Please contact admin.</p>';
  }

  // Update marketplace link
  const marketplaceLink = document.getElementById('marketplace-link');
  if (config && config.collection_name) {
    marketplaceLink.href = `https://neftyblocks.com/collection/${config.collection_name}`;
  }
}

// Claim reward
async function claimReward(templateId, rewardId, button) {
  try {
    button.disabled = true;
    button.textContent = 'Claiming...';

    const response = await fetch(`${API_URL}/api/user/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account: currentAccount,
        template_id: templateId,
        reward_id: rewardId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Claim failed');
    }

    // Show success
    const txIds = data.transaction_ids || [data.transaction_id];
    const quantityMsg = data.quantity_minted > 1 ? ` (${data.quantity_minted}x NFTs)` : '';
    showError(`Success! Reward claimed${quantityMsg}. TX: ${txIds[0]}`, 'success');

    // Reload user data
    setTimeout(() => loadUserData(), 2000);

  } catch (error) {
    showError('Claim failed: ' + error.message);
    button.disabled = false;
    button.textContent = '🎁 Claim Reward';
  }
}

// Start countdown timer
function startCountdown(element, seconds, onComplete) {
  let remaining = seconds;

  const updateCountdown = () => {
    if (remaining <= 0) {
      clearInterval(interval);
      if (onComplete) onComplete();
      return;
    }

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;

    element.textContent = `${hours}h ${minutes}m ${secs}s`;
    remaining--;
  };

  updateCountdown();
  const interval = setInterval(updateCountdown, 1000);
  countdownIntervals.push(interval);
}

// Clear all countdowns
function clearCountdowns() {
  countdownIntervals.forEach(interval => clearInterval(interval));
  countdownIntervals = [];
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

function hideError() {
  errorMessage.style.display = 'none';
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
