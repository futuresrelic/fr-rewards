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
  confirmClaimBtn.addEventListener('click', confirmClaim);
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

  // Fetch user's packs of this template via backend proxy (avoids CORS)
  const packsResponse = await fetch(`${API_URL}/api/user/assets/${currentAccount}/${config.pack_template_id}`);
  const packsData = await packsResponse.json();

  if (!packsData.success || !packsData.data || packsData.data.length === 0) {
    throw new Error(`You don't own any packs of template #${config.pack_template_id}`);
  }

  let packs = packsData.data;
  console.log(`Found ${packs.length} total packs from API (may include stale cache)`);

  // STEP 1: Check ALL packs for claimability (query unboxassets table)
  console.log(`🔍 Step 1: Checking ${packs.length} packs for claimability...`);
  const claimableMap = {};
  const allAssetIds = packs.map(p => p.asset_id);

  try {
    const claimableResponse = await fetch(`${API_URL}/api/pack/check-claimable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: allAssetIds })
    });
    const claimableData = await claimableResponse.json();

    if (claimableData.success) {
      Object.keys(claimableData.claimable_status).forEach(assetId => {
        const status = claimableData.claimable_status[assetId];
        if (status.is_claimable) {
          claimableMap[assetId] = status;
        }
      });
      console.log(`Found ${Object.keys(claimableMap).length} packs in unboxassets table`);
    }
  } catch (error) {
    console.warn('Error checking claimable status:', error);
  }

  // STEP 2: Verify ACTUAL ownership of each pack (eliminate stale API cache)
  console.log(`🔍 Step 2: Verifying actual ownership for ${packs.length} packs...`);
  const verifiedPacks = [];
  let checkedCount = 0;

  for (const pack of packs) {
    checkedCount++;
    const assetId = pack.asset_id;

    // If in unboxassets table, it's claimable
    if (claimableMap[assetId]) {
      pack.roll_ids = claimableMap[assetId].roll_ids;
      pack.is_claimable = true;
      verifiedPacks.push(pack);
      console.log(`✅ [${checkedCount}/${packs.length}] Pack ${assetId} (mint #${pack.template_mint}) is CLAIMABLE (${claimableMap[assetId].roll_count} rolls)`);
      continue;
    }

    // Verify if actually owned (not stale cache)
    try {
      const verifyResponse = await fetch(`${API_URL}/api/asset/verify-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          expected_owner: currentAccount
        })
      });

      if (!verifyResponse.ok) {
        console.warn(`⚠️ [${checkedCount}/${packs.length}] Pack ${assetId} verification failed (${verifyResponse.status})`);
        continue;
      }

      const verifyData = await verifyResponse.json();

      if (verifyData.success && verifyData.is_owned && !verifyData.is_burned) {
        verifiedPacks.push(pack);
        console.log(`✅ [${checkedCount}/${packs.length}] Pack ${assetId} (mint #${pack.template_mint}) is OWNED - ready to unpack`);
      } else {
        console.log(`❌ [${checkedCount}/${packs.length}] Pack ${assetId} (mint #${pack.template_mint}) NOT VALID (owned: ${verifyData.is_owned}, burned: ${verifyData.is_burned}, owner: ${verifyData.current_owner || 'none'})`);
      }
    } catch (error) {
      console.warn(`⚠️ [${checkedCount}/${packs.length}] Could not verify pack ${assetId}:`, error.message);
    }
  }

  if (verifiedPacks.length === 0) {
    throw new Error(`No packs available. All packs have been unpacked, claimed, or are no longer in your wallet.`);
  }

  const claimableCount = verifiedPacks.filter(p => p.is_claimable).length;
  const ownedCount = verifiedPacks.filter(p => !p.is_claimable).length;
  console.log(`✅ Verified ${verifiedPacks.length} valid packs (${claimableCount} claimable, ${ownedCount} owned)`);

  // Sort by mint number (lowest first for easier browsing)
  verifiedPacks.sort((a, b) => {
    const mintA = parseInt(a.template_mint) || 0;
    const mintB = parseInt(b.template_mint) || 0;
    return mintA - mintB;  // Ascending order
  });

  // Always show modal (even for 1 pack - user can review before action)
  currentUnpackAction = action;
  showPackSelectionModal(verifiedPacks);
}

// Pack pagination
let allPacksForModal = [];
let currentPackPage = 0;
const PACKS_PER_PAGE = 15;

// Show pack selection modal with pagination
function showPackSelectionModal(packs) {
  allPacksForModal = packs;
  currentPackPage = 0;
  renderPackPage();
  packModal.style.display = 'block';
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

  // PRE-FLIGHT CHECK: Verify ownership before attempting transfer
  console.log(`🔍 Verifying ownership of asset ${assetId}...`);

  const verifyResponse = await fetch(`${API_URL}/api/asset/verify-ownership`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset_id: assetId,
      expected_owner: currentAccount
    })
  });

  const verifyData = await verifyResponse.json();

  // Check if pack is burned
  if (verifyData.is_burned) {
    throw new Error(`Pack ${assetId} has already been burned/claimed. It no longer exists.`);
  }

  // Check if pack is owned by user
  if (!verifyData.is_owned) {
    throw new Error(`Pack ${assetId} is not owned by you (current owner: ${verifyData.current_owner || 'unknown'}). It may have already been unpacked. Please use the "Claim" button if it's ready to claim, or refresh the page.`);
  }

  console.log(`✅ Ownership verified. Pack ${assetId} is owned by ${currentAccount}`);

  // Step 1: Transfer pack to atomicpacksx to unbox it
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

  // Mark action as complete
  await markActionComplete(action, claimResult.transaction_id, JSON.stringify({
    asset_id: assetId,
    template_id: packTemplateId,
    transfer_tx: transferResult.transaction_id,
    claim_tx: claimResult.transaction_id,
    rolls_claimed: rollIds.length
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
