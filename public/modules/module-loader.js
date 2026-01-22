/**
 * Module Loader System for FR Rewards
 *
 * Dynamically loads and initializes modular components
 * Usage: <div data-module="module-name" data-config='{"key": "value"}'></div>
 */

class ModuleLoader {
  static loadedModules = new Set();
  static loadingModules = new Map();

  /**
   * Load a specific module into a container
   * @param {string} moduleName - Name of the module (e.g., 'claim-rewards')
   * @param {string} containerId - ID of the container element
   * @param {object} config - Configuration object for the module
   */
  static async loadModule(moduleName, containerId, config = {}) {
    const container = document.getElementById(containerId);

    if (!container) {
      console.error(`Container #${containerId} not found for module ${moduleName}`);
      return;
    }

    // Show loading state
    container.innerHTML = `
      <div class="module-loading" style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <div class="spinner" style="margin: 0 auto 15px;"></div>
        <p>Loading ${moduleName}...</p>
      </div>
    `;

    try {
      // Load HTML
      const htmlResponse = await fetch(`/modules/${moduleName}.html`);
      if (!htmlResponse.ok) {
        throw new Error(`Failed to load ${moduleName}.html`);
      }
      const html = await htmlResponse.text();
      container.innerHTML = html;

      // Load and initialize JS
      await this.loadModuleScript(moduleName, containerId, config);

    } catch (error) {
      console.error(`Error loading module ${moduleName}:`, error);
      container.innerHTML = `
        <div class="module-error" style="text-align: center; padding: 40px; color: var(--error);">
          <p>❌ Failed to load module: ${moduleName}</p>
          <p style="font-size: 0.9rem; color: var(--text-secondary);">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Load module JavaScript file
   */
  static async loadModuleScript(moduleName, containerId, config) {
    // Check if already loaded
    if (this.loadedModules.has(moduleName)) {
      // Script already loaded, just initialize
      this.initializeModule(moduleName, containerId, config);
      return;
    }

    // Check if currently loading
    if (this.loadingModules.has(moduleName)) {
      // Wait for existing load to complete
      await this.loadingModules.get(moduleName);
      this.initializeModule(moduleName, containerId, config);
      return;
    }

    // Create loading promise
    const loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `/modules/${moduleName}.js`;
      script.onload = () => {
        this.loadedModules.add(moduleName);
        this.loadingModules.delete(moduleName);
        resolve();
      };
      script.onerror = () => {
        this.loadingModules.delete(moduleName);
        reject(new Error(`Failed to load ${moduleName}.js`));
      };
      document.head.appendChild(script);
    });

    this.loadingModules.set(moduleName, loadPromise);
    await loadPromise;
    this.initializeModule(moduleName, containerId, config);
  }

  /**
   * Initialize a loaded module
   */
  static initializeModule(moduleName, containerId, config) {
    // Convert module-name to module_name for function naming
    const functionName = `init_${moduleName.replace(/-/g, '_')}`;

    if (typeof window[functionName] === 'function') {
      console.log(`✅ Initializing module: ${moduleName}`);
      try {
        window[functionName](containerId, config);
      } catch (error) {
        console.error(`Error initializing module ${moduleName}:`, error);
      }
    } else {
      console.warn(`⚠️ Module ${moduleName} loaded but no init function found (expected: ${functionName})`);
    }
  }

  /**
   * Initialize all modules on the page
   */
  static initAllModules() {
    const moduleElements = document.querySelectorAll('[data-module]');

    console.log(`📦 Found ${moduleElements.length} module(s) to load`);

    // Group consecutive paid-claim modules
    const grouped = this.groupConsecutivePaidClaims(Array.from(moduleElements));

    grouped.forEach(item => {
      if (item.isGroup) {
        // This is a group of paid-claim modules
        this.loadGroupedPaidClaims(item.elements);
      } else {
        // Single module, load normally
        const el = item.element;
        const moduleName = el.getAttribute('data-module');
        const configStr = el.getAttribute('data-config') || '{}';

        // Parse config
        let config = {};
        try {
          config = JSON.parse(configStr);
        } catch (e) {
          console.error(`Invalid config JSON for module ${moduleName}:`, e);
        }

        // Ensure element has an ID
        let containerId = el.id;
        if (!containerId) {
          containerId = `module-${moduleName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          el.id = containerId;
        }

        // Load the module
        this.loadModule(moduleName, containerId, config);
      }
    });
  }

  /**
   * Group consecutive paid-claim modules together
   */
  static groupConsecutivePaidClaims(elements) {
    const result = [];
    let currentGroup = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const moduleName = el.getAttribute('data-module');

      if (moduleName === 'paid-claim') {
        currentGroup.push(el);
      } else {
        // Not a paid-claim, flush current group if any
        if (currentGroup.length > 1) {
          result.push({ isGroup: true, elements: currentGroup });
          currentGroup = [];
        } else if (currentGroup.length === 1) {
          result.push({ isGroup: false, element: currentGroup[0] });
          currentGroup = [];
        }
        // Add the non-paid-claim element
        result.push({ isGroup: false, element: el });
      }
    }

    // Flush remaining group
    if (currentGroup.length > 1) {
      result.push({ isGroup: true, elements: currentGroup });
    } else if (currentGroup.length === 1) {
      result.push({ isGroup: false, element: currentGroup[0] });
    }

    return result;
  }

  /**
   * Load grouped paid-claim modules
   */
  static async loadGroupedPaidClaims(elements) {
    console.log(`📦 Grouping ${elements.length} consecutive paid-claim modules`);

    // Parse all configs
    const configs = elements.map(el => {
      const configStr = el.getAttribute('data-config') || '{}';
      try {
        return JSON.parse(configStr);
      } catch (e) {
        console.error('Invalid config JSON for paid-claim:', e);
        return {};
      }
    });

    // Create a wrapper container
    const wrapperContainer = document.createElement('div');
    wrapperContainer.className = 'paid-claim-group-wrapper';
    wrapperContainer.id = `paid-claim-group-${Date.now()}`;

    // Replace the first element with the wrapper and remove the rest
    const firstElement = elements[0];
    firstElement.parentNode.insertBefore(wrapperContainer, firstElement);
    elements.forEach(el => el.remove());

    // Load the grouped module
    await this.loadGroupedPaidClaimModule(wrapperContainer.id, configs);
  }

  /**
   * Load grouped paid-claim module
   */
  static async loadGroupedPaidClaimModule(containerId, configs) {
    const container = document.getElementById(containerId);

    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    // Show loading state
    container.innerHTML = `
      <div class="module-loading" style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <div class="spinner" style="margin: 0 auto 15px;"></div>
        <p>Loading paid claims...</p>
      </div>
    `;

    try {
      // Load HTML template
      const htmlResponse = await fetch('/modules/paid-claim.html');
      if (!htmlResponse.ok) {
        throw new Error('Failed to load paid-claim.html');
      }
      const html = await htmlResponse.text();
      container.innerHTML = html;

      // Load and initialize JS with grouped config
      await this.loadModuleScript('paid-claim', containerId, {
        grouped: true,
        templates: configs
      });

    } catch (error) {
      console.error('Error loading grouped paid-claim module:', error);
      container.innerHTML = `
        <div class="module-error" style="text-align: center; padding: 40px; color: var(--error);">
          <p>❌ Failed to load paid claims</p>
          <p style="font-size: 0.9rem; color: var(--text-secondary);">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Reload a specific module
   */
  static async reloadModule(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    const moduleName = container.getAttribute('data-module');
    const configStr = container.getAttribute('data-config') || '{}';

    if (!moduleName) {
      console.error(`No data-module attribute found on #${containerId}`);
      return;
    }

    let config = {};
    try {
      config = JSON.parse(configStr);
    } catch (e) {
      console.error(`Invalid config JSON:`, e);
    }

    await this.loadModule(moduleName, containerId, config);
  }
}

// Auto-load all modules when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ModuleLoader.initAllModules();
  });
} else {
  // DOM already loaded
  ModuleLoader.initAllModules();
}

// Expose globally for manual module loading
window.ModuleLoader = ModuleLoader;
