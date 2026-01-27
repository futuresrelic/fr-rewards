/**
 * Site Builder - Visual Page Creator for FR Rewards Modules
 * Phase 7: No-code tool for building custom pages with modules
 */

// Available modules configuration
const AVAILABLE_MODULES = [
  {
    id: 'text-block',
    name: 'Text Block',
    icon: '📝',
    description: 'Add paragraphs, headings, and narrative text',
    config: {
      heading: { type: 'text', label: 'Heading', default: '', help: 'Optional heading (leave empty for no heading)' },
      content: { type: 'textarea', label: 'Content', default: 'Enter your text here...', help: 'The main text content (supports HTML)' },
      style: { type: 'select', label: 'Style', default: 'normal', options: ['normal', 'narrative', 'alert', 'quote'], help: 'Visual style for the text block' }
    }
  },
  {
    id: 'image-block',
    name: 'Image Block',
    icon: '🖼️',
    description: 'Add images with optional captions',
    config: {
      image_url: { type: 'text', label: 'Image URL', default: '', help: 'URL to the image file' },
      alt_text: { type: 'text', label: 'Alt Text', default: 'Image', help: 'Alternative text for accessibility' },
      caption: { type: 'text', label: 'Caption', default: '', help: 'Optional caption below the image' },
      width: { type: 'select', label: 'Width', default: 'auto', options: ['auto', '300px', '500px', '100%'], help: 'Image width' },
      alignment: { type: 'select', label: 'Alignment', default: 'center', options: ['left', 'center', 'right'], help: 'Image alignment' }
    }
  },
  {
    id: 'claim-rewards',
    name: 'Claim Rewards',
    icon: '🎁',
    description: 'Let users claim NFT rewards based on owned assets',
    config: {
      collection: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: true, help: 'Automatically connect wallet on load' },
      title: { type: 'text', label: 'Custom Title', default: '', help: 'Override module title (optional)' },
      verification_templates: { type: 'text', label: 'Verification Template IDs', default: '', help: 'Comma-separated template IDs users must own (e.g., 247050,247051,247052)' },
      reward_template_id: { type: 'text', label: 'Reward Template ID', default: '', help: 'Template ID to mint as reward' },
      reward_name: { type: 'text', label: 'Reward Name', default: '', help: 'Display name for the reward' },
      reward_quantity: { type: 'text', label: 'Reward Quantity', default: '1', help: 'Number of NFTs to mint per claim' },
      cooldown_hours: { type: 'text', label: 'Cooldown (hours)', default: '24', help: 'Hours before user can claim again' },
      max_claims: { type: 'text', label: 'Max Claims', default: '', help: 'Maximum total claims allowed (optional)' },
      show_only_reward_id: { type: 'text', label: 'Show Only Reward ID', default: '', help: 'Show only specific reward by ID (optional)' },
      highlight_reward_id: { type: 'text', label: 'Highlight Reward ID', default: '', help: 'Highlight specific reward with border (optional)' }
    }
  },
  {
    id: 'factory-craft',
    name: 'Factory Craft',
    icon: '🏭',
    description: 'Craft new NFTs using existing NFTs as ingredients',
    config: {
      collection: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: true, help: 'Automatically restore session and load recipes' },
      title: { type: 'text', label: 'Custom Title', default: '', help: 'Override module title (optional)' },
      show_category: { type: 'text', label: 'Filter by Category', default: '', help: 'Show only recipes from this category (optional)' },
      show_recipe_id: { type: 'text', label: 'Show Specific Recipe ID', default: '', help: 'Show only this recipe by ID (optional)' },
      recipe_name: { type: 'text', label: 'Recipe Name', default: '', help: 'Display name for the craft recipe' },
      category: { type: 'text', label: 'Category', default: '', help: 'Recipe category (e.g., Weapons, Armor, Tools)' },
      ingredient_templates: { type: 'text', label: 'Ingredient Template IDs', default: '', help: 'Comma-separated template IDs and quantities (e.g., 219904:4,246504:1)' },
      result_templates: { type: 'text', label: 'Result Template IDs', default: '', help: 'Comma-separated template IDs and quantities (e.g., 391378:1)' },
      max_batch_size: { type: 'text', label: 'Max Batch Size', default: '5', help: 'Maximum number of crafts in one transaction' },
      craft_cooldown: { type: 'text', label: 'Craft Cooldown (hours)', default: '0', help: 'Hours before user can craft again' },
      enable_pool_mode: { type: 'checkbox', label: 'Enable Pool/Swap Mode', default: false, help: 'Allow swapping from pool wallet (pre-minted results)' },
      pool_discount: { type: 'text', label: 'Pool Ingredient Discount', default: '1', help: 'Reduce ingredients needed for pool mode (e.g., 3 instead of 4)' },
      pool_wallet: { type: 'text', label: 'Pool Wallet', default: 'pool.fr', help: 'Wallet holding pre-minted results for swap mode' }
    }
  },
  {
    id: 'transfer-mode',
    name: 'Transfer Mode',
    icon: '↔️',
    description: 'Transfer NFTs to other wallets',
    config: {
      collection: { type: 'text', label: 'Default Collection', default: '', help: 'Pre-filter by collection (optional)' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: true }
    }
  },
  {
    id: 'unpack',
    name: 'Unpack Module',
    icon: '📦',
    description: 'Open mystery packs and unpackable NFTs',
    config: {
      collection: { type: 'text', label: 'Default Collection', default: 'futuresrelic', help: 'Pre-filter by collection' },
      template_id: { type: 'text', label: 'Template ID', default: '', help: 'Filter by template ID (e.g. 204194)' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: true }
    }
  },
  {
    id: 'blend-array',
    name: 'Blend Array',
    icon: '🔀',
    description: 'NeftyBlocks blend detector and executor',
    config: {
      collection: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      blend_ids: { type: 'text', label: 'Blend IDs', default: '', help: 'Comma-separated NeftyBlocks blend IDs' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: true }
    }
  },
  {
    id: 'nefty-drop',
    name: 'NeftyBlocks Drop',
    icon: '🎁',
    description: 'Embed NeftyBlocks drops for users to claim',
    config: {
      collection: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      drop_id: { type: 'text', label: 'Drop ID', default: '', help: 'NeftyBlocks drop ID (e.g., 229014)' },
      limit: { type: 'text', label: 'Limit', default: '1', help: 'Number of drops to show' }
    }
  },
  {
    id: 'paid-claim',
    name: 'Paid Claim (NFT Sales)',
    icon: '💰',
    description: 'Sell NFTs directly with WAX token payments',
    config: {
      template_id: { type: 'text', label: 'Template ID', default: '', help: 'NFT template ID to sell (required)' },
      template_name: { type: 'text', label: 'Template Name', default: 'NFT', help: 'Display name for the NFT' },
      template_image: { type: 'text', label: 'Template Image URL', default: '', help: 'Image/video URL for the NFT (optional)' },
      price_wax: { type: 'text', label: 'Price (WAX)', default: '10.00000000', help: 'Price in WAX tokens (8 decimals)' },
      payment_wallet: { type: 'text', label: 'Payment Wallet', default: 'futuresrelic', help: 'Wallet to receive payments' },
      collection_name: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      max_supply: { type: 'text', label: 'Max Supply', default: '', help: 'Maximum supply available (optional)' },
      per_wallet_limit: { type: 'text', label: 'Per Wallet Limit', default: '', help: 'Max purchases per wallet (optional)' },
      wallet_limit_cooldown: { type: 'text', label: 'Wallet Limit Cooldown (hours)', default: '', help: 'Hours before wallet limit resets (e.g., 24 for daily, 168 for weekly). Leave empty for no cooldown.' },
      supply_limit_cooldown: { type: 'text', label: 'Supply Limit Cooldown (hours)', default: '', help: 'Hours before supply limit resets (optional). Leave empty for no cooldown.' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: false, help: 'Automatically connect wallet on load' },
      show_purchase_history: { type: 'checkbox', label: 'Show Purchase History', default: true, help: 'Display user\'s purchase history' }
    }
  },
  {
    id: 'gated-paid-claim',
    name: 'Gated Paid Claim',
    icon: '🔐',
    description: 'Sell NFTs to users who hold specific verification templates',
    config: {
      collection: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: true, help: 'Automatically connect wallet on load' },
      title: { type: 'text', label: 'Custom Title', default: '', help: 'Override module title (optional)' },
      verification_templates: { type: 'text', label: 'Verification Template IDs', default: '', help: 'Comma-separated template IDs users must own to access (e.g., 247052,247053)' },
      payment_wallet: { type: 'text', label: 'Payment Wallet', default: 'futuresrelic', help: 'Wallet to receive WAX payments' },
      rewards: { type: 'custom-rewards-builder', label: 'Rewards', default: '[]', help: 'Configure rewards available for purchase' }
    }
  },
  {
    id: 'unified-module',
    name: '⭐ Unified Module',
    icon: '🎯',
    description: 'All-in-one module with dropdown selector - RECOMMENDED',
    config: {
      module_type: {
        type: 'select',
        label: 'Module Type',
        default: 'paid-claim',
        options: ['paid-claim', 'nefty-drop', 'text-block', 'image-block', 'claim-rewards', 'factory-craft', 'transfer-mode', 'unpack', 'blend-array', 'gated-paid-claim'],
        help: 'Select the type of functionality for this module'
      },

      // === PAID CLAIM CONFIGS ===
      template_id: { type: 'text', label: '[Paid Claim] Template ID', default: '', help: 'NFT template ID to sell' },
      template_name: { type: 'text', label: '[Paid Claim] Template Name', default: 'NFT', help: 'Display name for the NFT' },
      template_image: { type: 'text', label: '[Paid Claim] Image URL', default: '', help: 'Image/video URL for the NFT' },
      price_wax: { type: 'text', label: '[Paid Claim] Price (WAX)', default: '10', help: 'Price in WAX tokens' },
      payment_wallet: { type: 'text', label: '[Paid Claim] Payment Wallet', default: 'futuresrelic', help: 'Wallet to receive payments' },
      collection_name: { type: 'text', label: '[Paid Claim] Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      max_supply: { type: 'text', label: '[Paid Claim] Max Supply', default: '', help: 'Maximum supply available (optional)' },
      per_wallet_limit: { type: 'text', label: '[Paid Claim] Per Wallet Limit', default: '', help: 'Max purchases per wallet (optional)' },
      wallet_limit_cooldown: { type: 'text', label: '[Paid Claim] Wallet Cooldown (hrs)', default: '', help: 'Hours before wallet limit resets' },
      supply_limit_cooldown: { type: 'text', label: '[Paid Claim] Supply Cooldown (hrs)', default: '', help: 'Hours before supply limit resets (optional)' },
      show_purchase_history: { type: 'checkbox', label: '[Paid Claim] Show Purchase History', default: true, help: 'Display user purchase history' },

      // === NEFTYBLOCKS DROP CONFIGS ===
      collection: { type: 'text', label: '[NeftyDrop] Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      drop_id: { type: 'text', label: '[NeftyDrop] Drop ID', default: '', help: 'NeftyBlocks drop ID (e.g., 229014)' },
      limit: { type: 'text', label: '[NeftyDrop] Limit', default: '1', help: 'Number of drops to show' },

      // === TEXT BLOCK CONFIGS ===
      heading: { type: 'text', label: '[TextBlock] Heading', default: '', help: 'Optional heading' },
      content: { type: 'textarea', label: '[TextBlock] Content', default: 'Enter your text here...', help: 'Main text content (supports HTML)' },
      style: { type: 'select', label: '[TextBlock] Style', default: 'normal', options: ['normal', 'narrative', 'alert', 'quote'], help: 'Visual style' },

      // === IMAGE BLOCK CONFIGS ===
      image_url: { type: 'text', label: '[ImageBlock] Image URL', default: '', help: 'URL to the image file' },
      alt_text: { type: 'text', label: '[ImageBlock] Alt Text', default: 'Image', help: 'Alternative text for accessibility' },
      caption: { type: 'text', label: '[ImageBlock] Caption', default: '', help: 'Optional caption below the image' },
      width: { type: 'select', label: '[ImageBlock] Width', default: 'auto', options: ['auto', '300px', '500px', '100%'], help: 'Image width' },
      alignment: { type: 'select', label: '[ImageBlock] Alignment', default: 'center', options: ['left', 'center', 'right'], help: 'Image alignment' },

      // === CLAIM REWARDS CONFIGS ===
      title: { type: 'text', label: '[Claim Rewards] Custom Title', default: '', help: 'Override module title (optional)' },
      verification_templates: { type: 'text', label: '[Claim Rewards] Verification Template IDs', default: '', help: 'Comma-separated template IDs users must own (e.g., 247050,247051,247052)' },
      reward_template_id: { type: 'text', label: '[Claim Rewards] Reward Template ID', default: '', help: 'Template ID to mint as reward' },
      reward_name: { type: 'text', label: '[Claim Rewards] Reward Name', default: '', help: 'Display name for the reward' },
      reward_quantity: { type: 'text', label: '[Claim Rewards] Reward Quantity', default: '1', help: 'Number of NFTs to mint per claim' },
      cooldown_hours: { type: 'text', label: '[Claim Rewards] Cooldown (hours)', default: '24', help: 'Hours before user can claim again' },
      max_claims: { type: 'text', label: '[Claim Rewards] Max Claims', default: '', help: 'Maximum total claims allowed (optional)' },
      show_only_reward_id: { type: 'text', label: '[Claim Rewards] Show Only Reward ID', default: '', help: 'Show only specific reward by ID (optional)' },
      highlight_reward_id: { type: 'text', label: '[Claim Rewards] Highlight Reward ID', default: '', help: 'Highlight specific reward with border (optional)' },

      // === GATED PAID CLAIM CONFIGS ===
      rewards: { type: 'custom-rewards-builder', label: '[Gated Paid Claim] Rewards', default: '[]', help: 'Configure rewards available for purchase' },

      // === FACTORY CRAFT CONFIGS ===
      show_category: { type: 'text', label: '[Factory Craft] Filter by Category', default: '', help: 'Show only recipes from this category (optional)' },
      show_recipe_id: { type: 'text', label: '[Factory Craft] Show Specific Recipe ID', default: '', help: 'Show only this recipe by ID (optional)' },
      recipe_name: { type: 'text', label: '[Factory Craft] Recipe Name', default: '', help: 'Display name for the craft recipe' },
      category: { type: 'text', label: '[Factory Craft] Category', default: '', help: 'Recipe category (e.g., Weapons, Armor, Tools)' },
      ingredient_templates: { type: 'text', label: '[Factory Craft] Ingredient Template IDs', default: '', help: 'Comma-separated template IDs and quantities (e.g., 219904:4,246504:1)' },
      result_templates: { type: 'text', label: '[Factory Craft] Result Template IDs', default: '', help: 'Comma-separated template IDs and quantities (e.g., 391378:1)' },
      max_batch_size: { type: 'text', label: '[Factory Craft] Max Batch Size', default: '5', help: 'Maximum number of crafts in one transaction' },
      craft_cooldown: { type: 'text', label: '[Factory Craft] Craft Cooldown (hours)', default: '0', help: 'Hours before user can craft again' },
      enable_pool_mode: { type: 'checkbox', label: '[Factory Craft] Enable Pool/Swap Mode', default: false, help: 'Allow swapping from pool wallet (pre-minted results)' },
      pool_discount: { type: 'text', label: '[Factory Craft] Pool Ingredient Discount', default: '1', help: 'Reduce ingredients needed for pool mode (e.g., 3 instead of 4)' },
      pool_wallet: { type: 'text', label: '[Factory Craft] Pool Wallet', default: 'pool.fr', help: 'Wallet holding pre-minted results for swap mode' },

      // === BLEND ARRAY CONFIGS ===
      blend_ids: { type: 'text', label: '[Blend Array] Blend IDs', default: '', help: 'Comma-separated NeftyBlocks blend IDs' },

      // === COMMON WALLET CONFIGS (shown for wallet-based modules) ===
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: false, help: 'Automatically connect wallet on load (for wallet-based modules)' }
    }
  }
];

