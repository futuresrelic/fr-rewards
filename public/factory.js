// factory.js - User-facing Factory interface

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://claim.futuresrelic.com';
const wax = new waxjs.WaxJS({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: false });

let currentAccount = null;
let currentRecipe = null;
let currentBatchCount = 1;
let selectedAssets = [];
let templateCache = {}; // Cache template data

// Check for saved login on page load
window.addEventListener('DOMContentLoaded', async () => {
  const savedAccount = localStorage.getItem('factory_account');
  if (savedAccount) {
    try {
      // Try auto-login
      const userAccount = await wax.login();
      if (userAccount === savedAccount) {
        currentAccount = userAccount;
        document.getElementById('connected-wallet').textContent = userAccount;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('factory-content').style.display = 'block';
        loadRecipes();
      }
    } catch (error) {
      // Auto-login failed, clear saved account
      localStorage.removeItem('factory_account');
    }
  }
});

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  try {
    const userAccount = await wax.login();
    currentAccount = userAccount;
    localStorage.setItem('factory_account', userAccount); // Save login
    document.getElementById('connected-wallet').textContent = userAccount;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('factory-content').style.display = 'block';
    loadRecipes();
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
});

// Disconnect
document.getElementById('disconnect-btn').addEventListener('click', () => {
  currentAccount = null;
  localStorage.removeItem('factory_account'); // Clear saved login
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('factory-content').style.display = 'none';
});

// Load categories (lightweight - no asset checking!)
async function loadRecipes() {
  const loadingEl = document.getElementById('loading-recipes');
  loadingEl.style.display = 'block';
  loadingEl.innerHTML = '<p>⏳ Loading recipe categories...</p>';

  document.getElementById('recipes-container').style.display = 'none';
  document.getElementById('no-recipes').style.display = 'none';

  try {
    const response = await fetch(`${API_URL}/api/factory/categories`);
    const data = await response.json();

    if (response.ok && data.categories.length > 0) {
      displayCategories(data.categories);
      document.getElementById('loading-recipes').style.display = 'none';
      document.getElementById('recipes-container').style.display = 'block';
    } else {
      document.getElementById('loading-recipes').style.display = 'none';
      document.getElementById('no-recipes').style.display = 'block';
    }
  } catch (error) {
    document.getElementById('loading-recipes').innerHTML = `<p style="color: #f87171;">❌ Error: ${error.message}</p>`;
  }
}

// Display categories as collapsible cards
function displayCategories(categories) {
  const container = document.getElementById('recipes-container');

  const html = categories.map(category => `
    <div class="card" style="margin-bottom: 20px;">
      <div
        style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 20px;"
        onclick="toggleCategory('${category.name}')"
      >
        <div>
          <h3 style="margin: 0; font-size: 1.3rem;">${category.name}</h3>
          <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">
            ${category.recipeCount} recipe${category.recipeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div id="category-icon-${category.name.replace(/\s+/g, '-')}" style="font-size: 1.5rem;">▶</div>
      </div>

      <div id="category-${category.name.replace(/\s+/g, '-')}" style="display: none; padding: 0 20px 20px 20px; border-top: 1px solid var(--border);">
        <p style="text-align: center; padding: 20px; color: var(--text-secondary);">
          ⏳ Click to load recipes...
        </p>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

// Toggle category expansion
const loadedCategories = new Set();

async function toggleCategory(categoryName) {
  const categoryId = categoryName.replace(/\s+/g, '-');
  const categoryEl = document.getElementById(`category-${categoryId}`);
  const iconEl = document.getElementById(`category-icon-${categoryId}`);

  if (categoryEl.style.display === 'none') {
    // Expand category
    categoryEl.style.display = 'block';
    iconEl.textContent = '▼';

    // Load recipes if not already loaded
    if (!loadedCategories.has(categoryName)) {
      await loadCategoryRecipes(categoryName, categoryEl);
      loadedCategories.add(categoryName);
    }
  } else {
    // Collapse category
    categoryEl.style.display = 'none';
    iconEl.textContent = '▶';
  }
}

// Load recipes for a specific category
async function loadCategoryRecipes(categoryName, containerEl) {
  // Show loading state
  containerEl.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">⏳ Loading recipes and checking assets...</p>';

  try {
    // Fetch recipes for this category with asset checking
    const response = await fetch(`${API_URL}/api/factory/recipes?wallet=${currentAccount}&category=${encodeURIComponent(categoryName)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch recipes');
    }

    const recipes = data.recipes || [];

    if (recipes.length === 0) {
      containerEl.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">No recipes found in this category.</p>';
      return;
    }

    // Fetch template data for images and names
    await fetchTemplateData(recipes);

    // Render recipes in this category container
    displayRecipesInContainer(recipes, containerEl);
  } catch (error) {
    containerEl.innerHTML = `<p style="text-align: center; padding: 20px; color: #f87171;">❌ Error: ${error.message}</p>`;
  }
}

