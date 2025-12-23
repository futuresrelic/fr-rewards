const API_URL = window.location.origin;

let adminToken = null;

// Elements
const loginSection = document.getElementById('admin-login');
const dashboardSection = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const configForm = document.getElementById('config-form');
const configMessage = document.getElementById('config-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkExistingSession();
});

// Setup event listeners
function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  configForm.addEventListener('submit', handleConfigUpdate);
  document.getElementById('admin-logout').addEventListener('click', logout);
  document.getElementById('add-template-form').addEventListener('submit', handleAddTemplate);
  document.getElementById('export-btn').addEventListener('click', handleExport);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', handleImport);
  document.getElementById('branding-form').addEventListener('submit', handleBrandingUpdate);
  document.getElementById('upload-logo-btn').addEventListener('click', () => {
    document.getElementById('logo-upload').click();
  });
  document.getElementById('logo-upload').addEventListener('change', handleLogoUpload);
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
    await Promise.all([
      loadConfig(),
      loadStats(),
      loadClaims(),
      loadTemplates(),
      loadBranding()
    ]);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    if (error.message.includes('401')) {
      logout();
    }
  }
}

// Load configuration
async function loadConfig() {
  try {
    const response = await fetch(`${API_URL}/api/admin/config`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load config');
    }

    const data = await response.json();
    const config = data.config;

    document.getElementById('collection-name').value = config.collection_name;

  } catch (error) {
    console.error('Error loading config:', error);
    throw error;
  }
}

// Load statistics
async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/api/admin/stats`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load stats');
    }

    const data = await response.json();
    const stats = data.stats;

    document.getElementById('stat-total-claims').textContent = stats.totalClaims;
    document.getElementById('stat-active-users').textContent = stats.activeUsers;
    document.getElementById('stat-claims-24h').textContent = stats.claimsLast24h;

    if (stats.lastClaim) {
      const lastClaimDate = new Date(stats.lastClaim.claimed_at);
      const timeSince = getTimeSince(lastClaimDate);
      document.getElementById('stat-last-claim').textContent = timeSince;
    } else {
      document.getElementById('stat-last-claim').textContent = 'N/A';
    }

  } catch (error) {
    console.error('Error loading stats:', error);
    throw error;
  }
}

// Load claims
async function loadClaims() {
  try {
    const response = await fetch(`${API_URL}/api/admin/claims?limit=20`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load claims');
    }

    const data = await response.json();
    const claims = data.claims;

    const tbody = document.getElementById('claims-tbody');
    tbody.innerHTML = '';

    if (claims.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No claims yet</td></tr>';
      return;
    }

    claims.forEach(claim => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${claim.wallet_account}</td>
        <td>${claim.template_id}</td>
        <td><a href="https://waxblock.io/transaction/${claim.transaction_id}" target="_blank">${claim.transaction_id.substring(0, 8)}...</a></td>
        <td>${formatDate(claim.claimed_at)}</td>
        <td>${formatDate(claim.next_claim_at)}</td>
      `;
      tbody.appendChild(row);
    });

  } catch (error) {
    console.error('Error loading claims:', error);
    throw error;
  }
}

