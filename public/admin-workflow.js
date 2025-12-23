const API_URL = window.location.origin;

let adminToken = null;
let currentStepId = null;

// Elements
const loginSection = document.getElementById('admin-login');
const dashboardSection = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkExistingSession();
});

// Setup event listeners
function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  document.getElementById('admin-logout').addEventListener('click', logout);
  document.getElementById('add-step-form').addEventListener('submit', handleAddStep);
  document.getElementById('add-action-form').addEventListener('submit', handleAddAction);
  document.getElementById('close-actions-modal').addEventListener('click', closeActionsModal);

  // Action type change listener
  document.getElementById('action-type-input').addEventListener('change', handleActionTypeChange);
}

// Handle action type change to show/hide config fields
function handleActionTypeChange(e) {
  const actionType = e.target.value;

  // Hide all config sections
  document.querySelectorAll('.config-section').forEach(section => {
    section.style.display = 'none';
  });

  // Show relevant config section
  const sectionMap = {
    'CLAIM': 'config-claim',
    'UNPACK': 'config-unpack',
    'BLEND': 'config-blend',
    'DROP': 'config-drop',
    'MARKET_SCOUT': 'config-market'
  };

  const sectionId = sectionMap[actionType];
  if (sectionId) {
    document.getElementById(sectionId).style.display = 'block';
  }
}

// Build config JSON from form fields based on action type
function buildConfigFromFields(actionType) {
  const config = {};

  switch (actionType) {
    case 'CLAIM':
      const claimTemplateId = document.getElementById('claim-template-id').value;
      if (claimTemplateId) {
        config.template_id = parseInt(claimTemplateId);
      }
      break;

    case 'UNPACK':
      const packTemplate = document.getElementById('unpack-pack-template').value;
      if (packTemplate) {
        config.pack_template_id = parseInt(packTemplate);
      }
      break;

    case 'BLEND':
      const blendId = document.getElementById('blend-blend-id').value;
      const ingredients = document.getElementById('blend-ingredients').value;
      const count = document.getElementById('blend-count').value;
      const blendCollection = document.getElementById('blend-collection').value;

      if (blendId) config.blend_id = parseInt(blendId);
      if (ingredients) {
        config.ingredient_templates = ingredients.split(',').map(t => parseInt(t.trim()));
      }
      if (count) config.ingredient_count = parseInt(count);
      if (blendCollection) config.collection_name = blendCollection;
      break;

    case 'DROP':
      const dropId = document.getElementById('drop-drop-id').value;
      const dropCollection = document.getElementById('drop-collection').value;

      if (dropId) config.drop_id = dropId; // Keep as string for NeftyBlocks
      if (dropCollection) config.collection = dropCollection;
      break;

    case 'MARKET_SCOUT':
      const marketTemplateId = document.getElementById('market-template-id').value;
      const marketCollection = document.getElementById('market-collection').value;

      if (marketTemplateId) config.template_id = parseInt(marketTemplateId);
      if (marketCollection) config.collection_name = marketCollection;
      break;
  }

  return Object.keys(config).length > 0 ? config : null;
}

// Check existing session
function checkExistingSession() {
  const savedToken = sessionStorage.getItem('admin_token');
  if (savedToken) {
    adminToken = savedToken;
    showDashboard();
  }
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const password = document.getElementById('admin-password').value;

  try {
    const response = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    adminToken = data.token;
    sessionStorage.setItem('admin_token', adminToken);
    showDashboard();

  } catch (error) {
    loginError.textContent = error.message;
    loginError.style.display = 'block';
  }
}

// Logout
function logout() {
  adminToken = null;
  sessionStorage.removeItem('admin_token');
  loginSection.style.display = 'block';
  dashboardSection.style.display = 'none';
  loginForm.reset();
}

// Show dashboard
async function showDashboard() {
  loginSection.style.display = 'none';
  dashboardSection.style.display = 'block';

  try {
    await loadSteps();
  } catch (error) {
    console.error('Error loading dashboard:', error);
    if (error.message.includes('401')) {
      logout();
    }
  }
}

// ==================== WORKFLOW STEPS ====================

