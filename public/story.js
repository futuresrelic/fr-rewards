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

// Pack selection state
let selectedPack = null;  // Store full pack object with template data
let currentUnpackAction = null;

// Drop action state
let currentDropAction = null;

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
      }
      if (data.config.page_subtitle) {
        subtitleEl.textContent = data.config.page_subtitle;
      }
      if (data.config.logo_url) {
        logoEl.src = data.config.logo_url;
        logoEl.style.display = 'block';
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
  confirmUnpackBtn.addEventListener('click', confirmUnpack);
  markDropCompleteBtn.addEventListener('click', markDropAsComplete);
}

// Show error message
function showError(message, type = 'error') {
  errorMessageEl.textContent = message;
  errorMessageEl.className = `alert alert-${type}`;
  errorMessageEl.style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });

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
  } catch (error) {
    loadingSection.style.display = 'none';
    showError('Error loading story progress: ' + error.message);
    console.error('Error:', error);
  }
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
        ${action.action_description ? `<p style="margin: 8px 0; color: var(--text-secondary); font-size: 0.9rem;">${action.action_description}</p>` : ''}
        ${isCompleted && action.completed_at ? `
          <div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">
            Completed: ${new Date(action.completed_at).toLocaleString()}
            ${action.transaction_id ? `<br><a href="https://waxblock.io/transaction/${action.transaction_id}" target="_blank" style="color: var(--accent);">View TX →</a>` : ''}
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

  // Check asset ownership and update status badge if not completed
  if (!isCompleted) {
    // Add button event listener
    setTimeout(() => {
      const btn = document.getElementById(`action-btn-${action.action_id}`);
      if (btn) {
        btn.addEventListener('click', () => executeAction(action));
      }
    }, 0);

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

  // Fetch user's packs of this template via backend proxy (avoids CORS)
  const packsResponse = await fetch(`${API_URL}/api/user/assets/${currentAccount}/${config.pack_template_id}`);
  const packsData = await packsResponse.json();

  if (!packsData.success || !packsData.data || packsData.data.length === 0) {
    throw new Error(`You don't own any packs of template #${config.pack_template_id}`);
  }

  let packs = packsData.data;
  console.log(`Found ${packs.length} total packs from API`);

  // Check which packs are claimable (in unboxassets table)
  const assetIds = packs.map(p => p.asset_id);
  const claimableResponse = await fetch(`${API_URL}/api/pack/check-claimable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_ids: assetIds })
  });
  const claimableData = await claimableResponse.json();

  if (!claimableData.success) {
    console.warn('Failed to check claimable status, proceeding without it');
  }

  // Separate packs into claimable and unpackable
  const claimablePacks = [];
  const unpackablePacks = [];
  const skippedPacks = [];

  packs.forEach(pack => {
    // Skip burned assets (they show in API cache but don't exist on blockchain)
    if (pack.burned_at_block || pack.burned_at_time || pack.burned_by_account) {
      console.warn(`Pack ${pack.asset_id} (mint #${pack.template_mint}) was BURNED - skipping`);
      skippedPacks.push(pack);
      return;
    }

    const claimStatus = claimableData.success ? claimableData.claimable_status[pack.asset_id] : null;

    if (claimStatus && claimStatus.is_claimable) {
      // Pack is in unboxassets table - ready to claim
      pack.claimable = true;
      pack.roll_ids = claimStatus.roll_ids;
      pack.roll_count = claimStatus.roll_count;
      claimablePacks.push(pack);
      console.log(`Pack ${pack.asset_id} (mint #${pack.template_mint}) is CLAIMABLE (${pack.roll_count} rolls)`);
    } else if (pack.owner === currentAccount) {
      // Pack is owned by user - ready to unpack
      pack.claimable = false;
      unpackablePacks.push(pack);
      console.log(`Pack ${pack.asset_id} (mint #${pack.template_mint}) is UNPACKABLE`);
    } else if (pack.owner === 'atomicpacksx') {
      // Pack transferred to atomicpacksx but not in unboxassets table
      // This usually means it's about to be burned or there's a delay
      console.warn(`Pack ${pack.asset_id} (mint #${pack.template_mint}) is with atomicpacksx but not claimable yet - skipping`);
      skippedPacks.push(pack);
    } else {
      // Pack is in weird state - not owned and not claimable
      console.warn(`Pack ${pack.asset_id} (mint #${pack.template_mint}) is in unknown state - owner: ${pack.owner}, not claimable`);
      skippedPacks.push(pack);
    }
  });

  const totalValidPacks = claimablePacks.length + unpackablePacks.length;

  if (totalValidPacks === 0) {
    if (skippedPacks.length > 0) {
      throw new Error(`No packs available. Found ${packs.length} packs but ${skippedPacks.length} were already burned or claimed. Try refreshing the page.`);
    }
    throw new Error(`No packs available. Found ${packs.length} packs but none are ready to unpack or claim.`);
  }

  console.log(`Found ${unpackablePacks.length} unpackable, ${claimablePacks.length} claimable, ${skippedPacks.length} skipped`);


  // Combine and sort: claimable first, then by mint number
  const allPacks = [...claimablePacks, ...unpackablePacks].sort((a, b) => {
    // Claimable packs first
    if (a.claimable && !b.claimable) return -1;
    if (!a.claimable && b.claimable) return 1;

    // Then by mint number (descending - highest first)
    const mintA = parseInt(a.template_mint) || 0;
    const mintB = parseInt(b.template_mint) || 0;
    return mintB - mintA;
  });

  // If only one pack, process it immediately
  if (allPacks.length === 1) {
    const pack = allPacks[0];
    if (pack.claimable) {
      await doClaim(pack, action);
    } else {
      await doUnpack(pack, action);
    }
    return;
  }

  // Multiple packs - show selection modal
  currentUnpackAction = action;
  showPackSelectionModal(allPacks);
}

