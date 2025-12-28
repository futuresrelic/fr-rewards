const API_URL = window.location.origin;

// Wallet state
let currentWallet = null;
let currentAccount = null;
let wax = null;
let anchor = null;

// Elements
const notConnectedSection = document.getElementById('not-connected');
const connectedSection = document.getElementById('connected');
const loadingSection = document.getElementById('loading');
const storySection = document.getElementById('story-section');
const noStorySection = document.getElementById('no-story');
const connectedAccountEl = document.getElementById('connected-account');
const errorMessageEl = document.getElementById('error-message');
const dropModal = document.getElementById('drop-modal');
const dropEmbedContainer = document.getElementById('drop-embed-container');
const markDropCompleteBtn = document.getElementById('mark-drop-complete-btn');
const packModal = document.getElementById('pack-modal');
const packSelectionList = document.getElementById('pack-selection-list');
const confirmUnpackBtn = document.getElementById('confirm-unpack-btn');
const confirmClaimBtn = document.getElementById('confirm-claim-btn');
const packModalTitle = document.getElementById('pack-modal-title');
const packModalSubtitle = document.getElementById('pack-modal-subtitle');
const blendModal = document.getElementById('blend-modal');
const blendSelectionList = document.getElementById('blend-selection-list');
const blendSelectedCount = document.getElementById('blend-selected-count');
const blendRequirementsText = document.getElementById('blend-requirements-text');
const confirmBlendBtn = document.getElementById('confirm-blend-btn');
const unpackedModal = document.getElementById('unpacked-modal');
const unpackedAssetsGrid = document.getElementById('unpacked-assets-grid');
const closeUnpackedBtn = document.getElementById('close-unpacked-btn');
const closeUnpackedModalX = document.getElementById('close-unpacked-modal');

// Pack selection state
let selectedPack = null;  // Store full pack object with template data
let currentUnpackAction = null;

// Drop action state
let currentDropAction = null;

// Blend selection state
let selectedBlendAssets = [];
let currentBlendAction = null;
let currentBlendConfig = null;
let availableBlendAssets = [];

// Story tabs state
let storyTabs = [];
let selectedTabId = null;  // null = show all

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadPageBranding();
  setupEventListeners();
  await checkExistingConnection();
});