// Fetch template data for images and names
async function fetchTemplateData(recipes) {
  const templateIds = new Set();

  // Collect all unique template IDs
  recipes.forEach(recipe => {
    recipe.ingredients_enriched.forEach(ing => templateIds.add(ing.template_id));
    recipe.results.forEach(res => templateIds.add(res.template_id));
  });

  if (templateIds.size === 0) {
    return;
  }

  // Fetch all template data from backend (to avoid CORS)
  const idsArray = Array.from(templateIds);
  const ids = idsArray.join(',');

  try {
    const response = await fetch(`/api/factory/templates?ids=${ids}`);
    const data = await response.json();

    if (data.success && data.templates) {
      // Merge into template cache
      Object.assign(templateCache, data.templates);
      console.log(`✅ Loaded data for ${Object.keys(data.templates).length} templates`);
    }
  } catch (error) {
    console.warn('Failed to fetch template data:', error);
  }
}

// Get IPFS URL
function getIpfsUrl(hash) {
  if (!hash) return null;
  const cleanHash = hash.replace('ipfs://', '');
  return `https://ipfs.io/ipfs/${cleanHash}`;
}

// Get template info
function getTemplateInfo(templateId) {
  const cached = templateCache[templateId];
  if (cached) {
    return {
      name: cached.name,
      media: cached.video ? getIpfsUrl(cached.video) : (cached.img ? getIpfsUrl(cached.img) : null),
      isVideo: !!cached.video
    };
  }
  return {
    name: `Template ${templateId}`,
    media: null,
    isVideo: false
  };
}