// Show pack selection modal
function showPackSelectionModal(packs) {
  packSelectionList.innerHTML = '';

  packs.forEach((pack, index) => {
    const isFirstPack = index === 0;
    const isClaimable = pack.claimable === true;

    const packOption = document.createElement('div');
    packOption.style.cssText = `
      background: ${isFirstPack ? 'var(--accent)' : 'var(--bg-dark)'};
      padding: 15px;
      border-radius: 8px;
      border: 2px solid ${isFirstPack ? 'var(--accent)' : (isClaimable ? '#ff9800' : 'var(--border)')};
      cursor: pointer;
      transition: all 0.2s;
    `;

    const statusBadge = isClaimable
      ? `<div style="background: #ff9800; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; display: inline-block; margin-top: 5px;">🎁 Ready to Claim (${pack.roll_count} rolls)</div>`
      : `<div style="background: #4CAF50; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; display: inline-block; margin-top: 5px;">📦 Ready to Unpack</div>`;

    packOption.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: bold; font-size: 1.1rem;">Mint #${pack.template_mint || 'Unknown'}</div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">Asset ID: ${pack.asset_id}</div>
          ${statusBadge}
          ${isFirstPack && !isClaimable ? '<div style="color: white; font-size: 0.85rem; margin-top: 5px;">✨ Highest Mint (Recommended)</div>' : ''}
          ${isFirstPack && isClaimable ? '<div style="color: white; font-size: 0.85rem; margin-top: 5px;">⚡ Action Required</div>' : ''}
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
      selectedPack = pack;  // Store full pack object

      // Update button text based on pack type
      if (pack.claimable) {
        confirmUnpackBtn.textContent = `🎁 Claim ${pack.roll_count} Rolls`;
      } else {
        confirmUnpackBtn.textContent = '📦 Unpack Selected Pack';
      }
    });

    packSelectionList.appendChild(packOption);
  });

  // Auto-select first pack
  selectedPack = packs[0];  // Store full pack object

  // Set initial button text
  if (packs[0].claimable) {
    confirmUnpackBtn.textContent = `🎁 Claim ${packs[0].roll_count} Rolls`;
  } else {
    confirmUnpackBtn.textContent = '📦 Unpack Selected Pack';
  }

  packModal.style.display = 'block';
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