// Load page branding
async function loadPageBranding() {
  try {
    const response = await fetch(`${API_URL}/api/config/public`);
    const data = await response.json();

    if (data.success && data.config) {
      const titleEl = document.getElementById('page-title');
      const subtitleEl = document.getElementById('page-subtitle');
      const logoEl = document.getElementById('page-logo');

      // Keep the story-specific defaults if not overridden
      if (data.config.page_title) {
        titleEl.textContent = '📖 ' + data.config.page_title + ' Story';
        document.title = data.config.page_title + ' Story';
      }
      if (data.config.page_subtitle) {
        subtitleEl.textContent = data.config.page_subtitle;
      }
      if (data.config.logo_url) {
        logoEl.src = data.config.logo_url;
        logoEl.style.display = 'block';
      }
      // Update favicon if configured
      if (data.config.favicon_url) {
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = data.config.favicon_url;
      }
    }
  } catch (error) {
    console.error('Error loading page branding:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('connect-wcw').addEventListener('click', () => connectWallet('wcw'));
  document.getElementById('connect-anchor').addEventListener('click', () => connectWallet('anchor'));
  document.getElementById('disconnect-btn').addEventListener('click', disconnect);
  document.getElementById('close-drop-modal').addEventListener('click', closeDropModal);
  document.getElementById('close-pack-modal').addEventListener('click', closePackModal);
  document.getElementById('close-blend-modal').addEventListener('click', closeBlendModal);
  closeUnpackedBtn.addEventListener('click', closeUnpackedModal);
  closeUnpackedModalX.addEventListener('click', closeUnpackedModal);
  confirmUnpackBtn.addEventListener('click', confirmUnpack);
  confirmClaimBtn.addEventListener('click', confirmClaim);
  confirmBlendBtn.addEventListener('click', confirmBlend);
  markDropCompleteBtn.addEventListener('click', markDropAsComplete);
}

// Show error message
function showError(message, type = 'error') {
  errorMessageEl.textContent = message;
  errorMessageEl.className = `alert alert-${type}`;
  errorMessageEl.style.display = 'block';

  // Don't scroll to top - it's annoying when working through a story

  setTimeout(() => {
    errorMessageEl.style.display = 'none';
  }, 8000);
}

// Check existing connection
async function checkExistingConnection() {
  const savedWallet = localStorage.getItem('wallet_type');
  const savedAccount = localStorage.getItem('wallet_account');

  if (savedWallet && savedAccount) {
    try {
      if (savedWallet === 'wcw') {
        // Initialize WaxJS
        wax = new waxjs.WaxJS({
          rpcEndpoint: 'https://wax.greymass.com',
          tryAutoLogin: true
        });

        // Check if auto-login is available
        const isAvailable = await wax.isAutoLoginAvailable();
        if (isAvailable) {
          currentAccount = wax.userAccount;
          currentWallet = 'wcw';
          showConnected();
        } else {
          // Auto-login not available, clear saved session
          localStorage.removeItem('wallet_type');
          localStorage.removeItem('wallet_account');
        }
      } else if (savedWallet === 'anchor') {
        // Try to restore Anchor session
        if (window.AnchorWallet) {
          anchor = window.AnchorWallet;
          const restored = await anchor.restoreSession();
          if (restored) {
            currentAccount = savedAccount;
            currentWallet = 'anchor';
            showConnected();
          } else {
            // Session not available, clear saved session
            localStorage.removeItem('wallet_type');
            localStorage.removeItem('wallet_account');
          }
        } else {
          console.log('Anchor wallet not loaded yet');
          localStorage.removeItem('wallet_type');
          localStorage.removeItem('wallet_account');
        }
      }
    } catch (error) {
      console.log('Auto-reconnect failed:', error);
      // Clear invalid saved session
      localStorage.removeItem('wallet_type');
      localStorage.removeItem('wallet_account');
    }
  }
}

// Connect wallet
async function connectWallet(type) {
  try {
    if (type === 'wcw') {
      wax = new waxjs.WaxJS({
        rpcEndpoint: 'https://wax.greymass.com',
        tryAutoLogin: true
      });

      const userAccount = await wax.login();
      currentAccount = userAccount;
      currentWallet = 'wcw';
    } else if (type === 'anchor') {
      if (!window.AnchorWallet) {
        throw new Error('Anchor wallet not loaded. Please refresh the page or use WAX Cloud Wallet.');
      }

      anchor = window.AnchorWallet;
      const identity = await anchor.login('futuresrelic');
      currentAccount = identity.session.auth.actor.toString();
      currentWallet = 'anchor';
    }

    localStorage.setItem('wallet_type', currentWallet);
    localStorage.setItem('wallet_account', currentAccount);

    showConnected();
  } catch (error) {
    console.error('Connection error:', error);
    showError('Failed to connect wallet: ' + error.message);
  }
}

// Disconnect
function disconnect() {
  currentWallet = null;
  currentAccount = null;
  wax = null;
  anchor = null;

  localStorage.removeItem('wallet_type');
  localStorage.removeItem('wallet_account');

  notConnectedSection.style.display = 'block';
  connectedSection.style.display = 'none';
}

// Show connected state
async function showConnected() {
  notConnectedSection.style.display = 'none';
  connectedSection.style.display = 'block';
  connectedAccountEl.textContent = currentAccount;

  await loadStoryProgress();
}

// Load story progress
async function loadStoryProgress() {
  try {
    loadingSection.style.display = 'block';
    storySection.style.display = 'none';
    noStorySection.style.display = 'none';

    // Load story tabs
    try {
      const tabsResponse = await fetch(`${API_URL}/api/story/tabs`);
      const tabsData = await tabsResponse.json();
      if (tabsData.success && tabsData.tabs.length > 0) {
        storyTabs = tabsData.tabs;
      }
    } catch (error) {
      console.error('Error loading story tabs:', error);
      // Continue even if tabs fail to load
    }

    const response = await fetch(`${API_URL}/api/workflow/progress/${currentAccount}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch progress: ${response.statusText}`);
    }

    const data = await response.json();
    const progress = data.progress || [];

    loadingSection.style.display = 'none';

    if (progress.length === 0) {
      noStorySection.style.display = 'block';
      return;
    }

    displayStoryProgress(progress);
    renderStoryTabs();
  } catch (error) {
    loadingSection.style.display = 'none';
    showError('Error loading story progress: ' + error.message);
    console.error('Error:', error);
  }
}

// Render story tabs
function renderStoryTabs() {
  const tabsBar = document.getElementById('story-tabs-bar');
  const tabsContainer = document.getElementById('story-tabs-container');

  if (!tabsBar || !tabsContainer) {
    console.warn('Story tabs elements not found');
    return;
  }

  if (storyTabs.length === 0) {
    tabsBar.style.display = 'none';
    return;
  }

  tabsBar.style.display = 'block';

  // Add "All" tab
  tabsContainer.innerHTML = `
    <button onclick="filterByTab(null)" class="btn ${selectedTabId === null ? 'btn-primary' : 'btn-secondary'}" style="padding: 10px 20px;">
      📖 All Actions
    </button>
  `;

  // Add custom tabs
  storyTabs.forEach(tab => {
    tabsContainer.innerHTML += `
      <button onclick="filterByTab(${tab.id})" class="btn ${selectedTabId === tab.id ? 'btn-primary' : 'btn-secondary'}" style="padding: 10px 20px;">
        ${tab.tab_icon} ${tab.tab_name}
      </button>
    `;
  });
}

// Filter actions by tab
function filterByTab(tabId) {
  selectedTabId = tabId;
  renderStoryTabs(); // Re-render to update active state

  // Filter actions
  const allActions = document.querySelectorAll('[data-action-id]');
  allActions.forEach(actionEl => {
    const actionTabId = actionEl.getAttribute('data-tab-id');
    // Show if: no tab selected (null) OR action has no tab (empty string) OR tab matches
    if (selectedTabId === null || actionTabId === '' || actionTabId === String(selectedTabId)) {
      actionEl.style.display = '';
    } else {
      actionEl.style.display = 'none';
    }
  });
}

// Display story progress
function displayStoryProgress(progress) {
  const stepsContainer = document.getElementById('story-steps');
  stepsContainer.innerHTML = '';

  // Group by steps
  const stepMap = new Map();
  progress.forEach(item => {
    if (!stepMap.has(item.step_id)) {
      stepMap.set(item.step_id, {
        step_id: item.step_id,
        step_order: item.step_order,
        step_name: item.step_name,
        step_description: item.step_description,
        actions: []
      });
    }

    stepMap.get(item.step_id).actions.push({
      action_id: item.action_id,
      action_order: item.action_order,
      action_type: item.action_type,
      action_name: item.action_name,
      action_description: item.action_description,
      action_config: item.action_config,
      tab_id: item.tab_id,
      completed_at: item.completed_at,
      transaction_id: item.transaction_id,
      result_data: item.result_data
    });
  });

  // Sort steps by step_order
  const steps = Array.from(stepMap.values()).sort((a, b) => a.step_order - b.step_order);

  steps.forEach((step, stepIndex) => {
    const stepCard = document.createElement('div');
    stepCard.className = 'card';
    stepCard.style.cssText = 'position: relative; padding: 25px; border-left: 4px solid var(--accent);';

    // Calculate completion percentage
    const totalActions = step.actions.length;
    const completedActions = step.actions.filter(a => a.completed_at).length;
    const completionPercent = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
    const isStepComplete = completionPercent === 100;

    const actionTypeEmoji = {
      'CLAIM': '🎁',
      'UNPACK': '📦',
      'BLEND': '🔮',
      'DROP': '💧',
      'MARKET_SCOUT': '🔍'
    };

    stepCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1;">
          <h2 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 10px;">
            <span style="background: ${isStepComplete ? 'var(--success)' : 'var(--accent)'}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 0.9rem;">
              ${isStepComplete ? '✅' : ''} Step ${step.step_order}
            </span>
            ${step.step_name}
          </h2>
          ${step.step_description ? `<p style="margin: 10px 0; color: var(--text-secondary);">${step.step_description}</p>` : ''}
        </div>
        <div style="text-align: right; min-width: 100px;">
          <div style="font-size: 2rem; font-weight: bold; color: ${isStepComplete ? 'var(--success)' : 'var(--accent)'};">${completionPercent}%</div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">${completedActions}/${totalActions} complete</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div style="background: var(--bg-dark); height: 8px; border-radius: 10px; margin-bottom: 20px; overflow: hidden;">
        <div style="background: ${isStepComplete ? 'var(--success)' : 'var(--accent)'}; height: 100%; width: ${completionPercent}%; transition: width 0.3s ease;"></div>
      </div>

      <!-- Actions List -->
      <div id="actions-container-${step.step_id}" style="display: flex; flex-direction: column; gap: 15px;"></div>
    `;

    stepsContainer.appendChild(stepCard);

    // Add actions with event listeners
    const actionsContainer = stepCard.querySelector(`#actions-container-${step.step_id}`);
    step.actions.sort((a, b) => a.action_order - b.action_order).forEach(action => {
      const actionCard = createActionCard(action, actionTypeEmoji);
      actionsContainer.appendChild(actionCard);
    });
  });

  storySection.style.display = 'block';
}

// Check if user owns required assets for an action
async function checkActionAssetOwnership(action) {
  if (!action.action_config) {
    // No config means no specific requirements
    return { hasAssets: true, status: 'ready' };
  }

  let config;
  try {
    config = JSON.parse(action.action_config);
  } catch (e) {
    console.error('Failed to parse action config:', e);
    return { hasAssets: false, status: 'pending' };
  }

  const templateIds = [];

  // Determine which templates to check based on action type
  switch (action.action_type) {
    case 'CLAIM':
      // For CLAIM, user typically needs to own a specific template to be eligible
      if (config.template_id) {
        templateIds.push(config.template_id);
      }
      break;

    case 'UNPACK':
      // For UNPACK, user needs to own the pack template
      if (config.pack_template_id) {
        templateIds.push(config.pack_template_id);
      }
      break;

    case 'BLEND':
      // For BLEND, user needs to own the ingredient templates
      if (config.ingredient_templates && Array.isArray(config.ingredient_templates)) {
        templateIds.push(...config.ingredient_templates);
      }
      break;

    case 'DROP':
      // DROP actions are always available (user claims from the drop interface)
      return { hasAssets: true, status: 'ready' };

    case 'MARKET_SCOUT':
      // MARKET_SCOUT is always available (just opens market)
      return { hasAssets: true, status: 'ready' };

    default:
      return { hasAssets: false, status: 'pending' };
  }

  // If no template IDs to check, assume ready
  if (templateIds.length === 0) {
    return { hasAssets: true, status: 'ready' };
  }

  // Check ownership via backend proxy
  try {
    const response = await fetch(`${API_URL}/api/user/check-ownership/${currentAccount}?template_ids=${templateIds.join(',')}`);
    const data = await response.json();

    if (!data.success) {
      return { hasAssets: false, status: 'pending' };
    }

    // For most actions, user needs ALL templates
    // For BLEND, this is especially important (need all ingredients)
    const ownsAll = templateIds.every(tid => data.ownership[tid] === true);

    if (ownsAll) {
      return { hasAssets: true, status: 'ready' };
    } else {
      return { hasAssets: false, status: 'need_assets' };
    }

  } catch (error) {
    console.error('Error checking asset ownership:', error);
    return { hasAssets: false, status: 'pending' };
  }
}

// Create action card with button
function createActionCard(action, actionTypeEmoji) {
  const isCompleted = !!action.completed_at;
  const emoji = actionTypeEmoji[action.action_type] || '⚡';

  const actionCard = document.createElement('div');
  actionCard.id = `action-${action.action_id}`;
  actionCard.style.cssText = `background: var(--bg-dark); padding: 15px; border-radius: 8px; border: 2px solid ${isCompleted ? 'var(--success)' : 'var(--border)'};`;

  // Add data attributes for tab filtering
  actionCard.setAttribute('data-action-id', action.action_id);
  actionCard.setAttribute('data-tab-id', action.tab_id || '');

  actionCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="font-size: 1.5rem;">${emoji}</span>
          <h4 style="margin: 0;">${action.action_name}</h4>
          ${isCompleted ?
            '<span style="background: var(--success); color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;">✅ Completed</span>' :
            '<span id="status-badge-' + action.action_id + '" style="background: var(--bg-card-hover); color: var(--text-secondary); padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;">⏳ Checking...</span>'}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="background: var(--bg-card); padding: 5px 10px; border-radius: 5px; font-size: 0.85rem; color: var(--accent); font-weight: bold;">${action.action_type}</span>
        </div>
        ${action.action_description ? `<div style="margin: 8px 0; color: var(--text-secondary); font-size: 0.9rem;" class="markdown-content">${marked.parse(action.action_description)}</div>` : ''}
        ${isCompleted && action.completed_at ? `
          <div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">
            Completed: ${new Date(action.completed_at).toLocaleString()}
            ${action.transaction_id ? `<br><a href="https://waxblock.io/transaction/${action.transaction_id}" target="_blank" style="color: var(--accent);">View TX →</a>` : ''}
          </div>
          <div style="margin-top: 10px;">
            <button class="btn btn-secondary" id="action-btn-${action.action_id}" style="padding: 8px 16px; font-size: 0.85rem;">
              🔄 Try Again
            </button>
          </div>
        ` : `
          <div style="margin-top: 15px;">
            <button class="btn btn-primary" id="action-btn-${action.action_id}" style="width: 100%;">
              ${getActionButtonText(action.action_type)}
            </button>
          </div>
        `}
      </div>
    </div>
  `;

  // Add button event listener (for both completed and non-completed actions)
  setTimeout(() => {
    const btn = document.getElementById(`action-btn-${action.action_id}`);
    if (btn) {
      btn.addEventListener('click', () => executeAction(action));
    }
  }, 0);

  // Check asset ownership and update status badge if not completed
  if (!isCompleted) {
    // Check ownership asynchronously and update status badge
    checkActionAssetOwnership(action).then(ownershipResult => {
      const statusBadge = document.getElementById(`status-badge-${action.action_id}`);
      if (statusBadge) {
        if (ownershipResult.status === 'ready') {
          statusBadge.style.background = 'var(--success)';
          statusBadge.style.color = 'white';
          statusBadge.textContent = '✅ Ready';
        } else if (ownershipResult.status === 'need_assets') {
          statusBadge.style.background = '#f59e0b';
          statusBadge.style.color = 'white';
          statusBadge.textContent = '📋 Need Assets';
        } else {
          statusBadge.style.background = 'var(--bg-card-hover)';
          statusBadge.style.color = 'var(--text-secondary)';
          statusBadge.textContent = '⏳ Pending';
        }
      }
    }).catch(error => {
      console.error('Error checking ownership:', error);
      const statusBadge = document.getElementById(`status-badge-${action.action_id}`);
      if (statusBadge) {
        statusBadge.style.background = 'var(--bg-card-hover)';
        statusBadge.style.color = 'var(--text-secondary)';
        statusBadge.textContent = '⏳ Pending';
      }
    });
  }

  return actionCard;
}

// Get action button text
function getActionButtonText(actionType) {
  const texts = {
    'CLAIM': '🎁 Claim Reward',
    'UNPACK': '📦 Unpack Now',
    'BLEND': '🔮 Execute Blend',
    'DROP': '💧 View Drop',
    'MARKET_SCOUT': '🔍 Find on Market'
  };
  return texts[actionType] || '▶️ Execute Action';
}

// Mark action as complete
async function markActionComplete(action, transactionId = null, resultData = null) {
  try {
    const response = await fetch(`${API_URL}/api/workflow/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: currentAccount,
        action_id: action.action_id,
        transaction_id: transactionId,
        result_data: resultData
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Action marked as complete');
      // Reload progress to show updated state
      setTimeout(() => loadStoryProgress(), 1500);
    }
  } catch (error) {
    console.error('Error marking action complete:', error);
  }
}

