// admin-scheduler.js - Scheduled Actions Admin Panel

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://claim.futuresrelic.com';

let authToken = localStorage.getItem('adminToken');

// Check authentication on page load
if (authToken) {
  validateTokenAndShowDashboard();
} else {
  document.getElementById('login-section').style.display = 'block';
}

// Login form submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('admin-password').value;

  try {
    const response = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
      localStorage.setItem('adminToken', authToken);
      showDashboard();
      loadActions();
    } else {
      showError('login-error', 'Invalid password');
    }
  } catch (error) {
    showError('login-error', 'Login failed: ' + error.message);
  }
});

async function validateTokenAndShowDashboard() {
  try {
    const response = await fetch(`${API_URL}/api/admin/scheduler/actions`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showDashboard();
      loadActions();
    } else {
      localStorage.removeItem('adminToken');
      authToken = null;
      document.getElementById('login-section').style.display = 'block';
    }
  } catch (error) {
    console.error('Token validation failed:', error);
    document.getElementById('login-section').style.display = 'block';
  }
}

function showDashboard() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  authToken = null;
  location.reload();
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Load data for tab
    if (tabName === 'actions') {
      loadActions();
    } else if (tabName === 'executions') {
      loadExecutions();
    }
  });
});

// Show/Hide create form
document.getElementById('show-create-btn').addEventListener('click', () => {
  document.getElementById('create-form').style.display = 'block';
  document.getElementById('show-create-btn').style.display = 'none';
});

document.getElementById('cancel-create-btn').addEventListener('click', () => {
  document.getElementById('create-form').style.display = 'none';
  document.getElementById('show-create-btn').style.display = 'block';
  resetCreateForm();
});

// Time presets
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const now = new Date();

    if (btn.dataset.minutes) {
      now.setMinutes(now.getMinutes() + parseInt(btn.dataset.minutes));
    } else if (btn.dataset.hours) {
      now.setHours(now.getHours() + parseInt(btn.dataset.hours));
    } else if (btn.dataset.days) {
      now.setDate(now.getDate() + parseInt(btn.dataset.days));
    }

    // Format for datetime-local input
    const formatted = now.toISOString().slice(0, 16);
    document.getElementById('execution-time').value = formatted;
  });
});

