# 🚀 PROJECT: UNIFIED MODULAR STORY-DRIVEN PLATFORM

## 📖 CONTEXT

You're working on the **fr-rewards** system - a WAX blockchain NFT platform with multiple working features that are currently scattered across separate HTML pages. Everything works perfectly. Your job is to **consolidate without breaking anything**.

**CRITICAL**: Read these files FIRST before starting:
- `COMPLETE_API_WIKI.md` - Every API endpoint, database function, and pattern
- `CRITICAL_LOGIC_CORRECTIONS.md` - Deep logic understanding (match_quantity, LIVE queries, etc.)
- `server.js` - All API endpoints
- `wax.js` - All blockchain functions

## 🎯 YOUR MISSION

Create a **unified main platform** with a story-driven interface where users can:
1. **Navigate** through a main page with a menu/link bar
2. **Read storyline** content (text + images)
3. **Interact** with modular action components embedded inline with the story
4. **Use all existing features** as reusable, embedable modules

### The Vision:

```
┌─────────────────────────────────────────────────────────┐
│  FUTURE RELIC - Main Navigation Bar                     │
│  [Home] [Story] [Factory] [Admin] [Scheduler] [Login]  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    STORY CONTENT                        │
│                                                         │
│  Once upon a time in the WAX blockchain...             │
│  [Story text with images]                              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  📦 CLAIM YOUR STARTER PACK                     │  │
│  │  [Interactive Claim Rewards Module]             │  │
│  │  Connect wallet and claim your first NFTs      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  After claiming your rewards, the story continues...   │
│  [More story content]                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  🎲 OPEN YOUR PACK                              │  │
│  │  [Interactive Unpack Module]                    │  │
│  │  Use atomicpacksx contract to open packs       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  Now that you have materials, craft something...       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  🔨 FACTORY CRAFTING                            │  │
│  │  [Interactive Factory/Blend Module]             │  │
│  │  Combine ingredients to create new items       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🧩 EXISTING MODULES (Already Built and Working!)

You have these **WORKING** features that need to be modularized:

### 1. **Claim Rewards Module**
- **Current file**: `public/index.html` + `public/app.js`
- **What it does**:
  - Users connect WAX wallet
  - System checks eligibility (LIVE blockchain query)
  - Shows claimable rewards based on owned NFTs
  - "Claim" button mints reward NFTs
  - "Claim All" button for multiple rewards
  - Cooldown system prevents spam
- **API endpoints used**:
  - `GET /api/user/eligibility?account={wallet}`
  - `POST /api/user/claim`
  - `POST /api/user/claim-all`
- **CRITICAL**: Uses `getUserAssetsLive()` for security
- **CRITICAL**: Respects `match_quantity` flag (see CRITICAL_LOGIC_CORRECTIONS.md)

### 2. **NeftyBlocks Drops Module**
- **What it does**: Embeds NeftyBlocks drop widgets
- **How it works**: NeftyBlocks provides embed codes for drops
- **Example embed**:
  ```html
  <iframe
    src="https://neftyblocks.com/c/futuresrelic/drops/12345"
    width="100%"
    height="600px"
    frameborder="0">
  </iframe>
  ```
- **User action**: Connect wallet, purchase/claim NFTs from drop
- **This is external** - no backend needed, just clean embed

### 3. **Unpack Module (atomicpacksx contract)**
- **What it does**: Users open AtomicHub packs they own
- **How it works**:
  - User connects wallet
  - System fetches packs owned (template IDs configured as "packs")
  - User clicks "Unpack"
  - Triggers `atomicpacksx::unpack` action on blockchain
- **Blockchain action**:
  ```javascript
  {
    account: 'atomicpacksx',
    name: 'unpack',
    authorization: [{
      actor: userWallet,
      permission: 'active'
    }],
    data: {
      pack_asset_id: assetId,  // The pack to open
      pack_owner: userWallet
    }
  }
  ```
- **IMPORTANT**: User must sign transaction (uses anchor/wax.js)
- **API endpoint needed**: `POST /api/user/unpack` (validate pack ownership, return transaction)

### 4. **Claim Unpacks Module**
- **What it does**: After opening a pack, user claims the revealed NFTs
- **Why separate**: atomicpacksx unpacks → NFTs go to atomicpacksx contract → need to claim to user wallet
- **Blockchain action**:
  ```javascript
  {
    account: 'atomicpacksx',
    name: 'claimassets',
    authorization: [{
      actor: userWallet,
      permission: 'active'
    }],
    data: {
      pack_asset_id: originalPackId,
      origin_unpack_id: unpackId  // From unpack transaction
    }
  }
  ```
- **API endpoint needed**: `POST /api/user/claim-unpack`

### 5. **Factory Crafting/Blend Module**
- **Current files**: `public/craft.html` + `public/craft.js`
- **What it does**:
  - Shows available recipes (craft_recipes table)
  - User selects recipe
  - System validates ingredients (LIVE check of owned NFTs)
  - User submits craft
  - Backend burns ingredients, mints/transfers results
- **Two modes**:
  - **MINT MODE**: Creates new NFTs using `wax.mintNFT()`
  - **POOL MODE**: Swaps from pool.fr using `wax.transferNFTs()` (see TRANSFER_FUNCTION_MISSING.md)
- **API endpoints**:
  - `GET /api/user/craft-recipes` - List available recipes
  - `GET /api/user/craft-recipes/:id` - Recipe details
  - `POST /api/user/craft` - Execute craft
  - `POST /api/admin/fulfill-failed-craft/:id` - Admin fix for failures
- **CRITICAL**: Must burn ingredients atomically (all or nothing)
- **CRITICAL**: Uses `getUserAssetsLive()` to validate ingredients

### 6. **Blend Array Module** (NEW - Like story.html mode)
- **What it does**: Display multiple blend recipes in an array/grid format
- **Similar to**: `public/story.html` structure with blend arrays
- **User wants**: Many blends displayed in organized grid, not one-at-a-time
- **Key features**:
  - Grid layout showing multiple recipes at once
  - Each recipe card shows ingredients, results, requirements
  - Click to expand/execute specific blend
  - Filter by category or search
- **Uses same backend**: Existing craft endpoints
- **Config options**:
  - `recipe_ids`: Array of specific recipes to show
  - `category`: Filter by category
  - `layout`: "grid" or "list"
- **This is NOT NeftyBlocks** - Uses our own factory system

### 7. **Blend Array (Transfer + Mint Mode)** (NEW REQUIREMENT)
- **What it does**: Alternative to current factory that uses asset transfers instead of burns
- **How it works**:
  1. User selects blend recipe
  2. User transfers ingredients to blend wallet (from config)
  3. Backend detects transfer
  4. Backend mints result NFT to user's wallet
- **Why different from current factory**:
  - Current: Burns ingredients → mints result
  - New: Transfers ingredients → mints result
  - Ingredients go to `blend_array_wallet` (config) instead of being destroyed
- **Config needed**:
  - `BLEND_ARRAY_WALLET` - Where ingredients are transferred to
  - `BLEND_ARRAY_PRIVATE_KEY` - To verify/process transfers
- **Database addition**: Need to track transfers vs burns
- **API endpoints needed**:
  - `POST /api/user/blend-array` - Submit transfer-based blend
  - Backend validates transfer occurred, mints result
- **CRITICAL**: Must verify transfer BEFORE minting result
- **This is NOT using NeftyBlocks contracts** - Our own implementation using atomicassets::transfer

## 🏗️ ARCHITECTURE REQUIREMENTS

### Structure Overview:

```
public/
├── index.html                  ← NEW: Main unified page with story + modules
├── modules/                    ← NEW: Modular components
│   ├── claim-rewards.html          ← Extract from current index.html
│   ├── claim-rewards.js            ← Extract from current app.js
│   ├── nefty-drops.html            ← New embed wrapper
│   ├── unpack.html                 ← New unpack interface
│   ├── unpack.js                   ← New unpack logic
│   ├── claim-unpack.html           ← New claim unpack interface
│   ├── claim-unpack.js             ← New claim unpack logic
│   ├── factory-craft.html          ← Extract from craft.html
│   ├── factory-craft.js            ← Extract from craft.js
│   ├── blend-array.html            ← NEW: Grid view of multiple blends
│   ├── blend-array.js              ← NEW: Blend array logic
│   └── module-loader.js            ← NEW: Dynamic module injection
├── styles/
│   ├── main.css                   ← Global styles
│   └── modules.css                ← Module-specific styles
├── admin.html                 ← Keep existing (add to nav)
├── admin-scheduler.html       ← Keep existing (add to nav)
├── admin-factory.html         ← Update with NeftyBlocks extractor
├── admin-page-builder.html    ← NEW: Visual page builder
├── admin-page-builder.js      ← NEW: Page builder logic
├── user-guide.html            ← Keep existing (add to nav)
└── admin-wiki.html            ← Keep existing (add to nav)
```

### Module System Requirements:

Each module should be:
1. **Self-contained** - Has own HTML/JS/CSS
2. **Embedable** - Can be loaded dynamically with `<div data-module="claim-rewards"></div>`
3. **Reusable** - Can appear multiple times on same page
4. **Configurable** - Can pass parameters (e.g., specific reward, specific recipe)
5. **Non-breaking** - Uses existing API endpoints without changes

### Module Loader System:

Create `public/modules/module-loader.js`:

```javascript
// Example usage in main page:
// <div data-module="claim-rewards" data-config='{"highlight_reward_id": 5}'></div>

