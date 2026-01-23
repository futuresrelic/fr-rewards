/**
 * Factory Craft Module
 * Self-contained module for NFT crafting/recipes
 */

window.init_factory_craft = function(containerId, config = {}) {
  console.log(`✅ Factory Craft module initialized in #${containerId}`);
  console.log('Config:', config);

  const container = document.getElementById(containerId);
  const API_URL = window.location.origin;

  // Module state (scoped to this instance)
  let currentAccount = null;
  let wax = null;
  let anchor = null;
  let currentWalletType = null;
  let currentRecipe = null;
  let currentBatchCount = 1;
  let selectedAssets = [];
  let templateCache = {};
  let currentDisplayedRecipes = [];
  let loadedCategories = new Set();

  // Get module elements using container scope
  const notConnectedSection = container.querySelector('.factory-not-connected');
  const connectedSection = container.querySelector('.factory-connected');
  const loadingSection = container.querySelector('.factory-loading');
  const recipesContainer = container.querySelector('.factory-recipes-container');
  const noRecipesSection = container.querySelector('.factory-no-recipes');
  const errorSection = container.querySelector('.factory-error');
  const connectedAccountEl = container.querySelector('.factory-connected-account');
  const walletInfoDiv = container.querySelector('.factory-wallet-info');
  const assetModal = container.querySelector('.factory-asset-modal');
  const processingModal = container.querySelector('.factory-processing-modal');

  // Initialize
  (async function init() {
    await waitForLibraries();
    setupEventListeners();

    // Auto-connect if configured
    if (config.auto_connect) {
      checkExistingSession();
    }
  })();

  // Wait for wallet libraries to load
  async function waitForLibraries() {
    // Check WaxJS
    if (window.WaxJS || window.waxjs?.WaxJS) {
      console.log('✅ WaxJS loaded');
    } else {
      console.error('❌ WaxJS not loaded');
    }

    // Wait for Anchor to load
    let attempts = 0;
    while (!window.AnchorWallet && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.AnchorWallet) {
      console.log('✅ Anchor wallet loaded');
    } else {
      console.warn('⚠️ Anchor wallet not loaded (will be disabled)');
    }

    return true;
  }

  // Setup event listeners
  function setupEventListeners() {
    const connectWcwBtn = container.querySelector('.factory-connect-wcw');
    const connectAnchorBtn = container.querySelector('.factory-connect-anchor');
    const disconnectBtn = container.querySelector('.factory-disconnect-btn');
    const closeModalBtn = container.querySelector('.factory-close-modal');

    if (connectWcwBtn) {
      connectWcwBtn.addEventListener('click', () => connectWallet('wcw'));
    }
    if (connectAnchorBtn) {
      connectAnchorBtn.addEventListener('click', () => connectWallet('anchor'));
    }
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', disconnect);
    }
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeModal);
    }
  }

  // Check for existing session
  async function checkExistingSession() {
    const savedAccount = localStorage.getItem('wax_account');
    const savedWallet = localStorage.getItem('wax_wallet');

    if (savedAccount && savedWallet) {
      currentAccount = savedAccount;
      currentWalletType = savedWallet;

      // Try to restore Anchor session
      if (savedWallet === 'anchor' && window.AnchorWallet) {
        try {
          const restored = await window.AnchorWallet.restoreSession();
          if (restored) {
            anchor = window.AnchorWallet;
            currentAccount = restored;
          }
        } catch (error) {
          console.warn('Could not restore Anchor session:', error);
          localStorage.removeItem('wax_account');
          localStorage.removeItem('wax_wallet');
          return;
        }
      }

      showConnectedState();
      loadRecipes();
    }
  }

  // Connect wallet
  async function connectWallet(walletType) {
    try {
      hideError();

      if (walletType === 'wcw') {
        await connectWCW();
      } else if (walletType === 'anchor') {
        await connectAnchor();
      }

      if (currentAccount) {
        currentWalletType = walletType;
        localStorage.setItem('wax_account', currentAccount);
        localStorage.setItem('wax_wallet', walletType);
        showConnectedState();
        await loadRecipes();
      }
    } catch (error) {
      showError('Failed to connect wallet: ' + error.message);
      console.error('Wallet connection error:', error);
    }
  }

  // Connect Wax Cloud Wallet
  async function connectWCW() {
    const WaxJS = window.waxjs?.WaxJS || window.WaxJS;
    if (!WaxJS) throw new Error('WaxJS not loaded');

    wax = new WaxJS({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: false });
    currentAccount = await wax.login();
  }

  // Connect Anchor
  async function connectAnchor() {
    if (!window.AnchorWallet) {
      throw new Error('Anchor wallet not loaded. Please refresh the page or use WAX Cloud Wallet.');
    }

    anchor = window.AnchorWallet;
    currentAccount = await anchor.login();
  }

  // Disconnect wallet
  async function disconnect() {
    // Logout from Anchor if connected
    if (currentWalletType === 'anchor' && anchor) {
      try {
        await anchor.logout();
      } catch (error) {
        console.error('Error logging out of Anchor:', error);
      }
    }

    currentAccount = null;
    wax = null;
    anchor = null;
    currentWalletType = null;
    localStorage.removeItem('wax_account');
    localStorage.removeItem('wax_wallet');
    showNotConnectedState();
  }

  // Load categories (lightweight - no asset checking!)
  async function loadRecipes() {
    loadingSection.style.display = 'block';
    loadingSection.innerHTML = '<p>⏳ Loading recipe categories...</p>';

    recipesContainer.style.display = 'none';
    noRecipesSection.style.display = 'none';

    try {
      const response = await fetch(`${API_URL}/api/factory/categories`);
      const data = await response.json();

      if (response.ok && data.categories.length > 0) {
        // Filter categories if configured
        let categoriesToShow = data.categories;
        if (config.show_category) {
          categoriesToShow = data.categories.filter(cat => cat.name === config.show_category);
        }

        if (categoriesToShow.length > 0) {
          displayCategories(categoriesToShow);
          loadingSection.style.display = 'none';
          recipesContainer.style.display = 'block';

          // Auto-expand if show_category is set
          if (config.show_category && categoriesToShow.length === 1) {
            setTimeout(() => toggleCategory(categoriesToShow[0].name), 100);
          }
        } else {
          loadingSection.style.display = 'none';
          noRecipesSection.style.display = 'block';
        }
      } else {
        loadingSection.style.display = 'none';
        noRecipesSection.style.display = 'block';
      }
    } catch (error) {
      loadingSection.innerHTML = `<p style="color: #f87171;">❌ Error: ${error.message}</p>`;
    }
  }

  // Display categories as collapsible cards
  function displayCategories(categories) {
    const html = categories.map(category => {
      const categoryId = category.name.replace(/\s+/g, '-');
      return `
        <div class="card" style="margin-bottom: 20px;">
          <div
            class="category-header-${categoryId}"
            style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 20px;"
          >
            <div>
              <h3 style="margin: 0; font-size: 1.3rem;">${category.name}</h3>
              <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">
                ${category.recipeCount} recipe${category.recipeCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div class="category-icon-${categoryId}" style="font-size: 1.5rem;">▶</div>
          </div>

          <div class="category-${categoryId}" style="display: none; padding: 0 20px 20px 20px; border-top: 1px solid var(--border);">
            <p style="text-align: center; padding: 20px; color: var(--text-secondary);">
              ⏳ Click to load recipes...
            </p>
          </div>
        </div>
      `;
    }).join('');

    recipesContainer.innerHTML = html;

    // Add click listeners to category headers
    categories.forEach(category => {
      const categoryId = category.name.replace(/\s+/g, '-');
      const headerEl = container.querySelector(`.category-header-${categoryId}`);
      if (headerEl) {
        headerEl.addEventListener('click', () => toggleCategory(category.name));
      }
    });
  }

  // Toggle category expansion
  async function toggleCategory(categoryName) {
    const categoryId = categoryName.replace(/\s+/g, '-');
    const categoryEl = container.querySelector(`.category-${categoryId}`);
    const iconEl = container.querySelector(`.category-icon-${categoryId}`);

    if (!categoryEl || !iconEl) return;

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

      let recipes = data.recipes || [];

      // Filter by recipe_id if configured
      if (config.show_recipe_id) {
        recipes = recipes.filter(r => r.id === parseInt(config.show_recipe_id));
      }

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
      const response = await fetch(`${API_URL}/api/factory/templates?ids=${ids}`);
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
    // Store recipes for button listeners
    currentDisplayedRecipes = recipes;

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
              ${recipe.pool_mode_enabled ? `
                <p style="margin: 0 0 10px 0; color: var(--text-secondary); font-weight: 600;">🔄 Pool/Swap Mode Available!</p>
                <div class="pool-status-container-${recipe.id}" data-recipe-id="${recipe.id}" data-max-batch="${recipe.user_can_craft}" style="margin-bottom: 15px;">
                  <p style="margin: 5px 0; color: var(--text-secondary); font-size: 0.9rem;">
                    Checking pool availability...
                  </p>
                </div>
              ` : `
                <p style="margin: 0 0 10px 0; color: var(--text-secondary);">You can craft up to ${recipe.user_can_craft}x at once!</p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  ${Array.from({ length: recipe.user_can_craft }, (_, i) => i + 1).map(count => `
                    <button class="btn btn-primary craft-btn" data-recipe-id="${recipe.id}" data-batch="${count}" data-mode="mint">
                      Craft ${count}x
                    </button>
                  `).join('')}
                </div>
              `}
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

    // Check pool inventory for pool-enabled recipes
    recipes.forEach(async (recipe) => {
      if (recipe.pool_mode_enabled && recipe.user_can_craft > 0 && recipe.cooldown_remaining === 0) {
        const poolContainer = container.querySelector(`.pool-status-container-${recipe.id}`);
        if (poolContainer) {
          await checkAndDisplayPoolOptions(recipe, poolContainer);
        }
      }
    });

    // Add craft button listeners
    containerEl.querySelectorAll('.craft-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recipeId = parseInt(btn.dataset.recipeId);
        const batchCount = parseInt(btn.dataset.batch);
        const mode = btn.dataset.mode || 'mint';
        const recipe = recipes.find(r => r.id === recipeId);
        startCraft(recipe, batchCount, mode);
      });
    });
  }

  // Check pool inventory and display swap/mint options
  async function checkAndDisplayPoolOptions(recipe, poolContainer) {
    try {
      const maxBatch = parseInt(poolContainer.dataset.maxBatch);

      // Check pool inventory for batch size 1
      const response = await fetch(`${API_URL}/api/factory/pool-inventory/${recipe.id}?batch_count=1`);
      const data = await response.json();

      if (!response.ok) {
        poolContainer.innerHTML = `
          <p style="color: #f87171; margin: 5px 0; font-size: 0.9rem;">
            ⚠️ Error checking pool: ${data.error}
          </p>
          <p style="margin: 5px 0 10px 0; color: var(--text-secondary);">You can still mint:</p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${Array.from({ length: maxBatch }, (_, i) => i + 1).map(count => `
              <button class="btn btn-primary craft-btn" data-recipe-id="${recipe.id}" data-batch="${count}" data-mode="mint">
                Mint ${count}x
              </button>
            `).join('')}
          </div>
        `;
        attachCraftButtonListeners(poolContainer, [recipe]);
        return;
      }

      const swapAvailable = data.swap_available;

      if (swapAvailable) {
        // Pool has inventory! Show swap option
        poolContainer.innerHTML = `
          <div style="background: rgba(74, 222, 128, 0.1); padding: 12px; border-radius: 6px; border-left: 3px solid #4ade80; margin-bottom: 10px;">
            <strong style="color: #4ade80;">✅ Pool has assets available!</strong>
            <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
              Swap uses fewer ingredients (cheaper!) or mint new ones.
            </p>
          </div>
          <div style="margin-bottom: 15px;">
            <h4 style="margin: 0 0 8px 0; font-size: 0.95rem;">🔄 Swap from Pool (Cheaper):</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              ${Array.from({ length: maxBatch }, (_, i) => i + 1).map(count => `
                <button class="btn btn-success craft-btn" data-recipe-id="${recipe.id}" data-batch="${count}" data-mode="swap">
                  Swap ${count}x
                </button>
              `).join('')}
            </div>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; font-size: 0.95rem;">🔨 Mint New:</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              ${Array.from({ length: maxBatch }, (_, i) => i + 1).map(count => `
                <button class="btn btn-primary craft-btn" data-recipe-id="${recipe.id}" data-batch="${count}" data-mode="mint">
                  Mint ${count}x
                </button>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        // Pool doesn't have inventory, only show mint option
        poolContainer.innerHTML = `
          <div style="background: rgba(251, 191, 36, 0.1); padding: 10px; border-radius: 6px; border-left: 3px solid #fbbf24; margin-bottom: 10px;">
            <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
              ℹ️ Pool currently empty. You can mint new assets:
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${Array.from({ length: maxBatch }, (_, i) => i + 1).map(count => `
              <button class="btn btn-primary craft-btn" data-recipe-id="${recipe.id}" data-batch="${count}" data-mode="mint">
                Mint ${count}x
              </button>
            `).join('')}
          </div>
        `;
      }

      attachCraftButtonListeners(poolContainer, [recipe]);

    } catch (error) {
      console.error('Error checking pool inventory:', error);
      poolContainer.innerHTML = `
        <p style="color: #f87171; margin: 5px 0;">⚠️ Error checking pool availability</p>
      `;
    }
  }

  // Helper to attach craft button listeners to a container
  function attachCraftButtonListeners(containerEl, recipes) {
    containerEl.querySelectorAll('.craft-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recipeId = parseInt(btn.dataset.recipeId);
        const batchCount = parseInt(btn.dataset.batch);
        const mode = btn.dataset.mode || 'mint';
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe) {
          startCraft(recipe, batchCount, mode);
        }
      });
    });
  }

  // Start craft
  async function startCraft(recipe, batchCount, mode = 'mint') {
    currentRecipe = recipe;
    currentBatchCount = batchCount;
    window.currentCraftMode = mode; // Store mode globally for executeCraft

    console.log(`🏭 Starting craft in ${mode} mode`);

    // Show processing modal
    showProcessingModal('Loading Assets', 'Fetching relevant assets...<br><small style="color: var(--text-secondary);">Only loading what you need!</small>');

    try {
      // Use optimized endpoint - only fetches & enriches assets for THIS recipe!
      const response = await fetch(`${API_URL}/api/factory/recipe-assets?wallet=${currentAccount}&recipe_id=${recipe.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch assets');
      }

      // Assets are already filtered AND enriched with mint data from server!
      const enrichedAssets = data.assets || [];
      console.log(`✅ Received ${enrichedAssets.length} pre-enriched assets for recipe`);

      // Use pool_ingredients for swap mode, regular ingredients for mint mode
      const ingredientsToUse = (mode === 'swap' && recipe.pool_ingredients) ? recipe.pool_ingredients : recipe.ingredients;

      console.log(`📋 Using ingredients for ${mode} mode:`, ingredientsToUse);

      // Group assets by template
      const groupedAssets = {};
      ingredientsToUse.forEach(ing => {
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
      showError('Error loading assets: ' + error.message);
    }
  }

  // Show asset selection modal
  function showAssetSelectionModal(groupedAssets) {
    const modalContent = container.querySelector('.factory-modal-content');
    const modalTitle = container.querySelector('.factory-modal-title');

    modalTitle.textContent = `Select Assets for ${currentRecipe.name} (${currentBatchCount}x)`;

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
          <div class="asset-checkbox asset-checkbox-${assetId}" style="padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; border: 2px solid ${isAutoSelected ? 'var(--primary)' : 'transparent'};" data-asset-id="${assetId}" data-template-id="${templateId}">
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
        <button class="factory-confirm-craft-btn btn btn-primary btn-lg">Transfer & Craft</button>
        <button class="factory-cancel-craft-btn btn btn-secondary">Cancel</button>
      </div>
    `;

    modalContent.innerHTML = html;

    // Add checkbox listeners
    modalContent.querySelectorAll('.asset-select').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const assetId = e.target.dataset.assetId;
        const checkboxDiv = container.querySelector(`.asset-checkbox-${assetId}`);

        if (e.target.checked) {
          if (!selectedAssets.includes(assetId)) {
            selectedAssets.push(assetId);
          }
          if (checkboxDiv) checkboxDiv.style.borderColor = 'var(--primary)';
        } else {
          selectedAssets = selectedAssets.filter(id => id !== assetId);
          if (checkboxDiv) checkboxDiv.style.borderColor = 'transparent';
        }
      });
    });

    const confirmBtn = modalContent.querySelector('.factory-confirm-craft-btn');
    const cancelBtn = modalContent.querySelector('.factory-cancel-craft-btn');

    if (confirmBtn) confirmBtn.addEventListener('click', executeCraft);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    assetModal.style.display = 'block';
  }

  // Execute craft
  async function executeCraft() {
    closeModal();

    const craftMode = window.currentCraftMode || 'mint';

    try {
      // PREFLIGHT CHECK: For swap mode, verify pool still has inventory
      if (craftMode === 'swap') {
        showProcessingModal('Preflight Check', 'Verifying pool inventory...<br><small style="color: var(--text-secondary);">Ensuring assets are available</small>');

        const poolCheckResponse = await fetch(`${API_URL}/api/factory/pool-inventory/${currentRecipe.id}?batch_count=${currentBatchCount}`);
        const poolCheckData = await poolCheckResponse.json();

        if (!poolCheckResponse.ok) {
          hideProcessingModal();
          alert(`Pool check failed: ${poolCheckData.error || 'Unknown error'}\n\nPlease try using MINT mode instead.`);
          return;
        }

        if (!poolCheckData.swap_available) {
          hideProcessingModal();
          let errorMsg = '⚠️ Pool inventory is now empty!\n\n';

          if (poolCheckData.availability && poolCheckData.availability.length > 0) {
            errorMsg += 'Missing inventory:\n';
            poolCheckData.availability.forEach(item => {
              if (!item.has_enough) {
                errorMsg += `• ${item.template_name}: need ${item.required}, have ${item.available}\n`;
              }
            });
          }

          errorMsg += '\n✅ Use the MINT button instead to create new assets.';
          alert(errorMsg);
          return;
        }

        console.log('✅ Preflight check passed - pool has required inventory');
      }

      showProcessingModal('Step 1: Transfer Assets', 'Please sign the transaction in your wallet...');

      // Get the correct wallet API (wax or anchor)
      const walletApi = currentWalletType === 'anchor' ? anchor.api : wax.api;

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
      const result = await walletApi.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      const transferTxId = result.transaction_id;

      // Update processing
      showProcessingModal('Step 2: Verifying Transfer', 'Checking blockchain...<br><small style="color: var(--text-secondary);">Waiting for confirmation</small>');

      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for blockchain confirmation

      // Call backend to verify + mint/swap
      const modeLabel = craftMode === 'swap' ? 'Swapping from Pool' : 'Minting Results';
      const modeDesc = craftMode === 'swap' ? 'Transferring assets from pool...' : 'Creating your new assets...';
      showProcessingModal(`Step 3: ${modeLabel}`, `${modeDesc}<br><small style="color: var(--text-secondary);">Using ${transferWallet} wallet</small>`);

      const craftResponse = await fetch(`${API_URL}/api/factory/craft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: currentRecipe.id,
          batch_count: currentBatchCount,
          transfer_transaction_id: transferTxId,
          asset_ids: selectedAssets,
          user_wallet: currentAccount,
          mode: window.currentCraftMode || 'mint'
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
          <button class="btn btn-primary factory-reload-btn">Close & Refresh</button>
        `);

        // Add reload button listener
        const reloadBtn = container.querySelector('.factory-reload-btn');
        if (reloadBtn) {
          reloadBtn.addEventListener('click', () => {
            hideProcessingModal();
            loadRecipes();
          });
        }
      } else {
        throw new Error(craftData.error || 'Craft failed');
      }
    } catch (error) {
      hideProcessingModal();
      showError('Craft failed: ' + error.message);
    }
  }

  // Modal helpers
  function closeModal() {
    assetModal.style.display = 'none';
  }

  function showProcessingModal(title, content) {
    const titleEl = container.querySelector('.factory-processing-title');
    const contentEl = container.querySelector('.factory-processing-content');
    if (titleEl) titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = content;
    processingModal.style.display = 'block';
  }

  function hideProcessingModal() {
    processingModal.style.display = 'none';
  }

  // UI State functions
  function showNotConnectedState() {
    notConnectedSection.style.display = 'block';
    connectedSection.style.display = 'none';
  }

  function showConnectedState() {
    notConnectedSection.style.display = 'none';
    connectedSection.style.display = 'block';
    if (connectedAccountEl) connectedAccountEl.textContent = currentAccount;
    if (walletInfoDiv) walletInfoDiv.style.display = 'block';
  }

  function showError(message, type = 'error') {
    if (!errorSection) return;

    errorSection.textContent = message;
    errorSection.style.display = 'block';
    errorSection.style.color = type === 'success' ? 'var(--success)' : 'var(--error)';
    errorSection.style.background = type === 'success'
      ? 'rgba(16, 185, 129, 0.1)'
      : 'rgba(239, 68, 68, 0.1)';

    setTimeout(() => {
      errorSection.style.display = 'none';
    }, 5000);
  }

  function hideError() {
    if (errorSection) errorSection.style.display = 'none';
  }
};