// Page state
let pageModules = []; // Array of {id, moduleType, config}
let selectedModuleIndex = null;
let nextModuleId = 1;
let currentEditingFilepath = null; // Track which page we're editing
let pageCustomCSS = ''; // Custom CSS for the page

// DOM Elements
let moduleGallery, canvasEmpty, canvasModules, configEmpty, configPanel, configTitle, configForm;
let clearBtn, saveBtn, loadBtn, editPageBtn, exportBtn, codeModal, closeCodeModal;
let cssEditorBtn, cssEditorModal, closeCssModal, applyCssBtn, cssEditor;
let createPhaseBtn, manageIndexBtn, indexManagerModal, closeIndexModal, saveIndexBtn, addPhaseCardBtn, phaseCardsList;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  moduleGallery = document.getElementById('moduleGallery');
  canvasEmpty = document.getElementById('canvasEmpty');
  canvasModules = document.getElementById('canvasModules');
  configEmpty = document.getElementById('configEmpty');
  configPanel = document.getElementById('configPanel');
  configTitle = document.getElementById('configTitle');
  configForm = document.getElementById('configForm');
  clearBtn = document.getElementById('clearBtn');
  saveBtn = document.getElementById('saveBtn');
  loadBtn = document.getElementById('loadBtn');
  editPageBtn = document.getElementById('editPageBtn');
  exportBtn = document.getElementById('exportBtn');
  codeModal = document.getElementById('codeModal');
  closeCodeModal = document.getElementById('closeCodeModal');
  cssEditorBtn = document.getElementById('cssEditorBtn');
  cssEditorModal = document.getElementById('cssEditorModal');
  closeCssModal = document.getElementById('closeCssModal');
  applyCssBtn = document.getElementById('applyCssBtn');
  cssEditor = document.getElementById('cssEditor');
  createPhaseBtn = document.getElementById('createPhaseBtn');
  manageIndexBtn = document.getElementById('manageIndexBtn');
  indexManagerModal = document.getElementById('indexManagerModal');
  closeIndexModal = document.getElementById('closeIndexModal');
  saveIndexBtn = document.getElementById('saveIndexBtn');
  addPhaseCardBtn = document.getElementById('addPhaseCardBtn');
  phaseCardsList = document.getElementById('phaseCardsList');

  // Populate module gallery
  renderModuleGallery();

  // Setup event listeners
  clearBtn.addEventListener('click', clearAll);
  saveBtn.addEventListener('click', saveToCurrentPage);
  loadBtn.addEventListener('click', loadConfiguration);
  editPageBtn.addEventListener('click', editExistingPage);
  exportBtn.addEventListener('click', exportCode);
  closeCodeModal.addEventListener('click', () => codeModal.style.display = 'none');
  cssEditorBtn.addEventListener('click', openCssEditor);
  closeCssModal.addEventListener('click', () => cssEditorModal.style.display = 'none');
  applyCssBtn.addEventListener('click', applyCss);
  createPhaseBtn.addEventListener('click', createNewPhase);
  manageIndexBtn.addEventListener('click', openIndexManager);
  closeIndexModal.addEventListener('click', () => indexManagerModal.style.display = 'none');
  saveIndexBtn.addEventListener('click', saveStoryIndex);
  addPhaseCardBtn.addEventListener('click', addNewPhaseCard);

  // Copy button handlers
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-copy');
      const target = document.getElementById(targetId);
      navigator.clipboard.writeText(target.textContent);
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    });
  });

  // Try to load saved config from localStorage
  tryLoadSavedConfig();
});