class ModuleLoader {
  static async loadModule(moduleName, containerId, config = {}) {
    const container = document.getElementById(containerId);

    // Fetch module HTML
    const htmlResponse = await fetch(`/modules/${moduleName}.html`);
    const html = await htmlResponse.text();
    container.innerHTML = html;

    // Load module JS
    const script = document.createElement('script');
    script.src = `/modules/${moduleName}.js`;
    script.onload = () => {
      // Initialize module with config
      if (window[`init_${moduleName.replace('-', '_')}`]) {
        window[`init_${moduleName.replace('-', '_')}`](containerId, config);
      }
    };
    document.body.appendChild(script);
  }

  static initAllModules() {
    document.querySelectorAll('[data-module]').forEach(el => {
      const moduleName = el.getAttribute('data-module');
      const config = JSON.parse(el.getAttribute('data-config') || '{}');
      const containerId = el.id || `module-${Date.now()}-${Math.random()}`;
      el.id = containerId;
      this.loadModule(moduleName, containerId, config);
    });
  }
}

// Auto-load all modules on page load
document.addEventListener('DOMContentLoaded', () => {
  ModuleLoader.initAllModules();
});
```

### Navigation Bar:

```html
<!-- Add to top of index.html and all pages -->
<nav class="main-nav">
  <div class="nav-container">
    <div class="nav-brand">
      <img src="/images/logo.png" alt="Future Relic">
      <span>FUTURE RELIC</span>
    </div>
    <div class="nav-links">
      <a href="/" class="nav-link active">Story</a>
      <a href="/craft.html" class="nav-link">Factory</a>
      <a href="/admin.html" class="nav-link">Admin</a>
      <a href="/admin-scheduler.html" class="nav-link">Scheduler</a>
      <a href="/user-guide.html" class="nav-link">Guide</a>
      <a href="/admin-wiki.html" class="nav-link">Wiki</a>
    </div>
    <div class="nav-wallet">
      <button id="nav-connect-wallet" class="btn btn-primary">Connect Wallet</button>
      <span id="nav-wallet-display" style="display: none;"></span>
    </div>
  </div>
</nav>

<style>
.main-nav {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  padding: 1rem 2rem;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.nav-container {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--primary);
}

