/**
 * Site Builder - Visual Page Creator for FR Rewards Modules
 * Phase 7: No-code tool for building custom pages with modules
 */

// Available modules configuration
const AVAILABLE_MODULES = [
  {
    id: 'claim-rewards',
    name: 'Claim Rewards',
    icon: '🎁',
    description: 'Let users claim NFT rewards based on owned assets',
    config: {
      collection: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: false, help: 'Automatically connect wallet on load' },
      title: { type: 'text', label: 'Custom Title', default: '', help: 'Override module title (optional)' }
    }
  },
  {
    id: 'factory-craft',
    name: 'Factory Craft',
    icon: '🏭',
    description: 'Craft new NFTs using existing NFTs as ingredients',
    config: {
      collection: { type: 'text', label: 'Collection Name', default: 'futuresrelic', help: 'WAX collection name' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: false }
    }
  },
  {
    id: 'transfer-mode',
    name: 'Transfer Mode',
    icon: '↔️',
    description: 'Transfer NFTs to other wallets',
    config: {
      collection: { type: 'text', label: 'Default Collection', default: '', help: 'Pre-filter by collection (optional)' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: false }
    }
  },
  {
    id: 'unpack',
    name: 'Unpack Module',
    icon: '📦',
    description: 'Open mystery packs and unpackable NFTs',
    config: {
      collection: { type: 'text', label: 'Default Collection', default: 'futuresrelic', help: 'Pre-filter by collection (optional)' },
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: false }
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
      auto_connect: { type: 'checkbox', label: 'Auto-connect wallet', default: false }
    }
  }
];

// Page state
let pageModules = []; // Array of {id, moduleType, config}
let selectedModuleIndex = null;
let nextModuleId = 1;

// DOM Elements
let moduleGallery, canvasEmpty, canvasModules, configEmpty, configPanel, configTitle, configForm;
let clearBtn, saveBtn, loadBtn, exportBtn, codeModal, closeCodeModal;

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
  exportBtn = document.getElementById('exportBtn');
  codeModal = document.getElementById('codeModal');
  closeCodeModal = document.getElementById('closeCodeModal');

  // Populate module gallery
  renderModuleGallery();

  // Setup event listeners
  clearBtn.addEventListener('click', clearAll);
  saveBtn.addEventListener('click', saveConfiguration);
  loadBtn.addEventListener('click', loadConfiguration);
  exportBtn.addEventListener('click', exportCode);
  closeCodeModal.addEventListener('click', () => codeModal.style.display = 'none');

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
function addModule(moduleType) {
  const moduleInfo = AVAILABLE_MODULES.find(m => m.id === moduleType);
  if (!moduleInfo) return;

  // Create default config
  const config = {};
  Object.keys(moduleInfo.config).forEach(key => {
    const field = moduleInfo.config[key];
    config[key] = field.default;
  });

  // Add to page modules
  const moduleId = nextModuleId++;
  pageModules.push({
    id: moduleId,
    moduleType: moduleType,
    config: config
  });

  renderCanvas();
  selectModule(pageModules.length - 1);
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
    // Create config JSON
    const configJson = JSON.stringify(module.config);

    // Use module loader to initialize
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

  // Render config fields
  Object.keys(moduleInfo.config).forEach(key => {
    const field = moduleInfo.config[key];
    const section = document.createElement('div');
    section.className = 'config-section';

    if (field.type === 'checkbox') {
      section.innerHTML = `
        <label>
          <input type="checkbox" class="config-checkbox" data-key="${key}" ${module.config[key] ? 'checked' : ''}>
          <span class="config-label" style="display: inline;">${field.label}</span>
        </label>
        ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
      `;
    } else if (field.type === 'textarea') {
      section.innerHTML = `
        <label class="config-label">${field.label}:</label>
        <textarea class="config-textarea" data-key="${key}">${module.config[key] || ''}</textarea>
        ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
      `;
    } else {
      section.innerHTML = `
        <label class="config-label">${field.label}:</label>
        <input type="${field.type}" class="config-input" data-key="${key}" value="${module.config[key] || ''}" placeholder="${field.default}">
        ${field.help ? `<div class="config-help">${field.help}</div>` : ''}
      `;
    }

    configForm.appendChild(section);
  });

  // Add apply button
  const applyBtn = document.createElement('button');
  applyBtn.className = 'btn btn-primary';
  applyBtn.style.width = '100%';
  applyBtn.style.marginTop = '20px';
  applyBtn.textContent = '✓ Apply Changes';
  applyBtn.addEventListener('click', applyConfig);
  configForm.appendChild(applyBtn);
}

// Apply configuration changes
function applyConfig() {
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

  renderCanvas();

  // Show feedback
  const btn = configForm.querySelector('.btn-primary');
  const originalText = btn.textContent;
  btn.textContent = '✓ Applied!';
  btn.style.background = '#10b981';
  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
  }, 1500);
}

// Remove module
function removeModule(index) {
  if (confirm('Remove this module?')) {
    pageModules.splice(index, 1);
    if (selectedModuleIndex === index) {
      selectedModuleIndex = null;
    } else if (selectedModuleIndex > index) {
      selectedModuleIndex--;
    }
    renderCanvas();
    renderConfigPanel();
  }
}

// Move module
function moveModule(index, direction) {
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
}

// Clear all modules
function clearAll() {
  if (pageModules.length === 0) return;

  if (confirm('Clear all modules? This cannot be undone.')) {
    pageModules = [];
    selectedModuleIndex = null;
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
    const configJson = JSON.stringify(module.config).replace(/"/g, '&quot;');

    html += `<!-- ${moduleInfo.name} -->\n`;
    html += `<div\n`;
    html += `  id="module-${module.id}"\n`;
    html += `  data-module="${module.moduleType}"\n`;
    html += `  data-config="${configJson}"\n`;
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
<script src="https://cdn.jsdelivr.net/npm/anchor-link-browser-transport@3.4.4/dist/index.min.js"></script>`;

  // Show in modal
  document.getElementById('htmlCode').textContent = html;
  document.getElementById('scriptsCode').textContent = scripts;
  codeModal.style.display = 'block';
}
