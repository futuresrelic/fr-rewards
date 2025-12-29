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

  // Edit modals
  document.getElementById('close-edit-step-modal').addEventListener('click', closeEditStepModal);
  document.getElementById('close-edit-action-modal').addEventListener('click', closeEditActionModal);
  document.getElementById('edit-step-form').addEventListener('submit', handleEditStep);
  document.getElementById('edit-action-form').addEventListener('submit', handleEditAction);
  document.getElementById('edit-action-type').addEventListener('change', handleEditActionTypeChange);
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
    'BLEND_ARRAY': 'config-blend-array',
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

    case 'BLEND_ARRAY':
      const blendArrayIds = document.getElementById('blend-array-ids').value;
      const blendArrayCollection = document.getElementById('blend-array-collection').value;

      if (blendArrayIds) {
        // Parse blend IDs (stored as comma-separated string)
        config.blend_ids = blendArrayIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      if (blendArrayCollection) config.collection_name = blendArrayCollection;
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
            <button class="btn btn-secondary btn-sm" onclick="openEditStepModal(${step.id})">✏️ Edit</button>
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
            <button class="btn btn-sm btn-primary" onclick="openEditActionModal(${action.id})">✏️ Edit</button>
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

// REMOVED OLD editAction - replaced with full modal editing below

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

// ==================== EDIT STEP MODAL ====================

let allSteps = []; // Store all steps for editing

async function openEditStepModal(stepId) {
  try {
    // Fetch fresh step data
    const response = await fetch(`${API_URL}/api/admin/workflow/steps`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    const step = data.steps.find(s => s.id === stepId);

    if (!step) {
      showStepMessage('Step not found', 'error');
      return;
    }

    // Populate form
    document.getElementById('edit-step-id').value = step.id;
    document.getElementById('edit-step-order').value = step.step_order;
    document.getElementById('edit-step-name').value = step.name;
    document.getElementById('edit-step-description').value = step.description || '';
    document.getElementById('edit-step-enabled').checked = step.enabled === 1;

    // Show modal
    document.getElementById('edit-step-modal').style.display = 'block';
  } catch (error) {
    showStepMessage('Error loading step: ' + error.message, 'error');
  }
}

function closeEditStepModal() {
  document.getElementById('edit-step-modal').style.display = 'none';
}

async function handleEditStep(e) {
  e.preventDefault();

  const stepId = document.getElementById('edit-step-id').value;
  const updates = {
    step_order: parseInt(document.getElementById('edit-step-order').value),
    name: document.getElementById('edit-step-name').value,
    description: document.getElementById('edit-step-description').value || null,
    enabled: document.getElementById('edit-step-enabled').checked ? 1 : 0
  };

  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/steps/${stepId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update step');
    }

    showStepMessage('✅ Step updated successfully!', 'success');
    closeEditStepModal();
    await loadSteps();

  } catch (error) {
    showStepMessage('Error: ' + error.message, 'error');
  }
}

// ==================== EDIT ACTION MODAL ====================

let currentEditingAction = null;

async function openEditActionModal(actionId) {
  try {
    // Fetch action data
    const response = await fetch(`${API_URL}/api/admin/workflow/actions?step_id=${currentStepId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    const action = data.actions.find(a => a.id === actionId);

    if (!action) {
      showActionsMessage('Action not found', 'error');
      return;
    }

    currentEditingAction = action;

    // Parse config
    let config = {};
    try {
      config = action.config ? JSON.parse(action.config) : {};
    } catch (e) {
      console.error('Failed to parse action config:', e);
    }

    // Populate basic fields
    document.getElementById('edit-action-id').value = action.id;
    document.getElementById('edit-action-order').value = action.action_order;
    document.getElementById('edit-action-type').value = action.action_type;
    document.getElementById('edit-action-name').value = action.name;
    document.getElementById('edit-action-description').value = action.description || '';
    document.getElementById('edit-action-enabled').checked = action.enabled === 1;

    // Show correct config section
    handleEditActionTypeChange({ target: { value: action.action_type } });

    // Populate config fields
    populateEditConfigFields(action.action_type, config);

    // Show modal
    document.getElementById('edit-action-modal').style.display = 'block';

  } catch (error) {
    showActionsMessage('Error loading action: ' + error.message, 'error');
  }
}

function closeEditActionModal() {
  document.getElementById('edit-action-modal').style.display = 'none';
  currentEditingAction = null;
}

function handleEditActionTypeChange(e) {
  const actionType = e.target.value;

  // Hide all edit config sections
  document.querySelectorAll('#edit-config-fields .config-section').forEach(section => {
    section.style.display = 'none';
  });

  // Show relevant section
  const sectionMap = {
    'CLAIM': 'edit-config-claim',
    'UNPACK': 'edit-config-unpack',
    'BLEND': 'edit-config-blend',
    'BLEND_ARRAY': 'edit-config-blend-array',
    'DROP': 'edit-config-drop',
    'MARKET_SCOUT': 'edit-config-market'
  };

  const sectionId = sectionMap[actionType];
  if (sectionId) {
    document.getElementById(sectionId).style.display = 'block';
  }
}

function populateEditConfigFields(actionType, config) {
  switch (actionType) {
    case 'CLAIM':
      document.getElementById('edit-claim-template-id').value = config.template_id || '';
      break;

    case 'UNPACK':
      document.getElementById('edit-unpack-pack-template').value = config.pack_template_id || '';
      document.getElementById('edit-unpack-url').value = '';
      break;

    case 'BLEND':
      document.getElementById('edit-blend-blend-id').value = config.blend_id || '';
      document.getElementById('edit-blend-ingredients').value = config.ingredient_templates ? config.ingredient_templates.join(',') : '';
      document.getElementById('edit-blend-count').value = config.ingredient_count || '';
      document.getElementById('edit-blend-collection').value = config.collection_name || 'futuresrelic';
      document.getElementById('edit-blend-url').value = '';
      break;

    case 'BLEND_ARRAY':
      if (config.blend_ids && Array.isArray(config.blend_ids)) {
        document.getElementById('edit-blend-array-ids').value = config.blend_ids.join(',');
      } else {
        document.getElementById('edit-blend-array-ids').value = '';
      }
      document.getElementById('edit-blend-array-collection').value = config.collection_name || 'futuresrelic';
      break;

    case 'DROP':
      document.getElementById('edit-drop-drop-id').value = config.drop_id || '';
      document.getElementById('edit-drop-collection').value = config.collection || 'futuresrelic';
      document.getElementById('edit-drop-url').value = '';
      break;

    case 'MARKET_SCOUT':
      document.getElementById('edit-market-template-id').value = config.template_id || '';
      document.getElementById('edit-market-collection').value = config.collection_name || 'futuresrelic';
      break;
  }
}

function buildEditConfigFromFields(actionType) {
  const config = {};

  switch (actionType) {
    case 'CLAIM':
      const claimTemplateId = document.getElementById('edit-claim-template-id').value;
      if (claimTemplateId) config.template_id = parseInt(claimTemplateId);
      break;

    case 'UNPACK':
      const packTemplate = document.getElementById('edit-unpack-pack-template').value;
      if (packTemplate) config.pack_template_id = parseInt(packTemplate);
      break;

    case 'BLEND':
      const blendId = document.getElementById('edit-blend-blend-id').value;
      const ingredients = document.getElementById('edit-blend-ingredients').value;
      const count = document.getElementById('edit-blend-count').value;
      const blendCollection = document.getElementById('edit-blend-collection').value;

      if (blendId) config.blend_id = parseInt(blendId);
      if (ingredients) config.ingredient_templates = ingredients.split(',').map(t => parseInt(t.trim()));
      if (count) config.ingredient_count = parseInt(count);
      if (blendCollection) config.collection_name = blendCollection;
      break;

    case 'BLEND_ARRAY':
      const editBlendArrayIds = document.getElementById('edit-blend-array-ids').value;
      const editBlendArrayCollection = document.getElementById('edit-blend-array-collection').value;

      if (editBlendArrayIds) {
        config.blend_ids = editBlendArrayIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      if (editBlendArrayCollection) config.collection_name = editBlendArrayCollection;
      break;

    case 'DROP':
      const dropId = document.getElementById('edit-drop-drop-id').value;
      const dropCollection = document.getElementById('edit-drop-collection').value;

      if (dropId) config.drop_id = dropId;
      if (dropCollection) config.collection = dropCollection;
      break;

    case 'MARKET_SCOUT':
      const marketTemplateId = document.getElementById('edit-market-template-id').value;
      const marketCollection = document.getElementById('edit-market-collection').value;

      if (marketTemplateId) config.template_id = parseInt(marketTemplateId);
      if (marketCollection) config.collection_name = marketCollection;
      break;
  }

  return Object.keys(config).length > 0 ? config : null;
}

async function handleEditAction(e) {
  e.preventDefault();

  const actionId = document.getElementById('edit-action-id').value;
  const actionType = document.getElementById('edit-action-type').value;

  const updates = {
    action_order: parseInt(document.getElementById('edit-action-order').value),
    action_type: actionType,
    name: document.getElementById('edit-action-name').value,
    description: document.getElementById('edit-action-description').value || null,
    enabled: document.getElementById('edit-action-enabled').checked ? 1 : 0,
    config: buildEditConfigFromFields(actionType) // Server will stringify it
  };

  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/actions/${actionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update action');
    }

    showActionsMessage('✅ Action updated successfully!', 'success');
    closeEditActionModal();
    await loadActions(currentStepId);

  } catch (error) {
    showActionsMessage('Error: ' + error.message, 'error');
  }
}

// ==================== URL AUTO-FETCH FUNCTIONS ====================

// Fetch Pack Data from AtomicHub URL OR NeftyBlocks Pack URL
async function fetchPackData() {
  const url = document.getElementById('unpack-url').value.trim();
  if (!url) {
    alert('Please enter an AtomicHub pack URL or NeftyBlocks pack URL');
    return;
  }

  try {
    // Check if it's a NeftyBlocks pack URL
    // Example: https://neftyblocks.com/collection/futuresrelic/packs/atomicpacksx/2404
    const neftyPackMatch = url.match(/neftyblocks\.com\/collection\/[^/]+\/packs\/atomicpacksx\/(\d+)/);

    if (neftyPackMatch) {
      // NeftyBlocks pack - query atomicpacksx contract
      const packId = neftyPackMatch[1];
      const packData = await queryPackFromChain(packId);

      if (!packData) {
        throw new Error('Pack not found on blockchain');
      }

      // Get template_id from pack data
      const templateId = packData.pack_template_id;

      // Auto-fill template ID
      document.getElementById('unpack-pack-template').value = templateId;
      alert(`✅ Fetched NeftyBlocks pack!\nPack ID: ${packId}\nTemplate ID: ${templateId}`);
      return;
    }

    // Check if it's an AtomicHub asset URL
    // Example: https://wax.atomichub.io/explorer/asset/wax-mainnet/Intern-Task-3-Completed_1099974449032
    const assetIdMatch = url.match(/asset\/[^/]+\/[^_]+_(\d+)/);

    if (assetIdMatch) {
      const assetId = assetIdMatch[1];

      // Fetch asset data from AtomicAssets API
      const response = await fetch(`https://aa.wax.blacklusion.io/atomicassets/v1/assets/${assetId}`);
      if (!response.ok) throw new Error('Failed to fetch asset data');

      const data = await response.json();
      const templateId = data.data.template.template_id;

      // Auto-fill template ID
      document.getElementById('unpack-pack-template').value = templateId;
      alert(`✅ Fetched AtomicHub asset!\nAsset ID: ${assetId}\nTemplate ID: ${templateId}`);
      return;
    }

    throw new Error('URL format not recognized. Please use:\n- AtomicHub: https://wax.atomichub.io/explorer/asset/...\n- NeftyBlocks: https://neftyblocks.com/collection/.../packs/atomicpacksx/...');

  } catch (error) {
    alert('❌ Error fetching pack data: ' + error.message);
    console.error(error);
  }
}

async function fetchPackDataEdit() {
  const url = document.getElementById('edit-unpack-url').value.trim();
  if (!url) {
    alert('Please enter an AtomicHub pack URL or NeftyBlocks pack URL');
    return;
  }

  try {
    // Check if it's a NeftyBlocks pack URL
    const neftyPackMatch = url.match(/neftyblocks\.com\/collection\/[^/]+\/packs\/atomicpacksx\/(\d+)/);

    if (neftyPackMatch) {
      const packId = neftyPackMatch[1];
      const packData = await queryPackFromChain(packId);

      if (!packData) {
        throw new Error('Pack not found on blockchain');
      }

      const templateId = packData.pack_template_id;
      document.getElementById('edit-unpack-pack-template').value = templateId;
      alert(`✅ Fetched! Pack ID: ${packId}, Template ID: ${templateId}`);
      return;
    }

    // Check if it's an AtomicHub asset URL
    const assetIdMatch = url.match(/asset\/[^/]+\/[^_]+_(\d+)/);

    if (assetIdMatch) {
      const assetId = assetIdMatch[1];
      const response = await fetch(`https://aa.wax.blacklusion.io/atomicassets/v1/assets/${assetId}`);
      if (!response.ok) throw new Error('Failed to fetch asset data');

      const data = await response.json();
      const templateId = data.data.template.template_id;

      document.getElementById('edit-unpack-pack-template').value = templateId;
      alert(`✅ Fetched! Template ID: ${templateId}`);
      return;
    }

    throw new Error('URL format not recognized');

  } catch (error) {
    alert('❌ Error: ' + error.message);
    console.error(error);
  }
}

// Fetch Blend Data from NeftyBlocks URL
async function fetchBlendData() {
  const url = document.getElementById('blend-url').value.trim();
  if (!url) {
    alert('Please enter a NeftyBlocks blend URL');
    return;
  }

  try {
    // Extract blend ID from URL
    // Example: https://neftyblocks.com/c/futuresrelic/blends/blend/12049
    const blendIdMatch = url.match(/blend\/(\d+)/);
    if (!blendIdMatch) {
      throw new Error('Could not extract blend ID from URL. Expected format: https://neftyblocks.com/c/collection/blends/blend/12345');
    }

    const blendId = blendIdMatch[1];

    // Fetch blend data from blockchain
    const blendData = await queryBlendFromChain(blendId);

    if (!blendData) {
      throw new Error('Blend not found on blockchain');
    }

    // Auto-fill fields
    document.getElementById('blend-blend-id').value = blendId;

    // Extract ingredient templates
    const ingredients = blendData.ingredients_schema.map(ing => ing.template_id);
    document.getElementById('blend-ingredients').value = ingredients.join(',');
    document.getElementById('blend-count').value = blendData.ingredients_schema.length;

    // Extract collection from URL
    const collectionMatch = url.match(/\/c\/([^/]+)\//);
    if (collectionMatch) {
      document.getElementById('blend-collection').value = collectionMatch[1];
    }

    alert(`✅ Fetched blend data!\nBlend ID: ${blendId}\nIngredients: ${ingredients.join(', ')}\nCount: ${blendData.ingredients_schema.length}`);

  } catch (error) {
    alert('❌ Error fetching blend data: ' + error.message);
    console.error(error);
  }
}

async function fetchBlendDataEdit() {
  const url = document.getElementById('edit-blend-url').value.trim();
  if (!url) {
    alert('Please enter a NeftyBlocks blend URL');
    return;
  }

  try {
    const blendIdMatch = url.match(/blend\/(\d+)/);
    if (!blendIdMatch) {
      throw new Error('Could not extract blend ID from URL');
    }

    const blendId = blendIdMatch[1];
    const blendData = await queryBlendFromChain(blendId);

    if (!blendData) {
      throw new Error('Blend not found on blockchain');
    }

    document.getElementById('edit-blend-blend-id').value = blendId;

    const ingredients = blendData.ingredients_schema.map(ing => ing.template_id);
    document.getElementById('edit-blend-ingredients').value = ingredients.join(',');
    document.getElementById('edit-blend-count').value = blendData.ingredients_schema.length;

    const collectionMatch = url.match(/\/c\/([^/]+)\//);
    if (collectionMatch) {
      document.getElementById('edit-blend-collection').value = collectionMatch[1];
    }

    alert(`✅ Fetched blend data!\nIngredients: ${ingredients.join(', ')}`);

  } catch (error) {
    alert('❌ Error: ' + error.message);
    console.error(error);
  }
}

// Query blend data from blockchain
async function queryBlendFromChain(blendId) {
  const rpcEndpoints = [
    'https://api.wax.alohaeos.com',
    'https://wax.greymass.com',
    'https://api.waxsweden.org',
    'https://wax.eosphere.io'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: true,
          code: 'blenderizerx',
          scope: 'blenderizerx',
          table: 'blends',
          lower_bound: blendId,
          upper_bound: blendId,
          limit: 1
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.rows && data.rows.length > 0) {
        return data.rows[0];
      }
    } catch (error) {
      console.error(`RPC ${endpoint} failed:`, error);
      continue;
    }
  }

  return null;
}

// Query pack data from blockchain (atomicpacksx contract)
async function queryPackFromChain(packId) {
  const rpcEndpoints = [
    'https://api.wax.alohaeos.com',
    'https://wax.greymass.com',
    'https://api.waxsweden.org',
    'https://wax.eosphere.io'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: true,
          code: 'atomicpacksx',
          scope: 'atomicpacksx',
          table: 'packs',
          lower_bound: packId,
          upper_bound: packId,
          limit: 1
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.rows && data.rows.length > 0) {
        return data.rows[0];
      }
    } catch (error) {
      console.error(`RPC ${endpoint} failed:`, error);
      continue;
    }
  }

  return null;
}