// Handle config update
async function handleConfigUpdate(e) {
  e.preventDefault();

  const config = {
    collection_name: document.getElementById('collection-name').value,
    whitelist_templates: '', // Keep for backward compatibility
    reward_template: 0,
    cooldown_hours: 24
  };

  try {
    const response = await fetch(`${API_URL}/api/admin/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Update failed');
    }

    showConfigMessage('Configuration updated successfully!', 'success');

    // Reload stats
    await loadStats();

  } catch (error) {
    showConfigMessage('Error: ' + error.message, 'error');
  }
}

// Show config message
function showConfigMessage(message, type) {
  configMessage.textContent = message;
  configMessage.className = `alert alert-${type}`;
  configMessage.style.display = 'block';

  setTimeout(() => {
    configMessage.style.display = 'none';
  }, 5000);
}

// Show template message
function showTemplateMessage(message, type) {
  const templateMessage = document.getElementById('template-message');
  templateMessage.textContent = message;
  templateMessage.className = `alert alert-${type}`;
  templateMessage.style.display = 'block';

  setTimeout(() => {
    templateMessage.style.display = 'none';
  }, 5000);
}

// Utility functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTimeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ==================== TEMPLATE MANAGEMENT ====================

// Load templates
async function loadTemplates() {
  try {
    const response = await fetch(`${API_URL}/api/admin/templates`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load templates');
    }

    const data = await response.json();
    const templates = data.templates;

    const tbody = document.getElementById('templates-tbody');
    tbody.innerHTML = '';

    if (templates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No templates configured. Add one above!</td></tr>';
      return;
    }

    templates.forEach(template => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${template.template_id}</strong></td>
        <td>${template.name || '-'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openRewardsModal(${template.template_id}, '${(template.name || 'Template ' + template.template_id).replace(/'/g, "\\'")}')">
            🎁 Manage Rewards
          </button>
        </td>
        <td>
          <span class="status-badge ${template.enabled ? 'success' : 'error'}" style="padding: 5px 10px; border-radius: 5px; font-size: 0.85rem;">
            ${template.enabled ? '✅ Enabled' : '❌ Disabled'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="toggleTemplate(${template.template_id}, ${template.enabled})">${template.enabled ? '⏸️ Disable' : '▶️ Enable'}</button>
          <button class="btn btn-sm" style="background: #ef4444; color: white;" onclick="deleteTemplate(${template.template_id})">🗑️</button>
        </td>
      `;
      tbody.appendChild(row);
    });

  } catch (error) {
    console.error('Error loading templates:', error);
    throw error;
  }
}

// Handle add template
async function handleAddTemplate(e) {
  e.preventDefault();

  const template = {
    template_id: document.getElementById('new-template-id').value,
    name: document.getElementById('new-template-name').value,
    reward_template_id: document.getElementById('new-reward-template').value,
    cooldown_hours: document.getElementById('new-cooldown-hours').value
  };

  try {
    const response = await fetch(`${API_URL}/api/admin/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(template)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add template');
    }

    showTemplateMessage('Template added successfully!', 'success');
    document.getElementById('add-template-form').reset();
    await loadTemplates();

  } catch (error) {
    showTemplateMessage('Error: ' + error.message, 'error');
  }
}

// Edit template
async function editTemplate(templateId) {
  const newName = prompt('Enter template name (optional):');
  const newReward = prompt('Enter reward template ID:');
  const newCooldown = prompt('Enter cooldown hours:');

  if (!newReward || !newCooldown) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/templates/${templateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: newName,
        reward_template_id: parseInt(newReward),
        cooldown_hours: parseInt(newCooldown),
        enabled: 1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update template');
    }

    showTemplateMessage('Template updated successfully!', 'success');
    await loadTemplates();

  } catch (error) {
    showTemplateMessage('Error: ' + error.message, 'error');
  }
}

// Toggle template enable/disable
async function toggleTemplate(templateId, currentlyEnabled) {
  try {
    const response = await fetch(`${API_URL}/api/admin/templates/${templateId}`, {
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
      throw new Error(data.error || 'Failed to toggle template');
    }

    showTemplateMessage(`Template ${currentlyEnabled ? 'disabled' : 'enabled'} successfully!`, 'success');
    await loadTemplates();

  } catch (error) {
    showTemplateMessage('Error: ' + error.message, 'error');
  }
}

// Delete template
async function deleteTemplate(templateId) {
  if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete template');
    }

    showTemplateMessage('Template deleted successfully!', 'success');
    await loadTemplates();

  } catch (error) {
    showTemplateMessage('Error: ' + error.message, 'error');
  }
}

// Export settings
async function handleExport() {
  try {
    const response = await fetch(`${API_URL}/api/admin/export`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fr-rewards-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showImportMessage('Settings exported successfully!', 'success');
  } catch (error) {
    showImportMessage('Export failed: ' + error.message, 'error');
  }
}

// Import settings
async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const importMessage = document.getElementById('import-message');

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const replace = document.getElementById('import-replace').checked;

    const response = await fetch(`${API_URL}/api/admin/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        ...data,
        replace: replace
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Import failed');
    }

    showImportMessage(
      `Import successful! Imported: ${result.stats.imported}, Updated: ${result.stats.updated}, Skipped: ${result.stats.skipped}`,
      'success'
    );

    // Reload templates and config
    await loadTemplates();
    await loadConfig();

  } catch (error) {
    showImportMessage('Import failed: ' + error.message, 'error');
  }

  // Reset file input
  e.target.value = '';
}

