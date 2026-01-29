# Developer Notes - WAX NFT Rewards System

This document contains technical details and architectural decisions for developers working on this project.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Module System](#module-system)
3. [Wallet Management](#wallet-management)
4. [Unified Module](#unified-module)
5. [Common Pitfalls](#common-pitfalls)
6. [Best Practices](#best-practices)

---

## Architecture Overview

### Frontend Structure
```
/public
  /modules              # Modular components
    wallet-manager.js   # Global wallet connection manager
    unified-module-base.js  # Base class for modules
    unified-module.js   # Unified module dispatcher
    paid-claim.js       # Paid NFT sales module
    gated-paid-claim.js # Gated paid sales (requires verification)
    unpack.js           # Pack opening module
    blend-array.js      # NeftyBlocks blend executor
    factory-craft.js    # NFT crafting module
    transfer-mode.js    # NFT transfer module
    claim-rewards.js    # Free NFT claims (holder rewards)
    nefty-drop.js       # NeftyBlocks drop embed
  module-loader.js      # Dynamic module loading system
  site-builder.js       # Visual page builder
  /story               # User-created pages
```

### Backend Structure
```
/server
  server.js            # Main Express server
  db.js                # SQLite database setup
  /routes              # API endpoints
  /middleware          # Auth, rate limiting, etc.
```

---

## Module System

### How Modules Work

1. **HTML Pages** contain module placeholders:
```html
<div data-module="paid-claim" data-config='{"template_id":"12345"}'></div>
```

2. **Module Loader** (`module-loader.js`) scans for `[data-module]` elements and:
   - Loads the module's `.html` template
   - Loads the module's `.js` file
   - Calls the module's init function with config

3. **Module Init Functions** follow this pattern:
```javascript
window.init_module_name = function(containerId, config) {
  const container = document.getElementById(containerId);
  // Initialize module UI and logic
}
```

### Module Base Class Pattern

**New modules** (gated-paid-claim, claim-rewards, factory-craft, etc.) extend `UnifiedModuleBase`:

```javascript
class MyModule extends UnifiedModuleBase {
  constructor(containerId, config) {
    super(containerId, config);
  }

  async loadModuleData() {
    // Load data from API
  }

  renderContent() {
    // Render UI
  }
}
```

**Benefits:**
- Consistent wallet connection handling
- Built-in loading states
- Error handling
- Shared UI utilities

---

## Wallet Management

### WalletManager (Global Singleton)

**Location:** `/public/modules/wallet-manager.js`

**Purpose:** Centralized wallet connection and transaction management

**Key Features:**
1. **Auto-loading WaxJS Library**
   - Starts with lightweight `waxjs-simple.js` (60KB)
   - Dynamically loads full `waxjs.js` (351KB) when needed
   - Improves initial page load time

2. **Session Persistence**
   - Stores wallet state in localStorage
   - Auto-restores connections on page load
   - Supports both WCW and Anchor wallets

3. **Transaction Management**
   - `WalletManager.transact(actions, options)` - Execute blockchain transactions
   - Automatically loads full WaxJS if not already loaded
   - Handles both wallet types transparently

### API

```javascript
// Get current state
const state = window.WalletManager.getState();
// Returns: { account: 'user.wam', walletType: 'wcw' }

// Connect wallet
const account = await window.WalletManager.connect('wcw'); // or 'anchor'

// Execute transaction
const result = await window.WalletManager.transact([
  {
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{ actor: account, permission: 'active' }],
    data: { from: account, to: 'receiver', quantity: '1.00000000 WAX', memo: '' }
  }
], {
  blocksBehind: 3,
  expireSeconds: 90
});

// Disconnect
window.WalletManager.disconnect();
```

### CRITICAL: Always Use WalletManager

**❌ OLD WAY (Don't do this):**
```javascript
if (!wax) {
  throw new Error('WaxJS not loaded');
}
const result = await wax.api.transact({ actions }, { blocksBehind: 3 });
```

**✅ NEW WAY (Always do this):**
```javascript
if (!window.WalletManager) {
  throw new Error('WalletManager not initialized');
}
const result = await window.WalletManager.transact(actions, { blocksBehind: 3 });
```

**Why?**
- WalletManager handles both WCW and Anchor
- Auto-loads WaxJS library when needed
- Manages session state
- Consistent error handling

---

## Unified Module

### Concept

**Problem Solved:**
- Users had to choose from 10+ different module types in site builder
- Each module had duplicate wallet connection code
- Configuration was scattered across multiple modules

**Solution:**
- Single "Unified Module" with dropdown to select functionality
- Reuses existing module code (no duplication)
- Intelligent config panel (shows only relevant fields)

### How It Works

1. **User selects "Unified Module" in site builder**
2. **Chooses module type from dropdown**: paid-claim, unpack, factory-craft, etc.
3. **Config panel shows only relevant fields** for that type
4. **Unified module loads the appropriate sub-module** dynamically

### Architecture

```javascript
// unified-module.js acts as a dispatcher
window.init_unified_module = function(containerId, config) {
  const moduleType = config.module_type; // e.g., 'paid-claim'

  // Map module types to their files and init functions
  const moduleInfo = MODULE_INIT_FUNCTIONS[moduleType];
  // { init: 'init_paid_claim', file: 'paid-claim.js' }

  // Load the module file if needed
  if (moduleFile && !window[initFunctionName]) {
    const script = document.createElement('script');
    script.src = `/modules/${moduleFile}`;
    script.onload = () => {
      // Call the module's init function
      window[initFunctionName](containerId, config);
    };
    document.head.appendChild(script);
  }
}
```

### Site Builder Field Filtering

**File:** `/public/site-builder.js`

**Function:** `setupUnifiedModuleFieldFiltering()`

**How it works:**
1. Each field in unified module config has a label prefix: `[Paid Claim]`, `[NeftyDrop]`, etc.
2. When rendering config, add data attribute: `data-unified-field-type="paid-claim"`
3. Listen to module_type dropdown changes
4. Show/hide fields based on selected type

```javascript
// Example: Field labeled "[Paid Claim] Template ID"
// Gets attribute: data-unified-field-type="paid-claim"
// Shown when: module_type dropdown = "paid-claim"
// Hidden when: module_type dropdown = "nefty-drop"
```

---

## Common Pitfalls

### 1. Wallet Connection Errors

**Error:** "WaxJS wallet not initialized"

**Cause:** Module tries to use `wax` or `anchor` directly instead of WalletManager

**Fix:** Use `window.WalletManager.transact()` instead

### 2. Module Not Loading

**Error:** "Failed to load init_module_name after 10 seconds"

**Cause:** Module file not loaded or init function not exported

**Fix:** Ensure module file exports `window.init_module_name = function() {}`

### 3. Config Panel Shows All Fields

**Error:** Unified module config shows fields for all module types

**Cause:** Field filtering not set up or module_type dropdown not found

**Fix:** Ensure `setupUnifiedModuleFieldFiltering()` is called in `renderConfigPanel()`

### 4. Page Reload Loses Wallet Connection

**Cause:** Not checking WalletManager state on page load

**Fix:** Use auto_connect or check `WalletManager.getState()` in module init

---

## Best Practices

### Module Development

1. **Always extend UnifiedModuleBase for new modules**
   - Provides wallet connection handling
   - Consistent UI utilities
   - Error handling

2. **Use WalletManager for ALL wallet operations**
   - Never access `wax` or `anchor` directly
   - Let WalletManager handle library loading

3. **Follow naming conventions**
   - Module file: `module-name.js`
   - Init function: `window.init_module_name`
   - Template file: `module-name.html`

4. **Handle loading states**
   ```javascript
   showLoading('Loading data...');
   try {
     const data = await fetchData();
     renderContent(data);
   } catch (error) {
     showError(error.message);
   }
   ```

### Site Builder

1. **Label unified module fields with prefixes**
   - `[Paid Claim] Field Name` - Shows for paid-claim type
   - `[NeftyDrop] Field Name` - Shows for nefty-drop type
   - No prefix = always show

2. **Test all module types**
   - Select each module type in dropdown
   - Verify only relevant fields appear
   - Check config saves correctly

### Database

1. **Always use parameterized queries**
   ```javascript
   db.get('SELECT * FROM claims WHERE account = ?', [account]);
   ```

2. **Handle errors gracefully**
   ```javascript
   try {
     await db.run('INSERT INTO ...');
   } catch (error) {
     console.error('Database error:', error);
     return res.status(500).json({ error: 'Database error' });
   }
   ```

---

## Debugging

### Enable Verbose Logging

Check browser console for:
- `🔐 WalletManager` messages
- `📦 Module loader` messages
- `✅ Module initialized` confirmations

### Common Debug Commands

```javascript
// Check WalletManager state
window.WalletManager.getState()

// Check if module is loaded
window.init_paid_claim // Should be a function

// List all loaded modules
Object.keys(window).filter(k => k.startsWith('init_'))
```

### Testing Wallet Connections

1. Open DevTools Console
2. Try manual connection:
```javascript
await window.WalletManager.connect('wcw')
```
3. Check for errors

---

## Performance

### Optimization Strategies

1. **Lazy Load Modules**
   - Only load module JS when needed
   - Unified module handles dynamic loading

2. **WaxJS Auto-loading**
   - Start with 60KB lightweight version
   - Load full 351KB only for transactions
   - Reduces initial page load by ~290KB

3. **Cache API Responses**
   - Cache AtomicAssets API calls
   - Use localStorage for user preferences
   - Reduce redundant blockchain queries

---

## Security

### Private Keys

**NEVER:**
- Store private keys in frontend code
- Transmit private keys to backend
- Log private keys to console

**ALWAYS:**
- Keep WAX_PRIVATE_KEY in .env (backend only)
- Use user's wallet for signing (via WaxJS/Anchor)
- Verify transactions server-side

### Input Validation

**Frontend:**
```javascript
if (!templateId || !templateId.match(/^\d+$/)) {
  throw new Error('Invalid template ID');
}
```

**Backend:**
```javascript
if (typeof account !== 'string' || !account.match(/^[a-z1-5.]{1,12}$/)) {
  return res.status(400).json({ error: 'Invalid account name' });
}
```

---

## PWA Admin Panel

### Overview

**Location:** `/public/admin-pwa.html` and `/public/admin-pwa.js`

**Purpose:** Visual admin panel for managing Progressive Web App settings, icons, and theming

### Key Features

1. **PWA Manifest Configuration**
   - App name, short name, description
   - Start URL, theme color, background color
   - Configurable via UI, stored in SQLite config table

2. **Icon Generator (App Icons)**
   - Upload and edit app icons with visual editor
   - Supports scale, padding, background color, corner roundness
   - Generates 8 PWA icon sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
   - Files saved to `/public/icons/` directory
   - Endpoint: `POST /api/pwa/upload-icon`

3. **Favicon Generator (Separate Tool)**
   - Independent favicon editor with same controls as app icon editor
   - Generates 32x32 favicon.png with transparent background support
   - Allows different styling than app icons (e.g., app icons with background, favicon with transparency)
   - File saved to `/public/favicon.png`
   - Endpoint: `POST /api/pwa/upload-favicon`

4. **Color Theme System**
   - 8 built-in theme presets (Midnight Purple, Ocean Blue, Sakura Pink, etc.)
   - Customizable colors: primary, secondary, success, backgrounds
   - Gradient background controls (start color, end color, angle)
   - Dynamic CSS generation stored in database
   - Endpoint: `PUT /api/pwa/theme`

### Icon/Favicon Generation Workflow

**App Icons:**
1. User uploads image to icon editor
2. Adjusts scale, padding, background color, corner roundness
3. Canvas renders preview at 400x400
4. Click "Upload & Generate All Sizes"
5. Canvas converts to PNG blob
6. Backend generates 8 icon sizes using Sharp library
7. Files saved to `/public/icons/icon-{size}x{size}.png`

**Favicon (Separate):**
1. User uploads image to favicon editor (separate section)
2. Adjusts scale, padding, background color (default: transparent), corner roundness
3. Canvas renders preview at 400x400
4. Click "Generate Favicon"
5. Canvas converts to PNG blob
6. Backend generates 32x32 favicon.png using Sharp library
7. File saved to `/public/favicon.png`

### Implementation Details

**Frontend Variables:**
```javascript
// Icon editor
let selectedFile = null;
let originalIconImage = null;
let isTransparent = false;

// Favicon editor (separate)
let selectedFaviconFile = null;
let originalFaviconImage = null;
let isFaviconTransparent = true; // Default transparent for favicons
```

**Backend Endpoints:**
```javascript
// Generate app icons (8 sizes)
POST /api/pwa/upload-icon
  - Requires: 'icon' file in multipart form data
  - Generates: 8 PWA icon sizes (72-512px)
  - Returns: Array of generated icon paths

// Generate favicon (32x32 only)
POST /api/pwa/upload-favicon
  - Requires: 'favicon' file in multipart form data
  - Generates: 32x32 favicon.png
  - Returns: Favicon path
```

**Why Separate Icon and Favicon Generators?**
- App icons often look better with background colors
- Favicons look better with transparent backgrounds
- Different aesthetic requirements for different contexts
- Users can customize each independently

### Canvas Editor Functions

Both icon and favicon editors share similar canvas manipulation functions:

```javascript
// Shared between both editors
function drawRoundedRect(ctx, x, y, width, height, radius) {
  // Draws rounded rectangle with quadratic curves
}

// Icon editor specific
function updateIconEditor() {
  // Reads controls: scale, padding, radius, bgColor
  // Draws background (solid or transparent)
  // Draws icon with transformations
}

// Favicon editor specific (identical logic, different variables)
function updateFaviconEditor() {
  // Same as updateIconEditor but for favicon
}
```

### Database Schema (PWA Config)

Stored in `config` table:
- `pwa_app_name`, `pwa_short_name`, `pwa_description`
- `pwa_theme_color`, `pwa_background_color`
- `theme_primary`, `theme_secondary`, `theme_success`
- `theme_bg_dark`, `theme_bg_card`
- `theme_gradient_start`, `theme_gradient_end`, `theme_gradient_angle`

### Common Pitfalls

1. **Icon vs Favicon Confusion**
   - App icons go to `/public/icons/` (8 files)
   - Favicon goes to `/public/favicon.png` (1 file)
   - Don't mix them up!

2. **Transparent Background Issues**
   - App icons: Background color often desired for consistent branding
   - Favicon: Transparent background recommended for browser tab display
   - Use separate tools to set different backgrounds

3. **Canvas to Blob Conversion**
   - Always use `canvas.toBlob()` with callback or Promise
   - PNG format required for transparent backgrounds
   - Example:
   ```javascript
   const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
   ```

4. **File Upload Authentication**
   - All icon/favicon endpoints require admin JWT token
   - Include in Authorization header: `Bearer ${token}`

### Best Practices

1. **Icon Upload**
   - Use square images (512x512 or larger)
   - PNG format recommended for best quality
   - Test generated icons at different sizes

2. **Favicon Upload**
   - Keep design simple (displays at 32x32, very small)
   - Use transparent background for clean browser tab appearance
   - Avoid fine details that won't show at small size

3. **Theme Customization**
   - Test theme colors in live preview tab
   - Ensure good contrast between text and backgrounds
   - Gradient backgrounds optional (can set angle to 0 for solid color)

---

## Questions?

For issues or questions:
1. Check console for error messages
2. Review this DEV_NOTES.md
3. Check CHANGELOG.md for recent changes
4. Review module source code
5. Test in isolation (create minimal test page)

**Remember:** The user doesn't code - you do! Make them proud and don't break anything! 🚀