// Render module gallery
function renderModuleGallery() {
  moduleGallery.innerHTML = '';

  AVAILABLE_MODULES.forEach(module => {
    const card = document.createElement('div');
    card.className = 'module-card';
    card.innerHTML = `
      <div class="module-card-icon">${module.icon}</div>
      <div class="module-card-name">${module.name}</div>
      <div class="module-card-desc">${module.description}</div>
    `;
    card.addEventListener('click', () => addModule(module.id));
    moduleGallery.appendChild(card);
  });
}

// Add module to canvas
async function addModule(moduleType) {
  const moduleInfo = AVAILABLE_MODULES.find(m => m.id === moduleType);
  if (!moduleInfo) return;

  // Create default config
  const config = {};
  Object.keys(moduleInfo.config).forEach(key => {
    const field = moduleInfo.config[key];
    config[key] = field.default;
  });

  // Determine if this module type should use database-backed config
  const useDatabase = !['text-block', 'image-block'].includes(moduleType);

  const moduleId = nextModuleId++;
  let moduleInstanceId = null;

  // Create database instance for eligible modules
  if (useDatabase) {
    try {
      const response = await fetch('/api/modules/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module_type: moduleType,
          name: `${moduleInfo.name} - ${new Date().toLocaleString()}`,
          description: `Created via Site Builder`,
          config: config
        })
      });

      if (response.ok) {
        const data = await response.json();
        moduleInstanceId = data.module.id;
        console.log(`✅ Created database-backed module instance: ${moduleInstanceId}`);
      } else {
        console.warn(`⚠️ Failed to create database module instance, falling back to inline config`);
      }
    } catch (error) {
      console.warn(`⚠️ Error creating database module instance:`, error);
    }
  }

  // Add to page modules
  pageModules.push({
    id: moduleId,
    moduleType: moduleType,
    config: config,
    moduleInstanceId: moduleInstanceId
  });

  renderCanvas();
  selectModule(pageModules.length - 1);

  // Auto-save if editing a page
  if (currentEditingFilepath) {
    await autoSave();
  }
}

