/**
 * Claim Rewards Module
 * Self-contained module for NFT reward claiming
 */

window.init_claim_rewards = function(containerId, config = {}) {
  console.log(`✅ Claim Rewards module initialized in #${containerId}`);
  console.log('Config:', config);

  const container = document.getElementById(containerId);
  const API_URL = window.location.origin;

  // Module state (scoped to this instance)
  let currentAccount = null;
  let wax = null;
  let anchor = null;
  let currentWalletType = null;
  let publicConfig = null;
  let countdownIntervals = [];

  // Get module elements using container scope
  const notConnectedSection = container.querySelector('.claim-not-connected');
  const loadingSection = container.querySelector('.claim-loading');
  const eligibleSection = container.querySelector('.claim-eligible');
  const notEligibleSection = container.querySelector('.claim-not-eligible');
  const errorSection = container.querySelector('.claim-error');
  const connectedAccountEl = container.querySelector('.claim-connected-account');
  const nftListEl = container.querySelector('.claim-nft-list');
  const historyListEl = container.querySelector('.claim-history-list');
  const whitelistInfoEl = container.querySelector('.claim-whitelist-info');
  const claimHistorySection = container.querySelector('.claim-history');
  const claimAllContainer = container.querySelector('.claim-all-container');
  const walletInfoDiv = container.querySelector('.claim-wallet-info');

  // Initialize
  (async function init() {
    await loadPublicConfig();
    await waitForLibraries();
    setupEventListeners();

    // Auto-connect if configured
    if (config.auto_connect) {
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

  // Load public configuration
  async function loadPublicConfig() {
    try {
      const response = await fetch(`${API_URL}/api/config/public`);
      const data = await response.json();
      if (data.success) {
        publicConfig = data.config;
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    const connectWcwBtn = container.querySelector('.claim-connect-wcw');
    const connectAnchorBtn = container.querySelector('.claim-connect-anchor');
    const disconnectBtn = container.querySelector('.claim-disconnect-btn');
    const claimAllBtn = container.querySelector('.claim-all-btn');

    if (connectWcwBtn) {
      connectWcwBtn.addEventListener('click', () => connectWallet('wcw'));
    }
    if (connectAnchorBtn) {
      connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    }
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', disconnect);
    }
    if (claimAllBtn) {
      claimAllBtn.addEventListener('click', claimAll);
    }
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

    // Filter assets if show_only_reward_id is configured
    let assetsToShow = eligibilityData.eligibleAssets;
    if (config.show_only_reward_id) {
      assetsToShow = assetsToShow.filter(asset => {
        return asset.rewards && asset.rewards.some(r => r.reward_id === parseInt(config.show_only_reward_id));
      });
    }

    // Display each eligible template with its rewards
    assetsToShow.forEach(asset => {
      const templateId = parseInt(asset.template_id);
      const quantity = asset.quantity_owned;

      const nftCard = document.createElement('div');
      nftCard.className = 'nft-card';

      // Highlight if configured
      if (config.highlight_reward_id) {
        const hasHighlightedReward = asset.rewards && asset.rewards.some(r => r.reward_id === parseInt(config.highlight_reward_id));
        if (hasHighlightedReward) {
          nftCard.style.border = '2px solid var(--success)';
          nftCard.style.background = 'rgba(16, 185, 129, 0.05)';
        }
      }

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
        // Filter rewards if show_only_reward_id is configured
        let rewardsToShow = asset.rewards;
        if (config.show_only_reward_id) {
          rewardsToShow = rewardsToShow.filter(r => r.reward_id === parseInt(config.show_only_reward_id));
        }

        rewardsToShow.forEach((reward, index) => {
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

    // Check if any rewards are claimable and show/hide claim-all button
    const hasClaimableRewards = cooldownData.cooldowns.some(cd => cd.can_claim);
    if (hasClaimableRewards && claimAllContainer) {
      claimAllContainer.style.display = 'block';
    } else if (claimAllContainer) {
      claimAllContainer.style.display = 'none';
    }

    // Show claim history
    if (claimsData.claims.length > 0 && claimHistorySection && historyListEl) {
      claimHistorySection.style.display = 'block';
      historyListEl.innerHTML = '';

      claimsData.claims.slice(0, 5).forEach(claim => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
          <span>${claim.reward_name || `Template ${claim.reward_template}`}</span>
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

  // Claim all available rewards
  async function claimAll() {
    const button = container.querySelector('.claim-all-btn');
    const statusEl = container.querySelector('.claim-all-status');

    try {
      button.disabled = true;
      button.textContent = '⏳ Claiming all rewards...';
      statusEl.innerHTML = '<div style="color: var(--primary);">Processing...</div>';

      const response = await fetch(`${API_URL}/api/user/claim-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account: currentAccount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Claim all failed');
      }

      // Show detailed results
      let statusHtml = `<div style="color: var(--success); font-weight: 600; margin-bottom: 10px;">✅ ${data.message}</div>`;

      if (data.results && data.results.length > 0) {
        statusHtml += '<div style="text-align: left; max-width: 600px; margin: 0 auto;">';
        data.results.forEach(result => {
          const txLink = result.transaction_ids && result.transaction_ids[0]
            ? `<a href="https://waxblock.io/transaction/${result.transaction_ids[0]}" target="_blank" style="color: var(--primary);">View TX</a>`
            : '';
          statusHtml += `
            <div style="padding: 8px; border-bottom: 1px solid var(--border);">
              <strong>${result.reward_name || 'Reward #' + result.reward_id}</strong>
              - Minted ${result.quantity_minted}x NFT(s) ${txLink}
            </div>
          `;
        });
        statusHtml += '</div>';
      }

      if (data.errors && data.errors.length > 0) {
        statusHtml += '<div style="margin-top: 10px; color: var(--error);">⚠️ Some claims failed:</div>';
        data.errors.forEach(err => {
          statusHtml += `<div style="color: var(--text-secondary); font-size: 0.85rem;">${err.reward_name || 'Reward #' + err.reward_id}: ${err.error}</div>`;
        });
      }

      statusEl.innerHTML = statusHtml;

      // Show success message
      showError(`🎉 Successfully claimed ${data.total_claimed} reward(s)!`, 'success');

      // Reload user data after 5 seconds
      setTimeout(() => {
        loadUserData();
        button.disabled = false;
        button.textContent = '🎁 Claim All Available Rewards';
        statusEl.innerHTML = '';
      }, 5000);

    } catch (error) {
      statusEl.innerHTML = `<div style="color: var(--error);">❌ ${error.message}</div>`;
      showError('Claim all failed: ' + error.message);
      button.disabled = false;
      button.textContent = '🎁 Claim All Available Rewards';

      setTimeout(() => {
        statusEl.innerHTML = '';
      }, 5000);
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
    loadingSection.style.display = 'none';
    eligibleSection.style.display = 'none';
    notEligibleSection.style.display = 'none';
    if (walletInfoDiv) walletInfoDiv.style.display = 'none';
  }

  function showConnectedState() {
    notConnectedSection.style.display = 'none';
    if (connectedAccountEl) connectedAccountEl.textContent = currentAccount;
    if (walletInfoDiv) walletInfoDiv.style.display = 'block';
  }

  function showError(message, type = 'error') {
    if (!errorSection) return;

    errorSection.textContent = message;
    errorSection.style.display = 'block';
    errorSection.style.color = type === 'success' ? 'var(--success)' : 'var(--error)';
    errorSection.style.background = type === 'success'
      ? 'rgba(16, 185, 129, 0.1)'
      : 'rgba(239, 68, 68, 0.1)';

    setTimeout(() => {
      errorSection.style.display = 'none';
    }, 5000);
  }

  function hideError() {
    if (errorSection) errorSection.style.display = 'none';
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
};
