/**
 * UNIFIED MODULE SYSTEM - BASE FRAMEWORK
 *
 * This provides a common foundation for all module types.
 * All modules extend this base class to inherit:
 * - Consistent wallet management
 * - Unified state handling
 * - Common UI patterns
 * - Shared error handling
 *
 * Usage:
 *   class MyModule extends UnifiedModuleBase {
 *     constructor(containerId, config) {
 *       super(containerId, config);
 *     }
 *
 *     async loadModuleData() {
 *       // Load module-specific data
 *     }
 *
 *     renderContent() {
 *       // Render module-specific content
 *     }
 *   }
 */

class UnifiedModuleBase {
  /**
   * Initialize the module
   * @param {string} containerId - DOM container ID
   * @param {Object} config - Module configuration
   */
  constructor(containerId, config = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.config = config;

    // State
    this.currentAccount = null;
    this.currentWalletType = null;
    this.moduleData = null;
    this.isLoading = false;

    // DOM Elements (will be populated by setupDOM)
    this.elements = {};

    // Current state
    this.currentState = 'disconnected'; // disconnected, loading, connected, error

    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    // Initialize
    this.init();
  }

  /**
   * Initialize the module
   */
  async init() {
    try {
      // Wait for required libraries
      await this.waitForLibraries();

      // Setup DOM structure
      this.setupDOM();

      // Setup event listeners
      this.setupEventListeners();

      // Subscribe to wallet events
      this.subscribeToWallet();

      // Auto-connect if configured
      if (this.config.auto_connect) {
        const walletState = window.WalletManager.getState();
        if (walletState.connected) {
          this.currentAccount = walletState.account;
          this.currentWalletType = walletState.walletType;
          await this.handleWalletConnected();
        }
      }

      console.log(`Module ${this.constructor.name} initialized`, this.config);
    } catch (error) {
      console.error('Module initialization failed:', error);
      this.showError('Failed to initialize module');
    }
  }

