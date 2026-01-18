// admin-factory.js - Factory Admin Panel

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://claim.futuresrelic.com';

let authToken = localStorage.getItem('adminToken');
let currentEditingRecipe = null;

// Check authentication on page load
if (authToken) {
  validateTokenAndShowDashboard();
} else {
  document.getElementById('admin-login').style.display = 'block';
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
      loadRecipes();
    } else {
      showError('login-error', 'Invalid password');
    }
  } catch (error) {
    showError('login-error', 'Login failed: ' + error.message);
  }
});

async function validateTokenAndShowDashboard() {
  try {
    const response = await fetch(`${API_URL}/api/admin/factory/recipes`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showDashboard();
      loadRecipes();
    } else {
      localStorage.removeItem('adminToken');
      authToken = null;
      document.getElementById('admin-login').style.display = 'block';
    }
  } catch (error) {
    console.error('Token validation failed:', error);
    document.getElementById('admin-login').style.display = 'block';
  }
}

function showDashboard() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
}

// Logout
document.getElementById('admin-logout').addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  authToken = null;
  location.reload();
});

// Show/Hide create form
document.getElementById('show-create-form-btn').addEventListener('click', () => {
  document.getElementById('create-recipe-form').style.display = 'block';
  document.getElementById('show-create-form-btn').style.display = 'none';
  addIngredientRow();
  addResultRow();
});

document.getElementById('cancel-create-btn').addEventListener('click', () => {
  document.getElementById('create-recipe-form').style.display = 'none';
  document.getElementById('show-create-form-btn').style.display = 'block';
  resetCreateForm();
});

// Cooldown checkbox handler
document.getElementById('cooldown-enabled').addEventListener('change', (e) => {
  document.getElementById('cooldown-hours-group').style.display = e.target.checked ? 'block' : 'none';
});

// Pool mode checkbox handler
document.getElementById('pool-mode-enabled').addEventListener('change', (e) => {
  document.getElementById('pool-config-section').style.display = e.target.checked ? 'block' : 'none';
});

// Add ingredient row
document.getElementById('add-ingredient-btn').addEventListener('click', addIngredientRow);

function addIngredientRow() {
  const container = document.getElementById('ingredients-list');
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

  row.innerHTML = `
    <input type="number" class="form-control ingredient-template" placeholder="Template ID" style="flex: 1;" required>
    <input type="number" class="form-control ingredient-amount" placeholder="Amount" min="1" value="1" style="width: 100px;" required>
    <button type="button" class="btn btn-danger btn-sm remove-ingredient" style="width: 32px; height: 32px;">×</button>
  `;

  row.querySelector('.remove-ingredient').addEventListener('click', () => row.remove());

  container.appendChild(row);
}

// Add result row
document.getElementById('add-result-btn').addEventListener('click', addResultRow);

function addResultRow() {
  const container = document.getElementById('results-list');
  const row = document.createElement('div');
  row.className = 'result-row';
  row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

  row.innerHTML = `
    <input type="number" class="form-control result-template" placeholder="Template ID" style="width: 150px;" required>
    <input type="number" class="form-control result-amount" placeholder="Amount" min="1" value="1" style="width: 100px;" required>
    <input type="text" class="form-control result-name" placeholder="Name Override (optional)" style="flex: 1;">
    <button type="button" class="btn btn-danger btn-sm remove-result" style="width: 32px; height: 32px;">×</button>
  `;

  row.querySelector('.remove-result').addEventListener('click', () => row.remove());

  container.appendChild(row);
}

// Add pool ingredient row
document.getElementById('add-pool-ingredient-btn').addEventListener('click', addPoolIngredientRow);

function addPoolIngredientRow() {
  const container = document.getElementById('pool-ingredients-list');
  const row = document.createElement('div');
  row.className = 'pool-ingredient-row';
  row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

  row.innerHTML = `
    <input type="number" class="form-control pool-ingredient-template" placeholder="Template ID" style="flex: 1;" required>
    <input type="number" class="form-control pool-ingredient-amount" placeholder="Amount" min="1" value="1" style="width: 100px;" required>
    <button type="button" class="btn btn-danger btn-sm remove-pool-ingredient" style="width: 32px; height: 32px;">×</button>
  `;

  row.querySelector('.remove-pool-ingredient').addEventListener('click', () => row.remove());

  container.appendChild(row);
}

