/**
 * Claim Rewards Module - UNIFIED VERSION
 *
 * Extends UnifiedModuleBase for consistent look, feel, and authentication.
 * This demonstrates the new unified module pattern.
 */

class ClaimRewardsModule extends UnifiedModuleBase {
  constructor(containerId, config) {
    super(containerId, config);

    // Module-specific state
    this.publicConfig = null;
    this.eligibilityData = null;
    this.cooldownData = null;
    this.claimsData = null;
    this.countdownIntervals = [];
    this.API_URL = window.location.origin;
  }

  /**
   * Load module-specific data
   * Called by base class when wallet connects
   */
  async loadModuleData() {
    try {
      // Load public config if not loaded
      if (!this.publicConfig) {
        await this.loadPublicConfig();
      }

      // Clear any existing countdowns
      this.clearCountdowns();

      // Build eligibility URL with optional template filtering
      let eligibilityUrl = `${this.API_URL}/api/user/eligibility/${this.currentAccount}`;

      // If verification_templates is configured, only check those templates
      if (this.config.verification_templates) {
        const templates = this.config.verification_templates.toString().trim();
        if (templates) {
          eligibilityUrl += `?templates=${encodeURIComponent(templates)}`;
        }
      }

      // Load all data in parallel
      const [eligibilityData, cooldownData, claimsData] = await Promise.all([
        fetch(eligibilityUrl).then(r => r.json()),
        fetch(`${this.API_URL}/api/user/cooldowns/${this.currentAccount}`).then(r => r.json()),
        fetch(`${this.API_URL}/api/user/claims/${this.currentAccount}`).then(r => r.json())
      ]);

      this.eligibilityData = eligibilityData;
      this.cooldownData = cooldownData;
      this.claimsData = claimsData;

    } catch (error) {
      console.error('Error loading claim rewards data:', error);
      throw error;
    }
  }

  /**
   * Render module content
   * Called by base class after data is loaded
   */
  renderContent() {
    this.elements.content.innerHTML = '';

    if (!this.eligibilityData.eligible) {
      this.renderNotEligible();
      return;
    }

    // Build cooldown map
    const cooldownMap = {};
    this.cooldownData.cooldowns.forEach(cd => {
      const key = `${cd.template_id}-${cd.reward_id}`;
      cooldownMap[key] = cd;
    });

    // Filter assets if configured
    let assetsToShow = this.eligibilityData.eligibleAssets;
    if (this.config.show_only_reward_id) {
      assetsToShow = assetsToShow.filter(asset => {
        return asset.rewards && asset.rewards.some(r =>
          r.reward_id === parseInt(this.config.show_only_reward_id)
        );
      });
    }

    // Check if we have claimable rewards
    const hasClaimableRewards = this.cooldownData.cooldowns.some(cd => cd.can_claim);

    // Add claim-all button if applicable
    if (hasClaimableRewards) {
      const claimAllBtn = document.createElement('button');
      claimAllBtn.className = 'module-item-action-btn success';
      claimAllBtn.style.marginBottom = '20px';
      claimAllBtn.style.width = '100%';
      claimAllBtn.style.fontSize = '1.1rem';
      claimAllBtn.innerHTML = '🎁 Claim All Available Rewards';
      claimAllBtn.addEventListener('click', () => this.claimAll());
      this.elements.content.appendChild(claimAllBtn);
    }

    // Create items grid
    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'module-items-grid';

    // Render each asset
    assetsToShow.forEach(asset => {
      const card = this.createAssetCard(asset, cooldownMap);
      itemsGrid.appendChild(card);
    });

    this.elements.content.appendChild(itemsGrid);

    // Show claim history if available
    if (this.claimsData.claims.length > 0) {
      this.renderClaimHistory();
    }
  }