// Show import message
function showImportMessage(message, type) {
  const importMessage = document.getElementById('import-message');
  importMessage.textContent = message;
  importMessage.className = `alert alert-${type}`;
  importMessage.style.display = 'block';

  setTimeout(() => {
    importMessage.style.display = 'none';
  }, 5000);
}

// Handle logo upload
async function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const brandingMessage = document.getElementById('branding-message');

  try {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch(`${API_URL}/api/admin/upload-logo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    // Show preview
    const logoPreview = document.getElementById('logo-preview');
    const logoPreviewImg = document.getElementById('logo-preview-img');
    logoPreviewImg.src = data.logo_url;
    logoPreview.style.display = 'block';

    showBrandingMessage('Logo uploaded successfully!', 'success');
  } catch (error) {
    showBrandingMessage('Logo upload failed: ' + error.message, 'error');
  }

  // Reset file input
  e.target.value = '';
}

// Handle branding update
async function handleBrandingUpdate(e) {
  e.preventDefault();

  const pageTitle = document.getElementById('page-title-input').value.trim();
  const pageSubtitle = document.getElementById('page-subtitle-input').value.trim();

  if (!pageTitle && !pageSubtitle) {
    showBrandingMessage('Please enter at least one field', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        page_title: pageTitle || undefined,
        page_subtitle: pageSubtitle || undefined
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Update failed');
    }

    showBrandingMessage('Branding updated successfully!', 'success');
  } catch (error) {
    showBrandingMessage('Update failed: ' + error.message, 'error');
  }
}

// Show branding message
function showBrandingMessage(message, type) {
  const brandingMessage = document.getElementById('branding-message');
  brandingMessage.textContent = message;
  brandingMessage.className = `alert alert-${type}`;
  brandingMessage.style.display = 'block';

  setTimeout(() => {
    brandingMessage.style.display = 'none';
  }, 5000);
}

// Load branding into form
async function loadBranding() {
  try {
    const response = await fetch(`${API_URL}/api/config/public`);
    const data = await response.json();

    if (data.success && data.config) {
      document.getElementById('page-title-input').value = data.config.page_title || '';
      document.getElementById('page-subtitle-input').value = data.config.page_subtitle || '';

      if (data.config.logo_url) {
        const logoPreview = document.getElementById('logo-preview');
        const logoPreviewImg = document.getElementById('logo-preview-img');
        logoPreviewImg.src = data.config.logo_url;
        logoPreview.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Error loading branding:', error);
  }
}

// ==================== REWARDS MANAGEMENT ====================

let currentTemplateId = null;

// Open rewards modal
async function openRewardsModal(templateId, templateName) {
  currentTemplateId = templateId;
  document.getElementById('modal-template-id').textContent = templateId;
  document.getElementById('modal-template-name').textContent = templateName;
  document.getElementById('reward-template-id-hidden').value = templateId;
  document.getElementById('rewards-modal').style.display = 'block';
  await loadRewards(templateId);
}

// Close rewards modal
document.getElementById('close-rewards-modal').addEventListener('click', () => {
  document.getElementById('rewards-modal').style.display = 'none';
  currentTemplateId = null;
});

// Load rewards for a template
async function loadRewards(templateId) {
  try {
    const response = await fetch(`${API_URL}/api/admin/template-rewards/${templateId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!response.ok) throw new Error('Failed to load rewards');

    const data = await response.json();
    const rewards = data.rewards;

    const rewardsList = document.getElementById('rewards-list');
    rewardsList.innerHTML = '';

    if (rewards.length === 0) {
      rewardsList.innerHTML = '<p style="color: var(--text-secondary);">No rewards configured yet. Add one above!</p>';
      return;
    }

    rewards.forEach(reward => {
      const rewardCard = document.createElement('div');
      rewardCard.style.cssText = 'background: var(--bg-dark); padding: 15px; border-radius: 8px; border: 2px solid var(--border);';
      rewardCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
          <div style="flex: 1; min-width: 200px;">
            <h4 style="margin: 0 0 10px 0;">
              ${reward.reward_name || `Reward Template #${reward.reward_template_id}`}
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 0.9rem; color: var(--text-secondary);">
              <div><strong>Template ID:</strong> ${reward.reward_template_id}</div>
              <div><strong>Cooldown:</strong> ${reward.cooldown_hours}h</div>
              <div><strong>Max Claims:</strong> ${reward.max_claims || 'N/A'}</div>
              <div><strong>Match Quantity:</strong> ${reward.match_quantity ? '✅ Yes' : '❌ No'}</div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-sm" style="background: #ef4444; color: white;" onclick="deleteReward(${reward.id})">🗑️ Delete</button>
          </div>
        </div>
      `;
      rewardsList.appendChild(rewardCard);
    });
  } catch (error) {
    console.error('Error loading rewards:', error);
    showRewardsMessage('Error loading rewards: ' + error.message, 'error');
  }
}

// Add new reward
document.getElementById('add-reward-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const templateId = currentTemplateId;
  const rewardTemplateId = document.getElementById('reward-template-id-input').value;
  const rewardName = document.getElementById('reward-name-input').value.trim();
  const cooldownHours = document.getElementById('reward-cooldown-input').value;
  const maxClaims = document.getElementById('reward-max-claims-input').value;
  const matchQuantity = document.getElementById('reward-match-quantity-input').checked;

  try {
    const response = await fetch(`${API_URL}/api/admin/template-rewards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        template_id: parseInt(templateId),
        reward_template_id: parseInt(rewardTemplateId),
        reward_name: rewardName || null,
        cooldown_hours: parseInt(cooldownHours),
        max_claims: maxClaims ? parseInt(maxClaims) : null,
        match_quantity: matchQuantity
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add reward');
    }

    showRewardsMessage('Reward added successfully!', 'success');
    document.getElementById('add-reward-form').reset();
    document.getElementById('reward-cooldown-input').value = '24'; // Reset to default
    await loadRewards(templateId);
  } catch (error) {
    showRewardsMessage('Error: ' + error.message, 'error');
  }
});

