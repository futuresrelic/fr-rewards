/**
 * Gated Paid Claim Module - UNIFIED VERSION
 *
 * Combines eligibility checking (Claim Rewards) with paid purchases (Paid Claim).
 * Users must hold specific verification templates to access paid rewards.
 *
 * Flow:
 * 1. Check if user holds verification template(s) - LIVE blockchain query
 * 2. If eligible, show available paid rewards
 * 3. User pays WAX → Backend verifies payment → Minting wallet mints reward
 * 4. Optional cooldowns and per-wallet limits
 */

class GatedPaidClaimModule extends UnifiedModuleBase {
  constructor(containerId, config) {
    super(containerId, config);

    // Module-specific state
    this.eligibilityData = null;
    this.purchaseHistory = null;
    this.cooldownIntervals = [];
    this.API_URL = window.location.origin;

    // Parse rewards config
    this.rewards = this.parseRewardsConfig();
  }

  /**
   * Parse rewards configuration
   */
  parseRewardsConfig() {
    // If rewards is a JSON string, parse it
    if (typeof this.config.rewards === 'string') {
      try {
        const parsed = JSON.parse(this.config.rewards);
        console.log(`✅ Parsed ${parsed.length} reward(s) from JSON string`);
        return parsed;
      } catch (e) {
        console.error('Failed to parse rewards config:', e);
        return [];
      }
    }

    // If it's already an array, use it
    if (Array.isArray(this.config.rewards)) {
      console.log(`✅ Using ${this.config.rewards.length} reward(s) from array`);
      return this.config.rewards;
    }

    console.warn('⚠️ No rewards configured - rewards field is empty or missing');
    return [];
  }

  /**
   * Load module-specific data
   * Called by base class when wallet connects
   */
  async loadModuleData() {
    try {
      // Check eligibility (must hold verification templates)
      await this.checkEligibility();

      // Load purchase history
      await this.loadPurchaseHistory();

    } catch (error) {
      console.error('Error loading gated paid claim data:', error);
      throw error;
    }
  }

  /**
   * Check if user is eligible (holds verification templates)
   */
  async checkEligibility() {
    const verificationTemplates = this.config.verification_templates?.toString().trim();

    if (!verificationTemplates) {
      throw new Error('No verification templates configured');
    }

    // Query eligibility API with template filter
    const eligibilityUrl = `${this.API_URL}/api/user/eligibility/${this.currentAccount}?templates=${encodeURIComponent(verificationTemplates)}`;

    const response = await fetch(eligibilityUrl);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to check eligibility');
    }