// Save recipe
document.getElementById('save-recipe-btn').addEventListener('click', async () => {
  try {
    // Collect data
    const name = document.getElementById('recipe-name').value.trim();
    const description = document.getElementById('recipe-description').value.trim();
    const category = document.getElementById('recipe-category').value.trim() || 'Uncategorized';
    const transferToWallet = document.getElementById('recipe-transfer-wallet').value.trim() || 'pool.fr';
    const maxBatch = parseInt(document.getElementById('max-batch').value);
    const cooldownEnabled = document.getElementById('cooldown-enabled').checked;
    const cooldownHours = cooldownEnabled ? parseInt(document.getElementById('cooldown-hours').value) || null : null;
    const enabled = document.getElementById('recipe-enabled').checked;

    // Collect pool mode settings
    const poolModeEnabled = document.getElementById('pool-mode-enabled').checked;
    const poolWallet = document.getElementById('pool-wallet').value.trim() || null;
    let poolIngredients = null;

    if (poolModeEnabled) {
      if (!poolWallet) {
        showStatus('create-status', 'Pool wallet is required when pool mode is enabled', 'error');
        return;
      }

      // Collect pool ingredients
      poolIngredients = [];
      document.querySelectorAll('.pool-ingredient-row').forEach(row => {
        const templateId = parseInt(row.querySelector('.pool-ingredient-template').value);
        const amount = parseInt(row.querySelector('.pool-ingredient-amount').value);
        if (templateId && amount) {
          poolIngredients.push({ template_id: templateId, amount: amount });
        }
      });

      if (poolIngredients.length === 0) {
        showStatus('create-status', 'At least one pool ingredient is required when pool mode is enabled', 'error');
        return;
      }
    }

    if (!name) {
      showStatus('create-status', 'Recipe name is required', 'error');
      return;
    }

    // Collect ingredients
    const ingredients = [];
    document.querySelectorAll('.ingredient-row').forEach(row => {
      const templateId = parseInt(row.querySelector('.ingredient-template').value);
      const amount = parseInt(row.querySelector('.ingredient-amount').value);
      if (templateId && amount) {
        ingredients.push({ template_id: templateId, amount: amount });
      }
    });

    if (ingredients.length === 0) {
      showStatus('create-status', 'At least one ingredient is required', 'error');
      return;
    }

    // Collect results
    const results = [];
    document.querySelectorAll('.result-row').forEach(row => {
      const templateId = parseInt(row.querySelector('.result-template').value);
      const amount = parseInt(row.querySelector('.result-amount').value);
      const nameOverride = row.querySelector('.result-name').value.trim();
      if (templateId && amount) {
        results.push({
          template_id: templateId,
          amount: amount,
          name_override: nameOverride || undefined
        });
      }
    });

    if (results.length === 0) {
      showStatus('create-status', 'At least one result is required', 'error');
      return;
    }

    // Create recipe
    const response = await fetch(`${API_URL}/api/admin/factory/recipes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description,
        category,
        transfer_to_wallet: transferToWallet,
        ingredients,
        results,
        max_batch_multiplier: maxBatch,
        cooldown_hours: cooldownHours,
        cooldown_enabled: cooldownEnabled,
        enabled,
        pool_mode_enabled: poolModeEnabled,
        pool_wallet: poolWallet,
        pool_ingredients: poolIngredients
      })
    });

    const data = await response.json();

    if (response.ok) {
      showStatus('create-status', '✅ Recipe created successfully!', 'success');
      setTimeout(() => {
        document.getElementById('create-recipe-form').style.display = 'none';
        document.getElementById('show-create-form-btn').style.display = 'block';
        resetCreateForm();
        loadRecipes();
      }, 1500);
    } else {
      showStatus('create-status', `❌ Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showStatus('create-status', `❌ Error: ${error.message}`, 'error');
  }
});

function resetCreateForm() {
  document.getElementById('recipe-name').value = '';
  document.getElementById('recipe-description').value = '';
  document.getElementById('recipe-category').value = 'Uncategorized';
  document.getElementById('recipe-transfer-wallet').value = 'pool.fr';
  document.getElementById('max-batch').value = '5';
  document.getElementById('cooldown-enabled').checked = false;
  document.getElementById('cooldown-hours').value = '';
  document.getElementById('recipe-enabled').checked = true;
  document.getElementById('cooldown-hours-group').style.display = 'none';
  document.getElementById('pool-mode-enabled').checked = false;
  document.getElementById('pool-wallet').value = '';
  document.getElementById('pool-config-section').style.display = 'none';
  document.getElementById('ingredients-list').innerHTML = '';
  document.getElementById('results-list').innerHTML = '';
  document.getElementById('pool-ingredients-list').innerHTML = '';
  document.getElementById('create-status').style.display = 'none';
}

// Load recipes
async function loadRecipes() {
  try {
    const response = await fetch(`${API_URL}/api/admin/factory/recipes`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      displayRecipes(data.recipes);
    } else {
      document.getElementById('recipes-list').innerHTML = `<p style="color: #f87171;">Error: ${data.error}</p>`;
    }
  } catch (error) {
    document.getElementById('recipes-list').innerHTML = `<p style="color: #f87171;">Error: ${error.message}</p>`;
  }
}

function displayRecipes(recipes) {
  const container = document.getElementById('recipes-list');

  if (!recipes || recipes.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No recipes created yet.</p>';
    return;
  }

  let html = '';

  recipes.forEach(recipe => {
    const statusBadge = recipe.enabled
      ? '<span style="background: #4ade80; color: black; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">✅ Enabled</span>'
      : '<span style="background: #94a3b8; color: black; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">❌ Disabled</span>';

    const cooldownText = recipe.cooldown_enabled && recipe.cooldown_hours
      ? `${recipe.cooldown_hours}h cooldown`
      : 'No cooldown';

    const categoryBadge = `<span style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">📁 ${recipe.category || 'Uncategorized'}</span>`;

    html += `
      <div class="recipe-card" style="background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
          <div>
            <h3 style="margin: 0; color: var(--primary);">${recipe.name}</h3>
            ${recipe.description ? `<p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">${recipe.description}</p>` : ''}
            <div style="margin-top: 8px;">${categoryBadge}</div>
          </div>
          <div style="text-align: right;">
            ${statusBadge}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px;">
          <div>
            <strong style="color: var(--text-primary);">Ingredients:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 0.9rem;">
              ${recipe.ingredients.map(ing => `<li>Template ${ing.template_id} x${ing.amount}</li>`).join('')}
            </ul>
          </div>

          <div>
            <strong style="color: var(--text-primary);">Results:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 0.9rem;">
              ${recipe.results.map(res => `<li>Template ${res.template_id} x${res.amount}${res.name_override ? ` (${res.name_override})` : ''}</li>`).join('')}
            </ul>
          </div>

          <div>
            <strong style="color: var(--text-primary);">Settings:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 0.9rem;">
              <li>Max Batch: ${recipe.max_batch_multiplier}x</li>
              <li>${cooldownText}</li>
            </ul>
          </div>

          <div>
            <strong style="color: var(--text-primary);">Stats:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 0.9rem;">
              <li>Crafted: ${recipe.stats.total_crafts || 0} times</li>
              <li>Items Minted: ${recipe.stats.total_items_crafted || 0}</li>
              <li>Unique Users: ${recipe.stats.unique_crafters || 0}</li>
            </ul>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button class="btn btn-secondary btn-sm edit-recipe-btn" data-recipe-id="${recipe.id}">✏️ Edit</button>
          <button class="btn btn-danger btn-sm delete-recipe-btn" data-recipe-id="${recipe.id}">🗑️ Delete</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Add event listeners
  document.querySelectorAll('.edit-recipe-btn').forEach(btn => {
    btn.addEventListener('click', () => editRecipe(parseInt(btn.dataset.recipeId)));
  });

  document.querySelectorAll('.delete-recipe-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteRecipe(parseInt(btn.dataset.recipeId)));
  });
}

// Edit recipe
async function editRecipe(recipeId) {
  try {
    const response = await fetch(`${API_URL}/api/admin/factory/recipes`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    const recipe = data.recipes.find(r => r.id === recipeId);

    if (!recipe) {
      alert('Recipe not found');
      return;
    }

    currentEditingRecipe = recipe;

    // Populate edit form
    const editForm = document.getElementById('edit-recipe-form');
    editForm.innerHTML = `
      <div class="form-group">
        <label>Recipe Name:</label>
        <input type="text" id="edit-recipe-name" class="form-control" value="${recipe.name}" required>
      </div>

      <div class="form-group">
        <label>Description:</label>
        <textarea id="edit-recipe-description" class="form-control" rows="2">${recipe.description || ''}</textarea>
      </div>

      <div class="form-group">
        <label>Category:</label>
        <input type="text" id="edit-recipe-category" class="form-control" value="${recipe.category || 'Uncategorized'}">
        <small style="color: var(--text-secondary);">Group related recipes together for easier navigation</small>
      </div>

      <div class="form-group">
        <label>Transfer to Wallet:</label>
        <input type="text" id="edit-recipe-transfer-wallet" class="form-control" value="${recipe.transfer_to_wallet || 'pool.fr'}">
        <small style="color: var(--text-secondary);">Wallet where user assets will be transferred during crafting</small>
      </div>

      <hr style="margin: 20px 0; border-color: rgba(255,255,255,0.1);">

      <h4>Ingredients</h4>
      <div id="edit-ingredients-list"></div>
      <button type="button" id="edit-add-ingredient-btn" class="btn btn-secondary btn-sm">+ Add Ingredient</button>

      <hr style="margin: 20px 0; border-color: rgba(255,255,255,0.1);">

      <h4>Results</h4>
      <div id="edit-results-list"></div>
      <button type="button" id="edit-add-result-btn" class="btn btn-secondary btn-sm">+ Add Result</button>

      <hr style="margin: 20px 0; border-color: rgba(255,255,255,0.1);">

      <h4>Settings</h4>

      <div class="form-group">
        <label>Max Batch Multiplier:</label>
        <input type="number" id="edit-max-batch" class="form-control" min="1" max="100" value="${recipe.max_batch_multiplier}" style="max-width: 150px;">
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" id="edit-cooldown-enabled" ${recipe.cooldown_enabled ? 'checked' : ''}> Enable Cooldown
        </label>
      </div>

      <div class="form-group" id="edit-cooldown-hours-group" style="display: ${recipe.cooldown_enabled ? 'block' : 'none'};">
        <label>Cooldown Hours:</label>
        <input type="number" id="edit-cooldown-hours" class="form-control" min="1" max="8760" value="${recipe.cooldown_hours || ''}" style="max-width: 150px;">
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" id="edit-recipe-enabled" ${recipe.enabled ? 'checked' : ''}> Enabled (visible to users)
        </label>
      </div>

      <hr style="margin: 20px 0; border-color: rgba(255,255,255,0.1);">

      <h4>🔄 Pool/Swap Mode (Optional)</h4>
      <p style="color: var(--text-secondary); margin: 0 0 15px 0; font-size: 0.9rem;">
        Enable this to allow users to swap assets from a pool instead of minting new ones.
      </p>

      <div class="form-group">
        <label>
          <input type="checkbox" id="edit-pool-mode-enabled" ${recipe.pool_mode_enabled ? 'checked' : ''}> Enable Pool/Swap Mode
        </label>
      </div>

      <div id="edit-pool-config-section" style="display: ${recipe.pool_mode_enabled ? 'block' : 'none'}; background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-top: 10px;">
        <div class="form-group">
          <label>Pool Wallet:</label>
          <input type="text" id="edit-pool-wallet" class="form-control" value="${recipe.pool_wallet || ''}" placeholder="e.g., pool.fr">
          <small style="color: var(--text-secondary);">Wallet containing assets available for swapping</small>
        </div>

        <h5 style="margin: 15px 0 10px 0;">Pool Ingredients (Cheaper Option)</h5>
        <div id="edit-pool-ingredients-list"></div>
        <button type="button" id="edit-add-pool-ingredient-btn" class="btn btn-secondary btn-sm">+ Add Pool Ingredient</button>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button id="update-recipe-btn" class="btn btn-primary">Update Recipe</button>
        <button id="cancel-edit-btn" class="btn btn-secondary">Cancel</button>
      </div>
    `;

    // Add existing ingredients
    recipe.ingredients.forEach(ing => {
      addEditIngredientRow(ing.template_id, ing.amount);
    });

    // Add existing results
    recipe.results.forEach(res => {
      addEditResultRow(res.template_id, res.amount, res.name_override);
    });

    // Add existing pool ingredients
    if (recipe.pool_ingredients && Array.isArray(recipe.pool_ingredients)) {
      recipe.pool_ingredients.forEach(ing => {
        addEditPoolIngredientRow(ing.template_id, ing.amount);
      });
    }

    // Event listeners
    document.getElementById('edit-add-ingredient-btn').addEventListener('click', () => addEditIngredientRow());
    document.getElementById('edit-add-result-btn').addEventListener('click', () => addEditResultRow());
    document.getElementById('edit-add-pool-ingredient-btn').addEventListener('click', () => addEditPoolIngredientRow());

    document.getElementById('edit-cooldown-enabled').addEventListener('change', (e) => {
      document.getElementById('edit-cooldown-hours-group').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('edit-pool-mode-enabled').addEventListener('change', (e) => {
      document.getElementById('edit-pool-config-section').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('update-recipe-btn').addEventListener('click', updateRecipe);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);

    // Show modal
    document.getElementById('edit-recipe-modal').style.display = 'block';
  } catch (error) {
    alert('Error loading recipe: ' + error.message);
  }
}

function addEditIngredientRow(templateId = '', amount = 1) {
  const container = document.getElementById('edit-ingredients-list');
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

  row.innerHTML = `
    <input type="number" class="form-control ingredient-template" placeholder="Template ID" value="${templateId}" style="flex: 1;" required>
    <input type="number" class="form-control ingredient-amount" placeholder="Amount" min="1" value="${amount}" style="width: 100px;" required>
    <button type="button" class="btn btn-danger btn-sm remove-ingredient" style="width: 32px; height: 32px;">×</button>
  `;

  row.querySelector('.remove-ingredient').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function addEditResultRow(templateId = '', amount = 1, nameOverride = '') {
  const container = document.getElementById('edit-results-list');
  const row = document.createElement('div');
  row.className = 'result-row';
  row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

  row.innerHTML = `
    <input type="number" class="form-control result-template" placeholder="Template ID" value="${templateId}" style="width: 150px;" required>
    <input type="number" class="form-control result-amount" placeholder="Amount" min="1" value="${amount}" style="width: 100px;" required>
    <input type="text" class="form-control result-name" placeholder="Name Override (optional)" value="${nameOverride || ''}" style="flex: 1;">
    <button type="button" class="btn btn-danger btn-sm remove-result" style="width: 32px; height: 32px;">×</button>
  `;

  row.querySelector('.remove-result').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function addEditPoolIngredientRow(templateId = '', amount = 1) {
  const container = document.getElementById('edit-pool-ingredients-list');
  const row = document.createElement('div');
  row.className = 'pool-ingredient-row';
  row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

  row.innerHTML = `
    <input type="number" class="form-control pool-ingredient-template" placeholder="Template ID" value="${templateId}" style="flex: 1;" required>
    <input type="number" class="form-control pool-ingredient-amount" placeholder="Amount" min="1" value="${amount}" style="width: 100px;" required>
    <button type="button" class="btn btn-danger btn-sm remove-pool-ingredient" style="width: 32px; height: 32px;">×</button>
  `;

  row.querySelector('.remove-pool-ingredient').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

async function updateRecipe() {
  try {
    const name = document.getElementById('edit-recipe-name').value.trim();
    const description = document.getElementById('edit-recipe-description').value.trim();
    const category = document.getElementById('edit-recipe-category').value.trim() || 'Uncategorized';
    const transferToWallet = document.getElementById('edit-recipe-transfer-wallet').value.trim() || 'pool.fr';
    const maxBatch = parseInt(document.getElementById('edit-max-batch').value);
    const cooldownEnabled = document.getElementById('edit-cooldown-enabled').checked;
    const cooldownHours = cooldownEnabled ? parseInt(document.getElementById('edit-cooldown-hours').value) || null : null;
    const enabled = document.getElementById('edit-recipe-enabled').checked;

    // Collect pool mode settings
    const poolModeEnabled = document.getElementById('edit-pool-mode-enabled').checked;
    const poolWallet = document.getElementById('edit-pool-wallet').value.trim() || null;
    let poolIngredients = null;

    if (poolModeEnabled) {
      if (!poolWallet) {
        alert('Pool wallet is required when pool mode is enabled');
        return;
      }

      poolIngredients = [];
      document.querySelectorAll('#edit-pool-ingredients-list .pool-ingredient-row').forEach(row => {
        const templateId = parseInt(row.querySelector('.pool-ingredient-template').value);
        const amount = parseInt(row.querySelector('.pool-ingredient-amount').value);
        if (templateId && amount) {
          poolIngredients.push({ template_id: templateId, amount: amount });
        }
      });

      if (poolIngredients.length === 0) {
        alert('At least one pool ingredient is required when pool mode is enabled');
        return;
      }
    }

    // Collect ingredients
    const ingredients = [];
    document.querySelectorAll('#edit-ingredients-list .ingredient-row').forEach(row => {
      const templateId = parseInt(row.querySelector('.ingredient-template').value);
      const amount = parseInt(row.querySelector('.ingredient-amount').value);
      if (templateId && amount) {
        ingredients.push({ template_id: templateId, amount: amount });
      }
    });

    // Collect results
    const results = [];
    document.querySelectorAll('#edit-results-list .result-row').forEach(row => {
      const templateId = parseInt(row.querySelector('.result-template').value);
      const amount = parseInt(row.querySelector('.result-amount').value);
      const nameOverride = row.querySelector('.result-name').value.trim();
      if (templateId && amount) {
        results.push({
          template_id: templateId,
          amount: amount,
          name_override: nameOverride || undefined
        });
      }
    });

    const response = await fetch(`${API_URL}/api/admin/factory/recipes/${currentEditingRecipe.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description,
        category,
        transfer_to_wallet: transferToWallet,
        ingredients,
        results,
        max_batch_multiplier: maxBatch,
        cooldown_hours: cooldownHours,
        cooldown_enabled: cooldownEnabled,
        enabled,
        pool_mode_enabled: poolModeEnabled,
        pool_wallet: poolWallet,
        pool_ingredients: poolIngredients
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert('✅ Recipe updated successfully!');
      closeEditModal();
      loadRecipes();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
}

function closeEditModal() {
  document.getElementById('edit-recipe-modal').style.display = 'none';
  currentEditingRecipe = null;
}

document.getElementById('close-edit-modal').addEventListener('click', closeEditModal);

// Delete recipe
async function deleteRecipe(recipeId) {
  if (!confirm('Are you sure you want to delete this recipe? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/factory/recipes/${recipeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      alert('✅ Recipe deleted successfully!');
      loadRecipes();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
}

// Load history
document.getElementById('load-history-btn').addEventListener('click', async () => {
  try {
    const response = await fetch(`${API_URL}/api/admin/factory/history`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      displayHistory(data.history);
    } else {
      document.getElementById('history-list').innerHTML = `<p style="color: #f87171;">Error: ${data.error}</p>`;
    }
  } catch (error) {
    document.getElementById('history-list').innerHTML = `<p style="color: #f87171;">Error: ${error.message}</p>`;
  }
});

function displayHistory(history) {
  const container = document.getElementById('history-list');

  if (!history || history.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No craft history yet.</p>';
    return;
  }

  let html = '<div style="max-height: 600px; overflow-y: auto;">';

  history.forEach(record => {
    const statusColor = record.status === 'completed' ? '#4ade80' : record.status === 'failed' ? '#f87171' : '#fbbf24';
    const statusIcon = record.status === 'completed' ? '✅' : record.status === 'failed' ? '❌' : '⏳';

    html += `
      <div style="background: var(--bg-dark); padding: 12px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid ${statusColor};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${statusIcon} ${record.recipe_name || `Recipe #${record.recipe_id}`}</strong>
          <span style="font-size: 0.85rem; color: var(--text-secondary);">${new Date(record.crafted_at).toLocaleString()}</span>
        </div>
        <div style="font-size: 0.9rem; margin-top: 5px; color: var(--text-secondary);">
          User: ${record.user_wallet} | Batch: ${record.batch_count}x | Status: ${record.status}
        </div>
        <div style="font-size: 0.85rem; margin-top: 5px;">
          Transfer TX: <a href="https://waxblock.io/transaction/${record.transfer_transaction_id}" target="_blank" style="color: var(--primary);">${record.transfer_transaction_id.substr(0, 8)}...</a>
          ${record.mint_transaction_id ? `| Mint TX: <a href="https://waxblock.io/transaction/${record.mint_transaction_id}" target="_blank" style="color: var(--primary);">${record.mint_transaction_id.substr(0, 8)}...</a>` : ''}
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// Load failed crafts
document.getElementById('load-failed-btn').addEventListener('click', async () => {
  try {
    const response = await fetch(`${API_URL}/api/admin/factory/failed`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      displayFailed(data.failed);
    } else {
      document.getElementById('failed-list').innerHTML = `<p style="color: #f87171;">Error: ${data.error}</p>`;
    }
  } catch (error) {
    document.getElementById('failed-list').innerHTML = `<p style="color: #f87171;">Error: ${error.message}</p>`;
  }
});

function displayFailed(failed) {
  const container = document.getElementById('failed-list');

  if (!failed || failed.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No failed crafts. Great!</p>';
    return;
  }

  let html = '<div style="max-height: 600px; overflow-y: auto;">';

  failed.forEach(record => {
    const ingredientAssetIds = record.ingredient_asset_ids;

    html += `
      <div style="background: var(--bg-dark); padding: 15px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #f87171;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>❌ ${record.recipe_name || `Recipe #${record.recipe_id}`}</strong>
          <span style="font-size: 0.85rem; color: var(--text-secondary);">${new Date(record.crafted_at).toLocaleString()}</span>
        </div>
        <div style="font-size: 0.9rem; margin-top: 5px; color: var(--text-secondary);">
          User: ${record.user_wallet} | Batch: ${record.batch_count}x
        </div>
        <div style="font-size: 0.85rem; margin-top: 5px;">
          Transfer TX: <a href="https://waxblock.io/transaction/${record.transfer_transaction_id}" target="_blank" style="color: var(--primary);">${record.transfer_transaction_id}</a>
        </div>
        <div style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
          <strong style="font-size: 0.85rem;">Error:</strong>
          <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #f87171;">${record.error_message || 'Unknown error'}</p>
        </div>
        <div style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
          <strong style="font-size: 0.85rem;">Assets in futuresrelic wallet:</strong>
          <p style="margin: 5px 0 0 0; font-size: 0.85rem; font-family: monospace;">${ingredientAssetIds.join(', ')}</p>
        </div>
        <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button class="btn btn-primary btn-sm" onclick="fulfillFailedCraft(${record.id})" id="fulfill-btn-${record.id}">🔄 Fulfill Craft</button>
          <button class="btn btn-warning btn-sm" onclick="refundFailedCraft(${record.id})" id="refund-btn-${record.id}">↩️ Refund to User</button>
          <button class="btn btn-secondary btn-sm" onclick="window.open('https://wax.atomichub.io/profile/futuresrelic', '_blank')">👁️ View Wallet</button>
        </div>
        <div id="fulfill-status-${record.id}" style="margin-top: 8px; font-size: 0.85rem;"></div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// Utility functions
function showStatus(elementId, message, type = 'info') {
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

// Fulfill a failed craft (retry pool swap)
async function fulfillFailedCraft(craftId) {
  const statusEl = document.getElementById(`fulfill-status-${craftId}`);
  const fulfillBtn = document.getElementById(`fulfill-btn-${craftId}`);
  const refundBtn = document.getElementById(`refund-btn-${craftId}`);

  if (!confirm('Attempt to fulfill this failed craft by transferring assets from pool.fr to the user?')) {
    return;
  }

  try {
    // Disable buttons
    fulfillBtn.disabled = true;
    refundBtn.disabled = true;
    statusEl.innerHTML = '<span style="color: #60a5fa;">🔄 Fulfilling craft...</span>';

    const response = await fetch('/api/admin/factory/fulfill-failed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': localStorage.getItem('admin_password')
      },
      body: JSON.stringify({ craft_id: craftId })
    });

    const data = await response.json();

    if (data.success) {
      statusEl.innerHTML = `
        <div style="color: #10b981;">
          ✅ <strong>Craft fulfilled successfully!</strong><br>
          TX: <a href="https://waxblock.io/transaction/${data.transaction_id}" target="_blank" style="color: var(--primary);">${data.transaction_id}</a><br>
          <span style="font-size: 0.8rem;">Transferred ${data.transferred_assets.length} asset(s) to user</span>
        </div>
      `;

      // Remove this craft from the list after 3 seconds
      setTimeout(() => {
        document.getElementById('load-failed-btn').click();
      }, 3000);
    } else if (data.pool_still_empty) {
      statusEl.innerHTML = `
        <div style="color: #f59e0b;">
          ⚠️ <strong>Pool still doesn't have inventory</strong><br>
          ${data.error}<br>
          <span style="font-size: 0.8rem;">Try using the Refund button instead.</span>
        </div>
      `;
      fulfillBtn.disabled = false;
      refundBtn.disabled = false;
    } else {
      statusEl.innerHTML = `<span style="color: #f87171;">❌ ${data.error}</span>`;
      fulfillBtn.disabled = false;
      refundBtn.disabled = false;
    }
  } catch (error) {
    statusEl.innerHTML = `<span style="color: #f87171;">❌ Error: ${error.message}</span>`;
    fulfillBtn.disabled = false;
    refundBtn.disabled = false;
  }
}

// Refund failed craft assets to user
async function refundFailedCraft(craftId) {
  const statusEl = document.getElementById(`fulfill-status-${craftId}`);
  const fulfillBtn = document.getElementById(`fulfill-btn-${craftId}`);
  const refundBtn = document.getElementById(`refund-btn-${craftId}`);

  if (!confirm('Transfer the stuck assets from futuresrelic wallet back to the user?\n\nNote: You will need to manually transfer the assets using AtomicHub or another wallet interface.')) {
    return;
  }

  // For now, just show instructions since we need manual transfer
  statusEl.innerHTML = `
    <div style="color: #60a5fa; padding: 10px; background: rgba(96,165,250,0.1); border-radius: 4px;">
      <strong>📋 Manual Refund Instructions:</strong><br>
      1. Go to <a href="https://wax.atomichub.io/profile/futuresrelic" target="_blank" style="color: var(--primary);">futuresrelic wallet on AtomicHub</a><br>
      2. Find and select the stuck assets listed above<br>
      3. Transfer them back to the user's wallet<br>
      4. Once refunded, this craft can be marked as resolved<br>
      <br>
      <button class="btn btn-success btn-sm" onclick="markCraftRefunded(${craftId})">✅ Mark as Refunded</button>
    </div>
  `;
}

// Mark craft as refunded (admin confirmation)
async function markCraftRefunded(craftId) {
  const statusEl = document.getElementById(`fulfill-status-${craftId}`);

  if (!confirm('Have you manually transferred the assets back to the user?\n\nThis will mark the craft as resolved.')) {
    return;
  }

  try {
    statusEl.innerHTML = '<span style="color: #60a5fa;">Updating status...</span>';

    // Update craft status to a custom "refunded" state
    // For now, we'll just reload the failed list
    // In the future, you could add a PATCH endpoint to update status

    statusEl.innerHTML = `
      <div style="color: #10b981;">
        ✅ <strong>Marked as refunded</strong><br>
        <span style="font-size: 0.8rem;">Reloading failed crafts list...</span>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('load-failed-btn').click();
    }, 2000);

  } catch (error) {
    statusEl.innerHTML = `<span style="color: #f87171;">❌ Error: ${error.message}</span>`;
  }
}