// Load steps
async function loadSteps() {
  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/steps`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load workflow steps');
    }

    const data = await response.json();
    const steps = data.steps;

    const stepsList = document.getElementById('steps-list');
    stepsList.innerHTML = '';

    if (steps.length === 0) {
      stepsList.innerHTML = '<p style="color: var(--text-secondary);">No steps configured yet. Add one above!</p>';
      return;
    }

    steps.forEach(step => {
      const stepCard = document.createElement('div');
      stepCard.style.cssText = 'background: var(--bg-card); padding: 20px; border-radius: 8px; border: 2px solid var(--border);';
      stepCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
          <div style="flex: 1; min-width: 200px;">
            <h3 style="margin: 0 0 5px 0; display: flex; align-items: center; gap: 10px;">
              <span style="background: var(--accent); color: white; padding: 5px 15px; border-radius: 20px; font-size: 0.9rem;">Step ${step.step_order}</span>
              ${step.name}
            </h3>
            ${step.description ? `<p style="margin: 10px 0 0 0; color: var(--text-secondary);">${step.description}</p>` : ''}
            <div style="margin-top: 10px;">
              <span class="status-badge ${step.enabled ? 'success' : 'error'}" style="padding: 5px 10px; border-radius: 5px; font-size: 0.85rem;">
                ${step.enabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="openActionsModal(${step.id}, '${step.name.replace(/'/g, "\\'")}', '${(step.description || '').replace(/'/g, "\\'")}')">
              ⚡ Manage Actions
            </button>
            <button class="btn btn-secondary btn-sm" onclick="toggleStep(${step.id}, ${step.enabled})">${step.enabled ? '⏸️ Disable' : '▶️ Enable'}</button>
            <button class="btn btn-sm" style="background: #ef4444; color: white;" onclick="deleteStep(${step.id})">🗑️ Delete</button>
          </div>
        </div>
      `;
      stepsList.appendChild(stepCard);
    });

  } catch (error) {
    console.error('Error loading steps:', error);
    throw error;
  }
}

// Handle add step
async function handleAddStep(e) {
  e.preventDefault();

  const step = {
    step_order: parseInt(document.getElementById('new-step-order').value),
    name: document.getElementById('new-step-name').value,
    description: document.getElementById('new-step-description').value
  };

  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/steps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(step)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add step');
    }

    showStepMessage('Step added successfully!', 'success');
    document.getElementById('add-step-form').reset();
    await loadSteps();

  } catch (error) {
    showStepMessage('Error: ' + error.message, 'error');
  }
}

// Toggle step enable/disable
async function toggleStep(stepId, currentlyEnabled) {
  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/steps/${stepId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        enabled: currentlyEnabled ? 0 : 1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to toggle step');
    }

    showStepMessage(`Step ${currentlyEnabled ? 'disabled' : 'enabled'} successfully!`, 'success');
    await loadSteps();

  } catch (error) {
    showStepMessage('Error: ' + error.message, 'error');
  }
}

// Delete step
async function deleteStep(stepId) {
  if (!confirm('Are you sure you want to delete this step? This will also delete all associated actions.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/steps/${stepId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete step');
    }

    showStepMessage('Step deleted successfully!', 'success');
    await loadSteps();

  } catch (error) {
    showStepMessage('Error: ' + error.message, 'error');
  }
}

// Show step message
function showStepMessage(message, type) {
  const stepMessage = document.getElementById('step-message');
  stepMessage.textContent = message;
  stepMessage.className = `alert alert-${type}`;
  stepMessage.style.display = 'block';

  setTimeout(() => {
    stepMessage.style.display = 'none';
  }, 5000);
}

// ==================== WORKFLOW ACTIONS ====================

// Open actions modal
async function openActionsModal(stepId, stepName, stepDescription) {
  currentStepId = stepId;
  document.getElementById('modal-step-name').textContent = stepName;
  document.getElementById('modal-step-description').textContent = stepDescription || 'No description';
  document.getElementById('action-step-id-hidden').value = stepId;
  document.getElementById('actions-modal').style.display = 'block';
  await loadActions(stepId);
}

// Close actions modal
function closeActionsModal() {
  document.getElementById('actions-modal').style.display = 'none';
  currentStepId = null;
}