// Execute action
async function executeAction(action) {
  console.log('Executing action:', action);

  const btn = document.getElementById(`action-btn-${action.action_id}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Processing...';
  }

  try {
    let config = null;
    if (action.action_config) {
      try {
        config = JSON.parse(action.action_config);
      } catch (e) {
        console.error('Failed to parse action config:', e);
      }
    }

    switch (action.action_type) {
      case 'CLAIM':
        await executeClaim(action, config);
        break;
      case 'UNPACK':
        await executeUnpack(action, config);
        break;
      case 'BLEND':
        await executeBlend(action, config);
        break;
      case 'DROP':
        await executeDrop(action, config);
        break;
      case 'MARKET_SCOUT':
        await executeMarketScout(action, config);
        break;
      default:
        throw new Error(`Unknown action type: ${action.action_type}`);
    }
  } catch (error) {
    console.error('Action execution error:', error);
    showError('Error executing action: ' + error.message);

    // Re-enable button
    if (btn) {
      btn.disabled = false;
      btn.textContent = getActionButtonText(action.action_type);
    }
  }
}

// Execute CLAIM action
async function executeClaim(action, config) {
  if (!config || !config.template_id) {
    throw new Error('CLAIM action requires template_id in config');
  }

  const response = await fetch(`${API_URL}/api/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: currentAccount,
      template_id: config.template_id
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Claim failed');
  }

  showError(`Success! Reward claimed. TX: ${data.transaction_id}`, 'success');

  // Reload progress
  setTimeout(() => loadStoryProgress(), 2000);
}

