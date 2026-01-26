/**
 * Unified Module - Smart Wrapper with Dropdown Selector
 *
 * This module provides a single entry point with a dropdown to select
 * which module type to use. It then loads and initializes the appropriate
 * existing module, ensuring consistent wallet management across all types.
 *
 * Supported Module Types:
 * - paid-claim: Sell NFTs for WAX tokens
 * - nefty-drop: Embed NeftyBlocks drops
 * - claim-rewards: NFT claim rewards
 * - gated-paid-claim: Sell NFTs to verified holders
 * - factory-craft: Craft NFTs from ingredients
 * - transfer-mode: Transfer NFTs to other wallets
 * - unpack: Open mystery packs
 * - blend-array: NeftyBlocks blend detector
 * - text-block: Display text content
 * - image-block: Display images
 */

window.init_unified_module = function(containerId, config = {}) {
  console.log(`✅ Unified Module initialized in #${containerId}`);
  console.log('Config:', config);

  // Get container - it might be passed as ID or the element itself
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) {
    console.error('Container not found:', containerId);
    return;
  }

  // Find the unified-module-container div within this container
  let targetContainer = container.querySelector('.unified-module-container');
  if (!targetContainer) {
    // If not found, use the container directly
    targetContainer = container;
  }

  const MODULE_TYPE = config.module_type || 'paid-claim';
  console.log(`🎯 Module Type: ${MODULE_TYPE}`);

  // Module type to init function and file mapping
  const MODULE_INIT_FUNCTIONS = {
    'paid-claim': { init: 'init_paid_claim', file: 'paid-claim.js' },
    'nefty-drop': { init: 'init_nefty_drop', file: null },
    'claim-rewards': { init: 'init_claim_rewards', file: 'claim-rewards.js' },
    'gated-paid-claim': { init: 'init_gated_paid_claim', file: 'gated-paid-claim.js' },
    'factory-craft': { init: 'init_factory_craft', file: 'factory-craft.js' },
    'transfer-mode': { init: 'init_transfer_mode', file: 'transfer-mode.js' },
    'unpack': { init: 'init_unpack', file: 'unpack.js' },
    'blend-array': { init: 'init_blend_array', file: 'blend-array.js' },
    'text-block': { init: 'init_text_block', file: null },
    'image-block': { init: 'init_image_block', file: null }
  };

  // Special handlers for simple modules (text-block, image-block)
  if (MODULE_TYPE === 'text-block') {
    initTextBlock(targetContainer, config);
    return;
  }

  if (MODULE_TYPE === 'image-block') {
    initImageBlock(targetContainer, config);
    return;
  }

  // Special handler for nefty-drop (doesn't need a module file)
  if (MODULE_TYPE === 'nefty-drop') {
    initNeftyDrop(targetContainer, config);
    return;
  }

  // Get the init function name and file for this module type
  const moduleInfo = MODULE_INIT_FUNCTIONS[MODULE_TYPE];

  if (!moduleInfo) {
    targetContainer.innerHTML = `
      <div class="card" style="padding: 20px; text-align: center; background: var(--bg-dark); border: 2px solid var(--error);">
        <p style="color: var(--error); font-weight: 600; margin: 0;">⚠️ Unknown Module Type</p>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 10px 0 0;">
          Module type "${MODULE_TYPE}" is not recognized.
        </p>
      </div>
    `;
    return;
  }

  const initFunctionName = moduleInfo.init;
  const moduleFile = moduleInfo.file;

  // Create a unique ID for the target container if it doesn't have one
  if (!targetContainer.id) {
    targetContainer.id = `unified-module-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const targetContainerId = targetContainer.id;

  // If module needs a file loaded, load it first
  if (moduleFile && !window[initFunctionName]) {
    console.log(`📦 Loading module file: /modules/${moduleFile}`);

    const script = document.createElement('script');
    script.src = `/modules/${moduleFile}`;
    script.onload = () => {
      console.log(`✅ Module file loaded: ${moduleFile}`);
      initializeModule();
    };
    script.onerror = () => {
      console.error(`❌ Failed to load module file: ${moduleFile}`);
      targetContainer.innerHTML = `
        <div class="card" style="padding: 20px; text-align: center; background: var(--bg-dark); border: 2px solid var(--error);">
          <p style="color: var(--error); font-weight: 600; margin: 0;">⚠️ Failed to Load Module</p>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 10px 0 0;">
            Could not load ${moduleFile}. Please check your configuration.
          </p>
        </div>
      `;
    };
    document.head.appendChild(script);
  } else {
    // Module file already loaded or not needed
    initializeModule();
  }

  function initializeModule() {
    // Wait for the module's init function to be available
    const checkAndInit = setInterval(() => {
      if (window[initFunctionName]) {
        clearInterval(checkAndInit);
        console.log(`✅ Calling ${initFunctionName}() with container #${targetContainerId}`);

        // Call the existing module's init function with the target container ID and config
        window[initFunctionName](targetContainerId, config);
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkAndInit);
      if (!window[initFunctionName]) {
        console.error(`❌ Failed to load ${initFunctionName} after 10 seconds`);
        targetContainer.innerHTML = `
          <div class="card" style="padding: 20px; text-align: center; background: var(--bg-dark); border: 2px solid var(--warning);">
            <p style="color: var(--warning); font-weight: 600; margin: 0;">⚠️ Module Not Loaded</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 10px 0 0;">
              The ${MODULE_TYPE} module could not be loaded. Please check that the module file is included in your page.
            </p>
          </div>
        `;
      }
    }, 10000);
  }
};