// Delete reward
async function deleteReward(rewardId) {
  if (!confirm('Are you sure you want to delete this reward?')) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/template-rewards/${rewardId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete reward');
    }

    showRewardsMessage('Reward deleted successfully!', 'success');
    await loadRewards(currentTemplateId);
  } catch (error) {
    showRewardsMessage('Error: ' + error.message, 'error');
  }
}

// Show rewards message
function showRewardsMessage(message, type) {
  const messageEl = document.getElementById('rewards-message');
  messageEl.textContent = message;
  messageEl.className = `alert alert-${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}

// ==================== API ENDPOINT MANAGEMENT ====================

// Load Atomic API endpoints
async function loadAtomicAPIs() {
  try {
    const response = await fetch(`${API_URL}/api/admin/atomic-apis`);
    const data = await response.json();

    if (data.success) {
      // Update current preferred endpoint
      document.getElementById('current-api').textContent = data.preferred || 'None (using fallback)';

      // Populate dropdown
      const selector = document.getElementById('api-selector');
      selector.innerHTML = '';
      data.endpoints.forEach(endpoint => {
        const option = document.createElement('option');
        option.value = endpoint;
        option.textContent = endpoint;
        if (endpoint === data.preferred) {
          option.textContent += ' (current)';
        }
        selector.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading Atomic APIs:', error);
  }
}

// Set preferred API endpoint
document.getElementById('set-api-btn').addEventListener('click', async () => {
  const endpoint = document.getElementById('api-selector').value;
  if (!endpoint) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/atomic-apis/set-preferred`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });
    const data = await response.json();

    showAPIMessage(data.message, data.success ? 'success' : 'error');
    if (data.success) {
      loadAtomicAPIs();
    }
  } catch (error) {
    showAPIMessage('Error setting preferred API: ' + error.message, 'error');
  }
});