// Display recipes in a specific container element
function displayRecipesInContainer(recipes, containerEl) {
  let html = '';

  recipes.forEach(recipe => {
    const canCraft = recipe.user_can_craft > 0 && recipe.cooldown_remaining === 0;
    const statusClass = canCraft ? 'available' : 'unavailable';
    const statusIcon = canCraft ? '✅' : '❌';

    html += `
      <div class="card" style="margin-bottom: 20px; border-left: 4px solid ${canCraft ? '#4ade80' : '#94a3b8'};">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <h2 style="margin: 0;">${recipe.name}</h2>
            ${recipe.description ? `<p style="margin: 5px 0 0 0; color: var(--text-secondary);">${recipe.description}</p>` : ''}
          </div>
          <span style="font-size: 1.5rem;">${statusIcon}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
          <div>
            <h3 style="margin: 0 0 10px 0;">Ingredients Required:</h3>
            ${recipe.ingredients_enriched.map(ing => {
              const hasEnough = ing.owned >= ing.amount;
              const templateInfo = getTemplateInfo(ing.template_id);
              return `
                <div style="display: flex; gap: 10px; padding: 10px; background: var(--bg-dark); border-radius: 6px; margin-bottom: 8px;">
                  ${templateInfo.media ? `
                    ${templateInfo.isVideo ?
                      `<video src="${templateInfo.media}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" muted autoplay loop></video>` :
                      `<img src="${templateInfo.media}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" alt="${templateInfo.name}">`
                    }
                  ` : `
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">No Media</div>
                  `}
                  <div style="flex: 1;">
                    <strong>${templateInfo.name}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Template ${ing.template_id} x${ing.amount}</div>
                    <div style="font-size: 0.85rem; color: ${hasEnough ? '#4ade80' : '#f87171'};">${hasEnough ? '✅' : '❌'} You have: ${ing.owned}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div>
            <h3 style="margin: 0 0 10px 0;">Results:</h3>
            ${recipe.results.map(res => {
              const templateInfo = getTemplateInfo(res.template_id);
              return `
                <div style="display: flex; gap: 10px; padding: 10px; background: var(--bg-dark); border-radius: 6px; margin-bottom: 8px;">
                  ${templateInfo.media ? `
                    ${templateInfo.isVideo ?
                      `<video src="${templateInfo.media}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" muted autoplay loop></video>` :
                      `<img src="${templateInfo.media}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" alt="${templateInfo.name}">`
                    }
                  ` : `
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">No Media</div>
                  `}
                  <div style="flex: 1;">
                    <strong>${res.name_override || templateInfo.name}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Template ${res.template_id} x${res.amount}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${recipe.cooldown_remaining > 0 ? `
          <div style="margin-top: 15px; padding: 10px; background: rgba(251, 191, 36, 0.1); border-radius: 6px; border-left: 3px solid #fbbf24;">
            ⏳ Cooldown active: ${recipe.cooldown_remaining.toFixed(1)} hours remaining
          </div>
        ` : ''}

        ${canCraft ? `
          <div style="margin-top: 15px;">
            <p style="margin: 0 0 10px 0; color: var(--text-secondary);">You can craft up to ${recipe.user_can_craft}x at once!</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              ${Array.from({ length: recipe.user_can_craft }, (_, i) => i + 1).map(count => `
                <button class="btn btn-primary craft-btn" data-recipe-id="${recipe.id}" data-batch="${count}">
                  Craft ${count}x
                </button>
              `).join('')}
            </div>
          </div>
        ` : recipe.missing_ingredients.length > 0 ? `
          <div style="margin-top: 15px; padding: 10px; background: rgba(248, 113, 113, 0.1); border-radius: 6px; border-left: 3px solid #f87171;">
            ❌ Missing ingredients - acquire more assets to craft this recipe
          </div>
        ` : ''}
      </div>
    `;
  });

  containerEl.innerHTML = html;

  // Add craft button listeners
  containerEl.querySelectorAll('.craft-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const recipeId = parseInt(btn.dataset.recipeId);
      const batchCount = parseInt(btn.dataset.batch);
      const recipe = recipes.find(r => r.id === recipeId);
      startCraft(recipe, batchCount);
    });
  });
}

// Legacy display function for backward compatibility
function displayRecipes(recipes) {
  const container = document.getElementById('recipes-container');
  displayRecipesInContainer(recipes, container);
}