// Execute UNPACK action
async function executeUnpack(action, config) {
  if (!config || !config.pack_template_id) {
    throw new Error('UNPACK action requires pack_template_id in config');
  }

  // Fetch user's owned packs of this template via blockchain RPC (no cache!)
  const packsResponse = await fetch(`${API_URL}/api/user/assets-rpc/${currentAccount}/${config.pack_template_id}`);
  const packsData = await packsResponse.json();

  let ownedPacks = [];
  if (packsData.success && packsData.data && packsData.data.length > 0) {
    ownedPacks = packsData.data;
    console.log(`📦 Found ${ownedPacks.length} owned packs from blockchain (real-time, no cache)`);
  }

  // Fetch claimable packs (unpacked but not claimed) from atomicpacksx
  // EXACTLY LIKE PACKS.JS - Don't filter yet, just fetch all
  let claimablePacks = [];
  try {
    const claimResponse = await fetch(`${API_URL}/api/user/claimable-packs/${currentAccount}`);
    if (claimResponse.ok) {
      const claimData = await claimResponse.json();
      if (claimData.success && claimData.claimable_packs) {
        claimablePacks = claimData.claimable_packs;
        console.log(`🎁 Found ${claimablePacks.length} claimable packs in atomicpacksx`);

        // Mark each as claimable and add required fields - EXACTLY LIKE PACKS.JS
        claimablePacks.forEach(pack => {
          pack.is_claimable = true;
          pack.asset_id = pack.pack_asset_id;
          pack.template = {
            template_id: pack.pack_template_id || 'Unknown'
          };
          console.log(`  ✅ Pack ${pack.asset_id} ready to claim (${pack.roll_count} rolls) - Template ${pack.pack_template_id}, Mint #${pack.template_mint || 'Unknown'}`);
        });
      }
    }
  } catch (error) {
    console.warn('Could not fetch claimable packs:', error.message);
  }

  // Combine owned packs and claimable packs - EXACTLY LIKE PACKS.JS
  let allPacks = [...ownedPacks, ...claimablePacks];

  // NOW filter by template (works for both owned and claimable)
  allPacks = allPacks.filter(pack => {
    const templateId = pack.template?.template_id;
    return templateId && parseInt(templateId) === parseInt(config.pack_template_id);
  });

  console.log(`📦 Total packs for template ${config.pack_template_id}: ${allPacks.length} (${ownedPacks.length} owned total + ${claimablePacks.length} claimable total = ${allPacks.length} matching template)`);

  if (allPacks.length === 0) {
    throw new Error(`You don't have any packs of template #${config.pack_template_id} (owned or claimable)`);
  }

  // Quick filter: remove obviously burned packs (only for owned packs)
  const candidatePacks = allPacks.filter(pack => {
    // Skip burn check for claimable packs (they're in atomicpacksx, not burned)
    if (pack.is_claimable) return true;

    if (pack.burned_at_block || pack.burned_at_time || pack.burned_by_account) {
      console.log(`❌ Pack ${pack.asset_id} (mint #${pack.template_mint}) is burned - skipping`);
      return false;
    }
    return true;
  });

  if (candidatePacks.length === 0) {
    throw new Error(`No packs available - all are burned.`);
  }

  // Sort: claimable packs first, then by HIGHEST mint
  candidatePacks.sort((a, b) => {
    // Claimable packs first
    if (a.is_claimable && !b.is_claimable) return -1;
    if (!a.is_claimable && b.is_claimable) return 1;

    // Otherwise sort by mint (highest first)
    return parseInt(b.template_mint || 0) - parseInt(a.template_mint || 0);
  });

  console.log(`✅ ${candidatePacks.length} candidate packs (claimable packs shown first)`);

  currentUnpackAction = action;
  remainingPacks = [...candidatePacks]; // Clone array for auto-advancing
  showPackDropdown(action);
}

// Global pack list for auto-advancing
let remainingPacks = [];
let currentPackDropdown = null;

// Show pack dropdown selector with auto-verification
async function showPackDropdown(action) {
  if (remainingPacks.length === 0) {
    showError('No packs available to unpack', 'error');
    return;
  }

  // Find the action card and replace the button with dropdown UI
  const actionCard = document.getElementById(`action-${action.action_id}`);
  if (!actionCard) {
    console.error('Could not find action card for action:', action.action_id);
    return;
  }

  // Find the button and replace its parent container
  const actionBtn = document.getElementById(`action-btn-${action.action_id}`);
  if (!actionBtn) {
    console.error('Could not find action button');
    return;
  }

  const buttonContainer = actionBtn.parentElement;
  if (!buttonContainer) {
    console.error('Could not find button container');
    return;
  }

  // Create dropdown UI
  buttonContainer.innerHTML = `
    <div class="pack-dropdown-container" style="margin-top: 15px;">
      <div style="margin-bottom: 10px;">
        <label for="pack-selector" style="display: block; margin-bottom: 5px; font-weight: bold;">
          📦 Select Pack:
        </label>
        <select id="pack-selector" class="form-control" style="width: 100%; padding: 10px; font-size: 1rem; background: var(--bg-dark); color: white; border: 2px solid var(--border); border-radius: 8px;">
          ${remainingPacks.map((pack, idx) => `
            <option value="${pack.asset_id}" data-pack-index="${idx}">
              ${pack.is_claimable ? '🎁 [CLAIMABLE]' : '📦'} Mint #${pack.template_mint || 'Unknown'} - Asset ID: ${pack.asset_id}
            </option>
          `).join('')}
        </select>
      </div>

      <div id="pack-status" style="padding: 12px; background: var(--bg-card-hover); border-radius: 8px; margin-bottom: 10px; min-height: 60px;">
        <div class="loader" style="width: 20px; height: 20px; border-width: 2px;"></div>
        <span style="margin-left: 10px;">Checking pack status...</span>
      </div>

      <div id="pack-actions" style="display: flex; gap: 10px;">
        <button id="action-unpack-btn" class="btn btn-primary" style="flex: 1; display: none;">
          📦 Unpack This Pack
        </button>
        <button id="action-claim-btn" class="btn btn-primary" style="flex: 1; display: none; background: orange;">
          🎁 Claim This Pack
        </button>
        <button id="action-skip-btn" class="btn btn-secondary" style="display: none;">
          ⏭️ Skip & Try Next
        </button>
      </div>
    </div>
  `;

  // Get references to elements
  currentPackDropdown = document.getElementById('pack-selector');
  const statusDiv = document.getElementById('pack-status');
  const unpackBtn = document.getElementById('action-unpack-btn');
  const claimBtn = document.getElementById('action-claim-btn');
  const skipBtn = document.getElementById('action-skip-btn');

  // Auto-verify first pack
  await verifyAndUpdatePackStatus();

  // Add event listener for dropdown changes
  currentPackDropdown.addEventListener('change', async () => {
    await verifyAndUpdatePackStatus();
  });

  // Add button event listeners
  unpackBtn.addEventListener('click', async () => {
    const selectedAssetId = currentPackDropdown.value;
    const selectedPack = remainingPacks.find(p => p.asset_id == selectedAssetId);
    if (selectedPack) {
      try {
        unpackBtn.disabled = true;
        unpackBtn.textContent = '⏳ Unpacking...';
        await doUnpack(selectedPack, action);
        // Success - remove from list and show next
        await removeCurrentPackAndAdvance();
      } catch (error) {
        unpackBtn.disabled = false;
        unpackBtn.textContent = '📦 Unpack This Pack';

        // If error is about not owning the pack, auto-skip to next
        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('not owned') || errorMsg.includes('burned') || errorMsg.includes('does not exist')) {
          showError(`Pack not owned or burned. Skipping to next...`, 'warning');
          setTimeout(async () => {
            await removeCurrentPackAndAdvance();
          }, 1500);
        } else {
          throw error;
        }
      }
    }
  });

  claimBtn.addEventListener('click', async () => {
    const selectedAssetId = currentPackDropdown.value;
    const selectedPack = remainingPacks.find(p => p.asset_id == selectedAssetId);
    if (selectedPack) {
      try {
        claimBtn.disabled = true;
        claimBtn.textContent = '⏳ Claiming...';
        await doClaim(selectedPack, action);
        // Success - remove from list and show next
        await removeCurrentPackAndAdvance();
      } catch (error) {
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Claim This Pack';
        throw error;
      }
    }
  });

  skipBtn.addEventListener('click', async () => {
    await removeCurrentPackAndAdvance();
  });
}