// Fetch Drop Data from NeftyBlocks URL
async function fetchDropData() {
  const url = document.getElementById('drop-url').value.trim();
  if (!url) {
    alert('Please enter a NeftyBlocks drop URL');
    return;
  }

  try {
    // Extract drop ID from URL
    // Example: https://neftyblocks.com/c/futuresrelic/drops/229014
    const dropIdMatch = url.match(/drops\/(\d+)/);
    if (!dropIdMatch) {
      throw new Error('Could not extract drop ID from URL. Expected format: https://neftyblocks.com/c/collection/drops/12345');
    }

    const dropId = dropIdMatch[1];

    // Auto-fill fields
    document.getElementById('drop-drop-id').value = dropId;

    // Extract collection from URL
    const collectionMatch = url.match(/\/c\/([^/]+)\//);
    if (collectionMatch) {
      document.getElementById('drop-collection').value = collectionMatch[1];
    }

    alert(`✅ Fetched drop data!\nDrop ID: ${dropId}\nCollection: ${collectionMatch ? collectionMatch[1] : 'Not found'}`);

  } catch (error) {
    alert('❌ Error fetching drop data: ' + error.message);
    console.error(error);
  }
}

async function fetchDropDataEdit() {
  const url = document.getElementById('edit-drop-url').value.trim();
  if (!url) {
    alert('Please enter a NeftyBlocks drop URL');
    return;
  }

  try {
    const dropIdMatch = url.match(/drops\/(\d+)/);
    if (!dropIdMatch) {
      throw new Error('Could not extract drop ID from URL');
    }

    const dropId = dropIdMatch[1];
    document.getElementById('edit-drop-drop-id').value = dropId;

    const collectionMatch = url.match(/\/c\/([^/]+)\//);
    if (collectionMatch) {
      document.getElementById('edit-drop-collection').value = collectionMatch[1];
    }

    alert(`✅ Fetched drop data! Drop ID: ${dropId}`);

  } catch (error) {
    alert('❌ Error: ' + error.message);
    console.error(error);
  }
}