    this.eligibilityData = data;
  }

  /**
   * Load purchase history and sync cooldowns with backend
   */
  async loadPurchaseHistory() {
    try {
      const response = await fetch(`${this.API_URL}/api/user/gated-purchases/${this.currentAccount}`);
      const data = await response.json();

      if (response.ok) {
        this.purchaseHistory = data.purchases || [];

        // Sync cooldowns from backend purchase history to localStorage
        this.syncCooldownsFromHistory();
      } else {
        this.purchaseHistory = [];
      }
    } catch (error) {
      console.error('Error loading purchase history:', error);
      this.purchaseHistory = [];
    }
  }

  /**
   * Sync cooldowns from backend purchase history to localStorage
   * This ensures frontend cooldown state matches backend reality
   */
  syncCooldownsFromHistory() {
    if (!this.purchaseHistory || !this.currentAccount) return;

    // Group purchases by template_id
    const purchasesByTemplate = {};
    this.purchaseHistory.forEach(purchase => {
      const templateId = purchase.template_id.toString();
      if (!purchasesByTemplate[templateId]) {
        purchasesByTemplate[templateId] = [];
      }
      purchasesByTemplate[templateId].push(purchase);
    });

    // For each template, find the most recent completed purchase
    // and sync cooldown to localStorage
    Object.keys(purchasesByTemplate).forEach(templateId => {
      const purchases = purchasesByTemplate[templateId];

      // Filter to completed purchases only
      const completedPurchases = purchases.filter(p => p.status === 'completed');

      if (completedPurchases.length > 0) {
        // Sort by purchased_at descending (most recent first)
        completedPurchases.sort((a, b) => {
          const timeA = new Date(a.purchased_at).getTime();
          const timeB = new Date(b.purchased_at).getTime();
          return timeB - timeA;
        });

        const mostRecent = completedPurchases[0];
        const purchaseTime = new Date(mostRecent.purchased_at).getTime();

        // Update localStorage with backend timestamp
        const key = this.getCooldownKey(templateId);
        const existingTime = localStorage.getItem(key);

        // Only update if backend has more recent timestamp
        if (!existingTime || purchaseTime > parseInt(existingTime)) {
          localStorage.setItem(key, purchaseTime.toString());
        }
      }
    });
  }

  /**
   * Render module content
   * Called by base class after data is loaded
   */
  renderContent() {
    // Clear any existing countdown timers
    this.clearCooldownTimers();

    this.elements.content.innerHTML = '';

    // Check if user is eligible
    if (!this.eligibilityData.eligible) {
      this.renderNotEligible();
      return;
    }

    // User is eligible! Show available rewards
    this.renderEligible();
  }

  /**
   * Render not eligible state
   */
  renderNotEligible() {
    const emptyState = document.createElement('div');
    emptyState.className = 'module-empty-state';
    emptyState.innerHTML = `
      <div class="module-empty-icon">🔒</div>
      <div class="module-empty-title">Access Restricted</div>
      <div class="module-empty-description">
        You need to hold one of the required NFTs to access these premium rewards.
      </div>
    `;

    // Show required templates
    if (this.config.verification_templates) {
      const templates = this.config.verification_templates.toString().split(',').map(t => t.trim());

      const whitelistDiv = document.createElement('div');
      whitelistDiv.style.marginTop = '20px';
      whitelistDiv.style.textAlign = 'left';
      whitelistDiv.innerHTML = '<h4 style="margin-bottom: 10px;">Required NFT Templates:</h4>';

      const list = document.createElement('ul');
      list.style.listStyle = 'none';
      list.style.padding = '0';
      list.style.display = 'grid';
      list.style.gap = '10px';

      templates.forEach(templateId => {
        const li = document.createElement('li');
        li.style.padding = '10px';
        li.style.background = 'var(--bg-card)';
        li.style.borderRadius = '8px';
        li.style.border = '1px solid var(--border)';
        li.textContent = `Template ID: ${templateId}`;
        list.appendChild(li);
      });

      whitelistDiv.appendChild(list);
      emptyState.appendChild(whitelistDiv);
    }

    this.elements.content.appendChild(emptyState);
  }

  /**
   * Render eligible state - show available rewards
   */
  renderEligible() {
    const successMessage = document.createElement('div');
    successMessage.className = 'module-status-message success';
    successMessage.style.marginBottom = '20px';
    successMessage.innerHTML = `
      <span class="module-status-icon">✅</span>
      <span>You are eligible! Select a reward below to purchase.</span>
    `;
    this.elements.content.appendChild(successMessage);

    // Create rewards grid
    const rewardsGrid = document.createElement('div');
    rewardsGrid.className = 'module-items-grid';

    // Store countdown data for starting timers after DOM append
    const countdownsToStart = [];

    // Render each reward
    this.rewards.forEach(reward => {
      const result = this.createRewardCard(reward);
      rewardsGrid.appendChild(result.card);

      // Collect countdown data if present
      if (result.countdownData) {
        countdownsToStart.push(result.countdownData);
      }
    });

    this.elements.content.appendChild(rewardsGrid);

    // NOW start all countdown timers (after cards are in DOM)
    countdownsToStart.forEach(data => {
      this.startCooldownTimer(data.elementId, data.remainingMs);
    });

    // Show purchase history if exists
    if (this.purchaseHistory && this.purchaseHistory.length > 0) {
      this.renderPurchaseHistory();
    }
  }

  /**
   * Create reward card
   */
  createRewardCard(reward) {
    const templateId = reward.template_id;
    const templateName = reward.template_name || `Template #${templateId}`;
    const priceWax = parseFloat(reward.price_wax || '10.00000000');
    const priceDisplay = priceWax.toString(); // Remove trailing zeros

    // Check cooldown
    const cooldown = this.checkCooldown(templateId, reward.cooldown_hours);

    // Check wallet limit
    const purchaseCount = this.getWalletPurchaseCount(templateId);
    const walletLimitReached = reward.per_wallet_limit && purchaseCount >= parseInt(reward.per_wallet_limit);

    // Determine if purchase is disabled
    const isPurchaseDisabled = cooldown.active || (walletLimitReached && !reward.cooldown_hours);

    // Determine media type
    const isVideo = reward.template_image?.match(/\.(mp4|webm|mov)$/i) || reward.is_video;

    // Create base card
    const card = this.createItemCard({
      title: templateName,
      image: reward.template_image,
      isVideo: isVideo,
      badge: `${priceDisplay} WAX`,
      badgeType: 'primary',
      description: `Template ID: ${templateId}`,
      info: []
    });

    // Track countdown data (to start timer after card is in DOM)
    let countdownData = null;

    // Add purchase info and button
    const actionsContainer = card.querySelector('[data-actions-container]');
    if (actionsContainer) {
      actionsContainer.style.flexDirection = 'column';
      actionsContainer.style.gap = '15px';

      // Show limits/cooldown info
      if (reward.per_wallet_limit) {
        const limitInfo = document.createElement('div');
        limitInfo.style.fontSize = '0.85rem';
        limitInfo.style.color = 'var(--text-secondary)';

        if (cooldown.active) {
          limitInfo.style.color = 'var(--warning)';
          // Create countdown element
          const countdownId = `cooldown-${templateId}-${Date.now()}`;
          limitInfo.innerHTML = `⏳ Cooldown: <span id="${countdownId}"></span>`;

          // Save countdown data to start later (after DOM append)
          countdownData = {
            elementId: countdownId,
            remainingMs: cooldown.remainingMs
          };
        } else if (reward.cooldown_hours) {
          limitInfo.textContent = `Limit: ${reward.per_wallet_limit} per ${reward.cooldown_hours}h (${purchaseCount}/${reward.per_wallet_limit} used)`;
        } else {
          limitInfo.textContent = `Limit: ${reward.per_wallet_limit} per wallet (${purchaseCount}/${reward.per_wallet_limit} used)`;
        }

        actionsContainer.appendChild(limitInfo);
      }

      if (reward.max_supply) {
        const supplyInfo = document.createElement('div');
        supplyInfo.style.fontSize = '0.85rem';
        supplyInfo.style.color = 'var(--text-secondary)';
        supplyInfo.textContent = `Max Supply: ${reward.max_supply}`;
        actionsContainer.appendChild(supplyInfo);
      }

      // Purchase button
      const purchaseBtn = this.createActionButton(
        isPurchaseDisabled ? '🔒 Unavailable' : `💰 Purchase for ${priceDisplay} WAX`,
        () => this.purchaseReward(reward),
        isPurchaseDisabled ? 'secondary' : 'success',
        isPurchaseDisabled
      );
      purchaseBtn.style.width = '100%';
      purchaseBtn.dataset.templateId = templateId;
      actionsContainer.appendChild(purchaseBtn);

      // Status message area
      const statusDiv = document.createElement('div');
      statusDiv.className = 'purchase-status';
      statusDiv.style.marginTop = '10px';
      statusDiv.style.minHeight = '20px';
      statusDiv.dataset.templateId = templateId;
      actionsContainer.appendChild(statusDiv);
    }

    return {
      card: card,
      countdownData: countdownData
    };
  }

  /**
   * Purchase a reward
   */
  async purchaseReward(reward) {
    const statusEl = this.elements.content.querySelector(`.purchase-status[data-template-id="${reward.template_id}"]`);
    const button = this.elements.content.querySelector(`button[data-template-id="${reward.template_id}"]`);

    let paymentResult = null;

    try {
      button.disabled = true;
      button.textContent = 'Processing...';
      statusEl.innerHTML = '<div style="color: var(--primary);">⏳ Preparing transaction...</div>';

      // Step 1: User signs token transfer
      statusEl.innerHTML = '<div style="color: var(--primary);">💳 Please sign the payment in your wallet...</div>';

      paymentResult = await this.executeTokenTransfer(reward);

      statusEl.innerHTML = '<div style="color: var(--primary);">✅ Payment sent! Verifying...</div>';

      // Step 2: Send to backend for verification and minting
      statusEl.innerHTML = '<div style="color: var(--primary);">🔍 Verifying payment...</div>';

      const response = await fetch(`${this.API_URL}/api/user/gated-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: this.currentAccount,
          template_id: reward.template_id,
          payment_transaction_id: paymentResult.transaction_id,
          price_wax: reward.price_wax,
          payment_wallet: this.config.payment_wallet || 'futuresrelic',
          per_wallet_limit: reward.per_wallet_limit || null,
          cooldown_hours: reward.cooldown_hours || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || 'Purchase failed');
        error.can_retry = data.can_retry;
        error.status_code = response.status;
        throw error;
      }

      // Success!
      statusEl.innerHTML = `
        <div style="color: var(--success); font-weight: 600;">✅ Purchase successful!</div>
        <div style="font-size: 0.85rem; margin-top: 8px;">
          <a href="https://waxblock.io/transaction/${data.mint_transaction_id}" target="_blank" style="color: var(--primary);">
            View Mint Transaction →
          </a>
        </div>
      `;

      this.showStatusMessage('🎉 Purchase completed! NFT minted successfully.', 'success');

      // Update cooldown/limits
      if (reward.cooldown_hours) {
        const cooldown = this.checkCooldown(reward.template_id, reward.cooldown_hours);
        if (!cooldown.active) {
          this.resetWalletPurchaseCount(reward.template_id);
          this.setLastPurchaseTime(reward.template_id);
        }
        this.incrementWalletPurchaseCount(reward.template_id);
      } else if (reward.per_wallet_limit) {
        this.incrementWalletPurchaseCount(reward.template_id);
      }

      // Reload data
      setTimeout(() => {
        this.handleWalletConnected();
      }, 3000);

    } catch (error) {
      console.error('Purchase error:', error);

      // Check if this is a cooldown error (429)
      const isCooldownError = error.status_code === 429 || error.message?.includes('cooldown') || error.message?.includes('limit reached');

      // If cooldown error, reload data to sync backend state
      if (isCooldownError) {
        // Reload purchase history to sync cooldowns from backend
        setTimeout(async () => {
          await this.loadPurchaseHistory();
          // Re-render to show cooldown state
          this.renderContent();
        }, 500);
      }

      // Check if can retry
      const canRetry = error.can_retry || (error.message && error.message.includes('verification'));

      let errorHtml = `<div style="color: var(--error);">❌ ${error.message}</div>`;

      if (canRetry && paymentResult && paymentResult.transaction_id) {
        errorHtml += `
          <button class="module-item-action-btn warning" style="margin-top: 10px; font-size: 0.9rem;" onclick="window.retryGatedPurchase_${this.containerId}('${paymentResult.transaction_id}', '${reward.template_id}')">
            ♻️ Retry Verification
          </button>
        `;
      }

      statusEl.innerHTML = errorHtml;
      this.showStatusMessage('Purchase failed: ' + error.message, 'error');

      button.disabled = false;
      button.textContent = `💰 Purchase for ${parseFloat(reward.price_wax).toString()} WAX`;
    }

    // Global retry function
    window[`retryGatedPurchase_${this.containerId}`] = async (txId, templateId) => {
      try {
        statusEl.innerHTML = '<div style="color: var(--primary);">♻️ Retrying verification...</div>';

        const response = await fetch(`${this.API_URL}/api/user/gated-purchase/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_transaction_id: txId,
            payment_wallet: this.config.payment_wallet || 'futuresrelic'
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Recovery failed');
        }

        statusEl.innerHTML = `
          <div style="color: var(--success); font-weight: 600;">✅ Recovery successful!</div>
          <div style="font-size: 0.85rem; margin-top: 8px;">
            <a href="https://waxblock.io/transaction/${data.mint_transaction_id}" target="_blank" style="color: var(--primary);">
              View Mint Transaction →
            </a>
          </div>
        `;

        this.showStatusMessage('🎉 Recovery completed! NFT minted successfully.', 'success');

        // Update cooldown/limits
        const rewardConfig = this.rewards.find(r => r.template_id === templateId);
        if (rewardConfig) {
          if (rewardConfig.cooldown_hours) {
            const cooldown = this.checkCooldown(templateId, rewardConfig.cooldown_hours);
            if (!cooldown.active) {
              this.resetWalletPurchaseCount(templateId);
              this.setLastPurchaseTime(templateId);
            }
            this.incrementWalletPurchaseCount(templateId);
          } else if (rewardConfig.per_wallet_limit) {
            this.incrementWalletPurchaseCount(templateId);
          }
        }

        // Reload data
        setTimeout(() => {
          this.handleWalletConnected();
        }, 3000);

      } catch (retryError) {
        console.error('Retry error:', retryError);
        statusEl.innerHTML = `
          <div style="color: var(--error);">❌ Retry failed: ${retryError.message}</div>
          <button class="module-item-action-btn warning" style="margin-top: 10px; font-size: 0.9rem;" onclick="window.retryGatedPurchase_${this.containerId}('${txId}', '${templateId}')">
            ♻️ Try Again
          </button>
        `;
      }
    };
  }

  /**
   * Execute token transfer transaction
   */
  async executeTokenTransfer(reward) {
    const actions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{
        actor: this.currentAccount,
        permission: 'active',
      }],
      data: {
        from: this.currentAccount,
        to: this.config.payment_wallet || 'futuresrelic',
        quantity: `${reward.price_wax} WAX`,
        memo: `Gated NFT Purchase - Template ${reward.template_id}`
      },
    }];

    return await this.signTransaction(actions);
  }

  /**
   * Render purchase history
   */
  renderPurchaseHistory() {
    const historySection = document.createElement('div');
    historySection.style.marginTop = '30px';
    historySection.style.paddingTop = '30px';
    historySection.style.borderTop = '2px solid var(--border)';

    const title = document.createElement('h3');
    title.textContent = 'Recent Purchases';
    title.style.marginBottom = '15px';
    title.style.color = 'var(--text-secondary)';
    historySection.appendChild(title);

    const historyList = document.createElement('div');
    historyList.style.display = 'grid';
    historyList.style.gap = '10px';

    this.purchaseHistory.slice(0, 5).forEach(purchase => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '12px 15px';
      item.style.background = 'var(--bg-dark)';
      item.style.borderRadius = '8px';
      item.style.border = '1px solid var(--border)';

      const status = purchase.status === 'completed' ? '✅' :
                    purchase.status === 'failed' ? '❌' : '⏳';

      const mintLink = purchase.mint_transaction_id
        ? `<a href="https://waxblock.io/transaction/${purchase.mint_transaction_id}" target="_blank" style="color: var(--primary); font-size: 0.85rem;">View TX</a>`
        : '';

      item.innerHTML = `
        <div style="flex: 1;">
          <div style="font-weight: 600;">${status} Template ${purchase.template_id}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            ${purchase.price_wax} WAX • ${this.formatDate(purchase.purchased_at)}
          </div>
        </div>
        <div>${mintLink}</div>
      `;

      historyList.appendChild(item);
    });

    historySection.appendChild(historyList);
    this.elements.content.appendChild(historySection);
  }

  /**
   * Cooldown management
   */
  getCooldownKey(templateId) {
    return `gated_claim_cooldown_${this.currentAccount}_${templateId}`;
  }

  getLastPurchaseTime(templateId) {
    const key = this.getCooldownKey(templateId);
    const timestamp = localStorage.getItem(key);
    return timestamp ? parseInt(timestamp) : null;
  }

  setLastPurchaseTime(templateId) {
    const key = this.getCooldownKey(templateId);
    localStorage.setItem(key, Date.now().toString());
  }

  checkCooldown(templateId, cooldownHours) {
    if (!cooldownHours || !this.currentAccount) return { active: false };

    const lastPurchase = this.getLastPurchaseTime(templateId);
    if (!lastPurchase) return { active: false };

    const cooldownMs = parseFloat(cooldownHours) * 60 * 60 * 1000;
    const elapsedMs = Date.now() - lastPurchase;
    const remainingMs = cooldownMs - elapsedMs;

    if (remainingMs > 0) {
      return {
        active: true,
        remainingMs: remainingMs,
        remainingTime: this.formatCooldownTime(remainingMs)
      };
    }

    return { active: false };
  }

  formatCooldownTime(ms) {
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

  /**
   * Start countdown timer for cooldown display
   */
  startCooldownTimer(elementId, remainingMs) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let remaining = remainingMs;

    const updateTimer = () => {
      if (remaining <= 0) {
        // Cooldown ended - reload data to update UI
        clearInterval(interval);
        this.handleWalletConnected();
        return;
      }

      element.textContent = this.formatCooldownTime(remaining);
      remaining -= 1000;
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    // Store interval for cleanup
    this.cooldownIntervals.push(interval);
  }

  /**
   * Clear all countdown timers (called when module is destroyed or refreshed)
   */
  clearCooldownTimers() {
    this.cooldownIntervals.forEach(interval => clearInterval(interval));
    this.cooldownIntervals = [];
  }

  getWalletPurchaseCount(templateId) {
    if (!this.currentAccount) return 0;
    const key = `gated_claim_count_${this.currentAccount}_${templateId}`;
    const count = localStorage.getItem(key);
    return count ? parseInt(count) : 0;
  }

  incrementWalletPurchaseCount(templateId) {
    if (!this.currentAccount) return;
    const key = `gated_claim_count_${this.currentAccount}_${templateId}`;
    const count = this.getWalletPurchaseCount(templateId);
    localStorage.setItem(key, (count + 1).toString());
  }

  resetWalletPurchaseCount(templateId) {
    if (!this.currentAccount) return;
    const key = `gated_claim_count_${this.currentAccount}_${templateId}`;
    localStorage.removeItem(key);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clearCountdowns();
  }

  clearCountdowns() {
    this.countdownIntervals.forEach(interval => clearInterval(interval));
    this.countdownIntervals = [];
  }
}

// Initialize module using the standard init function pattern
window.init_gated_paid_claim = function(containerId, config = {}) {
  return new GatedPaidClaimModule(containerId, config);
};