// Verify ownership and update pack status display
async function verifyAndUpdatePackStatus() {
  const statusDiv = document.getElementById('pack-status');
  const unpackBtn = document.getElementById('action-unpack-btn');
  const claimBtn = document.getElementById('action-claim-btn');
  const skipBtn = document.getElementById('action-skip-btn');

  if (!currentPackDropdown || !statusDiv) return;

  const selectedAssetId = currentPackDropdown.value;
  const selectedPack = remainingPacks.find(p => p.asset_id == selectedAssetId);

  if (!selectedPack) {
    statusDiv.innerHTML = '<span style="color: var(--error);">❌ Pack not found</span>';
    return;
  }

  // Hide all buttons while checking
  unpackBtn.style.display = 'none';
  claimBtn.style.display = 'none';
  skipBtn.style.display = 'none';

  // Show loading
  statusDiv.innerHTML = `
    <div style="display: flex; align-items: center;">
      <div class="loader" style="width: 20px; height: 20px; border-width: 2px;"></div>
      <span style="margin-left: 10px;">Verifying pack status...</span>
    </div>
  `;

  try {
    // Step 1: Check if pack is in unboxassets table (already unpacked, ready to claim)
    console.log(`🔍 STEP 1: Checking if pack ${selectedAssetId} has been unpacked...`);
    const rollResponse = await fetch(`${API_URL}/api/pack/unboxed-rolls/${selectedAssetId}`);

    // 404 = Pack not unpacked yet (NORMAL, expected for packs in wallet)
    // 200 = Pack has been unpacked and has rolls (ready to claim)
    if (rollResponse.status === 404) {
      console.log(`  ℹ️  STEP 2: Pack ${selectedAssetId} is NOT unpacked yet → Ready to UNPACK`);

      // Pack is in wallet, ready to unpack
      statusDiv.innerHTML = `
        <div style="color: var(--success);">
          ✅ <strong>Ready to Unpack</strong><br>
          <span style="font-size: 0.9rem;">Mint #${selectedPack.template_mint || 'Unknown'} • Click to open this pack</span>
        </div>
      `;

      unpackBtn.style.display = 'block';
      skipBtn.style.display = 'block';
      return;
    }

    if (!rollResponse.ok) {
      throw new Error(`Server error: ${rollResponse.status}`);
    }

    const rollData = await rollResponse.json();

    if (rollData.success && rollData.roll_ids && rollData.roll_ids.length > 0) {
      console.log(`  ✅ STEP 2: Pack ${selectedAssetId} HAS been unpacked → Ready to CLAIM (${rollData.roll_ids.length} rolls)`);

      // Pack has been unpacked, ready to claim!
      selectedPack.roll_ids = rollData.roll_ids;
      selectedPack.is_claimable = true;

      statusDiv.innerHTML = `
        <div style="color: orange;">
          ✅ <strong>Ready to Claim!</strong><br>
          <span style="font-size: 0.9rem;">This pack has been unpacked and contains ${rollData.roll_ids.length} rolls.</span>
        </div>
      `;

      claimBtn.style.display = 'block';
      skipBtn.style.display = 'block';
      return;
    }

    // Fallback: treat as ready to unpack
    console.log(`  ℹ️  STEP 2: Pack ${selectedAssetId} status unclear → Assuming ready to UNPACK`);
    statusDiv.innerHTML = `
      <div style="color: var(--success);">
        ✅ <strong>Ready to Unpack</strong><br>
        <span style="font-size: 0.9rem;">Mint #${selectedPack.template_mint || 'Unknown'} • Click to open this pack</span>
      </div>
    `;

    unpackBtn.style.display = 'block';
    skipBtn.style.display = 'block';

  } catch (error) {
    console.error('❌ ERROR verifying pack:', error);
    statusDiv.innerHTML = `
      <div style="color: var(--error);">
        ❌ <strong>Verification Error</strong><br>
        <span style="font-size: 0.9rem;">${error.message}</span>
      </div>
    `;
    skipBtn.style.display = 'block';
  }
}

// Remove current pack from list and advance to next
async function removeCurrentPackAndAdvance() {
  if (!currentPackDropdown) return;

  const selectedAssetId = currentPackDropdown.value;
  const selectedIndex = remainingPacks.findIndex(p => p.asset_id == selectedAssetId);

  if (selectedIndex !== -1) {
    remainingPacks.splice(selectedIndex, 1);
  }

  if (remainingPacks.length === 0) {
    // No more packs
    const actionCard = document.getElementById(`action-${currentUnpackAction.action_id}`);
    if (actionCard) {
      const actionBtn = document.getElementById(`action-btn-${currentUnpackAction.action_id}`);
      if (actionBtn) {
        const buttonContainer = actionBtn.parentElement;
        if (buttonContainer) {
          buttonContainer.innerHTML = `
            <div style="padding: 15px; background: var(--bg-card-hover); border-radius: 8px; text-align: center;">
              <div style="font-size: 1.5rem; margin-bottom: 10px;">🎉</div>
              <div style="font-weight: bold; margin-bottom: 5px;">All packs processed!</div>
              <div style="font-size: 0.9rem; color: var(--text-secondary);">No more packs available to unpack.</div>
            </div>
          `;
        }
      }
    }
    return;
  }

  // Rebuild dropdown with remaining packs
  currentPackDropdown.innerHTML = remainingPacks.map((pack, idx) => `
    <option value="${pack.asset_id}" data-pack-index="${idx}">
      ${pack.is_claimable ? '🎁 [CLAIMABLE]' : '📦'} Mint #${pack.template_mint || 'Unknown'} - Asset ID: ${pack.asset_id}
    </option>
  `).join('');

  // Auto-verify the new selection
  await verifyAndUpdatePackStatus();
}

// Pack pagination (OLD - keeping for reference but not used)
let allPacksForModal = [];
let currentPackPage = 0;
const PACKS_PER_PAGE = 15;

// Show pack selection modal with pagination (OLD - not used anymore)
function showPackSelectionModal(packs) {
  // This function is deprecated - using dropdown instead
  console.warn('showPackSelectionModal is deprecated - use showPackDropdown instead');
}