// Render canvas
function renderCanvas() {
  if (pageModules.length === 0) {
    canvasEmpty.style.display = 'block';
    canvasModules.style.display = 'none';
    return;
  }

  canvasEmpty.style.display = 'none';
  canvasModules.style.display = 'block';
  canvasModules.innerHTML = '';

  pageModules.forEach((module, index) => {
    const moduleInfo = AVAILABLE_MODULES.find(m => m.id === module.moduleType);

    const moduleEl = document.createElement('div');
    moduleEl.className = 'canvas-module';
    if (selectedModuleIndex === index) {
      moduleEl.classList.add('selected');
    }

    moduleEl.innerHTML = `
      <div class="canvas-module-header">
        <div class="canvas-module-title">
          <span>${moduleInfo.icon}</span>
          <span>${moduleInfo.name}</span>
        </div>
        <div class="canvas-module-actions">
          ${index > 0 ? '<button class="btn btn-secondary btn-sm" data-action="up">↑</button>' : ''}
          ${index < pageModules.length - 1 ? '<button class="btn btn-secondary btn-sm" data-action="down">↓</button>' : ''}
          <button class="btn btn-secondary btn-sm" data-action="config">⚙️</button>
          <button class="btn btn-error btn-sm" data-action="remove">🗑️</button>
        </div>
      </div>
      <div class="canvas-module-preview" id="preview-${module.id}"></div>
    `;

    // Event listeners for actions
    moduleEl.querySelector('[data-action="config"]')?.addEventListener('click', () => selectModule(index));
    moduleEl.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeModule(index));
    moduleEl.querySelector('[data-action="up"]')?.addEventListener('click', () => moveModule(index, -1));
    moduleEl.querySelector('[data-action="down"]')?.addEventListener('click', () => moveModule(index, 1));

    moduleEl.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        selectModule(index);
      }
    });

    canvasModules.appendChild(moduleEl);

    // Load module preview
    loadModulePreview(module);
  });
}

// Load module preview
async function loadModulePreview(module) {
  const previewEl = document.getElementById(`preview-${module.id}`);
  if (!previewEl) return;

  try {
    // Handle text-block preview
    if (module.moduleType === 'text-block') {
      const styles = {
        normal: 'padding: 20px; line-height: 1.6;',
        narrative: 'background: var(--bg-secondary); border-left: 4px solid var(--primary); padding: 20px; border-radius: 8px; line-height: 1.8;',
        alert: 'background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; color: #92400e;',
        quote: 'border-left: 4px solid var(--border); padding: 20px; font-style: italic; color: var(--text-secondary);'
      };
      const style = styles[module.config.style] || styles.normal;

      previewEl.innerHTML = `
        <div style="${style}">
          ${module.config.heading ? `<h2 style="margin-top: 0; color: var(--primary);">${module.config.heading}</h2>` : ''}
          <div>${module.config.content}</div>
        </div>
      `;
      return;
    }

    // Handle image-block preview
    if (module.moduleType === 'image-block') {
      const textAlign = module.config.alignment || 'center';
      previewEl.innerHTML = `
        <div style="text-align: ${textAlign}; padding: 20px;">
          ${module.config.image_url ?
            `<img src="${module.config.image_url}" alt="${module.config.alt_text}" style="max-width: ${module.config.width}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">` :
            `<div style="padding: 60px; background: #f3f4f6; border-radius: 8px; color: #9ca3af;">No image URL provided</div>`
          }
          ${module.config.caption ? `<p style="margin-top: 10px; font-size: 0.9rem; color: var(--text-secondary);">${module.config.caption}</p>` : ''}
        </div>
      `;
      return;
    }

    // For all other modules, use the module loader
    const configJson = JSON.stringify(module.config);
    previewEl.setAttribute('data-module', module.moduleType);
    previewEl.setAttribute('data-config', configJson);

    // Initialize module
    if (typeof window.loadModule === 'function') {
      await window.loadModule(previewEl);
    }
  } catch (error) {
    console.error('Failed to load module preview:', error);
    previewEl.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">Preview unavailable</p>`;
  }
}

// Select module
function selectModule(index) {
  selectedModuleIndex = index;
  renderCanvas();
  renderConfigPanel();
}

// Render configuration panel
function renderConfigPanel() {
  if (selectedModuleIndex === null || !pageModules[selectedModuleIndex]) {
    configEmpty.style.display = 'block';
    configPanel.style.display = 'none';
    return;
  }

  configEmpty.style.display = 'none';
  configPanel.style.display = 'block';

  const module = pageModules[selectedModuleIndex];
  const moduleInfo = AVAILABLE_MODULES.find(m => m.id === module.moduleType);

  configTitle.textContent = `${moduleInfo.icon} ${moduleInfo.name} Configuration`;
  configForm.innerHTML = '';

  // Check if this is the unified module
  const isUnifiedModule = module.moduleType === 'unified-module';

  // Render config fields
  Object.keys(moduleInfo.config).forEach(key => {
    const field = moduleInfo.config[key];
    const section = document.createElement('div');
    section.className = 'config-section';

    // For unified module, add data attribute for field type filtering
    if (isUnifiedModule) {
      // Extract module type from label (e.g., "[Paid Claim]" -> "paid-claim")
      const match = field.label.match(/^\[(.*?)\]/);
      if (match) {
        const fieldModuleType = match[1].toLowerCase().replace(/\s+/g, '-');
        section.setAttribute('data-unified-field-type', fieldModuleType);
      } else if (key === 'module_type') {
        section.setAttribute('data-unified-field-type', 'always-show');
      } else {
        // Common fields (auto_connect, show_purchase_history)
        section.setAttribute('data-unified-field-type', 'common');
      }
    }

    if (field.type === 'checkbox') {
      section.innerHTML = `
        <label>
          <input type="checkbox" class="config-checkbox" data-key="${key}" ${module.config[key] ? 'checked' : ''}>
          <span class="config-label" style="display: inline;">${field.label}</span>
        </label>
        ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
      `;
    } else if (field.type === 'custom-rewards-builder') {
      // Custom rewards builder for gated-paid-claim
      section.innerHTML = `
        <label class="config-label">${field.label}:</label>
        <div id="rewards-builder-container"></div>
        <button type="button" class="btn btn-success" id="add-reward-btn" style="margin-top: 10px; width: 100%;">+ Add Reward</button>
        ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
      `;
    } else if (field.type === 'textarea') {
      section.innerHTML = `
        <label class="config-label">${field.label}:</label>
        <textarea class="config-textarea" data-key="${key}">${module.config[key] || ''}</textarea>
        ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
      `;
    } else if (field.type === 'select') {
      const options = field.options.map(opt =>
        `<option value="${opt}" ${module.config[key] === opt ? 'selected' : ''}>${opt}</option>`
      ).join('');
      section.innerHTML = `
        <label class="config-label">${field.label}:</label>
        <select class="config-input" data-key="${key}">
          ${options}
        </select>
        ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
      `;
    } else {
      // Special handling for template_id in paid-claim module - add fetch button
      if (module.moduleType === 'paid-claim' && key === 'template_id') {
        section.innerHTML = `
          <label class="config-label">${field.label}:</label>
          <div style="display: flex; gap: 8px;">
            <input type="${field.type}" class="config-input" data-key="${key}" value="${module.config[key] || ''}" placeholder="${field.default}" style="flex: 1;">
            <button type="button" class="btn btn-secondary" id="fetch-template-btn" style="padding: 8px 16px; white-space: nowrap;">📥 Fetch Data</button>
          </div>
          ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
        `;
      } else {
        section.innerHTML = `
          <label class="config-label">${field.label}:</label>
          <input type="${field.type}" class="config-input" data-key="${key}" value="${module.config[key] || ''}" placeholder="${field.default}">
          ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
        `;
      }
    }

    configForm.appendChild(section);
  });

  // Add event listener for fetch template button (paid-claim module)
  if (module.moduleType === 'paid-claim') {
    const fetchBtn = configForm.querySelector('#fetch-template-btn');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', () => fetchTemplateData(module));
    }
  }

  // Setup rewards builder for gated-paid-claim module OR unified module (which includes gated-paid-claim)
  if (module.moduleType === 'gated-paid-claim' || isUnifiedModule) {
    // Check if rewards-builder-container exists (might be hidden initially for unified module)
    const rewardsContainer = document.getElementById('rewards-builder-container');
    if (rewardsContainer) {
      setupRewardsBuilder(module);
    }
  }

  // Setup unified module field filtering
  if (isUnifiedModule) {
    setupUnifiedModuleFieldFiltering(module);
  }

  // Add apply button
  const applyBtn = document.createElement('button');
  applyBtn.className = 'btn btn-primary';
  applyBtn.style.width = '100%';
  applyBtn.style.marginTop = '20px';
  applyBtn.textContent = '✓ Apply Changes';
  applyBtn.addEventListener('click', applyConfig);
  configForm.appendChild(applyBtn);
}