.nav-brand img {
  height: 40px;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  color: var(--text-primary);
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.nav-link:hover {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
}

.nav-link.active {
  background: var(--primary);
  color: white;
}

.nav-wallet {
  display: flex;
  align-items: center;
  gap: 1rem;
}
</style>
```

## 📋 STEP-BY-STEP IMPLEMENTATION PLAN

### Phase 0: Backup Everything (CRITICAL - Do This FIRST!)

**Before making ANY changes, create a backup branch!**

1. **Create backup branch**:
   ```bash
   git checkout -b backup-before-modular-platform
   git push -u origin backup-before-modular-platform
   ```

2. **Return to working branch**:
   ```bash
   git checkout claude/continue-project-review-aB6RT
   ```

3. **Verify backup exists**:
   ```bash
   git branch -a | grep backup
   ```

**This backup ensures you can restore everything if something breaks!**

### Phase 1: Setup Module System (Do This First!)

1. **Create module directory structure**:
   ```bash
   mkdir -p public/modules
   mkdir -p public/styles
   ```

2. **Create module-loader.js** (see code above)

3. **Test with simple module**:
   - Create `public/modules/test-module.html`
   - Create `public/modules/test-module.js`
   - Add `<div data-module="test-module"></div>` to index.html
   - Verify it loads correctly

### Phase 2: Extract Claim Rewards Module

1. **Create `public/modules/claim-rewards.html`**:
   - Copy the claim interface from current `index.html`
   - Remove nav/header/footer - just the claim content
   - Keep wallet connection, eligibility check, claim buttons
   - Keep claim-all functionality

2. **Create `public/modules/claim-rewards.js`**:
   - Copy logic from current `app.js`
   - Wrap in initialization function: `window.init_claim_rewards = function(containerId, config) { ... }`
   - Support config options:
     - `highlight_reward_id` - Auto-scroll to specific reward
     - `auto_connect` - Auto-connect wallet on load
     - `show_only_reward_id` - Filter to specific reward

3. **Test standalone**: Create `public/test-claim-module.html` that only loads this module

### Phase 3: Extract Factory Craft Module

1. **Create `public/modules/factory-craft.html`**:
   - Copy from `craft.html`
   - Remove wrapper, keep craft interface

2. **Create `public/modules/factory-craft.js`**:
   - Copy from `craft.js`
   - Wrap in `window.init_factory_craft = function(containerId, config) { ... }`
   - Support config options:
     - `recipe_id` - Show specific recipe only
     - `recipe_category` - Filter by category
     - `auto_connect` - Auto-connect wallet

3. **Test standalone**

### Phase 4: Create Unpack Module (New Functionality)

1. **Backend: Add unpack endpoint to `server.js`**:

```javascript
// POST /api/user/unpack
app.post('/api/user/unpack', strictLimiter, async (req, res) => {
  try {
    const { account, asset_id } = req.body;

    // Validate inputs
    if (!account || !asset_id) {
      return res.status(400).json({ error: 'Account and asset_id required' });
    }

    // Verify user owns the pack (LIVE check)
    const assets = await wax.getUserAssetsLive(account, config.collection_name);
    const packAsset = assets.find(a => a.asset_id === asset_id);

    if (!packAsset) {
      return res.status(400).json({ error: 'Pack not found or not owned by user' });
    }

    // Optional: Verify it's actually a pack template
    const packTemplateIds = [/* Add your pack template IDs here */];
    if (!packTemplateIds.includes(parseInt(packAsset.template_id))) {
      return res.status(400).json({ error: 'Asset is not a valid pack' });
    }

    // Return transaction data for user to sign
    res.json({
      success: true,
      action: {
        account: 'atomicpacksx',
        name: 'unpack',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          pack_asset_id: asset_id,
          pack_owner: account
        }
      },
      message: 'Sign this transaction to open your pack'
    });

  } catch (error) {
    console.error('Unpack error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

2. **Frontend: Create `public/modules/unpack.html`**:

```html
<div class="module-container unpack-module">
  <div class="module-header">
    <h3>📦 Open Your Packs</h3>
    <p>Select a pack to open and reveal its contents</p>
  </div>

  <div id="unpack-wallet-prompt" class="wallet-prompt">
    <button id="unpack-connect-wallet" class="btn btn-primary">Connect Wallet to View Packs</button>
  </div>

  <div id="unpack-loading" style="display: none;">
    <div class="spinner"></div>
    <p>Loading your packs...</p>
  </div>

  <div id="unpack-content" style="display: none;">
    <div id="unpack-packs-list" class="packs-grid">
      <!-- Packs will be inserted here -->
    </div>

    <div id="unpack-status" class="status-message"></div>
  </div>
</div>
```

3. **Frontend: Create `public/modules/unpack.js`**:

```javascript
window.init_unpack = function(containerId, config = {}) {
  const container = document.getElementById(containerId);
  const API_URL = config.api_url || '';

  let currentAccount = null;
  let wax = null;

  // Initialize WAX wallet
  async function initWallet() {
    if (typeof waxjs === 'undefined') {
      // Load waxjs if not already loaded
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@waxio/waxjs@1.0.4/dist/waxjs.min.js';
      document.head.appendChild(script);
      await new Promise(resolve => script.onload = resolve);
    }
    wax = new waxjs.WaxJS({ rpcEndpoint: 'https://api.waxsweden.org' });
  }

  // Connect wallet
  async function connectWallet() {
    try {
      await initWallet();
      currentAccount = await wax.login();

      container.querySelector('#unpack-wallet-prompt').style.display = 'none';
      container.querySelector('#unpack-loading').style.display = 'block';

      await loadPacks();

    } catch (error) {
      showStatus(`Wallet connection failed: ${error.message}`, 'error');
    }
  }

  // Load user's packs
  async function loadPacks() {
    try {
      // Fetch user's assets (filtered to pack templates)
      const response = await fetch(`${API_URL}/api/user/eligibility?account=${currentAccount}`);
      const data = await response.json();

      // Filter to pack templates only (configure in backend or here)
      const packTemplateIds = config.pack_template_ids || []; // e.g., [123456, 123457]
      const packs = data.assets?.filter(asset =>
        packTemplateIds.includes(parseInt(asset.template_id))
      ) || [];

      container.querySelector('#unpack-loading').style.display = 'none';
      container.querySelector('#unpack-content').style.display = 'block';

      if (packs.length === 0) {
        container.querySelector('#unpack-packs-list').innerHTML = `
          <div class="no-packs">
            <p>You don't own any packs yet!</p>
            <p>Acquire packs from drops or the marketplace to get started.</p>
          </div>
        `;
        return;
      }

      displayPacks(packs);

    } catch (error) {
      showStatus(`Failed to load packs: ${error.message}`, 'error');
    }
  }

  // Display packs
  function displayPacks(packs) {
    const packsList = container.querySelector('#unpack-packs-list');

    // Group by template_id
    const groupedPacks = {};
    packs.forEach(pack => {
      if (!groupedPacks[pack.template_id]) {
        groupedPacks[pack.template_id] = [];
      }
      groupedPacks[pack.template_id].push(pack);
    });

    packsList.innerHTML = Object.entries(groupedPacks).map(([templateId, packGroup]) => {
      const pack = packGroup[0];
      return `
        <div class="pack-card">
          <div class="pack-image">
            ${pack.image_url ?
              `<img src="${pack.image_url}" alt="${pack.name || 'Pack'}">` :
              `<div class="pack-placeholder">📦</div>`
            }
          </div>
          <div class="pack-info">
            <h4>${pack.name || `Pack #${templateId}`}</h4>
            <p class="pack-quantity">You own: ${packGroup.length}</p>
          </div>
          <div class="pack-actions">
            <button class="btn btn-primary" onclick="window.unpack_openPack('${packGroup[0].asset_id}', '${pack.name}')">
              Open Pack
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Open pack
  window.unpack_openPack = async function(assetId, packName) {
    try {
      showStatus('Requesting transaction data...', 'info');

      // Get transaction from backend
      const response = await fetch(`${API_URL}/api/user/unpack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: currentAccount,
          asset_id: assetId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unpack request failed');
      }

      showStatus('Please sign the transaction in your wallet...', 'info');

      // User signs transaction
      const result = await wax.api.transact(
        { actions: [data.action] },
        { blocksBehind: 3, expireSeconds: 30 }
      );

      showStatus(`✅ Pack opened successfully! Transaction: ${result.transaction_id}`, 'success');

      // Show link to claim assets
      setTimeout(() => {
        showStatus(`Pack opened! Now claim your rewards from the atomicpacksx contract.`, 'success');
      }, 2000);

      // Reload packs after 3 seconds
      setTimeout(loadPacks, 3000);

    } catch (error) {
      showStatus(`❌ Failed to open pack: ${error.message}`, 'error');
    }
  };

  // Show status message
  function showStatus(message, type = 'info') {
    const statusEl = container.querySelector('#unpack-status');
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
    statusEl.style.display = 'block';
  }

  // Setup event listeners
  container.querySelector('#unpack-connect-wallet').addEventListener('click', connectWallet);

  // Auto-connect if configured
  if (config.auto_connect && window.wax && window.currentAccount) {
    currentAccount = window.currentAccount;
    loadPacks();
  }
};
```

### Phase 5: Create Claim Unpack Module

Similar structure to unpack, but calls `atomicpacksx::claimassets` action.

### Phase 6: Create NeftyBlocks Drops Module

Simple embed wrapper:

```html
<!-- public/modules/nefty-drops.html -->
<div class="module-container nefty-drops-module">
  <div class="module-header">
    <h3>🎁 Special Drop</h3>
  </div>
  <div class="nefty-embed-container">
    <!-- Will be injected by JS -->
  </div>
</div>
```

```javascript
// public/modules/nefty-drops.js
window.init_nefty_drops = function(containerId, config = {}) {
  const container = document.getElementById(containerId);
  const dropId = config.drop_id;
  const collection = config.collection || 'futuresrelic';

  if (!dropId) {
    container.querySelector('.nefty-embed-container').innerHTML =
      '<p class="error">Drop ID not configured</p>';
    return;
  }

  const embedUrl = `https://neftyblocks.com/c/${collection}/drops/${dropId}`;

  container.querySelector('.nefty-embed-container').innerHTML = `
    <iframe
      src="${embedUrl}"
      width="100%"
      height="600px"
      frameborder="0"
      allow="clipboard-write">
    </iframe>
  `;
};
```

### Phase 7: Build Main Story Page

Create new `public/index.html` with story + embedded modules:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Future Relic - The Story Begins</title>
  <link rel="stylesheet" href="/styles/main.css">
  <link rel="stylesheet" href="/styles/modules.css">
</head>
<body>
  <!-- Navigation (add the nav code from above) -->
  <nav class="main-nav">...</nav>

  <!-- Main Story Container -->
  <div class="story-container">

    <!-- Chapter 1: The Beginning -->
    <section class="story-chapter">
      <div class="story-content">
        <h1>Chapter 1: The Awakening</h1>
        <img src="/images/chapter1-hero.jpg" alt="The Awakening" class="story-image">
        <p>
          In the year 2157, humanity discovered the Relics—mysterious artifacts
          scattered across the blockchain, each containing fragments of knowledge
          from a civilization long forgotten...
        </p>
        <p>
          Your journey begins here. To proceed, you must claim your starter pack
          and prove your worth to the Council of Keepers.
        </p>
      </div>

      <!-- Interactive Module: Claim Rewards -->
      <div class="story-module">
        <div
          id="chapter1-claim"
          data-module="claim-rewards"
          data-config='{"highlight_reward_id": 1, "auto_connect": false}'>
        </div>
      </div>
    </section>

    <!-- Chapter 2: Opening the Portal -->
    <section class="story-chapter">
      <div class="story-content">
        <h2>Chapter 2: The First Pack</h2>
        <img src="/images/chapter2-portal.jpg" alt="Portal" class="story-image">
        <p>
          With your starter pack in hand, you stand before the Portal of Revelation.
          The pack glows with ancient energy, waiting to reveal its secrets...
        </p>
        <p>
          Open your pack to discover what fate has chosen for you.
        </p>
      </div>

      <!-- Interactive Module: Unpack -->
      <div class="story-module">
        <div
          id="chapter2-unpack"
          data-module="unpack"
          data-config='{"pack_template_ids": [123456, 123457], "auto_connect": true}'>
        </div>
      </div>
    </section>

    <!-- Chapter 3: The Factory -->
    <section class="story-chapter">
      <div class="story-content">
        <h2>Chapter 3: The Forge of Creation</h2>
        <img src="/images/chapter3-factory.jpg" alt="Factory" class="story-image">
        <p>
          The materials you've gathered can be combined in the Ancient Forge.
          Legends speak of powerful artifacts that can only be created through
          the art of blending...
        </p>
      </div>

      <!-- Interactive Module: Factory Craft -->
      <div class="story-module">
        <div
          id="chapter3-craft"
          data-module="factory-craft"
          data-config='{"recipe_category": "beginner"}'>
        </div>
      </div>
    </section>

    <!-- Chapter 4: Special Drop -->
    <section class="story-chapter">
      <div class="story-content">
        <h2>Chapter 4: The Limited Offering</h2>
        <p>
          The Council has opened a special vault for a limited time.
          These rare artifacts are available only to those who act swiftly...
        </p>
      </div>

      <!-- Interactive Module: NeftyBlocks Drop -->
      <div class="story-module">
        <div
          id="chapter4-drop"
          data-module="nefty-drops"
          data-config='{"drop_id": "YOUR_DROP_ID", "collection": "futuresrelic"}'>
        </div>
      </div>
    </section>

  </div>

  <!-- Load module system -->
  <script src="/modules/module-loader.js"></script>

  <style>
    .story-container {
      max-width: 1200px;
      margin: 2rem auto;
      padding: 0 2rem;
    }

    .story-chapter {
      margin-bottom: 4rem;
      background: var(--card-bg);
      border-radius: 16px;
      padding: 2rem;
      border: 1px solid var(--border);
    }

    .story-content {
      margin-bottom: 2rem;
    }

    .story-content h1 {
      font-size: 2.5rem;
      color: var(--primary);
      margin-bottom: 1.5rem;
    }

    .story-content h2 {
      font-size: 2rem;
      color: var(--primary);
      margin-bottom: 1rem;
    }

    .story-content p {
      font-size: 1.1rem;
      line-height: 1.8;
      color: var(--text-primary);
      margin-bottom: 1rem;
    }

    .story-image {
      width: 100%;
      max-width: 800px;
      height: auto;
      border-radius: 12px;
      margin: 1.5rem 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .story-module {
      margin-top: 2rem;
      padding: 2rem;
      background: rgba(59, 130, 246, 0.05);
      border-radius: 12px;
      border: 2px dashed var(--primary);
    }
  </style>
</body>
</html>
```

### Phase 8: Create NeftyBlocks Recipe Extractor (Admin Tool)

**User wants**: Button in `admin-factory.html` to extract blend recipes from NeftyBlocks and auto-fill the factory form!

1. **Add to `public/admin-factory.html`**:

```html
<!-- Add this section at the top of the factory admin panel -->
<div class="nefty-extractor-section" style="background: rgba(147, 51, 234, 0.1); padding: 20px; border-radius: 12px; margin-bottom: 30px;">
  <h3>🎯 NeftyBlocks Recipe Extractor</h3>
  <p style="color: var(--text-secondary); margin-bottom: 15px;">
    Import a blend recipe from NeftyBlocks - paste the blend URL and we'll extract all the data for you!
  </p>

  <div style="display: flex; gap: 10px; align-items: center;">
    <input
      type="text"
      id="nefty-blend-url"
      placeholder="https://neftyblocks.com/c/futuresrelic/blends/12345"
      style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
    <button id="extract-nefty-recipe-btn" class="btn btn-primary" style="min-width: 150px;">
      🔍 Extract Recipe
    </button>
  </div>

  <div id="nefty-extract-status" style="margin-top: 10px; font-size: 0.9rem;"></div>

  <!-- Extracted data display -->
  <div id="nefty-extracted-data" style="display: none; margin-top: 20px; padding: 15px; background: var(--card-bg); border-radius: 8px;">
    <h4>Extracted Recipe Data:</h4>
    <div id="nefty-recipe-preview"></div>
    <button id="auto-fill-recipe-btn" class="btn btn-success" style="margin-top: 10px;">
      ✅ Auto-Fill Form with This Recipe
    </button>
  </div>
</div>
```

2. **Create extraction logic in `public/admin-factory.js`**:

```javascript
// NeftyBlocks Recipe Extractor
document.getElementById('extract-nefty-recipe-btn')?.addEventListener('click', async () => {
  const url = document.getElementById('nefty-blend-url').value.trim();
  const statusEl = document.getElementById('nefty-extract-status');
  const dataEl = document.getElementById('nefty-extracted-data');

  if (!url) {
    statusEl.innerHTML = '<span style="color: var(--error);">Please enter a NeftyBlocks blend URL</span>';
    return;
  }

  // Extract blend ID from URL
  const blendIdMatch = url.match(/blends\/(\d+)/);
  if (!blendIdMatch) {
    statusEl.innerHTML = '<span style="color: var(--error);">Invalid NeftyBlocks blend URL format</span>';
    return;
  }

  const blendId = blendIdMatch[1];
  statusEl.innerHTML = '<span style="color: var(--primary);">🔄 Fetching blend data from NeftyBlocks...</span>';

  try {
    // Call backend endpoint that fetches from NeftyBlocks API
    const response = await fetch(`${API_URL}/api/admin/extract-nefty-blend/${blendId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch blend data');
    }

    const blendData = await response.json();

    // Display extracted data
    displayExtractedRecipe(blendData);
    dataEl.style.display = 'block';
    statusEl.innerHTML = '<span style="color: var(--success);">✅ Recipe extracted successfully!</span>';

  } catch (error) {
    statusEl.innerHTML = `<span style="color: var(--error);">❌ Error: ${error.message}</span>`;
  }
});

function displayExtractedRecipe(blendData) {
  const previewEl = document.getElementById('nefty-recipe-preview');

  let html = '<div style="font-size: 0.95rem;">';

  // Recipe Name
  html += `<div style="margin-bottom: 10px;"><strong>Name:</strong> ${blendData.name || 'Unnamed Blend'}</div>`;

  // Ingredients
  html += '<div style="margin-bottom: 10px;"><strong>Ingredients:</strong></div>';
  html += '<ul style="margin-left: 20px; color: var(--text-secondary);">';
  blendData.ingredients.forEach(ing => {
    html += `<li>Template #${ing.template_id} - ${ing.name || 'Unknown'} (Quantity: ${ing.quantity})</li>`;
  });
  html += '</ul>';

  // Results
  html += '<div style="margin-bottom: 10px;"><strong>Results:</strong></div>';
  html += '<ul style="margin-left: 20px; color: var(--text-secondary);">';
  blendData.results.forEach(res => {
    html += `<li>Template #${res.template_id} - ${res.name || 'Unknown'} (Quantity: ${res.quantity})</li>`;
  });
  html += '</ul>';

  html += '</div>';
  previewEl.innerHTML = html;

  // Store data for auto-fill
  window.extractedNeftyRecipe = blendData;
}

// Auto-fill form with extracted recipe
document.getElementById('auto-fill-recipe-btn')?.addEventListener('click', () => {
  if (!window.extractedNeftyRecipe) return;

  const recipe = window.extractedNeftyRecipe;

  // Fill recipe name
  document.getElementById('recipe-name-input').value = recipe.name || '';

  // Fill ingredients
  document.getElementById('recipe-ingredients-input').value = JSON.stringify(recipe.ingredients, null, 2);

  // Fill results
  document.getElementById('recipe-results-input').value = JSON.stringify(recipe.results, null, 2);

  // Fill mode (default to mint if not specified)
  const modeSelect = document.getElementById('recipe-mode-select');
  if (modeSelect) {
    modeSelect.value = recipe.mode || 'mint';
  }

  // Scroll to form
  document.getElementById('recipe-name-input').scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Show success message
  showMessage('✅ Form auto-filled with NeftyBlocks recipe data! Review and save.', 'success');
});
```

3. **Backend: Add extraction endpoint to `server.js`**:

```javascript
// GET /api/admin/extract-nefty-blend/:blendId
app.get('/api/admin/extract-nefty-blend/:blendId', adminAuthMiddleware, async (req, res) => {
  try {
    const { blendId } = req.params;

    console.log(`📥 Extracting NeftyBlocks blend ${blendId}...`);

    // Fetch blend data from NeftyBlocks API
    const neftyResponse = await fetch(`https://neftyblocks.com/api/v1/blends/${blendId}`);

    if (!neftyResponse.ok) {
      return res.status(404).json({ error: 'Blend not found on NeftyBlocks' });
    }

    const neftyBlend = await neftyResponse.json();

    // Extract ingredients
    const ingredients = neftyBlend.ingredients?.map(ing => ({
      template_id: parseInt(ing.template_id),
      name: ing.template_data?.immutable_data?.name || null,
      quantity: parseInt(ing.amount || 1),
      effect: 'burn'  // NeftyBlocks always burns
    })) || [];

    // Extract results
    const results = neftyBlend.outputs?.map(out => ({
      template_id: parseInt(out.template_id),
      name: out.template_data?.immutable_data?.name || null,
      quantity: parseInt(out.amount || 1)
    })) || [];

    // Return formatted data ready for our factory
    res.json({
      name: neftyBlend.name || `Blend #${blendId}`,
      description: neftyBlend.description || null,
      ingredients: ingredients,
      results: results,
      mode: 'mint',  // Default to mint mode
      nefty_blend_id: blendId,
      extracted_at: new Date().toISOString()
    });

    console.log(`✅ Successfully extracted blend ${blendId} with ${ingredients.length} ingredients and ${results.length} results`);

  } catch (error) {
    console.error('❌ NeftyBlocks extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**What this does**:
- User pastes NeftyBlocks blend URL
- Backend calls NeftyBlocks API to fetch blend data
- Extracts: recipe name, ingredient template IDs + names + quantities, result template IDs + names + quantities
- Displays extracted data in preview
- "Auto-Fill" button populates the factory recipe form
- User reviews and saves to database

**NeftyBlocks API endpoints to use**:
- `GET https://neftyblocks.com/api/v1/blends/{blendId}` - Get blend details
- Returns ingredients, outputs, template data, etc.

### Phase 9: Create Main Page Builder (Admin Tool)

**User wants**: Visual tool to build the main story page with text, images, and module embeds!

1. **Create `public/admin-page-builder.html`**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Builder - Future Relic Admin</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <!-- Navigation -->
  <nav class="main-nav">
    <!-- Same nav as other pages -->
  </nav>

  <div class="container" style="max-width: 1400px; margin: 2rem auto; padding: 0 2rem;">
    <div style="display: flex; gap: 2rem;">

      <!-- Left Panel: Page Builder Controls -->
      <div style="flex: 1; max-width: 400px;">
        <div class="card">
          <h2>📝 Page Builder</h2>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">
            Build your story page by adding sections of text, images, and interactive modules.
          </p>

          <!-- Add Section Controls -->
          <div class="section-adder">
            <h3>Add New Section:</h3>

            <button class="add-section-btn" data-type="heading">
              📌 Add Heading
            </button>
            <button class="add-section-btn" data-type="text">
              📄 Add Text Paragraph
            </button>
            <button class="add-section-btn" data-type="image">
              🖼️ Add Image
            </button>
            <button class="add-section-btn" data-type="module">
              🧩 Add Interactive Module
            </button>

            <hr style="margin: 20px 0;">

            <!-- Module Selection -->
            <div id="module-selector" style="display: none;">
              <h4>Select Module Type:</h4>
              <select id="module-type-select" style="width: 100%; padding: 8px; margin-bottom: 10px;">
                <option value="claim-rewards">Claim Rewards</option>
                <option value="factory-craft">Factory Craft</option>
                <option value="blend-array">Blend Array</option>
                <option value="unpack">Unpack Packs</option>
                <option value="claim-unpack">Claim Unpack</option>
                <option value="nefty-drops">NeftyBlocks Drop</option>
              </select>
              <textarea id="module-config-input" placeholder='{"config": "value"}' style="width: 100%; min-height: 80px; font-family: monospace;"></textarea>
              <button id="confirm-module-btn" class="btn btn-primary">Add Module</button>
            </div>
          </div>

          <hr style="margin: 20px 0;">

          <!-- Page Actions -->
          <div class="page-actions">
            <button id="preview-page-btn" class="btn btn-secondary" style="width: 100%; margin-bottom: 10px;">
              👁️ Preview Page
            </button>
            <button id="save-page-btn" class="btn btn-success" style="width: 100%; margin-bottom: 10px;">
              💾 Save Page
            </button>
            <button id="export-html-btn" class="btn btn-primary" style="width: 100%;">
              📦 Export HTML
            </button>
          </div>
        </div>
      </div>

      <!-- Right Panel: Live Preview -->
      <div style="flex: 2;">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>👁️ Live Preview</h2>
            <button id="clear-preview-btn" class="btn btn-danger">Clear All</button>
          </div>

          <div id="page-preview" class="page-preview">
            <p style="color: var(--text-secondary); text-align: center; padding: 40px;">
              Your page content will appear here. Start adding sections!
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="/admin-page-builder.js"></script>
</body>
</html>
```

2. **Create `public/admin-page-builder.js`**:

```javascript
let pageContent = [];  // Array of content blocks

// Add section buttons
document.querySelectorAll('.add-section-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.getAttribute('data-type');

    if (type === 'module') {
      // Show module selector
      document.getElementById('module-selector').style.display = 'block';
    } else {
      addSection(type);
    }
  });
});

// Confirm module addition
document.getElementById('confirm-module-btn').addEventListener('click', () => {
  const moduleType = document.getElementById('module-type-select').value;
  const configText = document.getElementById('module-config-input').value;

  let config = {};
  try {
    config = configText ? JSON.parse(configText) : {};
  } catch (e) {
    alert('Invalid JSON config. Using empty config.');
  }

  addSection('module', { module_type: moduleType, config: config });

  // Reset
  document.getElementById('module-config-input').value = '';
  document.getElementById('module-selector').style.display = 'none';
});

function addSection(type, data = {}) {
  let content = '';

  switch (type) {
    case 'heading':
      content = prompt('Enter heading text:', 'Chapter Title');
      if (!content) return;
      pageContent.push({ type: 'heading', content: content });
      break;

    case 'text':
      content = prompt('Enter paragraph text:', 'Your story text here...');
      if (!content) return;
      pageContent.push({ type: 'text', content: content });
      break;

    case 'image':
      const imageUrl = prompt('Enter image URL:', '/images/chapter1.jpg');
      if (!imageUrl) return;
      const imageAlt = prompt('Enter image alt text:', 'Chapter Image');
      pageContent.push({ type: 'image', url: imageUrl, alt: imageAlt });
      break;

    case 'module':
      pageContent.push({ type: 'module', module_type: data.module_type, config: data.config });
      break;
  }

  renderPreview();
}

function renderPreview() {
  const preview = document.getElementById('page-preview');

  if (pageContent.length === 0) {
    preview.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Your page content will appear here. Start adding sections!</p>';
    return;
  }

  let html = '';

  pageContent.forEach((item, index) => {
    html += `<div class="preview-section" data-index="${index}" style="position: relative; margin-bottom: 20px; padding: 15px; border: 1px solid var(--border); border-radius: 8px;">`;

    // Delete button
    html += `<button class="delete-section-btn" onclick="deleteSection(${index})" style="position: absolute; top: 10px; right: 10px; background: var(--error); color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">🗑️ Delete</button>`;

    switch (item.type) {
      case 'heading':
        html += `<h2 style="color: var(--primary);">${item.content}</h2>`;
        break;

      case 'text':
        html += `<p style="font-size: 1.1rem; line-height: 1.8;">${item.content}</p>`;
        break;

      case 'image':
        html += `<img src="${item.url}" alt="${item.alt}" style="max-width: 100%; border-radius: 8px;">`;
        break;

      case 'module':
        html += `
          <div style="background: rgba(59, 130, 246, 0.1); padding: 20px; border-radius: 8px; border: 2px dashed var(--primary);">
            <strong>🧩 Interactive Module: ${item.module_type}</strong>
            <pre style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">${JSON.stringify(item.config, null, 2)}</pre>
          </div>
        `;
        break;
    }

    html += '</div>';
  });

  preview.innerHTML = html;
}

window.deleteSection = function(index) {
  if (confirm('Delete this section?')) {
    pageContent.splice(index, 1);
    renderPreview();
  }
};

// Clear all
document.getElementById('clear-preview-btn').addEventListener('click', () => {
  if (confirm('Clear all content?')) {
    pageContent = [];
    renderPreview();
  }
});

// Save page
document.getElementById('save-page-btn').addEventListener('click', async () => {
  if (pageContent.length === 0) {
    alert('Nothing to save!');
    return;
  }

  const pageName = prompt('Enter page name:', 'main-story');
  if (!pageName) return;

  try {
    const response = await fetch('/api/admin/save-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`
      },
      body: JSON.stringify({
        name: pageName,
        content: pageContent
      })
    });

    if (response.ok) {
      alert('✅ Page saved successfully!');
    } else {
      alert('❌ Failed to save page');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
});

// Export HTML
document.getElementById('export-html-btn').addEventListener('click', () => {
  if (pageContent.length === 0) {
    alert('Nothing to export!');
    return;
  }

  const html = generateHTML();

  // Download as file
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'index.html';
  a.click();
});

function generateHTML() {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Future Relic - Story</title>
  <link rel="stylesheet" href="/styles/main.css">
  <link rel="stylesheet" href="/styles/modules.css">
</head>
<body>
  <!-- Navigation -->
  <nav class="main-nav">
    <!-- Add navigation here -->
  </nav>

  <div class="story-container">
`;

  pageContent.forEach(item => {
    switch (item.type) {
      case 'heading':
        html += `    <h1>${item.content}</h1>\n`;
        break;

      case 'text':
        html += `    <p>${item.content}</p>\n`;
        break;

      case 'image':
        html += `    <img src="${item.url}" alt="${item.alt}" class="story-image">\n`;
        break;

      case 'module':
        const moduleId = `module-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        html += `    <div class="story-module">
      <div id="${moduleId}" data-module="${item.module_type}" data-config='${JSON.stringify(item.config)}'></div>
    </div>\n`;
        break;
    }
  });

  html += `  </div>

  <script src="/modules/module-loader.js"></script>
</body>
</html>`;

  return html;
}

function getAdminToken() {
  return localStorage.getItem('admin_token') || '';
}
```

3. **Backend: Add save page endpoint to `server.js`**:

```javascript
// POST /api/admin/save-page
app.post('/api/admin/save-page', adminAuthMiddleware, async (req, res) => {
  try {
    const { name, content } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content required' });
    }

    // Generate HTML
    const html = generatePageHTML(content);

    // Save to file
    const fs = require('fs').promises;
    const path = require('path');
    const filePath = path.join(__dirname, 'public', `${name}.html`);

    await fs.writeFile(filePath, html, 'utf8');

    console.log(`✅ Page saved: ${filePath}`);

    res.json({
      success: true,
      message: `Page saved as ${name}.html`,
      path: `/${name}.html`
    });

  } catch (error) {
    console.error('❌ Save page error:', error);
    res.status(500).json({ error: error.message });
  }
});