// Test single API endpoint
document.getElementById('test-api-btn').addEventListener('click', async () => {
  const endpoint = document.getElementById('api-selector').value;
  if (!endpoint) return;

  showAPIMessage('Testing endpoint...', 'info');

  try {
    const response = await fetch(`${API_URL}/api/admin/atomic-apis/test-speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });
    const data = await response.json();

    displaySpeedTestResults([data]);
    showAPIMessage('Test complete!', 'success');
  } catch (error) {
    showAPIMessage('Error testing API: ' + error.message, 'error');
  }
});

// Test all API endpoints
document.getElementById('test-all-apis-btn').addEventListener('click', async () => {
  const selector = document.getElementById('api-selector');
  const endpoints = Array.from(selector.options).map(opt => opt.value);

  showAPIMessage(`Testing ${endpoints.length} endpoints...`, 'info');
  document.getElementById('api-test-results').style.display = 'block';
  document.getElementById('api-speed-results').innerHTML = '<tr><td colspan="4">Testing...</td></tr>';

  const results = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}/api/admin/atomic-apis/test-speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
      const data = await response.json();
      results.push(data);
    } catch (error) {
      results.push({
        success: false,
        endpoint: endpoint,
        error: error.message
      });
    }
  }

  // Sort by response time (fastest first)
  results.sort((a, b) => {
    if (!a.responseTime) return 1;
    if (!b.responseTime) return -1;
    return a.responseTime - b.responseTime;
  });

  displaySpeedTestResults(results);
  showAPIMessage('All tests complete!', 'success');
});

// Display speed test results
function displaySpeedTestResults(results) {
  const tbody = document.getElementById('api-speed-results');
  tbody.innerHTML = '';

  results.forEach((result, index) => {
    const row = document.createElement('tr');
    const isFastest = index === 0 && result.success;

    row.innerHTML = `
      <td style="font-family: monospace; font-size: 0.85rem;">${result.endpoint}</td>
      <td style="font-weight: ${isFastest ? 'bold' : 'normal'}; color: ${isFastest ? 'var(--success)' : 'inherit'};">
        ${result.responseTime ? result.responseTime + ' ms' : 'N/A'}
        ${isFastest ? ' ⚡' : ''}
      </td>
      <td>
        <span class="status-badge ${result.success ? 'status-active' : 'status-error'}">
          ${result.success ? 'OK' : (result.error || 'Failed')}
        </span>
      </td>
      <td>
        <button onclick="setAPIFromTest('${result.endpoint}')" class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.85rem;">
          Use This
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById('api-test-results').style.display = 'block';
}

// Set API from test results
window.setAPIFromTest = async function(endpoint) {
  try {
    const response = await fetch(`${API_URL}/api/admin/atomic-apis/set-preferred`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });
    const data = await response.json();

    showAPIMessage(data.message, data.success ? 'success' : 'error');
    if (data.success) {
      loadAtomicAPIs();
    }
  } catch (error) {
    showAPIMessage('Error setting preferred API: ' + error.message, 'error');
  }
};

// Add custom API endpoint
document.getElementById('add-custom-api-btn').addEventListener('click', async () => {
  const endpoint = document.getElementById('custom-api-input').value.trim();
  if (!endpoint) {
    showAPIMessage('Please enter an endpoint URL', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/atomic-apis/add-custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });
    const data = await response.json();

    showAPIMessage(data.message, data.success ? 'success' : 'error');
    if (data.success && data.added) {
      document.getElementById('custom-api-input').value = '';
      loadAtomicAPIs();
    }
  } catch (error) {
    showAPIMessage('Error adding custom API: ' + error.message, 'error');
  }
});

// Show API message
function showAPIMessage(message, type) {
  const messageEl = document.getElementById('api-message');
  messageEl.textContent = message;
  messageEl.className = `alert alert-${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}

// Load APIs on page load
loadAtomicAPIs();

// Auto-refresh stats every 30 seconds
setInterval(() => {
  if (adminToken && dashboardSection.style.display !== 'none') {
    loadStats();
    loadClaims();
    loadTemplates();
  }
}, 30000);