// Setup unified module field filtering
function setupUnifiedModuleFieldFiltering(module) {
  const moduleTypeDropdown = configForm.querySelector('[data-key="module_type"]');
  if (!moduleTypeDropdown) return;

  // Function to filter fields based on selected module type
  function filterFields() {
    const selectedType = moduleTypeDropdown.value;
    console.log(`🎯 Unified Module: Filtering fields for type "${selectedType}"`);

    // Get all config sections
    const sections = configForm.querySelectorAll('.config-section');

    sections.forEach(section => {
      const fieldType = section.getAttribute('data-unified-field-type');

      if (!fieldType) {
        // No attribute = regular module, always show
        section.style.display = '';
        return;
      }

      if (fieldType === 'always-show') {
        // Always show (module_type dropdown itself)
        section.style.display = '';
        return;
      }

      if (fieldType === 'common') {
        // Common fields - show for wallet-based modules
        const walletModules = ['paid-claim', 'gated-paid-claim', 'claim-rewards', 'factory-craft', 'transfer-mode', 'unpack', 'blend-array'];
        section.style.display = walletModules.includes(selectedType) ? '' : 'none';
        return;
      }

      // Field belongs to specific module type
      // Map friendly names to module types
      const typeMap = {
        'paid-claim': 'paid-claim',
        'neftydrop': 'nefty-drop',
        'textblock': 'text-block',
        'imageblock': 'image-block',
        'claim-rewards': 'claim-rewards',
        'gated-paid-claim': 'gated-paid-claim',
        'factory-craft': 'factory-craft',
        'transfer-mode': 'transfer-mode',
        'unpack': 'unpack',
        'blend-array': 'blend-array'
      };

      const mappedType = typeMap[fieldType] || fieldType;

      // Show if field type matches selected type
      // Also show shared fields for modules that use them
      const sharedFields = {
        'collection': ['nefty-drop', 'claim-rewards', 'gated-paid-claim', 'factory-craft', 'transfer-mode', 'unpack', 'blend-array'],
        'title': ['claim-rewards', 'gated-paid-claim', 'factory-craft'],
        'verification_templates': ['claim-rewards', 'gated-paid-claim'],
        'payment_wallet': ['paid-claim', 'gated-paid-claim'],
        'template_id': ['paid-claim', 'unpack']
      };

      const input = section.querySelector('input, select, textarea');
      const fieldKey = input ? input.getAttribute('data-key') : null;

      if (fieldKey && sharedFields[fieldKey]) {
        section.style.display = sharedFields[fieldKey].includes(selectedType) ? '' : 'none';
      } else {
        section.style.display = mappedType === selectedType ? '' : 'none';
      }
    });

    // After filtering, if gated-paid-claim is selected, ensure rewards builder is initialized
    if (selectedType === 'gated-paid-claim') {
      const rewardsContainer = document.getElementById('rewards-builder-container');
      const addBtn = document.getElementById('add-reward-btn');

      // Only initialize if container exists and hasn't been initialized yet
      if (rewardsContainer && addBtn && !addBtn.dataset.initialized) {
        setupRewardsBuilder(module);
        addBtn.dataset.initialized = 'true';
      }
    }
  }

  // Run filter immediately
  filterFields();

  // Add event listener for dropdown changes
  moduleTypeDropdown.addEventListener('change', filterFields);
}

// Fetch template data from AtomicAssets API (for paid-claim module)
async function fetchTemplateData(module) {
  const templateIdInput = configForm.querySelector('[data-key="template_id"]');
  const templateNameInput = configForm.querySelector('[data-key="template_name"]');
  const templateImageInput = configForm.querySelector('[data-key="template_image"]');
  const collectionNameInput = configForm.querySelector('[data-key="collection_name"]');
  const fetchBtn = configForm.querySelector('#fetch-template-btn');

  const templateId = templateIdInput.value.trim();
  const collectionName = collectionNameInput ? collectionNameInput.value.trim() : 'futuresrelic';

  if (!templateId) {
    alert('Please enter a Template ID first');
    return;
  }

  // Show loading state
  const originalBtnText = fetchBtn.textContent;
  fetchBtn.disabled = true;
  fetchBtn.textContent = '⏳ Fetching...';

  try {
    // AtomicAssets API endpoints to try
    const endpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax.api.atomicassets.io'
    ];

    let templateData = null;

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}/atomicassets/v1/templates/${collectionName}/${templateId}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            templateData = data.data;
            break;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch from ${endpoint}:`, err);
        continue;
      }
    }

    if (!templateData) {
      throw new Error('Could not fetch template data from AtomicAssets API');
    }

    // Extract template info
    const name = templateData.immutable_data?.name || templateData.name || `Template ${templateId}`;
    let imageUrl = '';

    // Try to get image/video from immutable_data
    if (templateData.immutable_data) {
      const img = templateData.immutable_data.img || templateData.immutable_data.image || templateData.immutable_data.video;
      if (img) {
        // Convert IPFS hash to gateway URL
        imageUrl = img.startsWith('Qm') ? `https://ipfs.io/ipfs/${img}` : img;
      }
    }

    // Update fields with fetched data
    if (templateNameInput && name) {
      templateNameInput.value = name;
    }

    if (templateImageInput && imageUrl) {
      templateImageInput.value = imageUrl;
    }

    // Show success feedback
    fetchBtn.textContent = '✅ Fetched!';
    fetchBtn.style.background = '#10b981';

    // Reset button after delay
    setTimeout(() => {
      fetchBtn.textContent = originalBtnText;
      fetchBtn.style.background = '';
      fetchBtn.disabled = false;
    }, 2000);

  } catch (error) {
    console.error('Error fetching template data:', error);
    alert(`Failed to fetch template data: ${error.message}`);

    fetchBtn.textContent = originalBtnText;
    fetchBtn.disabled = false;
  }
}