function generatePageHTML(content) {
  // Same logic as frontend generateHTML()
  // ... implementation ...
}
```

**What this does**:
- Drag-and-drop style page builder interface
- Add headings, paragraphs, images, and modules
- Live preview on the right side
- Rearrange/delete sections
- Save to database or export as HTML file
- User can build entire story page without touching code!

### Phase 10: Testing & Polish

1. **Test each module independently**
2. **Test all modules on main page**
3. **Test wallet connection across modules** (shared state)
4. **Test on mobile** (responsive design)
5. **Add loading states and error handling**
6. **Add transitions and animations**
7. **Test NeftyBlocks extractor with real blend URLs**
8. **Test page builder export and save**

## ⚠️ CRITICAL REQUIREMENTS

### DO NOT BREAK:

1. **Existing API endpoints** - All current endpoints must keep working
2. **Database schema** - No changes to tables or columns
3. **Authentication** - Admin tokens, rate limiting must stay
4. **Blockchain functions** - wax.js functions must not change behavior
5. **Scheduler** - Background worker must keep running
6. **Security** - LIVE queries, mint-first-record-after pattern

### MUST MAINTAIN:

1. **match_quantity logic** - Rewards system behavior
2. **Cooldown system** - Time-based restrictions
3. **JSON parsing** - For database fields
4. **Recurring actions** - Scheduler logic
5. **Rate limiting** - API protection
6. **Error handling** - All try-catch blocks

### CODE STYLE:

1. **Use existing patterns** - Follow current code style
2. **Comment critical sections** - Especially module initialization
3. **Handle errors gracefully** - User-friendly messages
4. **Mobile responsive** - All modules must work on mobile
5. **Accessibility** - Use semantic HTML, ARIA labels

## 📚 REFERENCE FILES (Read These!)

- `COMPLETE_API_WIKI.md` - Every endpoint, function, pattern
- `CRITICAL_LOGIC_CORRECTIONS.md` - Deep understanding of core logic
- `TRANSFER_FUNCTION_MISSING.md` - Missing function you may need
- `server.js` - All API endpoints (your source of truth)
- `wax.js` - All blockchain functions
- `database.js` - All database operations
- `scheduler.js` - Background worker logic

## 🎯 SUCCESS CRITERIA

You succeed when:

1. ✅ **Phase 0 complete**: Backup branch created and pushed
2. ✅ Main page loads with navigation bar
3. ✅ Story content displays with images
4. ✅ All 7 modules load and work independently:
   - Claim Rewards
   - Factory Craft
   - Blend Array (grid view)
   - Unpack
   - Claim Unpack
   - NeftyBlocks Drops
   - Blend Array (transfer + mint mode)
5. ✅ Wallet connection works across all modules
6. ✅ User can progress through story and complete actions
7. ✅ All existing pages still accessible via nav
8. ✅ Mobile responsive on all screen sizes
9. ✅ **NeftyBlocks Recipe Extractor works**:
   - Paste NeftyBlocks blend URL
   - Extracts ingredients, results, template names
   - Auto-fills factory form
   - User can review and save
10. ✅ **Page Builder works**:
    - Add headings, text, images, modules
    - Live preview updates
    - Save/export functionality
    - User can build pages without coding
11. ✅ Zero breaking changes to backend (all existing endpoints work)
12. ✅ All existing functionality still works (test claims, crafts, scheduler)
13. ✅ Code is clean, commented, maintainable
14. ✅ Documentation updated with new features

## 💬 COMMUNICATION STYLE

- **Be confident** - You know how to do this
- **Show progress** - Update user after each phase
- **Explain decisions** - Why you chose specific approaches
- **Ask for content** - You need story text and images from user
- **Test thoroughly** - Don't claim success until tested
- **Document changes** - Update wiki if needed

## 🚀 GET STARTED

1. Read COMPLETE_API_WIKI.md and CRITICAL_LOGIC_CORRECTIONS.md
2. Create module system (Phase 1)
3. Test with simple module
4. Extract existing features (Phases 2-3)
5. Build new unpack functionality (Phases 4-5)
6. Add NeftyBlocks embed (Phase 6)
7. Build main story page (Phase 7)
8. Test everything (Phase 8)
9. Report success with screenshots/links

## 📝 DELIVERABLES

When you're done, provide:

1. **Backup confirmation** - Verify backup branch exists and is pushed
2. **File structure** - List all new files created
3. **Module documentation** - How to use each module, including:
   - Claim Rewards
   - Factory Craft
   - Blend Array (both modes)
   - Unpack/Claim Unpack
   - NeftyBlocks Drops
4. **Configuration guide** - How user can customize story/modules
5. **NeftyBlocks Extractor guide** - How to extract and import blend recipes
6. **Page Builder guide** - How to use the visual page builder
7. **Testing report** - What you tested and results:
   - Each module independently
   - All modules on story page
   - NeftyBlocks extractor with real URLs
   - Page builder save/export
   - Existing features (claims, crafts, scheduler)
8. **Screenshots/Videos** - Show:
   - Working story page with embedded modules
   - NeftyBlocks extractor in action
   - Page builder interface
   - Blend array grid view
9. **API changes** - Document new endpoints added:
   - `/api/user/blend-array`
   - `/api/admin/extract-nefty-blend/:blendId`
   - `/api/admin/save-page`
   - `/api/user/unpack`
   - `/api/user/claim-unpack`
10. **Next steps** - Recommendations for improvement

---

## 🎯 QUICK SUMMARY FOR NEW CLAUDE

**What you're building**:
1. ✅ **Backup everything first** (Phase 0 - create backup branch)
2. 🎨 **Modular platform** - Convert existing features into reusable modules
3. 📖 **Story-driven interface** - Text + images + embedded interactive modules
4. 🧩 **7 different modules** - All existing features plus new blend array view
5. 🔧 **NeftyBlocks Recipe Extractor** - Button to import blend recipes from NeftyBlocks
6. 🛠️ **Visual Page Builder** - Admin tool to build story pages without coding
7. 🔄 **Blend Array (Transfer Mode)** - Alternative blend system using transfers instead of burns

**Critical rules**:
- ⚠️ **BACKUP FIRST** - Create backup branch before ANY changes
- ⚠️ **BREAK NOTHING** - All existing features must keep working
- ⚠️ **READ DOCS FIRST** - COMPLETE_API_WIKI.md and CRITICAL_LOGIC_CORRECTIONS.md
- ⚠️ **TEST THOROUGHLY** - Each module + existing features
- ⚠️ **USER DOESN'T CODE** - You do 100% of implementation

---

**Remember**: User doesn't code. You do ALL the implementation. Backup first. Break nothing. Make it beautiful. Make it work. Make the user proud! 🚀