/**
 * TEXT BLOCK MODULE
 * Display text content with optional styling
 */
function initTextBlock(container, config) {
  const heading = config.heading || '';
  const content = config.content || 'Enter your text here...';
  const style = config.style || 'normal';

  const styleClasses = {
    normal: '',
    narrative: 'style="background: var(--bg-dark); padding: 20px; border-radius: 8px; line-height: 1.8;"',
    alert: 'style="background: rgba(239, 68, 68, 0.1); padding: 20px; border-radius: 8px; border-left: 4px solid var(--error);"',
    quote: 'style="background: var(--bg-dark); padding: 20px; border-left: 4px solid var(--primary); border-radius: 4px; font-style: italic;"'
  };

  container.innerHTML = `
    <div class="card" ${styleClasses[style]}>
      ${heading ? `<h2 style="margin: 0 0 15px 0;">${heading}</h2>` : ''}
      <div>${content}</div>
    </div>
  `;
}

/**
 * IMAGE BLOCK MODULE
 * Display images with optional caption
 */
function initImageBlock(container, config) {
  const imageUrl = config.image_url || '';
  const altText = config.alt_text || 'Image';
  const caption = config.caption || '';
  const width = config.width || 'auto';
  const alignment = config.alignment || 'center';

  if (!imageUrl) {
    container.innerHTML = `
      <div class="card" style="padding: 20px; text-align: center;">
        <p style="color: var(--text-secondary);">⚠️ No image URL provided</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="card" style="text-align: ${alignment};">
      <img
        src="${imageUrl}"
        alt="${altText}"
        style="
          width: ${width};
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          ${alignment === 'center' ? 'display: block; margin: 0 auto;' : ''}
        "
        onerror="this.parentElement.innerHTML='<p style=\\'color: var(--error); padding: 20px;\\'>❌ Failed to load image</p>';"
      >
      ${caption ? `<p style="margin-top: 10px; font-size: 0.9rem; color: var(--text-secondary); ${alignment === 'center' ? 'text-align: center;' : ''}">${caption}</p>` : ''}
    </div>
  `;
}

/**
 * NEFTYBLOCKS DROP MODULE
 * Embed NeftyBlocks drop iframes
 */
function initNeftyDrop(container, config) {
  const collection = config.collection || 'futuresrelic';
  const dropId = config.drop_id || '';
  const limit = config.limit || '1';

  if (!dropId) {
    container.innerHTML = `
      <div class="card" style="padding: 20px; text-align: center;">
        <p style="color: var(--text-secondary);">⚠️ No drop ID configured</p>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 10px;">
          Please configure a drop_id in the module settings.
        </p>
      </div>
    `;
    return;
  }

  console.log(`✅ NeftyBlocks Drop initialized: ${collection} - Drop #${dropId}`);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <iframe
        src="https://neftyblocks.com/c/${collection}/drops/${dropId}/embed"
        width="100%"
        height="800"
        style="border: none; border-radius: 8px; display: block;"
        allow="payment"
        title="NeftyBlocks Drop"
      ></iframe>
    </div>
  `;
}

// Export the initialization function
console.log('✅ Unified Module wrapper loaded - ready to dispatch to specific modules');