  /**
   * Wait for required libraries to load
   */
  async waitForLibraries() {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    while (!window.WalletManager) {
      if (Date.now() - startTime > maxWait) {
        throw new Error('Required libraries failed to load');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Setup DOM structure - Creates unified module HTML
   */
  setupDOM() {
    this.container.innerHTML = `
      <div class="unified-module">
        <div class="unified-module-inner">

          <!-- Disconnected State -->
          <div class="module-state module-state-disconnected active" data-state="disconnected">
            <h3>${this.config.title || 'Connect Your Wallet'}</h3>
            <p>Connect your WAX wallet to get started.</p>
            <div class="module-wallet-buttons">
              <button class="module-wallet-button module-connect-wcw">
                <span class="btn-icon">☁️</span>
                WAX Cloud Wallet
              </button>
              <button class="module-wallet-button module-connect-anchor">
                <span class="btn-icon">⚓</span>
                Anchor Wallet
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div class="module-state module-state-loading" data-state="loading">
            <div class="module-loading-spinner"></div>
            <p class="module-loading-text">Loading...</p>
          </div>

          <!-- Connected State -->
          <div class="module-state module-state-connected" data-state="connected">
            <div class="module-wallet-info">
              <div class="module-wallet-account">
                <span class="module-wallet-label">Connected:</span>
                <span class="module-wallet-name"></span>
              </div>
              <button class="module-disconnect-btn">Disconnect</button>
            </div>
            <div class="module-content">
              <!-- Module-specific content goes here -->
            </div>
          </div>

          <!-- Error State -->
          <div class="module-state module-state-error" data-state="error">
            <div class="module-error-icon">⚠️</div>
            <div class="module-error-message"></div>
            <button class="module-error-retry">Try Again</button>
          </div>

        </div>
      </div>
    `;

    // Cache element references
    this.elements = {
      states: {
        disconnected: this.container.querySelector('[data-state="disconnected"]'),
        loading: this.container.querySelector('[data-state="loading"]'),
        connected: this.container.querySelector('[data-state="connected"]'),
        error: this.container.querySelector('[data-state="error"]')
      },
      connectWCW: this.container.querySelector('.module-connect-wcw'),
      connectAnchor: this.container.querySelector('.module-connect-anchor'),
      disconnect: this.container.querySelector('.module-disconnect-btn'),
      walletName: this.container.querySelector('.module-wallet-name'),
      content: this.container.querySelector('.module-content'),
      loadingText: this.container.querySelector('.module-loading-text'),
      errorMessage: this.container.querySelector('.module-error-message'),
      errorRetry: this.container.querySelector('.module-error-retry')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Wallet connect buttons
    if (this.elements.connectWCW) {
      this.elements.connectWCW.addEventListener('click', () => this.connectWallet('wcw'));
    }

    if (this.elements.connectAnchor) {
      this.elements.connectAnchor.addEventListener('click', () => this.connectWallet('anchor'));
    }

    // Disconnect button
    if (this.elements.disconnect) {
      this.elements.disconnect.addEventListener('click', () => this.disconnectWallet());
    }

    // Error retry button
    if (this.elements.errorRetry) {
      this.elements.errorRetry.addEventListener('click', () => this.retryLoad());
    }
  }

  /**
   * Subscribe to wallet manager events
   */
  subscribeToWallet() {
    window.WalletManager.subscribe(async (account, walletType) => {
      this.currentAccount = account;
      this.currentWalletType = walletType;

      if (account) {
        await this.handleWalletConnected();
      } else {
        this.handleWalletDisconnected();
      }
    });
  }

  /**
   * Connect wallet
   */
  async connectWallet(type) {
    try {
      await window.WalletManager.connect(type);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      this.showError(error.message || 'Failed to connect wallet');
    }
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet() {
    window.WalletManager.disconnect();
  }

  /**
   * Handle wallet connected event
   */
  async handleWalletConnected() {
    if (this.elements.walletName) {
      this.elements.walletName.textContent = this.currentAccount;
    }

    this.showLoading('Loading data...');

    try {
      await this.loadModuleData();
      this.renderContent();
      this.setState('connected');
    } catch (error) {
      console.error('Failed to load module data:', error);
      this.showError(error.message || 'Failed to load data');
    }
  }

  /**
   * Handle wallet disconnected event
   */
  handleWalletDisconnected() {
    this.currentAccount = null;
    this.currentWalletType = null;
    this.moduleData = null;
    this.setState('disconnected');
  }

  /**
   * Retry loading data after error
   */
  async retryLoad() {
    if (this.currentAccount) {
      await this.handleWalletConnected();
    } else {
      this.setState('disconnected');
    }
  }

  /**
   * Set current state and show appropriate UI
   */
  setState(state) {
    this.currentState = state;

    // Hide all states
    Object.values(this.elements.states).forEach(el => {
      if (el) el.classList.remove('active');
    });

    // Show target state
    if (this.elements.states[state]) {
      this.elements.states[state].classList.add('active');
    }
  }

  /**
   * Show loading state
   */
  showLoading(message = 'Loading...') {
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = message;
    }
    this.setState('loading');
  }

  /**
   * Show error state
   */
  showError(message) {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    this.setState('error');
  }

  /**
   * Show status message (inline notification)
   */
  showStatusMessage(message, type = 'info') {
    const existing = this.elements.content.querySelector('.module-status-message');
    if (existing) {
      existing.remove();
    }

    const iconMap = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const messageEl = document.createElement('div');
    messageEl.className = `module-status-message ${type}`;
    messageEl.innerHTML = `
      <span class="module-status-icon">${iconMap[type]}</span>
      <span>${message}</span>
    `;

    this.elements.content.insertBefore(messageEl, this.elements.content.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      messageEl.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => messageEl.remove(), 300);
    }, 5000);
  }

  /**
   * Create item card element (standard layout)
   */
  createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'module-item-card';
    card.innerHTML = `
      <div class="module-item-image-container">
        <img src="${item.image || '/api/placeholder/180/180'}"
             alt="${item.title}"
             class="module-item-image"
             onerror="this.src='/api/placeholder/180/180'">
      </div>
      <div class="module-item-details">
        <div class="module-item-header">
          <h3 class="module-item-title">${item.title}</h3>
          ${item.badge ? `<span class="module-item-badge ${item.badgeType || 'info'}">${item.badge}</span>` : ''}
        </div>
        ${item.description ? `<p class="module-item-description">${item.description}</p>` : ''}
        <div class="module-item-info" data-info-container></div>
        <div class="module-item-actions" data-actions-container></div>
      </div>
    `;

    // Add info rows if provided
    if (item.info && Array.isArray(item.info)) {
      const infoContainer = card.querySelector('[data-info-container]');
      item.info.forEach(info => {
        const row = document.createElement('div');
        row.className = 'module-item-info-row';
        row.innerHTML = `
          <span class="module-item-info-label">${info.label}:</span>
          <span class="module-item-info-value">${info.value}</span>
        `;
        infoContainer.appendChild(row);
      });
    }

    return card;
  }

  /**
   * Create action button
   */
  createActionButton(text, onClick, type = 'primary', disabled = false) {
    const button = document.createElement('button');
    button.className = `module-item-action-btn ${type}`;
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Create countdown timer element
   */
  createCountdown(endTime) {
    const countdown = document.createElement('div');
    countdown.className = 'module-countdown';
    countdown.innerHTML = `
      <span class="module-countdown-icon">⏱️</span>
      <span class="module-countdown-time"></span>
    `;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        countdown.remove();
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      const timeEl = countdown.querySelector('.module-countdown-time');
      if (timeEl) {
        timeEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    // Cleanup on remove
    countdown.dataset.intervalId = interval;

    return countdown;
  }

  /**
   * Create modal
   */
  createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'module-modal-overlay';
    modal.innerHTML = `
      <div class="module-modal">
        <button class="module-modal-close">×</button>
        <h2 class="module-modal-title">${title}</h2>
        <div class="module-modal-content"></div>
      </div>
    `;

    const contentContainer = modal.querySelector('.module-modal-content');
    if (typeof content === 'string') {
      contentContainer.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentContainer.appendChild(content);
    }

    const closeBtn = modal.querySelector('.module-modal-close');
    closeBtn.addEventListener('click', () => this.closeModal(modal));

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal(modal);
      }
    });

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    return modal;
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }

  /**
   * Sign transaction using wallet manager
   */
  async signTransaction(actions) {
    if (!this.currentAccount) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await window.WalletManager.transact(actions, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Format WAX amount (8 decimals)
   */
  formatWAX(amount) {
    const num = parseFloat(amount);
    return `${num.toFixed(8)} WAX`;
  }

  /**
   * Format date/time
   */
  formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  /**
   * ======================================================================
   * METHODS TO BE OVERRIDDEN BY CHILD CLASSES
   * ======================================================================
   */

  /**
   * Load module-specific data
   * Override this in child classes
   */
  async loadModuleData() {
    // To be implemented by child classes
    console.warn('loadModuleData() not implemented');
  }

  /**
   * Render module-specific content
   * Override this in child classes
   */
  renderContent() {
    // To be implemented by child classes
    console.warn('renderContent() not implemented');
  }
}

// Export for use in modules
window.UnifiedModuleBase = UnifiedModuleBase;
