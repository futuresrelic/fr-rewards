const API_URL = window.location.origin;

// DOM Elements
const loginSection = document.getElementById('admin-login');
const dashboard = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('admin-logout');

const navConfig = {
  claims: document.getElementById('nav-show-claims'),
  unpack: document.getElementById('nav-show-unpack'),
  story: document.getElementById('nav-show-story')
};
const saveNavConfigBtn = document.getElementById('save-nav-config');
const navMessage = document.getElementById('nav-message');

const addTabForm = document.getElementById('add-tab-form');
const tabsList = document.getElementById('tabs-list');
const tabMessage = document.getElementById('tab-message');

// Auth state
let authToken = null;

// Check existing auth
if (localStorage.getItem('admin_token')) {
  authToken = localStorage.getItem('admin_token');
  showDashboard();
}

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('admin-password').value;

  try {
    const response = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (data.success) {
      authToken = data.token;
      localStorage.setItem('admin_token', authToken);
      showDashboard();
    } else {
      loginError.textContent = data.message || 'Invalid password';
      loginError.style.display = 'block';
    }
  } catch (error) {
    loginError.textContent = 'Login failed: ' + error.message;
    loginError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', () => {
  authToken = null;
  localStorage.removeItem('admin_token');
  dashboard.style.display = 'none';
  loginSection.style.display = 'block';
});

saveNavConfigBtn.addEventListener('click', saveNavigationConfig);
addTabForm.addEventListener('submit', addNewTab);

// Show dashboard
async function showDashboard() {
  loginSection.style.display = 'none';
  dashboard.style.display = 'block';

  // Load data
  await loadNavigationConfig();
  await loadStoryTabs();
}

// Load navigation config
async function loadNavigationConfig() {
  try {
    const response = await fetch(`${API_URL}/api/admin/config/navigation`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (data.success) {
      navConfig.claims.checked = data.config.show_claims !== false;
      navConfig.unpack.checked = data.config.show_unpack !== false;
      navConfig.story.checked = data.config.show_story !== false;
    }
  } catch (error) {
    console.error('Error loading navigation config:', error);
  }
}

// Save navigation config
async function saveNavigationConfig() {
  try {
    saveNavConfigBtn.disabled = true;
    saveNavConfigBtn.textContent = '💾 Saving...';

    const response = await fetch(`${API_URL}/api/admin/config/navigation`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        show_claims: navConfig.claims.checked,
        show_unpack: navConfig.unpack.checked,
        show_story: navConfig.story.checked
      })
    });

    const data = await response.json();

    if (data.success) {
      showNavMessage('✅ Navigation settings saved successfully!', 'success');
    } else {
      showNavMessage('❌ Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNavMessage('❌ Error saving: ' + error.message, 'error');
  } finally {
    saveNavConfigBtn.disabled = false;
    saveNavConfigBtn.textContent = '💾 Save Navigation Settings';
  }
}

// Load story tabs
async function loadStoryTabs() {
  try {
    const response = await fetch(`${API_URL}/api/admin/story/tabs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (data.success) {
      renderStoryTabs(data.tabs);
    }
  } catch (error) {
    console.error('Error loading story tabs:', error);
    tabsList.innerHTML = '<p style="color: var(--error);">Error loading tabs</p>';
  }
}

// Render story tabs
function renderStoryTabs(tabs) {
  if (tabs.length === 0) {
    tabsList.innerHTML = '<p style="color: var(--text-secondary);">No tabs yet. Create one above!</p>';
    return;
  }

  tabsList.innerHTML = tabs.map(tab => `
    <div class="card" style="background: var(--bg-dark); padding: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">
            ${tab.tab_icon} ${tab.tab_name}
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">
            Order: ${tab.tab_order} • ${tab.enabled ? '✅ Enabled' : '❌ Disabled'}
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="toggleTabStatus(${tab.id}, ${tab.enabled})" class="btn btn-secondary btn-sm">
            ${tab.enabled ? '🔴 Disable' : '🟢 Enable'}
          </button>
          <button onclick="deleteTab(${tab.id})" class="btn btn-secondary btn-sm" style="background: var(--error);">
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Add new tab
async function addNewTab(e) {
  e.preventDefault();

  const order = parseInt(document.getElementById('new-tab-order').value);
  const name = document.getElementById('new-tab-name').value;
  const icon = document.getElementById('new-tab-icon').value || '📖';

  try {
    const response = await fetch(`${API_URL}/api/admin/story/tabs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tab_order: order,
        tab_name: name,
        tab_icon: icon
      })
    });

    const data = await response.json();

    if (data.success) {
      showTabMessage('✅ Tab created successfully!', 'success');
      addTabForm.reset();
      await loadStoryTabs();
    } else {
      showTabMessage('❌ Error: ' + data.error, 'error');
    }
  } catch (error) {
    showTabMessage('❌ Error: ' + error.message, 'error');
  }
}

// Toggle tab status
async function toggleTabStatus(tabId, currentlyEnabled) {
  try {
    const response = await fetch(`${API_URL}/api/admin/story/tabs/${tabId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabled: currentlyEnabled ? 0 : 1
      })
    });

    const data = await response.json();

    if (data.success) {
      showTabMessage(`✅ Tab ${currentlyEnabled ? 'disabled' : 'enabled'}`, 'success');
      await loadStoryTabs();
    } else {
      showTabMessage('❌ Error: ' + data.error, 'error');
    }
  } catch (error) {
    showTabMessage('❌ Error: ' + error.message, 'error');
  }
}

// Delete tab
async function deleteTab(tabId) {
  if (!confirm('Are you sure you want to delete this tab? Actions assigned to this tab will have their tab assignment removed.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/story/tabs/${tabId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (data.success) {
      showTabMessage('✅ Tab deleted successfully!', 'success');
      await loadStoryTabs();
    } else {
      showTabMessage('❌ Error: ' + data.error, 'error');
    }
  } catch (error) {
    showTabMessage('❌ Error: ' + error.message, 'error');
  }
}

// Show navigation message
function showNavMessage(message, type) {
  navMessage.textContent = message;
  navMessage.className = `alert alert-${type}`;
  navMessage.style.display = 'block';
  setTimeout(() => {
    navMessage.style.display = 'none';
  }, 5000);
}

// Show tab message
function showTabMessage(message, type) {
  tabMessage.textContent = message;
  tabMessage.className = `alert alert-${type}`;
  tabMessage.style.display = 'block';
  setTimeout(() => {
    tabMessage.style.display = 'none';
  }, 5000);
}