// Render current page of packs
function renderPackPage() {
  const startIdx = currentPackPage * PACKS_PER_PAGE;
  const endIdx = Math.min(startIdx + PACKS_PER_PAGE, allPacksForModal.length);
  const packsToShow = allPacksForModal.slice(startIdx, endIdx);
  const totalPages = Math.ceil(allPacksForModal.length / PACKS_PER_PAGE);

  packSelectionList.innerHTML = '';

  // Show pagination info
  const paginationInfo = document.createElement('div');
  paginationInfo.style.cssText = 'margin-bottom: 15px; padding: 10px; background: var(--bg-card-hover); border-radius: 8px; text-align: center;';
  paginationInfo.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">
      Showing ${startIdx + 1}-${endIdx} of ${allPacksForModal.length} packs (Page ${currentPackPage + 1}/${totalPages})
    </div>
    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;">
      <button id="pack-prev-btn" ${currentPackPage === 0 ? 'disabled' : ''} class="btn btn-secondary" style="padding: 5px 15px;">← Prev</button>
      <button id="pack-next-btn" ${endIdx >= allPacksForModal.length ? 'disabled' : ''} class="btn btn-secondary" style="padding: 5px 15px;">Next →</button>
    </div>
  `;
  packSelectionList.appendChild(paginationInfo);

  // Render packs
  packsToShow.forEach((pack, index) => {
    const isFirstPack = index === 0 && currentPackPage === 0;
    const isClaimable = pack.is_claimable === true;

    const packOption = document.createElement('div');
    packOption.style.cssText = `
      background: ${isFirstPack ? 'var(--accent)' : 'var(--bg-dark)'};
      padding: 15px;
      border-radius: 8px;
      border: 2px solid ${isFirstPack ? 'var(--accent)' : 'var(--border)'};
      cursor: pointer;
      transition: all 0.2s;
    `;

    packOption.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: bold; font-size: 1.1rem;">
            Mint #${pack.template_mint || 'Unknown'}
            ${isClaimable ? '<span style="background: orange; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">READY TO CLAIM</span>' : ''}
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">
            Asset ID: ${pack.asset_id}
            ${isClaimable ? ` • ${pack.roll_ids.length} rolls` : ''}
          </div>
          ${isClaimable ? '<div style="color: orange; font-size: 0.85rem; margin-top: 5px;">🎁 Pack already unpacked - will claim contents</div>' : ''}
        </div>
        <input type="radio" name="pack-selection" value="${pack.asset_id}" ${isFirstPack ? 'checked' : ''} style="width: 24px; height: 24px; cursor: pointer;">
      </div>
    `;

    packOption.addEventListener('click', () => {
      // Deselect all
      document.querySelectorAll('input[name="pack-selection"]').forEach(radio => {
        radio.checked = false;
        radio.parentElement.parentElement.style.background = 'var(--bg-dark)';
        radio.parentElement.parentElement.style.borderColor = 'var(--border)';
      });

      // Select this one
      const radio = packOption.querySelector('input[type="radio"]');
      radio.checked = true;
      packOption.style.background = 'var(--accent)';
      packOption.style.borderColor = 'var(--accent)';
      selectedPack = pack;

      // Update button visibility based on pack type
      updateModalButtons(pack);
    });

    packSelectionList.appendChild(packOption);
  });

  // Setup pagination button listeners
  document.getElementById('pack-prev-btn')?.addEventListener('click', () => {
    if (currentPackPage > 0) {
      currentPackPage--;
      renderPackPage();
    }
  });

  document.getElementById('pack-next-btn')?.addEventListener('click', () => {
    if ((currentPackPage + 1) * PACKS_PER_PAGE < allPacksForModal.length) {
      currentPackPage++;
      renderPackPage();
    }
  });

  // Auto-select first pack on page
  if (packsToShow.length > 0) {
    selectedPack = packsToShow[0];
    updateModalButtons(packsToShow[0]);
  }
}

// Update modal buttons based on pack type
function updateModalButtons(pack) {
  const isClaimable = pack.is_claimable === true;

  if (isClaimable) {
    // Show claim button, hide unpack button
    confirmClaimBtn.style.display = 'block';
    confirmUnpackBtn.style.display = 'none';
    packModalTitle.textContent = '🎁 Claim Pack Contents';
    packModalSubtitle.textContent = 'This pack has already been unpacked. Select which pack to claim:';
  } else {
    // Show unpack button, hide claim button
    confirmUnpackBtn.style.display = 'block';
    confirmClaimBtn.style.display = 'none';
    packModalTitle.textContent = '📦 Unpack Pack';
    packModalSubtitle.textContent = 'Select which pack to unpack:';
  }
}

// Close pack modal
function closePackModal() {
  packModal.style.display = 'none';
  selectedPack = null;
  currentUnpackAction = null;

  // Re-enable the unpack button
  if (currentUnpackAction) {
    const btn = document.getElementById(`action-btn-${currentUnpackAction.action_id}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📦 Unpack Now';
    }
  }
}

// Close unpacked assets modal
function closeUnpackedModal() {
  unpackedModal.style.display = 'none';
  unpackedAssetsGrid.innerHTML = '';
}

// Show unpacked assets modal
async function showUnpackedAssetsModal(claimedAssets) {
  console.log(`🎨 Showing unpacked assets modal for ${claimedAssets.length} assets...`);

  unpackedAssetsGrid.innerHTML = '';

  for (const asset of claimedAssets) {
    // Create asset card
    const assetCard = document.createElement('div');
    assetCard.style.cssText = `
      background: var(--bg-card);
      border-radius: 12px;
      padding: 15px;
      text-align: center;
      border: 2px solid var(--accent);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    `;

    let mediaHtml = '<div style="font-size: 4rem;">🎁</div>';

    if (asset.data) {
      const immutableData = asset.data.data || {};
      const templateData = asset.data.template?.immutable_data || {};
      const combinedData = { ...templateData, ...immutableData };

      // Check for video first, then image
      if (combinedData.video) {
        const videoUrl = combinedData.video.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${combinedData.video}`
          : combinedData.video;
        mediaHtml = `<video src="${videoUrl}" autoplay loop muted playsinline style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;"></video>`;
      } else if (combinedData.img) {
        const imgUrl = combinedData.img.startsWith('Qm')
          ? `https://ipfs.io/ipfs/${combinedData.img}`
          : combinedData.img;
        mediaHtml = `<img src="${imgUrl}" alt="${asset.name}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">`;
      }
    }

    assetCard.innerHTML = `
      ${mediaHtml}
      <div style="font-weight: bold; margin-bottom: 5px; color: var(--text-primary);">${asset.name}</div>
      <div style="font-size: 0.85rem; color: var(--accent);">Mint #${asset.mint}</div>
    `;

    unpackedAssetsGrid.appendChild(assetCard);
  }

  // Show modal
  unpackedModal.style.display = 'block';
}

// Confirm unpack
async function confirmUnpack() {
  if (!selectedPack || !currentUnpackAction) {
    return;
  }

  try {
    confirmUnpackBtn.disabled = true;
    confirmUnpackBtn.textContent = '⏳ Unpacking...';

    await doUnpack(selectedPack, currentUnpackAction);

    // Close modal
    packModal.style.display = 'none';
    selectedPack = null;
    currentUnpackAction = null;
  } catch (error) {
    confirmUnpackBtn.disabled = false;
    confirmUnpackBtn.textContent = '📦 Unpack Selected Pack';
    throw error;
  }
}

// Confirm claim
async function confirmClaim() {
  if (!selectedPack || !currentUnpackAction) {
    return;
  }

  try {
    confirmClaimBtn.disabled = true;
    confirmClaimBtn.textContent = '⏳ Claiming...';

    await doClaim(selectedPack, currentUnpackAction);

    // Close modal
    packModal.style.display = 'none';
    selectedPack = null;
    currentUnpackAction = null;
  } catch (error) {
    confirmClaimBtn.disabled = false;
    confirmClaimBtn.textContent = '🎁 Claim Selected Pack';
    throw error;
  }
}

// Claim pack that's already been unpacked (in unboxassets table)
async function doClaim(pack, action) {
  const assetId = pack.asset_id;
  const rollIds = pack.roll_ids;

  console.log(`🎁 Claiming already-unpacked pack ${assetId} (${rollIds.length} rolls: [${rollIds.join(', ')}])`);

  showError(`Claiming ${rollIds.length} rolls from pack...`, 'info');

  // Claim the unpacked contents with the EXACT rolls from blockchain
  const claimResult = await transact([{
    account: 'atomicpacksx',
    name: 'claimunboxed',
    authorization: [{
      actor: currentAccount,
      permission: 'active'
    }],
    data: {
      pack_asset_id: assetId.toString(),
      origin_roll_ids: rollIds  // Use pre-fetched roll IDs
    }
  }]);

  showError(`Success! Pack contents claimed (${rollIds.length} rolls). TX: ${claimResult.transaction_id}`, 'success');

  // Fetch asset details for the claimed assets and show modal
  console.log('🎨 Fetching details for claimed assets...');
  const claimedAssets = await fetchUnpackedAssetDetails(rollIds);
  await showUnpackedAssetsModal(claimedAssets);

  // Mark action as complete
  await markActionComplete(action, claimResult.transaction_id, JSON.stringify({
    asset_id: assetId,
    transfer_tx: 'already_unpacked',
    claim_tx: claimResult.transaction_id,
    num_rolls: rollIds.length,
    roll_ids: rollIds
  }));
}

