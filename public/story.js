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
const packModal = document.getElementById('pack-modal');
const packSelectionList = document.getElementById('pack-selection-list');
const confirmUnpackBtn = document.getElementById('confirm-unpack-btn');

// Pack selection state
let selectedPackAssetId = null;
let currentUnpackAction = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadPageBranding();
  setupEventListeners();
  checkExistingConnection();
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
function checkExistingConnection() {
  const savedWallet = localStorage.getItem('wallet_type');
  const savedAccount = localStorage.getItem('wallet_account');

  if (savedWallet && savedAccount) {
    currentWallet = savedWallet;
    currentAccount = savedAccount;
    showConnected();
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
      anchor = await getAnchorLink();
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
            '<span style="background: var(--bg-card-hover); color: var(--text-secondary); padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;">⏳ Pending</span>'}
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

  // Add button event listener if not completed
  if (!isCompleted) {
    setTimeout(() => {
      const btn = document.getElementById(`action-btn-${action.action_id}`);
      if (btn) {
        btn.addEventListener('click', () => executeAction(action));
      }
    }, 0);
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

  // Fetch user's packs of this template
  const packsResponse = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets?owner=${currentAccount}&template_id=${config.pack_template_id}&limit=100`);
  const packsData = await packsResponse.json();

  if (!packsData.success || !packsData.data || packsData.data.length === 0) {
    throw new Error(`You don't own any packs of template #${config.pack_template_id}`);
  }

  const packs = packsData.data;

  // Sort by mint number (descending - highest first)
  packs.sort((a, b) => {
    const mintA = parseInt(a.template_mint) || 0;
    const mintB = parseInt(b.template_mint) || 0;
    return mintB - mintA;
  });

  // If only one pack, unpack it immediately
  if (packs.length === 1) {
    await doUnpack(packs[0].asset_id, action);
    return;
  }

  // Multiple packs - show selection modal
  currentUnpackAction = action;
  showPackSelectionModal(packs);
}

// Show pack selection modal
function showPackSelectionModal(packs) {
  packSelectionList.innerHTML = '';

  packs.forEach((pack, index) => {
    const isFirstPack = index === 0;
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
          <div style="font-weight: bold; font-size: 1.1rem;">Mint #${pack.template_mint || 'Unknown'}</div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">Asset ID: ${pack.asset_id}</div>
          ${isFirstPack ? '<div style="color: white; font-size: 0.85rem; margin-top: 5px;">✨ Highest Mint (Recommended)</div>' : ''}
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
      selectedPackAssetId = pack.asset_id;
    });

    packSelectionList.appendChild(packOption);
  });

  // Auto-select highest mint
  selectedPackAssetId = packs[0].asset_id;

  packModal.style.display = 'block';
}

// Close pack modal
function closePackModal() {
  packModal.style.display = 'none';
  selectedPackAssetId = null;
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
  if (!selectedPackAssetId || !currentUnpackAction) {
    return;
  }

  try {
    confirmUnpackBtn.disabled = true;
    confirmUnpackBtn.textContent = '⏳ Unpacking...';

    await doUnpack(selectedPackAssetId, currentUnpackAction);

    // Close modal
    packModal.style.display = 'none';
    selectedPackAssetId = null;
    currentUnpackAction = null;
  } catch (error) {
    confirmUnpackBtn.disabled = false;
    confirmUnpackBtn.textContent = '📦 Unpack Selected Pack';
    throw error;
  }
}

// Perform the actual unpack
async function doUnpack(assetId, action) {
  const result = await transact([{
    account: 'atomicpacksx',
    name: 'unpack',
    authorization: [{
      actor: currentAccount,
      permission: 'active'
    }],
    data: {
      pack_asset_id: assetId.toString(),
      pack_owner: currentAccount
    }
  }]);

  showError(`Success! Pack unpacked. TX: ${result.transaction_id}`, 'success');

  // Reload progress
  setTimeout(() => loadStoryProgress(), 2000);
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

// Close drop modal
function closeDropModal() {
  dropModal.style.display = 'none';
  dropEmbedContainer.innerHTML = '';

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