// Confirm unpack or claim
async function confirmUnpack() {
  if (!selectedPack || !currentUnpackAction) {
    return;
  }

  try {
    confirmUnpackBtn.disabled = true;

    if (selectedPack.claimable) {
      // Pack is already unpacked, just claim it
      confirmUnpackBtn.textContent = '⏳ Claiming...';
      await doClaim(selectedPack, currentUnpackAction);
    } else {
      // Pack needs to be unpacked first
      confirmUnpackBtn.textContent = '⏳ Unpacking...';
      await doUnpack(selectedPack, currentUnpackAction);
    }

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
// Uses same method as Unpack tab: transfer to atomicpacksx with "unbox" memo
// Then claim the unpacked contents
async function doUnpack(pack, action) {
  const assetId = pack.asset_id;
  const packTemplateId = pack.template.template_id;

  console.log(`📦 Starting unpack for pack ${assetId} (template ${packTemplateId})`);

  // Step 0: Check if pack is already in unboxassets table (stuck in limbo)
  // This happens if the pack was transferred but not claimed
  console.log(`🔍 Checking if pack ${assetId} is already unpacked but unclaimed...`);
  let rollIds = [];
  let transferResult = null;
  let alreadyUnpacked = false;

  try {
    const checkResponse = await fetch(`${API_URL}/api/pack/unboxed-rolls/${assetId}`);
    const checkData = await checkResponse.json();

    if (checkData.success && checkData.roll_ids && checkData.roll_ids.length > 0) {
      rollIds = checkData.roll_ids;
      alreadyUnpacked = true;
      console.log(`✅ Pack is already unpacked! Found ${rollIds.length} rolls waiting to be claimed: [${rollIds.join(', ')}]`);
      showError(`Pack already unpacked - claiming ${rollIds.length} rolls...`, 'info');
    }
  } catch (error) {
    console.log('Pack not in unboxassets table yet, will need to transfer it');
  }

  // Step 1: Transfer pack to atomicpacksx to unpack it (if not already unpacked)
  if (!alreadyUnpacked) {
    transferResult = await transact([{
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

    // Step 2: Wait for blockchain to process the unpack and populate unboxassets table
    // This typically takes 1-2 seconds
    console.log('⏳ Waiting for blockchain to process unpack...');
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Step 3: Query the unboxassets table to get EXACT rolls that were created
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`📡 Querying unboxassets table for pack ${assetId} (attempt ${retryCount + 1}/${maxRetries})...`);
        const rollResponse = await fetch(`${API_URL}/api/pack/unboxed-rolls/${assetId}`);
        const rollData = await rollResponse.json();

        if (rollData.success && rollData.roll_ids && rollData.roll_ids.length > 0) {
          rollIds = rollData.roll_ids;
          console.log(`✅ Found ${rollIds.length} rolls in unboxassets table: [${rollIds.join(', ')}]`);
          break;
        } else {
          console.warn(`⚠️ No rolls found yet, retrying in 2 seconds...`);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error('Error querying unboxed rolls:', error);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // If we still couldn't find rolls after retries, throw error
    if (rollIds.length === 0) {
      throw new Error(`Failed to find unboxed rolls for pack ${assetId}. The pack may not have unpacked correctly, or the blockchain needs more time to process.`);
    }
  }

  // Step 4: Claim the unpacked contents with the EXACT rolls from blockchain
  console.log(`🎁 Claiming ${rollIds.length} rolls: [${rollIds.join(', ')}]`);

  const claimResult = await transact([{
    account: 'atomicpacksx',
    name: 'claimunboxed',
    authorization: [{
      actor: currentAccount,
      permission: 'active'
    }],
    data: {
      pack_asset_id: assetId.toString(),
      origin_roll_ids: rollIds  // Use EXACT rolls from blockchain
    }
  }]);

  showError(`Success! Pack contents claimed (${rollIds.length} rolls). TX: ${claimResult.transaction_id}`, 'success');

  // Mark action as complete
  await markActionComplete(action, claimResult.transaction_id, JSON.stringify({
    asset_id: assetId,
    transfer_tx: transferResult ? transferResult.transaction_id : 'already_unpacked',
    claim_tx: claimResult.transaction_id,
    num_rolls: rollIds.length,
    roll_ids: rollIds
  }));
}

// Execute BLEND action
async function executeBlend(action, config) {
  if (!config || !config.blend_id) {
    throw new Error('BLEND action requires blend_id in config');
  }

  // Get user's assets to find ingredients
  const assetsResponse = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets?owner=${currentAccount}&collection_name=${config.collection_name || 'futuresrelic'}&limit=1000`);
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
    throw new Error('Not enough ingredients to complete blend');
  }

  // Take required number of assets
  const assetsForBlend = ingredientAssets.slice(0, config.ingredient_count || 1)
    .map(a => a.asset_id);

  const result = await transact([{
    account: 'blend.nefty',
    name: 'claimblend',
    authorization: [{
      actor: currentAccount,
      permission: 'active'
    }],
    data: {
      blend_id: config.blend_id,
      claimer: currentAccount,
      transferred_assets: assetsForBlend
    }
  }]);

  showError(`Success! Blend completed. TX: ${result.transaction_id}`, 'success');

  // Reload progress
  setTimeout(() => loadStoryProgress(), 2000);
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