// Perform the actual unpack
// Two-step process: 1) Transfer to unbox, 2) Claim the rolls
async function doUnpack(pack, action) {
  const assetId = pack.asset_id;
  const packTemplateId = pack.template.template_id;

  console.log(`📦 Starting unpack for pack ${assetId} (template ${packTemplateId})`);

  // Transfer pack to atomicpacksx to unbox it
  // Smart contract will automatically reject if not owned
  const transferResult = await transact([{
    account: 'atomicassets',
    name: 'transfer',
    authorization: [{
      actor: currentAccount,
      permission: 'active'
    }],
    data: {
      from: currentAccount,
      to: 'atomicpacksx',
      asset_ids: [assetId.toString()],
      memo: 'unbox'
    }
  }]);

  showError(`Pack transferred for unpacking. TX: ${transferResult.transaction_id}`, 'success');

  // Step 2: Wait for blockchain to process and populate unboxassets table
  console.log('⏳ Waiting 3 seconds for blockchain to process...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 3: Query unboxassets table to get the roll IDs
  let rollIds = [];
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts && rollIds.length === 0) {
    attempts++;
    console.log(`📡 Querying unboxassets table (attempt ${attempts}/${maxAttempts})...`);

    try {
      const rollResponse = await fetch(`${API_URL}/api/pack/unboxed-rolls/${assetId}`);
      const rollData = await rollResponse.json();

      if (rollData.success && rollData.roll_ids && rollData.roll_ids.length > 0) {
        rollIds = rollData.roll_ids;
        console.log(`✅ Found ${rollIds.length} rolls: [${rollIds.join(', ')}]`);
        break;
      }
    } catch (error) {
      console.warn(`Attempt ${attempts} failed:`, error.message);
    }

    if (attempts < maxAttempts) {
      console.log('⏳ Waiting 2 more seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (rollIds.length === 0) {
    throw new Error(`Pack unpacked but couldn't find rolls in unboxassets table. You may need to claim manually on NeftyBlocks. Transfer TX: ${transferResult.transaction_id}`);
  }

  // Step 4: Claim the unpacked rolls
  console.log(`🎁 Claiming ${rollIds.length} rolls...`);

  const claimResult = await transact([{
    account: 'atomicpacksx',
    name: 'claimunboxed',
    authorization: [{
      actor: currentAccount,
      permission: 'active'
    }],
    data: {
      pack_asset_id: assetId.toString(),
      origin_roll_ids: rollIds
    }
  }]);

  showError(`Success! Claimed ${rollIds.length} NFTs from pack. TX: ${claimResult.transaction_id}`, 'success');

  // Fetch asset details for the unpacked assets and show modal
  console.log('🎨 Fetching details for unpacked assets...');
  const claimedAssets = await fetchUnpackedAssetDetails(rollIds);
  await showUnpackedAssetsModal(claimedAssets);

  // Mark action as complete
  await markActionComplete(action, claimResult.transaction_id, JSON.stringify({
    asset_id: assetId,
    template_id: packTemplateId,
    transfer_tx: transferResult.transaction_id,
    claim_tx: claimResult.transaction_id,
    rolls_claimed: rollIds.length
  }));
}

// Fetch details for unpacked assets
async function fetchUnpackedAssetDetails(assetIds) {
  const atomicEndpoints = [
    'https://aa-wax-public1.neftyblocks.com',
    'https://wax-aa.eosdac.io',
    'https://atomic-wax-mainnet.wecan.dev',
    'https://wax-atomic-api.eosphere.io'
  ];

  const assets = [];

  for (const assetId of assetIds) {
    let assetData = null;

    // Try each endpoint
    for (const endpoint of atomicEndpoints) {
      try {
        const response = await fetch(`${endpoint}/atomicassets/v1/assets/${assetId}`, {
          timeout: 3000
        });
        if (response.ok) {
          const data = await response.json();
          assetData = data.data;
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (assetData) {
      assets.push({
        asset_id: assetId,
        name: assetData.name || assetData.data?.name || 'Unknown NFT',
        mint: assetData.template_mint || 'Unknown',
        data: assetData
      });
    } else {
      // Fallback if API fails
      assets.push({
        asset_id: assetId,
        name: 'Unknown NFT',
        mint: 'Unknown',
        data: null
      });
    }
  }

  return assets;
}

// Show blend asset selection modal
function showBlendAssetSelection(action, config, assets) {
  currentBlendAction = action;
  currentBlendConfig = config;
  availableBlendAssets = assets;
  selectedBlendAssets = [];

  const requiredCount = config.ingredient_count || 1;

  // Update requirements text
  blendRequirementsText.innerHTML = `
    <div>• <strong>Blend ID:</strong> ${config.blend_id}</div>
    <div>• <strong>Assets Required:</strong> ${requiredCount}</div>
    ${config.ingredient_templates ? `<div>• <strong>Template IDs:</strong> ${config.ingredient_templates.join(', ')}</div>` : ''}
  `;

  // Render available assets
  renderBlendAssets(requiredCount);

  // Update counter
  updateBlendCounter(requiredCount);

  // Show modal
  blendModal.style.display = 'block';
}

// Render blend assets with selection
function renderBlendAssets(requiredCount) {
  blendSelectionList.innerHTML = '';

  availableBlendAssets.forEach((asset, index) => {
    const assetCard = document.createElement('div');
    assetCard.style.cssText = `
      background: var(--bg-dark);
      padding: 10px;
      border-radius: 8px;
      border: 2px solid var(--border);
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    `;

    const imageUrl = asset.data?.img
      ? `https://ipfs.io/ipfs/${asset.data.img}`
      : 'https://via.placeholder.com/150?text=NFT';

    assetCard.innerHTML = `
      <img src="${imageUrl}" alt="${asset.name || 'Asset'}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;">
      <div style="font-size: 0.85rem; font-weight: bold; margin-bottom: 4px;">${asset.name || 'Unknown'}</div>
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">Mint #${asset.template_mint || '?'}</div>
      <div style="font-size: 0.7rem; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis;">ID: ${asset.asset_id}</div>
      <div style="margin-top: 8px;">
        <input type="checkbox" id="blend-asset-${index}" value="${asset.asset_id}" style="width: 20px; height: 20px; cursor: pointer;">
      </div>
    `;

    const checkbox = assetCard.querySelector('input[type="checkbox"]');

    // Handle selection
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (selectedBlendAssets.length >= requiredCount) {
          // Max reached, uncheck oldest
          const oldestAssetId = selectedBlendAssets.shift();
          const oldestCheckbox = document.querySelector(`input[value="${oldestAssetId}"]`);
          if (oldestCheckbox) {
            oldestCheckbox.checked = false;
            oldestCheckbox.parentElement.parentElement.style.borderColor = 'var(--border)';
            oldestCheckbox.parentElement.parentElement.style.background = 'var(--bg-dark)';
          }
        }
        selectedBlendAssets.push(asset.asset_id);
        assetCard.style.borderColor = 'var(--accent)';
        assetCard.style.background = 'var(--bg-card-hover)';
      } else {
        selectedBlendAssets = selectedBlendAssets.filter(id => id !== asset.asset_id);
        assetCard.style.borderColor = 'var(--border)';
        assetCard.style.background = 'var(--bg-dark)';
      }
      updateBlendCounter(requiredCount);
    });

    // Allow clicking card to toggle
    assetCard.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.click();
      }
    });

    blendSelectionList.appendChild(assetCard);
  });
}