  /**
   * Create asset card with rewards
   */
  createAssetCard(asset, cooldownMap) {
    const templateId = parseInt(asset.template_id);
    const quantity = asset.quantity_owned;

    // Filter rewards if configured
    let rewardsToShow = asset.rewards || [];
    if (this.config.show_only_reward_id) {
      rewardsToShow = rewardsToShow.filter(r =>
        r.reward_id === parseInt(this.config.show_only_reward_id)
      );
    }

    // Determine badge
    let badge = null;
    let badgeType = 'info';
    if (quantity > 1) {
      badge = `Owned: ${quantity}`;
      badgeType = 'success';
    }

    // Create base card
    const card = this.createItemCard({
      title: asset.name || `Template #${templateId}`,
      image: asset.image_url,
      isVideo: asset.is_video || false,
      badge: badge,
      badgeType: badgeType,
      description: `Template ID: ${templateId}`,
      info: []
    });

    // Highlight if configured
    if (this.config.highlight_reward_id) {
      const hasHighlightedReward = rewardsToShow.some(r =>
        r.reward_id === parseInt(this.config.highlight_reward_id)
      );
      if (hasHighlightedReward) {
        card.style.border = '2px solid var(--success)';
        card.style.background = 'rgba(16, 185, 129, 0.05)';
      }
    }

    // Add rewards section
    const actionsContainer = card.querySelector('[data-actions-container]');
    if (actionsContainer) {
      actionsContainer.style.flexDirection = 'column';
      actionsContainer.style.gap = '15px';

      if (rewardsToShow.length > 0) {
        const rewardsTitle = document.createElement('h4');
        rewardsTitle.style.margin = '10px 0 5px 0';
        rewardsTitle.style.color = 'var(--text-secondary)';
        rewardsTitle.style.fontSize = '0.95rem';
        rewardsTitle.textContent = 'Available Rewards:';
        actionsContainer.appendChild(rewardsTitle);

        rewardsToShow.forEach(reward => {
          const rewardElement = this.createRewardElement(templateId, reward, cooldownMap);
          actionsContainer.appendChild(rewardElement);
        });
      } else {
        const noRewards = document.createElement('p');
        noRewards.style.color = 'var(--text-secondary)';
        noRewards.style.fontSize = '0.9rem';
        noRewards.textContent = 'No rewards configured for this template.';
        actionsContainer.appendChild(noRewards);
      }
    }

    return card;
  }