// Apply configuration changes
// Setup rewards builder for gated-paid-claim module
function setupRewardsBuilder(module) {
  const container = document.getElementById('rewards-builder-container');
  const addBtn = document.getElementById('add-reward-btn');

  // Parse existing rewards
  let rewards = [];
  try {
    if (typeof module.config.rewards === 'string') {
      rewards = JSON.parse(module.config.rewards || '[]');
    } else if (Array.isArray(module.config.rewards)) {
      rewards = module.config.rewards;
    }
  } catch (e) {
    rewards = [];
  }

  // Render existing rewards
  function renderRewards() {
    container.innerHTML = '';

    if (rewards.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); background: var(--bg-dark); border-radius: 8px; border: 1px dashed var(--border);">No rewards configured yet. Click "Add Reward" to get started.</div>';
      return;
    }

    rewards.forEach((reward, index) => {
      const rewardCard = document.createElement('div');
      rewardCard.className = 'reward-builder-card';
      rewardCard.style.cssText = 'background: var(--bg-dark); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 15px;';

      rewardCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="margin: 0; color: var(--text-primary);">Reward #${index + 1}</h4>
          <button type="button" class="btn btn-sm btn-danger remove-reward-btn" data-index="${index}">🗑️ Remove</button>
        </div>

        <div style="display: grid; gap: 12px;">
          <div>
            <label style="display: block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Template ID:</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" class="config-input reward-field" data-index="${index}" data-field="template_id" value="${reward.template_id || ''}" placeholder="e.g., 123456" style="flex: 1;">
              <button type="button" class="btn btn-secondary btn-sm fetch-reward-data-btn" data-index="${index}" style="white-space: nowrap;">📥 Fetch</button>
            </div>
          </div>

          <div>
            <label style="display: block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Template Name:</label>
            <input type="text" class="config-input reward-field" data-index="${index}" data-field="template_name" value="${reward.template_name || ''}" placeholder="e.g., Premium Pack">
          </div>

          <div>
            <label style="display: block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Template Image URL:</label>
            <input type="text" class="config-input reward-field" data-index="${index}" data-field="template_image" value="${reward.template_image || ''}" placeholder="https://ipfs.io/ipfs/...">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Price (WAX):</label>
              <input type="text" class="config-input reward-field" data-index="${index}" data-field="price_wax" value="${reward.price_wax || '10.00000000'}" placeholder="10.00000000">
            </div>
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Cooldown (hours):</label>
              <input type="text" class="config-input reward-field" data-index="${index}" data-field="cooldown_hours" value="${reward.cooldown_hours || ''}" placeholder="24 (optional)">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Per Wallet Limit:</label>
              <input type="text" class="config-input reward-field" data-index="${index}" data-field="per_wallet_limit" value="${reward.per_wallet_limit || ''}" placeholder="5 (optional)">
            </div>
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Max Supply:</label>
              <input type="text" class="config-input reward-field" data-index="${index}" data-field="max_supply" value="${reward.max_supply || ''}" placeholder="1000 (optional)">
            </div>
          </div>
        </div>
      `;

      container.appendChild(rewardCard);
    });

    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-reward-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        rewards.splice(index, 1);
        renderRewards();
      });
    });

    // Add event listeners for fetch buttons
    container.querySelectorAll('.fetch-reward-data-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        fetchRewardTemplateData(index, module);
      });
    });

    // Add event listeners for input fields to update rewards array
    container.querySelectorAll('.reward-field').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        rewards[index][field] = e.target.value;
      });
    });
  }

  // Add reward button
  addBtn.addEventListener('click', () => {
    rewards.push({
      template_id: '',
      template_name: '',
      template_image: '',
      price_wax: '10.00000000',
      cooldown_hours: '',
      per_wallet_limit: '',
      max_supply: ''
    });
    renderRewards();
  });

  // Initial render
  renderRewards();

  // Store rewards getter function for applyConfig to use
  module._getRewards = () => rewards;
}

// Fetch template data for a specific reward in rewards builder
async function fetchRewardTemplateData(index, module) {
  const container = document.getElementById('rewards-builder-container');
  const fetchBtn = container.querySelector(`.fetch-reward-data-btn[data-index="${index}"]`);
  const templateIdInput = container.querySelector(`.reward-field[data-index="${index}"][data-field="template_id"]`);
  const templateNameInput = container.querySelector(`.reward-field[data-index="${index}"][data-field="template_name"]`);
  const templateImageInput = container.querySelector(`.reward-field[data-index="${index}"][data-field="template_image"]`);

  const templateId = templateIdInput.value.trim();
  const collectionName = module.config.collection || 'futuresrelic';

  if (!templateId) {
    alert('Please enter a Template ID first');
    return;
  }

  // Show loading state
  const originalBtnText = fetchBtn.textContent;
  fetchBtn.disabled = true;
  fetchBtn.textContent = '⏳';

  try {
    // AtomicAssets API endpoints to try
    const endpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax.api.atomicassets.io'
    ];

    let templateData = null;

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}/atomicassets/v1/templates/${collectionName}/${templateId}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            templateData = data.data;
            break;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch from ${endpoint}:`, err);
        continue;
      }
    }

    if (!templateData) {
      throw new Error('Could not fetch template data from AtomicAssets API');
    }

    // Extract template info
    const name = templateData.immutable_data?.name || templateData.name || `Template ${templateId}`;
    let imageUrl = '';

    // Try to get image/video from immutable_data
    if (templateData.immutable_data) {
      const img = templateData.immutable_data.img || templateData.immutable_data.image || templateData.immutable_data.video;
      if (img) {
        // Convert IPFS hash to gateway URL
        imageUrl = img.startsWith('Qm') ? `https://ipfs.io/ipfs/${img}` : img;
      }
    }

    // Update the input fields
    templateNameInput.value = name;
    templateImageInput.value = imageUrl;

    // Trigger input event to update the rewards array
    templateNameInput.dispatchEvent(new Event('input'));
    templateImageInput.dispatchEvent(new Event('input'));

    fetchBtn.textContent = '✅';
    setTimeout(() => {
      fetchBtn.textContent = originalBtnText;
      fetchBtn.disabled = false;
    }, 1500);

  } catch (error) {
    console.error('Error fetching template data:', error);
    alert('Failed to fetch template data: ' + error.message);
    fetchBtn.textContent = originalBtnText;
    fetchBtn.disabled = false;
  }
}

async function applyConfig() {
  if (selectedModuleIndex === null) return;

  const module = pageModules[selectedModuleIndex];
  const inputs = configForm.querySelectorAll('[data-key]');

  inputs.forEach(input => {
    const key = input.getAttribute('data-key');
    if (input.type === 'checkbox') {
      module.config[key] = input.checked;
    } else {
      module.config[key] = input.value;
    }
  });

  // Special handling for gated-paid-claim rewards
  if (module.moduleType === 'gated-paid-claim' && module._getRewards) {
    const rewards = module._getRewards();
    module.config.rewards = JSON.stringify(rewards);
  }

  // Update database instance if this module has one
  if (module.moduleInstanceId) {
    try {
      const response = await fetch(`/api/modules/${module.moduleInstanceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          config: module.config
        })
      });

      if (response.ok) {
        console.log(`✅ Updated database module instance: ${module.moduleInstanceId}`);
      } else {
        console.warn(`⚠️ Failed to update database module instance`);
      }
    } catch (error) {
      console.warn(`⚠️ Error updating database module instance:`, error);
    }
  }

  renderCanvas();

  // Show feedback
  const btn = configForm.querySelector('.btn-primary');
  const originalText = btn.textContent;
  btn.textContent = '✓ Applied!';
  btn.style.background = '#10b981';

  // Auto-save if we're editing a page
  if (currentEditingFilepath) {
    try {
      btn.textContent = '💾 Auto-saving...';
      await saveToCurrentPage();
      btn.textContent = '✓ Saved!';
    } catch (error) {
      btn.textContent = '❌ Save failed';
      console.error('Auto-save error:', error);
    }
  }

  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
  }, 1500);
}

// Remove module
async function removeModule(index) {
  if (confirm('Remove this module?')) {
    const module = pageModules[index];

    // Delete database instance if this module has one
    if (module.moduleInstanceId) {
      try {
        const response = await fetch(`/api/modules/${module.moduleInstanceId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          console.log(`✅ Deleted database module instance: ${module.moduleInstanceId}`);
        } else {
          console.warn(`⚠️ Failed to delete database module instance`);
        }
      } catch (error) {
        console.warn(`⚠️ Error deleting database module instance:`, error);
      }
    }

    pageModules.splice(index, 1);
    if (selectedModuleIndex === index) {
      selectedModuleIndex = null;
    } else if (selectedModuleIndex > index) {
      selectedModuleIndex--;
    }
    renderCanvas();
    renderConfigPanel();

    // Auto-save if editing a page
    if (currentEditingFilepath) {
      await autoSave();
    }
  }
}