// Update blend counter and button state
function updateBlendCounter(requiredCount) {
  blendSelectedCount.innerHTML = `Selected: <span style="color: ${selectedBlendAssets.length === requiredCount ? 'var(--success)' : 'var(--accent)'};">${selectedBlendAssets.length}</span> / ${requiredCount}`;

  confirmBlendBtn.disabled = selectedBlendAssets.length !== requiredCount;
  confirmBlendBtn.style.opacity = selectedBlendAssets.length === requiredCount ? '1' : '0.5';
}

// Close blend modal
function closeBlendModal() {
  blendModal.style.display = 'none';
  selectedBlendAssets = [];
  currentBlendAction = null;
  currentBlendConfig = null;
  availableBlendAssets = [];

  // Re-enable blend button
  if (currentBlendAction) {
    const btn = document.getElementById(`action-btn-${currentBlendAction.action_id}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔮 Blend Now';
    }
  }
}

// Confirm blend with selected assets
async function confirmBlend() {
  if (!currentBlendAction || !currentBlendConfig || selectedBlendAssets.length === 0) {
    return;
  }

  try {
    confirmBlendBtn.disabled = true;
    confirmBlendBtn.textContent = '⏳ Blending...';

    await doBlend(currentBlendAction, currentBlendConfig, selectedBlendAssets);

    // Close modal
    blendModal.style.display = 'none';
    selectedBlendAssets = [];
    currentBlendAction = null;
    currentBlendConfig = null;
  } catch (error) {
    confirmBlendBtn.disabled = false;
    confirmBlendBtn.textContent = '🔮 Execute Blend';
    throw error;
  }
}

// Perform the actual blend with selected assets
async function doBlend(action, config, assetsForBlend) {
  console.log(`🔮 Starting blend ${config.blend_id} with assets:`, assetsForBlend);

  // NeftyBlocks blend requires 3 actions in sequence:
  // 1. announcedepo - announce deposit
  // 2. atomicassets::transfer - transfer assets to blend.nefty with memo "deposit"
  // 3. nosecfuse - execute the blend
  const result = await transact([
    {
      account: 'blend.nefty',
      name: 'announcedepo',
      authorization: [{
        actor: currentAccount,
        permission: 'active'
      }],
      data: {
        count: assetsForBlend.length,
        owner: currentAccount
      }
    },
    {
      account: 'atomicassets',
      name: 'transfer',
      authorization: [{
        actor: currentAccount,
        permission: 'active'
      }],
      data: {
        asset_ids: assetsForBlend,
        from: currentAccount,
        memo: 'deposit',
        to: 'blend.nefty'
      }
    },
    {
      account: 'blend.nefty',
      name: 'nosecfuse',
      authorization: [{
        actor: currentAccount,
        permission: 'active'
      }],
      data: {
        blend_id: config.blend_id,
        claimer: currentAccount,
        own_assets: [],
        transferred_assets: assetsForBlend
      }
    }
  ]);

  showError(`Success! Blend completed. TX: ${result.transaction_id}`, 'success');

  // Mark action as complete
  await markActionComplete(action, result.transaction_id, JSON.stringify({
    blend_id: config.blend_id,
    asset_ids: assetsForBlend,
    tx: result.transaction_id
  }));
}

// Execute BLEND action
async function executeBlend(action, config) {
  if (!config || !config.blend_id) {
    throw new Error('BLEND action requires blend_id in config');
  }

  // Get user's assets to find ingredients (via server proxy to avoid CORS)
  const assetsResponse = await fetch(`${API_URL}/api/assets/${currentAccount}?collection_name=${config.collection_name || 'futuresrelic'}`);
  const assetsData = await assetsResponse.json();

  if (!assetsData.success) {
    throw new Error('Failed to fetch assets');
  }

  // Filter assets by template IDs if specified
  let ingredientAssets = assetsData.data;
  if (config.ingredient_templates) {
    const templateIds = config.ingredient_templates.map(t => t.toString());
    ingredientAssets = ingredientAssets.filter(asset =>
      templateIds.includes(asset.template.template_id)
    );
  }

  if (ingredientAssets.length < (config.ingredient_count || 1)) {
    throw new Error(`Not enough ingredients to complete blend. You have ${ingredientAssets.length} but need ${config.ingredient_count || 1}`);
  }

  // Show asset selection modal
  showBlendAssetSelection(action, config, ingredientAssets);
}

// Execute DROP action
async function executeDrop(action, config) {
  if (!config || !config.drop_id || !config.collection) {
    throw new Error('DROP action requires drop_id and collection in config');
  }

  // Store action for completion tracking
  currentDropAction = action;

  // Open NeftyBlocks drop embed
  openDropModal(config.collection, config.drop_id);
}

// Execute MARKET_SCOUT action
async function executeMarketScout(action, config) {
  if (!config || !config.template_id) {
    throw new Error('MARKET_SCOUT action requires template_id in config');
  }

  const url = `https://wax.atomichub.io/market?collection_name=${config.collection_name || 'futuresrelic'}&template_id=${config.template_id}&order=asc&sort=price`;

  window.open(url, '_blank');

  showError('Opened AtomicHub marketplace in new tab', 'success');
}

// Open drop modal
function openDropModal(collection, dropId) {
  // Clear previous content
  dropEmbedContainer.innerHTML = '';

  // Reset button state
  markDropCompleteBtn.disabled = false;
  markDropCompleteBtn.textContent = '✅ Mark as Complete (After Claiming)';

  // Create the neftyblocks-drops web component
  const dropEmbed = document.createElement('neftyblocks-drops');
  dropEmbed.setAttribute('collection', collection);
  dropEmbed.setAttribute('limit', '1');  // limit is a separate attribute

  // Use options config to show specific drop (ids must be comma-separated string)
  const options = {
    ids: dropId.toString()
  };
  dropEmbed.setAttribute('options', JSON.stringify(options));

  dropEmbedContainer.appendChild(dropEmbed);
  dropModal.style.display = 'block';
}

// Mark drop action as complete
async function markDropAsComplete() {
  if (!currentDropAction) {
    showError('No active drop action to complete', 'error');
    return;
  }

  markDropCompleteBtn.disabled = true;
  markDropCompleteBtn.textContent = '⏳ Marking Complete...';

  try {
    await markActionComplete(currentDropAction, null, null);
    showError('Drop action marked as complete!', 'success');
    closeDropModal();
  } catch (error) {
    console.error('Error marking drop complete:', error);
    showError('Failed to mark as complete: ' + error.message, 'error');
    markDropCompleteBtn.disabled = false;
    markDropCompleteBtn.textContent = '✅ Mark as Complete (After Claiming)';
  }
}

// Close drop modal
function closeDropModal() {
  dropModal.style.display = 'none';
  dropEmbedContainer.innerHTML = '';
  currentDropAction = null;

  // Reload progress in case user purchased
  loadStoryProgress();
}

// Transaction helper
async function transact(actions) {
  if (currentWallet === 'wcw') {
    return await wax.api.transact({
      actions: actions
    }, {
      blocksBehind: 3,
      expireSeconds: 90
    });
  } else if (currentWallet === 'anchor') {
    const result = await anchor.transact({
      actions: actions
    }, {
      blocksBehind: 3,
      expireSeconds: 90
    });
    return result;
  } else {
    throw new Error('No wallet connected');
  }
}
