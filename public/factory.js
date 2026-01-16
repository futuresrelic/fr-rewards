// factory.js - User-facing Factory interface

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://claim.futuresrelic.com';
const wax = new waxjs.WaxJS({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: false });

let currentAccount = null;
let currentRecipe = null;
let currentBatchCount = 1;
let selectedAssets = [];

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  try {
    const userAccount = await wax.login();
    currentAccount = userAccount;
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
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('factory-content').style.display = 'none';
});

// Load recipes
async function loadRecipes() {
  document.getElementById('loading-recipes').style.display = 'block';
  document.getElementById('recipes-container').style.display = 'none';
  document.getElementById('no-recipes').style.display = 'none';

  try {
    const response = await fetch(`${API_URL}/api/factory/recipes?wallet=${currentAccount}`);
    const data = await response.json();

    if (response.ok && data.recipes.length > 0) {
      displayRecipes(data.recipes);
      document.getElementById('loading-recipes').style.display = 'none';
      document.getElementById('recipes-container').style.display = 'block';
    } else {
      document.getElementById('loading-recipes').style.display = 'none';
      document.getElementById('no-recipes').style.display = 'block';
    }
  } catch (error) {
    document.getElementById('loading-recipes').innerHTML = `<p style="color: #f87171;">Error: ${error.message}</p>`;
  }
}

// Display recipes
function displayRecipes(recipes) {
  const container = document.getElementById('recipes-container');
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
              return `
                <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-dark); border-radius: 6px; margin-bottom: 5px;">
                  <span>Template ${ing.template_id} x${ing.amount}</span>
                  <span style="color: ${hasEnough ? '#4ade80' : '#f87171'};">${hasEnough ? '✅' : '❌'} You have: ${ing.owned}</span>
                </div>
              `;
            }).join('')}
          </div>

          <div>
            <h3 style="margin: 0 0 10px 0;">Results:</h3>
            ${recipe.results.map(res => `
              <div style="padding: 8px; background: var(--bg-dark); border-radius: 6px; margin-bottom: 5px;">
                Template ${res.template_id} x${res.amount}${res.name_override ? ` (${res.name_override})` : ''}
              </div>
            `).join('')}
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

  container.innerHTML = html;

  // Add craft button listeners
  document.querySelectorAll('.craft-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const recipeId = parseInt(btn.dataset.recipeId);
      const batchCount = parseInt(btn.dataset.batch);
      const recipe = recipes.find(r => r.id === recipeId);
      startCraft(recipe, batchCount);
    });
  });
}

// Start craft
async function startCraft(recipe, batchCount) {
  currentRecipe = recipe;
  currentBatchCount = batchCount;

  // Show processing modal
  showProcessingModal('Loading Assets', 'Fetching your assets...');

  try {
    // Fetch user's assets
    const response = await fetch(`${API_URL}/api/assets/${currentAccount}?collection_name=futuresrelic&live=true`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch assets');
    }

    const userAssets = data.data || [];

    // Filter and group assets by template
    const groupedAssets = {};
    recipe.ingredients.forEach(ing => {
      const templateId = ing.template_id.toString();
      const matching = userAssets.filter(asset =>
        asset.template && asset.template.template_id.toString() === templateId
      );
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
  html += '</div>';

  // Display grouped assets
  for (const [templateId, group] of Object.entries(groupedAssets)) {
    html += `
      <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-dark); border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0;">Template ${templateId} (Need ${group.needed})</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
    `;

    group.assets.slice(0, group.needed * 2).forEach((asset, idx) => {
      const assetId = asset.asset_id;
      const isAutoSelected = idx < group.needed;

      html += `
        <div class="asset-checkbox" style="padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; border: 2px solid ${isAutoSelected ? 'var(--primary)' : 'transparent'};" data-asset-id="${assetId}" data-template-id="${templateId}">
          <label style="cursor: pointer; display: block;">
            <input type="checkbox" class="asset-select" data-asset-id="${assetId}" data-template-id="${templateId}" ${isAutoSelected ? 'checked' : ''} style="margin-right: 5px;">
            Asset #${assetId}
            <br><small>Mint: #${asset.template_mint || 'N/A'}</small>
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
    <div style="margin-top: 20px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border-left: 3px solid var(--primary);">
      <strong>⚠️ Important:</strong> Selected assets will be transferred to futuresrelic wallet and cannot be recovered.
    </div>

    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button id="confirm-craft-btn" class="btn btn-primary">Transfer & Craft</button>
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
    const actions = [{
      account: 'atomicassets',
      name: 'transfer',
      authorization: [{
        actor: currentAccount,
        permission: 'active'
      }],
      data: {
        from: currentAccount,
        to: 'futuresrelic',
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
    showProcessingModal('Step 2: Verifying Transfer', 'Checking blockchain...');

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for blockchain confirmation

    // Call backend to verify + mint
    showProcessingModal('Step 3: Minting Results', 'Creating your new assets...');

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
      showProcessingModal('✅ Craft Complete!', `
        <p style="margin: 15px 0;">Successfully crafted ${currentRecipe.name} x${currentBatchCount}!</p>
        <div style="margin: 15px 0; padding: 15px; background: var(--bg-dark); border-radius: 6px;">
          <strong>Results:</strong><br>
          ${craftData.results.map(r => `Template ${r.template_id} x${r.amount}`).join('<br>')}
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