// Move module
async function moveModule(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= pageModules.length) return;

  // Swap
  [pageModules[index], pageModules[newIndex]] = [pageModules[newIndex], pageModules[index]];

  // Update selection
  if (selectedModuleIndex === index) {
    selectedModuleIndex = newIndex;
  } else if (selectedModuleIndex === newIndex) {
    selectedModuleIndex = index;
  }

  renderCanvas();

  // Auto-save if editing a page
  if (currentEditingFilepath) {
    await autoSave();
  }
}

// Auto-save helper
async function autoSave() {
  if (!currentEditingFilepath) return;

  try {
    const response = await fetch('/api/page/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filepath: currentEditingFilepath,
        modules: pageModules,
        customCSS: pageCustomCSS
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.error('Auto-save failed:', data.error);
    } else {
      console.log('✓ Auto-saved to', currentEditingFilepath);
    }
  } catch (error) {
    console.error('Auto-save error:', error);
  }
}

// Clear all modules
function clearAll() {
  if (pageModules.length === 0) return;

  if (confirm('Clear all modules? This cannot be undone.')) {
    pageModules = [];
    selectedModuleIndex = null;
    currentEditingFilepath = null;
    saveBtn.textContent = '💾 Save Config';
    saveBtn.classList.remove('btn-success');
    saveBtn.classList.add('btn-secondary');
    renderCanvas();
    renderConfigPanel();
  }
}

// Save configuration
function saveConfiguration() {
  const configData = {
    version: '1.0',
    modules: pageModules,
    timestamp: new Date().toISOString()
  };

  localStorage.setItem('fr_site_builder_config', JSON.stringify(configData));

  // Download as JSON file
  const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fr-page-config-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  alert('✓ Configuration saved!\n\nSaved to browser storage and downloaded as file.');
}

// Load configuration
function loadConfiguration() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const configData = JSON.parse(text);

      if (!configData.modules || !Array.isArray(configData.modules)) {
        throw new Error('Invalid configuration file');
      }

      pageModules = configData.modules;
      selectedModuleIndex = null;
      nextModuleId = Math.max(...pageModules.map(m => m.id), 0) + 1;

      renderCanvas();
      renderConfigPanel();

      alert('✓ Configuration loaded successfully!');
    } catch (error) {
      alert('❌ Failed to load configuration:\n' + error.message);
    }
  });

  input.click();
}