// Load actions for a step
async function loadActions(stepId) {
  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/actions?step_id=${stepId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!response.ok) throw new Error('Failed to load actions');

    const data = await response.json();
    const actions = data.actions;

    const actionsList = document.getElementById('actions-list');
    actionsList.innerHTML = '';

    if (actions.length === 0) {
      actionsList.innerHTML = '<p style="color: var(--text-secondary);">No actions configured yet. Add one above!</p>';
      return;
    }

    actions.forEach(action => {
      const actionCard = document.createElement('div');
      actionCard.style.cssText = 'background: var(--bg-dark); padding: 15px; border-radius: 8px; border: 2px solid var(--border);';

      const actionTypeEmoji = {
        'CLAIM': '🎁',
        'UNPACK': '📦',
        'BLEND': '🔮',
        'DROP': '💧',
        'MARKET_SCOUT': '🔍'
      };

      actionCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
          <div style="flex: 1; min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 10px;">
              <span style="background: var(--bg-card-hover); padding: 5px 10px; border-radius: 5px; font-size: 0.85rem;">Order ${action.action_order}</span>
              <span>${actionTypeEmoji[action.action_type] || '⚡'} ${action.action_type}</span>
            </h4>
            <p style="margin: 5px 0; font-weight: bold;">${action.name}</p>
            ${action.description ? `<p style="margin: 5px 0; color: var(--text-secondary); font-size: 0.9rem;">${action.description}</p>` : ''}
            ${action.config ? `<details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: var(--accent);">View Configuration</summary>
              <pre style="background: var(--bg-card); padding: 10px; border-radius: 5px; margin-top: 10px; overflow-x: auto; font-size: 0.85rem;">${action.config}</pre>
            </details>` : ''}
            <div style="margin-top: 10px;">
              <span class="status-badge ${action.enabled ? 'success' : 'error'}" style="padding: 5px 10px; border-radius: 5px; font-size: 0.85rem;">
                ${action.enabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-sm btn-secondary" onclick="moveActionUp(${action.id}, ${action.action_order})" ${action.action_order === 0 ? 'disabled' : ''}>↑ Up</button>
            <button class="btn btn-sm btn-secondary" onclick="moveActionDown(${action.id}, ${action.action_order}, ${actions.length - 1})">↓ Down</button>
            <button class="btn btn-sm btn-primary" onclick="editAction(${action.id})">✏️ Edit</button>
            <button class="btn btn-sm" style="background: #ef4444; color: white;" onclick="deleteAction(${action.id})">🗑️ Delete</button>
          </div>
        </div>
      `;
      actionsList.appendChild(actionCard);
    });
  } catch (error) {
    console.error('Error loading actions:', error);
    showActionsMessage('Error loading actions: ' + error.message, 'error');
  }
}

// Handle add action
async function handleAddAction(e) {
  e.preventDefault();

  const stepId = currentStepId;
  const actionOrder = parseInt(document.getElementById('action-order-input').value);
  const actionType = document.getElementById('action-type-input').value;
  const name = document.getElementById('action-name-input').value;
  const description = document.getElementById('action-description-input').value.trim();

  // Build config from simple fields (no more JSON!)
  const config = buildConfigFromFields(actionType);

  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        step_id: stepId,
        action_order: actionOrder,
        action_type: actionType,
        name: name,
        description: description || null,
        config: config ? JSON.stringify(config) : null
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add action');
    }

    showActionsMessage('Action added successfully!', 'success');
    document.getElementById('add-action-form').reset();
    document.getElementById('action-order-input').value = '0';
    // Reset config fields
    document.querySelectorAll('.config-section').forEach(section => {
      section.style.display = 'none';
    });
    await loadActions(stepId);
  } catch (error) {
    showActionsMessage('Error: ' + error.message, 'error');
  }
}

// Delete action
async function deleteAction(actionId) {
  if (!confirm('Are you sure you want to delete this action?')) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/actions/${actionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete action');
    }

    showActionsMessage('Action deleted successfully!', 'success');
    await loadActions(currentStepId);
  } catch (error) {
    showActionsMessage('Error: ' + error.message, 'error');
  }
}

// Edit action
async function editAction(actionId) {
  try {
    // Fetch the action details
    const response = await fetch(`${API_URL}/api/admin/workflow/actions?step_id=${currentStepId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    const action = data.actions.find(a => a.id === actionId);

    if (!action) {
      throw new Error('Action not found');
    }

    // Prompt for new order
    const newOrder = prompt(`Enter new order for "${action.name}" (current: ${action.action_order}):`, action.action_order);
    if (newOrder === null) return; // Cancelled

    const orderNum = parseInt(newOrder);
    if (isNaN(orderNum) || orderNum < 0) {
      showActionsMessage('Invalid order number', 'error');
      return;
    }

    // Update the action
    const updateResponse = await fetch(`${API_URL}/api/admin/workflow/actions/${actionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action_order: orderNum })
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to update action');
    }

    showActionsMessage('Action order updated!', 'success');
    await loadActions(currentStepId);
  } catch (error) {
    showActionsMessage('Error: ' + error.message, 'error');
  }
}

// Move action up
async function moveActionUp(actionId, currentOrder) {
  if (currentOrder === 0) return; // Can't move up from position 0

  try {
    const updateResponse = await fetch(`${API_URL}/api/admin/workflow/actions/${actionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action_order: currentOrder - 1 })
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to move action');
    }

    showActionsMessage('Action moved up!', 'success');
    await loadActions(currentStepId);
  } catch (error) {
    showActionsMessage('Error: ' + error.message, 'error');
  }
}

// Move action down
async function moveActionDown(actionId, currentOrder, maxOrder) {
  if (currentOrder >= maxOrder) return; // Can't move down from last position

  try {
    const updateResponse = await fetch(`${API_URL}/api/admin/workflow/actions/${actionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action_order: currentOrder + 1 })
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to move action');
    }

    showActionsMessage('Action moved down!', 'success');
    await loadActions(currentStepId);
  } catch (error) {
    showActionsMessage('Error: ' + error.message, 'error');
  }
}

// Show actions message
function showActionsMessage(message, type) {
  const messageEl = document.getElementById('actions-message');
  messageEl.textContent = message;
  messageEl.className = `alert alert-${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}

// Auto-refresh steps every 30 seconds
setInterval(() => {
  if (adminToken && dashboardSection.style.display !== 'none' && !currentStepId) {
    loadSteps();
  }
}, 30000);