  /**
   * Create reward element with claim button
   */
  createRewardElement(templateId, reward, cooldownMap) {
    const cooldownKey = `${templateId}-${reward.reward_id}`;
    const cooldown = cooldownMap[cooldownKey];
    const canClaim = cooldown ? cooldown.can_claim : true;
    const remainingSeconds = cooldown ? cooldown.remaining_seconds : 0;

    const rewardName = reward.reward_name || `Template #${reward.reward_template_id}`;
    const quantityInfo = reward.match_quantity
      ? `×${reward.available_quantity}`
      : `(max ${reward.max_claims || 1})`;

    const rewardDiv = document.createElement('div');
    rewardDiv.style.padding = '15px';
    rewardDiv.style.background = 'var(--bg-card)';
    rewardDiv.style.borderRadius = '8px';
    rewardDiv.style.border = '1px solid var(--border)';

    // Reward header with image
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '10px';
    header.style.marginBottom = '10px';

    if (reward.reward_image_url) {
      const img = document.createElement('img');
      img.src = reward.reward_image_url;
      img.alt = rewardName;
      img.style.width = '40px';
      img.style.height = '40px';
      img.style.objectFit = 'contain';
      img.style.borderRadius = '4px';
      img.style.background = 'rgba(139, 92, 246, 0.1)';
      img.style.padding = '4px';
      header.appendChild(img);
    }

    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
      <div style="font-weight: 600; color: var(--text-primary);">${rewardName}</div>
      <div style="font-size: 0.85rem; color: var(--text-secondary);">
        ${quantityInfo} • ${reward.cooldown_hours}h cooldown
      </div>
    `;
    header.appendChild(infoDiv);
    rewardDiv.appendChild(header);

    // Status or countdown
    if (!canClaim && remainingSeconds > 0) {
      const countdown = this.createCountdown(Date.now() + (remainingSeconds * 1000));
      countdown.style.marginBottom = '10px';
      countdown.style.width = '100%';
      countdown.style.justifyContent = 'center';

      // Store countdown info for reload
      countdown.dataset.templateId = templateId;
      countdown.dataset.rewardId = reward.reward_id;

      // When countdown ends, reload data
      setTimeout(() => {
        this.handleWalletConnected();
      }, remainingSeconds * 1000);

      rewardDiv.appendChild(countdown);
    } else if (canClaim) {
      const readyBadge = document.createElement('div');
      readyBadge.className = 'module-status-message success';
      readyBadge.style.marginBottom = '10px';
      readyBadge.style.fontSize = '0.85rem';
      readyBadge.style.padding = '8px 12px';
      readyBadge.innerHTML = '<span class="module-status-icon">✅</span><span>Ready to claim!</span>';
      rewardDiv.appendChild(readyBadge);
    }

    // Claim button
    const claimBtn = this.createActionButton(
      `🎁 Claim ${rewardName}`,
      () => this.claimReward(templateId, reward.reward_id),
      canClaim ? 'success' : 'secondary',
      !canClaim
    );
    claimBtn.style.width = '100%';
    rewardDiv.appendChild(claimBtn);

    return rewardDiv;
  }

  /**
   * Render not eligible state
   */
  renderNotEligible() {
    const emptyState = document.createElement('div');
    emptyState.className = 'module-empty-state';
    emptyState.innerHTML = `
      <div class="module-empty-icon">❌</div>
      <div class="module-empty-title">No Eligible NFTs Found</div>
      <div class="module-empty-description">
        You need to hold one of the whitelisted NFT templates to claim rewards.
      </div>
    `;

    // Show whitelisted templates if available
    if (this.eligibilityData.whitelistTemplates && this.eligibilityData.whitelistTemplates.length > 0) {
      const whitelistDiv = document.createElement('div');
      whitelistDiv.style.marginTop = '20px';
      whitelistDiv.style.textAlign = 'left';
      whitelistDiv.innerHTML = '<h4 style="margin-bottom: 10px;">Required Templates:</h4>';

      const list = document.createElement('ul');
      list.style.listStyle = 'none';
      list.style.padding = '0';
      list.style.display = 'grid';
      list.style.gap = '10px';

      this.eligibilityData.whitelistTemplates.forEach(templateId => {
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
   * Render claim history
   */
  renderClaimHistory() {
    const historySection = document.createElement('div');
    historySection.style.marginTop = '30px';
    historySection.style.paddingTop = '30px';
    historySection.style.borderTop = '2px solid var(--border)';

    const title = document.createElement('h3');
    title.textContent = 'Recent Claims';
    title.style.marginBottom = '15px';
    title.style.color = 'var(--text-secondary)';
    historySection.appendChild(title);

    const historyList = document.createElement('div');
    historyList.style.display = 'grid';
    historyList.style.gap = '10px';

    this.claimsData.claims.slice(0, 5).forEach(claim => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.padding = '12px 15px';
      item.style.background = 'var(--bg-dark)';
      item.style.borderRadius = '8px';
      item.style.border = '1px solid var(--border)';

      item.innerHTML = `
        <span style="color: var(--text-primary);">
          ${claim.reward_name || `Template ${claim.reward_template}`}
        </span>
        <span style="color: var(--text-secondary); font-size: 0.9rem;">
          ${this.formatDate(claim.claimed_at)}
        </span>
      `;

      historyList.appendChild(item);
    });

    historySection.appendChild(historyList);
    this.elements.content.appendChild(historySection);
  }

  /**
   * Claim a single reward
   */
  async claimReward(templateId, rewardId) {
    this.showLoading('Claiming reward...');

    try {
      const response = await fetch(`${this.API_URL}/api/user/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: this.currentAccount,
          template_id: templateId,
          reward_id: rewardId
        })
      });

      const result = await response.json();

      if (result.success) {
        await this.handleWalletConnected(); // Reload data
        this.showStatusMessage(`Successfully claimed ${result.reward_name || 'reward'}!`, 'success');
      } else {
        throw new Error(result.error || 'Failed to claim reward');
      }
    } catch (error) {
      console.error('Claim error:', error);
      this.showError(error.message || 'Failed to claim reward');
    }
  }

  /**
   * Claim all available rewards
   */
  async claimAll() {
    this.showLoading('Claiming all rewards...');

    try {
      const response = await fetch(`${this.API_URL}/api/user/claim-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: this.currentAccount
        })
      });

      const result = await response.json();

      if (result.success) {
        await this.handleWalletConnected(); // Reload data
        this.showStatusMessage(
          `Successfully claimed ${result.claimed_count} reward${result.claimed_count !== 1 ? 's' : ''}!`,
          'success'
        );
      } else {
        throw new Error(result.error || 'Failed to claim rewards');
      }
    } catch (error) {
      console.error('Claim all error:', error);
      this.showError(error.message || 'Failed to claim rewards');
    }
  }

  /**
   * Load public configuration
   */
  async loadPublicConfig() {
    try {
      const response = await fetch(`${this.API_URL}/api/config/public`);
      const data = await response.json();
      if (data.success) {
        this.publicConfig = data.config;
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  /**
   * Clear all countdown intervals
   */
  clearCountdowns() {
    this.countdownIntervals.forEach(interval => clearInterval(interval));
    this.countdownIntervals = [];
  }

  /**
   * Cleanup on module unload
   */
  destroy() {
    this.clearCountdowns();
  }
}

// Initialize module using the standard init function pattern
window.init_claim_rewards = function(containerId, config = {}) {
  return new ClaimRewardsModule(containerId, config);
};