// Start craft
async function startCraft(recipe, batchCount) {
  currentRecipe = recipe;
  currentBatchCount = batchCount;

  // Show processing modal
  showProcessingModal('Loading Assets', 'Fetching relevant assets...<br><small style="color: var(--text-secondary);">Only loading what you need!</small>');

  try {
    // Use new optimized endpoint - only fetches & enriches assets for THIS recipe!
    const response = await fetch(`${API_URL}/api/factory/recipe-assets?wallet=${currentAccount}&recipe_id=${recipe.id}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch assets');
    }

    // Assets are already filtered AND enriched with mint data from server!
    const enrichedAssets = data.assets || [];
    console.log(`✅ Received ${enrichedAssets.length} pre-enriched assets for recipe`);

    // Group assets by template
    const groupedAssets = {};
    recipe.ingredients.forEach(ing => {
      const templateId = ing.template_id.toString();
      const matching = enrichedAssets.filter(asset =>
        asset.template && asset.template.template_id.toString() === templateId
      );

      // Sort by mint number (HIGHEST first - save low mints!)
      matching.sort((a, b) => {
        const mintA = a.template_mint || 0;
        const mintB = b.template_mint || 0;
        return mintB - mintA; // Descending order
      });

      groupedAssets[templateId] = {
        template_id: templateId,
        needed: ing.amount * batchCount,
        assets: matching
      };
    });

    hideProcessingModal();
    showAssetSelectionModal(groupedAssets);
  } catch (error) {
    hideProcessingModal();
    alert('Error loading assets: ' + error.message);
  }
}

// Show asset selection modal
function showAssetSelectionModal(groupedAssets) {
  const modalContent = document.getElementById('modal-content');
  document.getElementById('modal-title').textContent = `Select Assets for ${currentRecipe.name} (${currentBatchCount}x)`;

  selectedAssets = [];

  let html = '<div style="margin-bottom: 20px;">';
  html += `<p><strong>Total assets needed:</strong> ${Object.values(groupedAssets).reduce((sum, g) => sum + g.needed, 0)}</p>`;
  html += '<p style="font-size: 0.9rem; color: var(--text-secondary);">💡 Highest mint numbers are pre-selected to save your low mints!</p>';
  html += '</div>';

  // Display grouped assets
  for (const [templateId, group] of Object.entries(groupedAssets)) {
    const templateInfo = getTemplateInfo(templateId);

    html += `
      <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-dark); border-radius: 8px;">
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
          ${templateInfo.media ? `
            ${templateInfo.isVideo ?
              `<video src="${templateInfo.media}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" muted autoplay loop></video>` :
              `<img src="${templateInfo.media}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" alt="${templateInfo.name}">`
            }
          ` : ''}
          <div>
            <h3 style="margin: 0;">${templateInfo.name}</h3>
            <small style="color: var(--text-secondary);">Template ${templateId} - Need ${group.needed}</small>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
    `;

    group.assets.slice(0, Math.max(group.needed * 2, 10)).forEach((asset, idx) => {
      const assetId = asset.asset_id;
      const isAutoSelected = idx < group.needed;

      html += `
        <div class="asset-checkbox" style="padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; border: 2px solid ${isAutoSelected ? 'var(--primary)' : 'transparent'};" data-asset-id="${assetId}" data-template-id="${templateId}">
          <label style="cursor: pointer; display: block;">
            <input type="checkbox" class="asset-select" data-asset-id="${assetId}" data-template-id="${templateId}" ${isAutoSelected ? 'checked' : ''} style="margin-right: 5px;">
            <strong>Asset #${assetId}</strong>
            <br><small style="color: ${isAutoSelected ? '#4ade80' : 'var(--text-secondary)'};">Mint: #${asset.template_mint || 'N/A'}</small>
          </label>
        </div>
      `;

      if (isAutoSelected) {
        selectedAssets.push(assetId);
      }
    });

    html += '</div></div>';
  }

  html += `
    <div style="margin-top: 20px; padding: 15px; background: rgba(248, 113, 113, 0.1); border-radius: 6px; border-left: 3px solid #f87171;">
      <strong>⚠️ Important:</strong> Selected assets will be transferred to <strong>${currentRecipe.transfer_to_wallet || 'futuresrelic'}</strong> wallet. This action cannot be undone automatically.
    </div>

    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button id="confirm-craft-btn" class="btn btn-primary btn-lg">Transfer & Craft</button>
      <button id="cancel-craft-btn" class="btn btn-secondary">Cancel</button>
    </div>
  `;

  modalContent.innerHTML = html;

  // Add checkbox listeners
  document.querySelectorAll('.asset-select').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const assetId = e.target.dataset.assetId;
      if (e.target.checked) {
        if (!selectedAssets.includes(assetId)) {
          selectedAssets.push(assetId);
        }
        e.target.closest('.asset-checkbox').style.borderColor = 'var(--primary)';
      } else {
        selectedAssets = selectedAssets.filter(id => id !== assetId);
        e.target.closest('.asset-checkbox').style.borderColor = 'transparent';
      }
    });
  });

  document.getElementById('confirm-craft-btn').addEventListener('click', executeCraft);
  document.getElementById('cancel-craft-btn').addEventListener('click', closeModal);

  document.getElementById('asset-modal').style.display = 'block';
}

// Execute craft
async function executeCraft() {
  closeModal();
  showProcessingModal('Step 1: Transfer Assets', 'Please sign the transaction in your wallet...');

  try {
    // Prepare transfer transaction
    const transferWallet = currentRecipe.transfer_to_wallet || 'futuresrelic';
    const actions = [{
      account: 'atomicassets',
      name: 'transfer',
      authorization: [{
        actor: currentAccount,
        permission: 'active'
      }],
      data: {
        from: currentAccount,
        to: transferWallet,
        asset_ids: selectedAssets,
        memo: `Factory craft: ${currentRecipe.name} x${currentBatchCount}`
      }
    }];

    // Execute transfer
    const result = await wax.api.transact({ actions }, {
      blocksBehind: 3,
      expireSeconds: 30
    });

    const transferTxId = result.transaction_id;

    // Update processing
    showProcessingModal('Step 2: Verifying Transfer', 'Checking blockchain...<br><small style="color: var(--text-secondary);">Waiting for confirmation</small>');

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for blockchain confirmation

    // Call backend to verify + mint
    showProcessingModal('Step 3: Minting Results', `Creating your new assets...<br><small style="color: var(--text-secondary);">Using ${transferWallet} wallet</small>`);

    const craftResponse = await fetch(`${API_URL}/api/factory/craft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: currentRecipe.id,
        batch_count: currentBatchCount,
        transfer_transaction_id: transferTxId,
        asset_ids: selectedAssets,
        user_wallet: currentAccount
      })
    });

    const craftData = await craftResponse.json();

    if (craftResponse.ok) {
      // Success!
      const resultsList = craftData.results.map(r => {
        const templateInfo = getTemplateInfo(r.template_id);
        return `${templateInfo.name} (Template ${r.template_id}) x${r.amount}`;
      }).join('<br>');

      showProcessingModal('✅ Craft Complete!', `
        <p style="margin: 15px 0; color: #4ade80;">Successfully crafted ${currentRecipe.name} x${currentBatchCount}!</p>
        <div style="margin: 15px 0; padding: 15px; background: var(--bg-dark); border-radius: 6px; text-align: left;">
          <strong>Results:</strong><br>
          ${resultsList}
        </div>
        <p style="font-size: 0.85rem;">
          Mint TX: <a href="https://waxblock.io/transaction/${craftData.mint_transaction_id}" target="_blank" style="color: var(--primary);">${craftData.mint_transaction_id.substr(0, 16)}...</a>
        </p>
        <button class="btn btn-primary" onclick="location.reload()">Close & Refresh</button>
      `);
    } else {
      throw new Error(craftData.error || 'Craft failed');
    }
  } catch (error) {
    hideProcessingModal();
    alert('Craft failed: ' + error.message);
  }
}

// Modal helpers
function closeModal() {
  document.getElementById('asset-modal').style.display = 'none';
}

document.getElementById('close-modal').addEventListener('click', closeModal);

function showProcessingModal(title, content) {
  document.getElementById('processing-title').textContent = title;
  document.getElementById('processing-content').innerHTML = content;
  document.getElementById('processing-modal').style.display = 'block';
}

function hideProcessingModal() {
  document.getElementById('processing-modal').style.display = 'none';
}
