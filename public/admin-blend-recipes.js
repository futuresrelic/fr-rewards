// admin-blend-recipes.js - Blend Recipe Management Admin Panel

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://claim.futuresrelic.com';

let authToken = localStorage.getItem('adminToken');

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
    } else {
      showError('login-error', 'Invalid password');
    }
  } catch (error) {
    showError('login-error', 'Login failed: ' + error.message);
  }
});

async function validateTokenAndShowDashboard() {
  try {
    const response = await fetch(`${API_URL}/api/admin/workflow/steps`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showDashboard();
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

// Fetch & Cache Blend Recipes
document.getElementById('fetch-blends-btn').addEventListener('click', () => fetchBlendRecipes(false));
document.getElementById('refresh-blends-btn').addEventListener('click', () => fetchBlendRecipes(true));

async function fetchBlendRecipes(forceRefresh = false) {
  const blendIdsInput = document.getElementById('blend-ids-input').value.trim();
  const collection = document.getElementById('collection-input').value.trim();

  if (!blendIdsInput) {
    showStatus('fetch-status', 'Please enter blend IDs', 'error');
    return;
  }

  const blendIds = blendIdsInput.split(',').map(id => id.trim()).filter(id => id);

  if (blendIds.length === 0) {
    showStatus('fetch-status', 'No valid blend IDs found', 'error');
    return;
  }

  console.log(`🚀 Fetching ${blendIds.length} blend recipes (refresh: ${forceRefresh})...`);

  // Show progress
  document.getElementById('fetch-progress').style.display = 'block';
  document.getElementById('fetch-status').style.display = 'none';
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-text').textContent = `Starting...`;

  try {
    const startTime = Date.now();

    // Call the /api/blend-recipes endpoint
    const url = `${API_URL}/api/blend-recipes?blend_ids=${blendIds.join(',')}&collection=${collection}&refresh=${forceRefresh}`;

    console.log('📡 Request URL:', url);

    const response = await fetch(url);
    const data = await response.json();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (response.ok) {
      // Update progress
      document.getElementById('progress-bar').style.width = '100%';
      document.getElementById('progress-text').textContent = `Completed in ${elapsed}s`;

      // Show success status
      setTimeout(() => {
        document.getElementById('fetch-progress').style.display = 'none';

        const successCount = data.recipes ? data.recipes.length : 0;
        const fromCache = data.cached ? data.cached.length : 0;
        const fromBlockchain = successCount - fromCache;

        let message = `✅ Success! Retrieved ${successCount} blend recipes`;
        if (fromCache > 0 && !forceRefresh) {
          message += ` (${fromCache} from cache, ${fromBlockchain} from blockchain)`;
        } else if (forceRefresh) {
          message += ` (all fetched fresh from blockchain)`;
        }

        showStatus('fetch-status', message, 'success');

        // Display the recipes
        displayRecipes(data.recipes || []);
      }, 500);
    } else {
      document.getElementById('fetch-progress').style.display = 'none';
      showStatus('fetch-status', `❌ Error: ${data.error || 'Failed to fetch blend recipes'}`, 'error');
      console.error('Fetch error:', data);
    }
  } catch (error) {
    document.getElementById('fetch-progress').style.display = 'none';
    showStatus('fetch-status', `❌ Error: ${error.message}`, 'error');
    console.error('Fetch failed:', error);
  }
}

// Load cached recipes
document.getElementById('load-cache-btn').addEventListener('click', async () => {
  const blendIdsInput = document.getElementById('blend-ids-input').value.trim();
  const collection = document.getElementById('collection-input').value.trim();
  const blendIds = blendIdsInput.split(',').map(id => id.trim()).filter(id => id);

  try {
    const url = `${API_URL}/api/blend-recipes?blend_ids=${blendIds.join(',')}&collection=${collection}&refresh=false`;
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      const recipes = data.recipes || [];
      const cached = data.cached || [];

      if (cached.length > 0) {
        showStatus('cache-status', `✅ Loaded ${cached.length} recipes from cache`, 'success');
      } else {
        showStatus('cache-status', `⚠️ No cached recipes found. Click "Fetch & Cache Recipes" to populate.`, 'warning');
      }

      displayRecipes(recipes);
    } else {
      showStatus('cache-status', `❌ Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showStatus('cache-status', `❌ Error: ${error.message}`, 'error');
  }
});

// Clear cache
document.getElementById('clear-cache-btn').addEventListener('click', async () => {
  if (!confirm('⚠️ Are you sure you want to clear ALL cached blend recipes? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/blend-recipes/clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ collection: 'futuresrelic' })
    });

    const data = await response.json();

    if (response.ok) {
      showStatus('cache-status', `✅ Cache cleared successfully`, 'success');
      document.getElementById('cached-recipes-container').innerHTML = '<p style="color: var(--text-secondary);">Cache is empty</p>';
    } else {
      showStatus('cache-status', `❌ Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showStatus('cache-status', `❌ Error: ${error.message}`, 'error');
  }
});

// Test blend availability
document.getElementById('test-availability-btn').addEventListener('click', async () => {
  const wallet = document.getElementById('test-wallet-input').value.trim();

  if (!wallet) {
    alert('Please enter a wallet address');
    return;
  }

  const blendIdsInput = document.getElementById('blend-ids-input').value.trim();
  const collection = document.getElementById('collection-input').value.trim();
  const blendIds = blendIdsInput.split(',').map(id => id.trim()).filter(id => id);

  document.getElementById('test-results').style.display = 'block';
  document.getElementById('test-results-content').innerHTML = '<p>Loading...</p>';

  try {
    // First, get blend recipes
    const recipesResponse = await fetch(`${API_URL}/api/blend-recipes?blend_ids=${blendIds.join(',')}&collection=${collection}`);
    const recipesData = await recipesResponse.json();

    if (!recipesResponse.ok) {
      throw new Error(recipesData.error || 'Failed to fetch recipes');
    }

    // Then, get user's assets
    const assetsResponse = await fetch(`${API_URL}/api/assets/${wallet}?collection_name=${collection}&live=true`);
    const assetsData = await assetsResponse.json();

    if (!assetsResponse.ok) {
      throw new Error(assetsData.error || 'Failed to fetch assets');
    }

    // Check which blends are available
    const recipes = recipesData.recipes || [];
    const userAssets = assetsData.data || [];

    const results = recipes.map(recipe => {
      const ingredients = recipe.ingredients || [];
      const available = checkBlendAvailable(ingredients, userAssets);

      return {
        blend_id: recipe.blend_id,
        available: available.canBlend,
        missing: available.missing,
        ingredients: ingredients
      };
    });

    // Display results
    const availableCount = results.filter(r => r.available).length;
    const unavailableCount = results.length - availableCount;

    let html = `
      <div style="margin-bottom: 15px; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px;">
        <strong>Summary:</strong><br>
        ✅ ${availableCount} blends available<br>
        ❌ ${unavailableCount} blends unavailable<br>
        💼 User has ${userAssets.length} total assets in collection
      </div>
    `;

    results.forEach(result => {
      const statusIcon = result.available ? '✅' : '❌';
      const statusColor = result.available ? '#4ade80' : '#f87171';

      html += `
        <div style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.05); border-left: 3px solid ${statusColor}; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>${statusIcon} Blend ${result.blend_id}</strong>
            <span style="color: ${statusColor};">${result.available ? 'Available' : 'Unavailable'}</span>
          </div>
          ${!result.available && result.missing.length > 0 ? `
            <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
              Missing: ${result.missing.map(m => `Template ${m.template_id} (need ${m.needed}, have ${m.owned})`).join(', ')}
            </div>
          ` : ''}
        </div>
      `;
    });

    document.getElementById('test-results-content').innerHTML = html;
  } catch (error) {
    document.getElementById('test-results-content').innerHTML = `<p style="color: #f87171;">❌ Error: ${error.message}</p>`;
  }
});

// Helper function to check if blend is available
function checkBlendAvailable(ingredients, userAssets) {
  const missing = [];

  for (const ingredient of ingredients) {
    const templateId = ingredient.template_id.toString();
    const needed = ingredient.amount || 1;

    const owned = userAssets.filter(asset =>
      asset.template && asset.template.template_id.toString() === templateId
    ).length;

    if (owned < needed) {
      missing.push({
        template_id: templateId,
        needed: needed,
        owned: owned
      });
    }
  }

  return {
    canBlend: missing.length === 0,
    missing: missing
  };
}

// Display recipes
function displayRecipes(recipes) {
  const container = document.getElementById('cached-recipes-container');

  if (!recipes || recipes.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No recipes to display</p>';
    return;
  }

  let html = `
    <div style="background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
      <strong>Total Recipes:</strong> ${recipes.length}
    </div>
  `;

  recipes.forEach(recipe => {
    const ingredients = recipe.ingredients || [];
    const displayData = recipe.display_data ? JSON.parse(recipe.display_data) : null;
    const blendName = displayData?.name || `Blend ${recipe.blend_id}`;

    html += `
      <div style="margin: 15px 0; padding: 15px; background: var(--bg-dark); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
          <div>
            <h3 style="margin: 0; color: var(--primary);">${blendName}</h3>
            <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">Blend ID: ${recipe.blend_id}</p>
          </div>
          <div style="text-align: right; font-size: 0.85rem; color: var(--text-secondary);">
            Collection: ${recipe.collection_name}<br>
            Cached: ${new Date(recipe.fetched_at).toLocaleString()}
          </div>
        </div>

        <div style="margin-top: 15px;">
          <strong style="color: var(--text-primary);">Ingredients (${ingredients.length}):</strong>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">
            ${ingredients.map((ing, idx) => `
              <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                <div style="font-size: 0.9rem;">
                  <strong>#${idx + 1}:</strong> Template ${ing.template_id}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                  Amount: ${ing.amount || 1}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });

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
