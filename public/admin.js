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
      loadClaims()
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
    document.getElementById('whitelist-templates').value = config.whitelist_templates;
    document.getElementById('reward-template').value = config.reward_template;
    document.getElementById('cooldown-hours').value = config.cooldown_hours;

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
    whitelist_templates: document.getElementById('whitelist-templates').value,
    reward_template: document.getElementById('reward-template').value,
    cooldown_hours: document.getElementById('cooldown-hours').value
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

    showMessage('Configuration updated successfully!', 'success');

    // Reload stats
    await loadStats();

  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Show message
function showMessage(message, type) {
  configMessage.textContent = message;
  configMessage.className = `alert alert-${type}`;
  configMessage.style.display = 'block';

  setTimeout(() => {
    configMessage.style.display = 'none';
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

// Auto-refresh stats every 30 seconds
setInterval(() => {
  if (adminToken && dashboardSection.style.display !== 'none') {
    loadStats();
    loadClaims();
  }
}, 30000);