// Edit Existing Page - Load HTML page for editing
async function editExistingPage() {
  const filepath = prompt('Enter the path to the page you want to edit:\n\nExamples:\n• story/phase2.html\n• rewards-hub.html\n• index.html', 'story/phase2.html');

  if (!filepath) return;

  try {
    const response = await fetch(`/api/page/load/${filepath}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load page');
    }

    // Load the modules into the canvas
    pageModules = data.modules;
    selectedModuleIndex = null;
    nextModuleId = Math.max(...pageModules.map(m => m.id), 0) + 1;
    currentEditingFilepath = data.filepath;

    // Load custom CSS if present
    if (data.customCSS) {
      pageCustomCSS = data.customCSS;
      // Apply CSS to preview
      let styleEl = document.getElementById('custom-page-css');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'custom-page-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = pageCustomCSS;
    }

    renderCanvas();
    renderConfigPanel();

    // Update save button text to show we're editing
    saveBtn.textContent = `💾 Save to ${filepath}`;
    saveBtn.classList.remove('btn-secondary');
    saveBtn.classList.add('btn-success');

    alert(`✓ Loaded ${filepath} for editing!\n\n${pageModules.length} module(s) found.`);
  } catch (error) {
    alert(`❌ Failed to load page:\n${error.message}\n\nMake sure the file path is correct.`);
    console.error('Load page error:', error);
  }
}

// Save to Current Page
async function saveToCurrentPage() {
  // If we're editing an existing page, save directly to it
  if (currentEditingFilepath) {
    try {
      const response = await fetch('/api/page/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: currentEditingFilepath,
          modules: pageModules,
          customCSS: pageCustomCSS
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save page');
      }

      alert(`✓ Saved changes to ${currentEditingFilepath}!`);
    } catch (error) {
      alert(`❌ Failed to save page:\n${error.message}`);
      console.error('Save page error:', error);
    }
  } else {
    // Otherwise, just save to localStorage like before
    saveConfiguration();
  }
}

// Try to load saved config from localStorage
function tryLoadSavedConfig() {
  try {
    const saved = localStorage.getItem('fr_site_builder_config');
    if (!saved) return;

    const configData = JSON.parse(saved);
    if (configData.modules && Array.isArray(configData.modules)) {
      // Ask user if they want to restore
      if (confirm('Found saved configuration. Load it?')) {
        pageModules = configData.modules;
        nextModuleId = Math.max(...pageModules.map(m => m.id), 0) + 1;
        renderCanvas();
      }
    }
  } catch (error) {
    console.error('Failed to load saved config:', error);
  }
}

// Export code
function exportCode() {
  if (pageModules.length === 0) {
    alert('Add some modules first!');
    return;
  }

  // Generate HTML for modules
  let html = '';
  pageModules.forEach(module => {
    const moduleInfo = AVAILABLE_MODULES.find(m => m.id === module.moduleType);

    // Handle text-block
    if (module.moduleType === 'text-block') {
      const styles = {
        normal: 'padding: 20px; line-height: 1.6;',
        narrative: 'background: var(--bg-secondary); border-left: 4px solid var(--primary); padding: 2rem; border-radius: 8px; line-height: 1.8; font-size: 1.05rem;',
        alert: 'background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; color: #92400e;',
        quote: 'border-left: 4px solid var(--border); padding: 20px; font-style: italic; color: var(--text-secondary); margin: 20px 0;'
      };
      const style = styles[module.config.style] || styles.normal;
      const className = module.config.style === 'narrative' ? ' class="narrative"' : '';

      html += `<!-- ${moduleInfo.name} -->\n`;
      html += `<div${className} style="${style}">\n`;
      if (module.config.heading) {
        html += `  <h2 style="margin-top: 0; color: var(--primary);">${module.config.heading}</h2>\n`;
      }
      html += `  ${module.config.content}\n`;
      html += `</div>\n\n`;
      return;
    }

    // Handle image-block
    if (module.moduleType === 'image-block') {
      const textAlign = module.config.alignment || 'center';
      html += `<!-- ${moduleInfo.name} -->\n`;
      html += `<div style="text-align: ${textAlign}; padding: 20px;">\n`;
      if (module.config.image_url) {
        html += `  <img src="${module.config.image_url}" alt="${module.config.alt_text}" style="max-width: ${module.config.width}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">\n`;
      }
      if (module.config.caption) {
        html += `  <p style="margin-top: 10px; font-size: 0.9rem; color: var(--text-secondary);">${module.config.caption}</p>\n`;
      }
      html += `</div>\n\n`;
      return;
    }

    // For all other modules, use data-module attributes
    html += `<!-- ${moduleInfo.name} -->\n`;
    html += `<div\n`;
    html += `  id="module-${module.id}"\n`;
    html += `  data-module="${module.moduleType}"\n`;

    // Use database ID if available, otherwise inline config
    if (module.moduleInstanceId) {
      html += `  data-module-id="${module.moduleInstanceId}"\n`;
    } else {
      const configJson = JSON.stringify(module.config).replace(/"/g, '&quot;');
      html += `  data-config="${configJson}"\n`;
    }

    html += `></div>\n\n`;
  });

  // Generate required scripts
  const scripts = `<!-- Required: CSS -->
<link rel="stylesheet" href="https://claim.futuresrelic.com/styles.css">

<!-- Required: Module Loader -->
<script src="https://claim.futuresrelic.com/modules/module-loader.js"></script>

<!-- Optional: Wallet Libraries (if using auto_connect or wallet features) -->
<script src="https://cdn.jsdelivr.net/npm/waxjs@1.0.0/dist-web/waxjs.js"></script>
<script src="https://cdn.jsdelivr.net/npm/anchor-link@3.4.4/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/anchor-link-browser-transport@3.4.4/dist/index.min.js"></script>

<!-- NeftyBlocks Web Components (for drop module) -->
<script src="https://cdn.jsdelivr.net/npm/@neftyblocks/drops@latest" type="module"></script>`;

  // Show in modal
  document.getElementById('htmlCode').textContent = html;
  document.getElementById('scriptsCode').textContent = scripts;
  codeModal.style.display = 'block';
}

// Open CSS Editor
function openCssEditor() {
  cssEditor.value = pageCustomCSS;
  cssEditorModal.style.display = 'block';
}

// Apply CSS
async function applyCss() {
  pageCustomCSS = cssEditor.value;

  // Apply CSS to preview
  let styleEl = document.getElementById('custom-page-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-page-css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = pageCustomCSS;

  // Show feedback
  const originalText = applyCssBtn.textContent;
  applyCssBtn.textContent = '✓ Applied!';
  applyCssBtn.style.background = '#10b981';

  // Auto-save if editing a page
  if (currentEditingFilepath) {
    try {
      applyCssBtn.textContent = '💾 Auto-saving...';
      await saveToCurrentPage();
      applyCssBtn.textContent = '✓ Saved!';
    } catch (error) {
      applyCssBtn.textContent = '❌ Save failed';
      console.error('CSS auto-save error:', error);
    }
  }

  setTimeout(() => {
    applyCssBtn.textContent = originalText;
    applyCssBtn.style.background = '';
  }, 1500);
}

// Create New Phase
async function createNewPhase() {
  const phaseNumber = prompt('Enter the phase number (e.g., 6, 7, 8):', '6');
  if (!phaseNumber) return;

  const phaseTitle = prompt('Enter the phase title:', `Phase ${phaseNumber}: The Adventure`);
  if (!phaseTitle) return;

  const phaseSubtitle = prompt('Enter the phase subtitle/action:', 'Action: Complete the challenge');
  if (!phaseSubtitle) return;

  try {
    const response = await fetch('/api/page/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phaseNumber: phaseNumber,
        phaseTitle: phaseTitle,
        phaseSubtitle: phaseSubtitle
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create phase');
    }

    // Load the new phase for editing
    pageModules = [];
    selectedModuleIndex = null;
    nextModuleId = 1;
    currentEditingFilepath = data.filepath;
    pageCustomCSS = '';

    renderCanvas();
    renderConfigPanel();

    // Update save button
    saveBtn.textContent = `💾 Save to ${data.filepath}`;
    saveBtn.classList.remove('btn-secondary');
    saveBtn.classList.add('btn-success');

    alert(`✓ Created new phase: ${data.filepath}\n\nNow add modules to build your phase!`);
  } catch (error) {
    alert(`❌ Failed to create phase:\n${error.message}`);
    console.error('Create phase error:', error);
  }
}

// Story Index Management
let storyPhases = [];

async function openIndexManager() {
  try {
    // Load current story index
    const response = await fetch('/api/story-index/load');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load story index');
    }

    storyPhases = data.phases;
    renderPhaseCards();
    indexManagerModal.style.display = 'block';
  } catch (error) {
    alert(`❌ Failed to load story index:\n${error.message}`);
    console.error('Load index error:', error);
  }
}

function renderPhaseCards() {
  phaseCardsList.innerHTML = '';

  if (storyPhases.length === 0) {
    phaseCardsList.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 40px;">No phases yet. Click "Add Phase Card" to create one.</p>';
    return;
  }

  storyPhases.forEach((phase, index) => {
    const card = document.createElement('div');
    card.style.cssText = 'background: #ffffff; border: 2px solid #cbd5e1; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between; align-items: start;';

    card.innerHTML = `
      <div style="flex: 1;">
        <h3 style="margin: 0 0 10px 0; color: #1e293b;">${phase.title}</h3>
        <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #64748b;"><strong>Action:</strong> ${phase.action}</p>
        <p style="margin: 0; font-size: 0.9rem; color: #64748b;"><strong>Preview:</strong> ${phase.preview}</p>
        <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #94a3b8;"><strong>Link:</strong> ${phase.link}</p>
      </div>
      <div style="display: flex; gap: 8px;">
        ${index > 0 ? '<button class="btn btn-secondary btn-sm" data-action="up" data-index="' + index + '">↑</button>' : ''}
        ${index < storyPhases.length - 1 ? '<button class="btn btn-secondary btn-sm" data-action="down" data-index="' + index + '">↓</button>' : ''}
        <button class="btn btn-warning btn-sm" data-action="edit" data-index="${index}">✏️</button>
        <button class="btn btn-error btn-sm" data-action="delete" data-index="${index}">🗑️</button>
      </div>
    `;

    // Event listeners
    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => editPhaseCard(index));
    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => deletePhaseCard(index));
    card.querySelector('[data-action="up"]')?.addEventListener('click', () => movePhaseCard(index, -1));
    card.querySelector('[data-action="down"]')?.addEventListener('click', () => movePhaseCard(index, 1));

    phaseCardsList.appendChild(card);
  });
}

function addNewPhaseCard() {
  const title = prompt('Phase Title:', 'Phase 6: The Adventure');
  if (!title) return;

  const action = prompt('Phase Action:', 'Action: Complete the challenge');
  if (!action) return;

  const preview = prompt('Phase Preview Text:', 'A brief description of this phase...');
  if (!preview) return;

  const link = prompt('Phase Link (relative path):', '/story/phase6.html');
  if (!link) return;

  storyPhases.push({ title, action, preview, link });
  renderPhaseCards();
}

function editPhaseCard(index) {
  const phase = storyPhases[index];

  const title = prompt('Phase Title:', phase.title);
  if (title === null) return;

  const action = prompt('Phase Action:', phase.action);
  if (action === null) return;

  const preview = prompt('Phase Preview Text:', phase.preview);
  if (preview === null) return;

  const link = prompt('Phase Link:', phase.link);
  if (link === null) return;

  storyPhases[index] = { title, action, preview, link };
  renderPhaseCards();
}

function deletePhaseCard(index) {
  if (confirm(`Delete "${storyPhases[index].title}"?`)) {
    storyPhases.splice(index, 1);
    renderPhaseCards();
  }
}

function movePhaseCard(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= storyPhases.length) return;

  [storyPhases[index], storyPhases[newIndex]] = [storyPhases[newIndex], storyPhases[index]];
  renderPhaseCards();
}

async function saveStoryIndex() {
  try {
    const response = await fetch('/api/story-index/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phases: storyPhases })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save story index');
    }

    alert('✓ Story index saved successfully!');
  } catch (error) {
    alert(`❌ Failed to save story index:\n${error.message}`);
    console.error('Save index error:', error);
  }
}
