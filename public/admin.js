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
      loadTemplates()
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
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No templates configured. Add one above!</td></tr>';
      return;
    }

    templates.forEach(template => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${template.template_id}</strong></td>
        <td>${template.name || '-'}</td>
        <td>${template.reward_template_id}</td>
        <td>${template.cooldown_hours}</td>
        <td>
          <span class="status-badge ${template.enabled ? 'success' : 'error'}" style="padding: 5px 10px; border-radius: 5px; font-size: 0.85rem;">
            ${template.enabled ? '✅ Enabled' : '❌ Disabled'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editTemplate(${template.template_id})">✏️ Edit</button>
          <button class="btn btn-sm btn-secondary" onclick="toggleTemplate(${template.template_id}, ${template.enabled})">${template.enabled ? '⏸️' : '▶️'}</button>
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

// Auto-refresh stats every 30 seconds
setInterval(() => {
  if (adminToken && dashboardSection.style.display !== 'none') {
    loadStats();
    loadClaims();
    loadTemplates();
  }
}, 30000);
