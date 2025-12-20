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
}

// Show error message
function showError(message, type = 'error') {
  errorMessageEl.textContent = message;
  errorMessageEl.className = `alert alert-${type}`;
  errorMessageEl.style.display = 'block';

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
      <div style="display: flex; flex-direction: column; gap: 15px;">
        ${step.actions.sort((a, b) => a.action_order - b.action_order).map(action => {
          const isCompleted = !!action.completed_at;
          const emoji = actionTypeEmoji[action.action_type] || '⚡';

          return `
            <div style="background: var(--bg-dark); padding: 15px; border-radius: 8px; border: 2px solid ${isCompleted ? 'var(--success)' : 'var(--border)'};">
              <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span style="font-size: 1.5rem;">${emoji}</span>
                    <h4 style="margin: 0;">${action.action_name}</h4>
                    ${isCompleted ? '<span style="background: var(--success); color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;">✅ Completed</span>' : '<span style="background: var(--bg-card-hover); color: var(--text-secondary); padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;">⏳ Pending</span>'}
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
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    stepsContainer.appendChild(stepCard);
  });

  storySection.style.display = 'block';
}