// Save action
document.getElementById('save-action-btn').addEventListener('click', async () => {
  try {
    const name = document.getElementById('action-name').value.trim();
    const action_type = document.getElementById('action-type').value;
    const execution_time = document.getElementById('execution-time').value;

    if (!name || !execution_time) {
      showStatus('create-status', 'Please fill in all required fields', 'error');
      return;
    }

    // Build action_params based on type
    let action_params = {};

    if (action_type === 'mint') {
      const to_wallet = document.getElementById('mint-to-wallet').value.trim();
      const template_id = parseInt(document.getElementById('mint-template-id').value);
      const quantity = parseInt(document.getElementById('mint-quantity').value);
      const authorized_minter = document.getElementById('mint-authorized-minter').value.trim();

      if (!to_wallet || !template_id) {
        showStatus('create-status', 'Please fill in all mint parameters', 'error');
        return;
      }

      action_params = {
        to_wallet,
        template_id,
        quantity: quantity || 1,
        authorized_minter: authorized_minter || 'futuresrelic'
      };
    }

    const response = await fetch(`${API_URL}/api/admin/scheduler/actions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        action_type,
        action_params,
        execution_time: new Date(execution_time).toISOString(),
        created_by: 'admin'
      })
    });

    const data = await response.json();

    if (response.ok) {
      showStatus('create-status', '✅ Action created successfully!', 'success');
      setTimeout(() => {
        document.getElementById('create-form').style.display = 'none';
        document.getElementById('show-create-btn').style.display = 'block';
        resetCreateForm();
        loadActions();
      }, 1500);
    } else {
      showStatus('create-status', `❌ Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showStatus('create-status', `❌ Error: ${error.message}`, 'error');
  }
});

// Refresh actions
document.getElementById('refresh-btn').addEventListener('click', loadActions);

// Run scheduler now
document.getElementById('run-now-btn').addEventListener('click', async () => {
  if (!confirm('Trigger the scheduler to check and execute pending actions now?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/scheduler/run-now`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      alert('✅ Scheduler triggered! Check the server logs for execution details.');
      setTimeout(loadActions, 2000); // Reload after 2 seconds
    } else {
      alert('❌ Failed to trigger scheduler');
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
});

// Load scheduled actions
async function loadActions() {
  try {
    const response = await fetch(`${API_URL}/api/admin/scheduler/actions`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      displayActions(data.actions);
    } else {
      document.getElementById('actions-list').innerHTML = `<p style="color: #ef4444;">Error: ${data.error}</p>`;
    }
  } catch (error) {
    document.getElementById('actions-list').innerHTML = `<p style="color: #ef4444;">Error loading actions: ${error.message}</p>`;
  }
}

// Display actions
function displayActions(actions) {
  const container = document.getElementById('actions-list');

  if (actions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No scheduled actions yet. Create one to get started!</p>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Type</th>
          <th>Execution Time</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  actions.forEach(action => {
    const execTime = new Date(action.execution_time);
    const createdTime = new Date(action.created_at);
    const now = new Date();
    const isPast = execTime < now;

    html += `
      <tr>
        <td>#${action.id}</td>
        <td><strong>${action.name}</strong></td>
        <td>${getActionTypeIcon(action.action_type)} ${action.action_type}</td>
        <td>
          ${execTime.toLocaleString()}
          ${isPast && action.status === 'pending' ? '<br><small style="color: #fbbf24;">⚠️ Overdue</small>' : ''}
        </td>
        <td><span class="status-badge status-${action.status}">${action.status}</span></td>
        <td><small>${createdTime.toLocaleString()}</small></td>
        <td>
          <button class="btn btn-sm btn-secondary view-details-btn" data-id="${action.id}">👁️ View</button>
          ${action.status === 'pending' ? `
            <button class="btn btn-sm btn-danger cancel-btn" data-id="${action.id}">🚫 Cancel</button>
          ` : ''}
          <button class="btn btn-sm btn-danger delete-btn" data-id="${action.id}">🗑️</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Add event listeners
  container.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', () => viewActionDetails(btn.dataset.id));
  });

  container.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => cancelAction(btn.dataset.id));
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteAction(btn.dataset.id));
  });
}

// View action details
async function viewActionDetails(id) {
  try {
    const response = await fetch(`${API_URL}/api/admin/scheduler/actions/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      const action = data.action;
      const params = JSON.stringify(action.action_params, null, 2);

      alert(`Action #${action.id}: ${action.name}\n\nType: ${action.action_type}\nStatus: ${action.status}\nExecution Time: ${new Date(action.execution_time).toLocaleString()}\n\nParameters:\n${params}`);
    } else {
      alert('Error loading action details');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Cancel action
async function cancelAction(id) {
  if (!confirm('Cancel this scheduled action?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/scheduler/actions/${id}/cancel`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      alert('✅ Action cancelled');
      loadActions();
    } else {
      alert('❌ Failed to cancel action');
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Delete action
async function deleteAction(id) {
  if (!confirm('Delete this action? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/scheduler/actions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      alert('✅ Action deleted');
      loadActions();
    } else {
      alert('❌ Failed to delete action');
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Load execution history
async function loadExecutions() {
  try {
    const response = await fetch(`${API_URL}/api/admin/scheduler/executions`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      displayExecutions(data.executions);
    } else {
      document.getElementById('executions-list').innerHTML = `<p style="color: #ef4444;">Error: ${data.error}</p>`;
    }
  } catch (error) {
    document.getElementById('executions-list').innerHTML = `<p style="color: #ef4444;">Error loading executions: ${error.message}</p>`;
  }
}

// Display executions
function displayExecutions(executions) {
  const container = document.getElementById('executions-list');

  if (executions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No execution history yet.</p>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Action</th>
          <th>Type</th>
          <th>Status</th>
          <th>Transaction ID</th>
          <th>Executed At</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
  `;

  executions.forEach(exec => {
    const execTime = new Date(exec.executed_at);

    html += `
      <tr>
        <td>#${exec.id}</td>
        <td>${exec.action_name || 'N/A'}</td>
        <td>${getActionTypeIcon(exec.action_type)} ${exec.action_type || 'N/A'}</td>
        <td><span class="status-badge status-${exec.status === 'success' ? 'completed' : 'failed'}">${exec.status}</span></td>
        <td>
          ${exec.transaction_id ? `<a href="https://waxblock.io/transaction/${exec.transaction_id}" target="_blank" style="color: var(--primary);">${exec.transaction_id.substring(0, 12)}...</a>` : 'N/A'}
        </td>
        <td><small>${execTime.toLocaleString()}</small></td>
        <td><small style="color: #ef4444;">${exec.error_message || '-'}</small></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// Helper functions
function getActionTypeIcon(type) {
  const icons = {
    'mint': '🔨',
    'transfer': '📤',
    'drop': '🎁',
    'burn': '🔥'
  };
  return icons[type] || '📋';
}

function showStatus(elementId, message, type) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `alert alert-${type}`;
  element.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      element.style.display = 'none';
    }, 5000);
  }
}

function showError(elementId, message) {
  showStatus(elementId, message, 'error');
}

function resetCreateForm() {
  document.getElementById('action-name').value = '';
  document.getElementById('action-type').value = 'mint';
  document.getElementById('execution-time').value = '';
  document.getElementById('mint-to-wallet').value = '';
  document.getElementById('mint-template-id').value = '';
  document.getElementById('mint-quantity').value = '1';
  document.getElementById('mint-authorized-minter').value = 'futuresrelic';
  document.getElementById('create-status').style.display = 'none';
}
