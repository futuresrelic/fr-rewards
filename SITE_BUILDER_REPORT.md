# COMPREHENSIVE SITE-BUILDER SYSTEM REPORT
**Future Relic Rewards Platform**
**Generated:** January 23, 2026

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Saving Capabilities](#saving-capabilities)
4. [Module Catalog](#module-catalog)
5. [Authentication & Wallet Integration](#authentication--wallet-integration)
6. [Blockchain Contract Integrations](#blockchain-contract-integrations)
7. [Payment & Transaction Flow](#payment--transaction-flow)
8. [Module Construction Pattern](#module-construction-pattern)
9. [Technical Stack](#technical-stack)

---

## EXECUTIVE SUMMARY

The **Future Relic Site-Builder** is a sophisticated, no-code visual page creator designed for building custom WAX blockchain NFT interaction pages. The system provides a drag-and-drop interface for creating pages with 9 specialized modules covering all major NFT operations:

- **NFT Sales** (Paid Claims with WAX token)
- **Reward Claims** (Free minting with cooldowns)
- **Crafting System** (Multi-ingredient recipes with pool swaps)
- **Pack Unpacking** (AtomicPacksX integration)
- **Blending** (NeftyBlocks blend contract)
- **Drops** (Embedded NeftyBlocks drop widgets)
- **Transfers** (Batch NFT transfers)
- **Content Display** (Text and image blocks)

**Key Capabilities:**
- Dual wallet authentication (WAX Cloud Wallet + Anchor)
- Real-time blockchain asset checking
- Server-side transaction signing for secure minting
- Payment verification and recovery system
- Cooldown management (client + server persistence)
- Visual page builder with save/load functionality
- Custom CSS per page

---

## SYSTEM ARCHITECTURE

### Core Components

```
┌──────────────────────────────────────────────────────────────┐
│                    SITE BUILDER INTERFACE                     │
│                  /public/site-builder.html                    │
│                                                                │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Module       │  │   Canvas     │  │  Configuration   │  │
│  │  Gallery      │  │   Preview    │  │  Panel           │  │
│  │  (Left)       │  │  (Center)    │  │  (Right)         │  │
│  └───────────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                      MODULE LOADER                            │
│               /public/modules/module-loader.js                │
│                                                                │
│  Dynamically injects HTML templates and initializes JS        │
└────────────────────────────┬─────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │ HTML        │    │ JavaScript  │    │ Data Config │
  │ Template    │    │ Module      │    │ (JSON)      │
  │ (.html)     │    │ (.js)       │    │             │
  └─────────────┘    └─────────────┘    └─────────────┘
```

### File Structure

**Builder Core:**
- `/public/site-builder.html` - Builder UI (drag-and-drop interface)
- `/public/site-builder.js` - Builder logic (1,130 lines)
- `/public/modules/module-loader.js` - Dynamic module injection (312 lines)

**Shared Services:**
- `/public/modules/wallet-manager.js` - Wallet authentication singleton (307 lines)
- `/public/modules/config.js` - Global configuration
- `/server/wax.js` - Server-side blockchain interaction (244 lines)

**Module Files:**
```
/public/modules/
├── claim-rewards.html + claim-rewards.js (601 lines)
├── paid-claim.html + paid-claim.js (873 lines)
├── factory-craft.html + factory-craft.js (919 lines)
├── unpack.html + unpack.js (789 lines)
├── blend-array.html + blend-array.js (804 lines)
├── nefty-drop.html + nefty-drop.js (28 lines)
├── transfer-mode.html + transfer-mode.js (460 lines)
└── text-block, image-block (inline in site-builder.js)
```

### Module Initialization Pattern

Modules are embedded using data attributes:

```html
<div data-module="claim-rewards"
     data-config='{"auto_connect": true, "collection": "futuresrelic"}'></div>
```

The module loader:
1. Finds all `[data-module]` elements
2. Fetches corresponding HTML template
3. Injects template into container
4. Calls `window.init_{module_name}(containerId, config)`
5. Module initializes with scoped state

---

## SAVING CAPABILITIES

### Server-Side Page Management

**API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/page/save` | POST | Save page configuration to HTML file |
| `/api/page/load/:filepath` | GET | Load existing page for editing |
| `/api/page/create` | POST | Create new phase pages |

**Storage Format:**

```javascript
{
  filepath: "story/phase2.html",
  modules: [
    {
      id: 1,
      moduleType: "text-block",
      config: {
        heading: "Welcome to Phase 2",
        content: "<p>Story content...</p>",
        style: "narrative"
      }
    },
    {
      id: 2,
      moduleType: "claim-rewards",
      config: {
        collection: "futuresrelic",
        auto_connect: true
      }
    }
  ],
  customCSS: "/* Page-specific styles */"
}
```

### Features

**Auto-Save System:**
- Automatically saves when editing existing pages
- Triggered on module add/remove/reorder
- Triggered on configuration changes
- Status indicator shows save state

**Custom CSS Editor:**
- Live CSS editor with syntax highlighting
- Per-page custom styles
- Preview applies CSS in real-time
- Saved with page configuration

**Export/Import:**
- Download configuration as JSON file
- Import previously exported configurations
- Useful for backups and migration

**localStorage Backup:**
- Browser-based configuration persistence
- Prevents loss on accidental page close
- Auto-recovers unsaved changes

**Template System:**
- Pre-built page templates
- Story phase templates
- Quick-start configurations

---

## MODULE CATALOG

### 1. TEXT BLOCK MODULE

**Purpose:** Display formatted text content

**Configuration:**
```javascript
{
  heading: "Optional Heading",
  content: "<p>HTML content with <strong>formatting</strong></p>",
  style: "normal|narrative|alert|quote"
}
```

**Styles:**
- `normal` - Standard text block
- `narrative` - Story/lore formatting with special styling
- `alert` - Warning/important information box
- `quote` - Styled quotation block

**Use Cases:**
- Story chapters
- Instructions
- Announcements
- Lore content

---

### 2. IMAGE BLOCK MODULE

**Purpose:** Display images with captions

**Configuration:**
```javascript
{
  image_url: "https://example.com/image.png",
  alt_text: "Description for accessibility",
  caption: "Optional caption text",
  width: "auto|300px|500px|100%",
  alignment: "left|center|right"
}
```

**Features:**
- Responsive sizing
- Alignment control
- Accessibility support
- Optional captions

---

### 3. CLAIM REWARDS MODULE

**Purpose:** Free NFT claiming with cooldowns based on asset ownership

**Files:**
- `/public/modules/claim-rewards.html`
- `/public/modules/claim-rewards.js` (601 lines)

**Configuration:**
```javascript
{
  collection: "futuresrelic",
  auto_connect: true,                    // Auto-login on page load
  title: "Chapter Rewards",              // Custom heading
  show_only_reward_id: 5,                // Filter to specific reward
  highlight_reward_id: 3                 // Highlight specific reward
}
```

**Architecture:**

```
┌─────────────────┐
│   User Wallet   │
│                 │
│  Holds NFTs     │
└────────┬────────┘
         │
         │ 1. Check holdings
         ▼
┌─────────────────────────────┐
│  Backend Eligibility Check  │
│  /api/user/eligibility      │
│                             │
│  - Query AtomicAssets API   │
│  - Match whitelisted        │
│    templates                │
│  - Check cooldowns          │
│  - Return eligible rewards  │
└────────┬────────────────────┘
         │
         │ 2. Eligible rewards shown
         ▼
┌─────────────────┐
│  Claim Button   │
│  (Available)    │
└────────┬────────┘
         │
         │ 3. User clicks claim
         ▼
┌─────────────────────────────┐
│  POST /api/user/claim       │
│  {account, template_id,     │
│   reward_id}                │
└────────┬────────────────────┘
         │
         │ 4. Backend validates
         ▼
┌─────────────────────────────┐
│  Mint Wallet Signs TX       │
│  atomicassets::mintasset    │
│                             │
│  authorized_minter: mint    │
│  new_asset_owner: user      │
└────────┬────────────────────┘
         │
         │ 5. NFT minted to user
         ▼
┌─────────────────┐
│   User Wallet   │
│  +1 Reward NFT  │
└─────────────────┘
```

**Backend Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/eligibility/:account` | GET | Check holdings & return eligible rewards |
| `/api/user/claim` | POST | Mint single reward NFT |
| `/api/user/claim-all` | POST | Batch claim all eligible rewards |

**Cooldown System:**
- Cooldown durations configured per reward
- Stored in SQLite database (`user_claims` table)
- Frontend displays countdown timers
- Server validates cooldown before minting

**Database Schema:**
```sql
CREATE TABLE user_claims (
  account TEXT,
  template_id INTEGER,
  reward_id INTEGER,
  last_claim_time INTEGER,
  PRIMARY KEY (account, template_id, reward_id)
);
```

**Features:**
- Multiple rewards per template
- Visual reward cards with images
- Countdown timers
- Batch claim all
- Quantity display (owned NFTs)

---

### 4. PAID CLAIM MODULE

**Purpose:** NFT sales with WAX token payments

**Files:**
- `/public/modules/paid-claim.html`
- `/public/modules/paid-claim.js` (873 lines)

**Configuration:**
```javascript
{
  template_id: "123456",
  price_wax: "10.00000000",              // 8 decimal precision required
  payment_wallet: "futuresrelic",         // Receives WAX payments
  collection_name: "futuresrelic",
  template_name: "Epic Sword",
  template_image: "https://...",
  max_supply: 100,                        // Optional supply limit
  per_wallet_limit: 5,                    // Max purchases per wallet
  wallet_limit_cooldown: 24,              // Hours before wallet limit resets
  supply_limit_cooldown: 168,             // Hours before supply limit resets (weekly)
  auto_connect: false,
  show_purchase_history: true
}
```

**Payment & Minting Flow:**

```
┌─────────────────┐
│   User Wallet   │
└────────┬────────┘
         │
         │ 1. Transfer WAX
         │    eosio.token::transfer
         │    to: payment_wallet
         │    quantity: "10.00000000 WAX"
         │    memo: "NFT Purchase - Template 123456"
         ▼
┌──────────────────────┐
│   Payment Wallet     │
│   (futuresrelic)     │
└────────┬─────────────┘
         │
         │ 2. Frontend captures TX ID
         ▼
┌──────────────────────────────────┐
│  POST /api/user/purchase         │
│  {                               │
│    account: "user",              │
│    template_id: "123456",        │
│    tx_id: "abc123...",           │
│    quantity: 1                   │
│  }                               │
└────────┬─────────────────────────┘
         │
         │ 3. Backend verifies payment
         │    - Query blockchain for TX
         │    - Validate recipient, amount, memo
         │    - Check supply & wallet limits
         ▼
┌──────────────────────────────────┐
│  Verification Successful         │
└────────┬─────────────────────────┘
         │
         │ 4. Mint NFT to user
         ▼
┌──────────────────────────────────┐
│  Mint Wallet Signs TX            │
│  atomicassets::mintasset         │
│                                  │
│  authorized_minter: mint_wallet  │
│  new_asset_owner: user_wallet    │
│  template_id: 123456             │
│  quantity: 1                     │
└────────┬─────────────────────────┘
         │
         │ 5. NFT minted
         ▼
┌─────────────────┐
│   User Wallet   │
│  +1 Purchased   │
│     NFT         │
└─────────────────┘
```

**Backend Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/purchase` | POST | Verify payment & mint NFT |
| `/api/user/purchase/recover` | POST | Retry failed minting for valid payment |
| `/api/user/purchases/:account` | GET | Purchase history for account |

**Cooldown Management:**

**Client-Side (Immediate UI):**
```javascript
localStorage: cooldown_{template_id}_{account} = timestamp
```

**Server-Side (Enforcement):**
```sql
CREATE TABLE paid_claim_cooldowns (
  account TEXT,
  template_id TEXT,
  claim_count INTEGER,
  last_claim_time INTEGER,
  total_supply_count INTEGER,
  last_supply_reset INTEGER,
  PRIMARY KEY (account, template_id)
);
```

**Cooldown Types:**
1. **Wallet Limit** - Max purchases per wallet (resets after cooldown)
2. **Supply Limit** - Max total mints (resets weekly)

**Recovery System:**

If minting fails after valid payment:
1. Payment record stored in database
2. User can click "Retry Verification"
3. Backend re-checks blockchain for payment
4. If valid, retries minting
5. Admin panel for manual fulfillment

**Features:**
- Real-time supply tracking
- Purchase history display
- Cooldown timers
- Responsive pricing display
- Auto-retry on network errors
- Payment verification

---

### 5. FACTORY CRAFT MODULE

**Purpose:** Multi-ingredient NFT crafting with recipes

**Files:**
- `/public/modules/factory-craft.html`
- `/public/modules/factory-craft.js` (919 lines)

**Configuration:**
```javascript
{
  collection: "futuresrelic",
  show_category: "Weapons",              // Filter by category
  show_recipe_id: 5,                     // Show specific recipe only
  auto_connect: true
}
```

**Architecture:**

```
┌──────────────────────────────────────┐
│        Recipe Categories             │
│  - Weapons                           │
│  - Armor                             │
│  - Tools                             │
└────────┬─────────────────────────────┘
         │
         │ User selects category
         ▼
┌──────────────────────────────────────┐
│        Recipe List                   │
│                                      │
│  Recipe: Epic Sword                  │
│  ┌────────────────────────────────┐ │
│  │ Ingredients:                   │ │
│  │  - 3x Iron Ore                 │ │
│  │  - 1x Gem                      │ │
│  │                                │ │
│  │ Result:                        │ │
│  │  - 1x Epic Sword               │ │
│  │                                │ │
│  │ [Pool Available: 5]            │ │
│  └────────────────────────────────┘ │
└────────┬─────────────────────────────┘
         │
         │ User selects quantity & mode
         ▼
┌──────────────────────────────────────┐
│      Crafting Mode Selection         │
│                                      │
│  ○ Mint Mode (Full ingredients)     │
│    - User gets NEW NFT               │
│    - Higher ingredient cost          │
│                                      │
│  ● Swap Mode (Reduced ingredients)  │
│    - User gets pooled NFT            │
│    - Lower ingredient cost           │
│    - Faster                          │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│         MINT MODE FLOW               │
└────────┬─────────────────────────────┘
         │
         │ 1. User transfers ingredients
         │    atomicassets::transfer
         │    to: transfer_wallet
         │    asset_ids: [selected ingredients]
         ▼
┌──────────────────────────────────────┐
│  POST /api/factory/craft             │
│  {                                   │
│    account: "user",                  │
│    recipe_id: 5,                     │
│    mode: "mint",                     │
│    batch_count: 2                    │
│  }                                   │
└────────┬─────────────────────────────┘
         │
         │ 2. Backend verifies ingredients
         │    - Check blockchain for transfers
         │    - Validate correct templates
         │    - Validate quantities
         ▼
┌──────────────────────────────────────┐
│  Mint Wallet Signs TX                │
│  atomicassets::mintasset             │
│  quantity: 2                         │
└────────┬─────────────────────────────┘
         │
         │ 3. Results minted to user
         ▼
┌─────────────────┐
│   User Wallet   │
│  +2 Epic Swords │
└─────────────────┘

         ┌───────────────────────────────┐
         │      SWAP MODE FLOW           │
         └────────┬──────────────────────┘
                  │
                  │ 1. User transfers REDUCED ingredients
                  │    atomicassets::transfer
                  │    to: transfer_wallet
                  ▼
         ┌──────────────────────────────┐
         │  Backend verifies receipt    │
         └────────┬─────────────────────┘
                  │
                  │ 2. Pool wallet transfers result
                  │    atomicassets::transfer
                  │    from: pool_wallet
                  │    to: user_wallet
                  ▼
         ┌─────────────────┐
         │   User Wallet   │
         │  +1 Epic Sword  │
         │  (from pool)    │
         └─────────────────┘
```

**Backend Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/factory/categories` | GET | List recipe categories |
| `/api/factory/recipes` | GET | Get recipes with asset checking |
| `/api/factory/recipe-assets` | GET | Optimized asset fetching for crafting |
| `/api/factory/craft` | POST | Execute craft (mint or swap mode) |
| `/api/factory/pool-inventory/:recipe_id` | GET | Check pool availability |

**Mint Number Optimization:**

The system automatically selects HIGH mint numbers to preserve low mints:

```javascript
// Auto-sorts by mint number descending
assets.sort((a, b) => {
  const mintA = parseInt(a.template_mint) || 0;
  const mintB = parseInt(b.template_mint) || 0;
  return mintB - mintA;  // Higher mints first
});
```

**Pool System:**

Pre-minted results stored in pool wallet offer:
- **Reduced ingredient cost** (e.g., 2 instead of 3)
- **Faster execution** (transfer vs minting)
- **Cheaper for users**

**Features:**
- Category-based organization
- Batch crafting (craft multiple at once)
- Asset preview with images
- Ingredient requirement display
- Pool availability indicators
- Mint number preservation
- Real-time asset checking

---

### 6. UNPACK MODULE

**Purpose:** Unpack mystery packs using AtomicPacksX contract

**Files:**
- `/public/modules/unpack.html`
- `/public/modules/unpack.js` (789 lines)

**Configuration:**
```javascript
{
  collection: "futuresrelic",
  template_id: "204194",                 // Filter specific pack type
  auto_connect: true
}
```

**Unpacking Flow:**

```
┌─────────────────┐
│   User Wallet   │
│                 │
│  Holds Packs    │
└────────┬────────┘
         │
         │ 1. User selects pack(s) to unpack
         │
         │ 2. Transfer to atomicpacksx
         │    atomicassets::transfer
         │    from: user_wallet
         │    to: atomicpacksx
         │    asset_ids: [pack_id]
         │    memo: "unbox"
         ▼
┌──────────────────────────────────┐
│     atomicpacksx Contract        │
│                                  │
│  - Receives pack                 │
│  - Rolls pack contents           │
│  - Creates unboxed state         │
│  - Stores in contract tables     │
└────────┬─────────────────────────┘
         │
         │ 3. Pack opened (rolls generated)
         │
         │ 4. User must claim results
         │    atomicpacksx::claimunboxed
         │    pack_asset_id: pack_id
         │    origin_roll_ids: [roll1, roll2, ...]
         ▼
┌──────────────────────────────────┐
│  Contract transfers results      │
│  to user wallet                  │
└────────┬─────────────────────────┘
         │
         │ 5. Assets received
         ▼
┌─────────────────┐
│   User Wallet   │
│  +NFTs from     │
│   pack          │
└─────────────────┘
```

**Contract Actions:**

**1. Unpack (User signs):**
```javascript
{
  account: 'atomicassets',
  name: 'transfer',
  authorization: [{ actor: userAccount, permission: 'active' }],
  data: {
    from: userAccount,
    to: 'atomicpacksx',
    asset_ids: [packAssetId],
    memo: 'unbox'
  }
}
```

**2. Claim (User signs):**
```javascript
{
  account: 'atomicpacksx',
  name: 'claimunboxed',
  authorization: [{ actor: userAccount, permission: 'active' }],
  data: {
    pack_asset_id: packAssetId,
    origin_roll_ids: [rollId1, rollId2, ...]
  }
}
```

**Backend Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/claimable-packs/:account` | GET | Check for unpacked packs ready to claim |
| `/api/pack/roll-count/:template_id` | GET | Get number of rolls per pack |
| `/api/pack/unboxed-rolls/:pack_id` | GET | Get contents of unpacked pack |

**Backend Contract Queries:**

```javascript
// Check for claimable packs
rpc.get_table_rows({
  code: 'atomicpacksx',
  scope: 'atomicpacksx',
  table: 'unboxpacks',
  index_position: 2,
  key_type: 'name',
  lower_bound: account,
  upper_bound: account
})
```

**Features:**
- Auto-detects claimable packs
- Shows roll count per pack
- Batch unpacking
- Displays claimed results with images
- Multi-retry for API sync delays

---

### 7. BLEND ARRAY MODULE

**Purpose:** Execute NeftyBlocks blends

**Files:**
- `/public/modules/blend-array.html`
- `/public/modules/blend-array.js` (804 lines)

**Configuration:**
```javascript
{
  collection: "futuresrelic",
  blend_ids: "12345,67890",              // Comma-separated blend IDs
  auto_connect: true
}
```

**Blending Flow:**

```
┌─────────────────┐
│   User Wallet   │
│                 │
│  Holds blend    │
│  ingredients    │
└────────┬────────┘
         │
         │ 1. User selects blend
         │
         │ 2. Backend fetches blend data
         │    POST /api/blends/analyze
         │    Queries blend.nefty contract tables
         ▼
┌──────────────────────────────────┐
│     Blend Configuration          │
│                                  │
│  Blend ID: 12345                 │
│  Ingredients:                    │
│   - 1x Template 111              │
│   - 2x Template 222              │
│                                  │
│  Results (with probability):     │
│   - 50%: Common Result           │
│   - 30%: Rare Result             │
│   - 20%: Epic Result             │
└────────┬─────────────────────────┘
         │
         │ 3. User selects ingredients
         │    (auto-selects high mints)
         │
         │ 4. Execute 3-action transaction
         ▼
┌──────────────────────────────────┐
│  Action 1: announcedepo          │
│  blend.nefty::announcedepo       │
│  {                               │
│    owner: user,                  │
│    count: asset_count            │
│  }                               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Action 2: Transfer Assets       │
│  atomicassets::transfer          │
│  {                               │
│    from: user,                   │
│    to: "blend.nefty",            │
│    asset_ids: [selected],        │
│    memo: "deposit"               │
│  }                               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Action 3: Execute Blend         │
│  blend.nefty::nosecfuse          │
│  {                               │
│    claimer: user,                │
│    blend_id: 12345,              │
│    own_assets: [],               │
│    transferred_assets: [ids]     │
│  }                               │
└────────┬─────────────────────────┘
         │
         │ 5. Blend executed
         │    Result randomly selected
         │    Result NFT minted to user
         ▼
┌─────────────────┐
│   User Wallet   │
│  +1 Blend       │
│     Result      │
└─────────────────┘
```

**Backend Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/blends/analyze` | POST | Fetch blend schemas from blockchain |

**Contract Table Queries:**

```javascript
// Fetch blend configuration
rpc.get_table_rows({
  code: 'blend.nefty',
  scope: 'blend.nefty',
  table: 'blends',
  lower_bound: blendId,
  upper_bound: blendId
})

// Returns:
{
  blend_id: 12345,
  collection_name: "futuresrelic",
  ingredients: [
    { template_id: 111, amount: 1 },
    { template_id: 222, amount: 2 }
  ],
  results: [
    { template_id: 333, odds: 50 },   // 50% probability
    { template_id: 444, odds: 30 },   // 30% probability
    { template_id: 555, odds: 20 }    // 20% probability
  ]
}
```

**Features:**
- Auto-fetches blend data from blockchain
- Displays ingredient requirements
- Shows probability for each result
- Auto-selects high mint numbers
- Displays newly blended result
- Batch blending support

---

### 8. NEFTY DROP MODULE

**Purpose:** Embed NeftyBlocks drop widgets

**Files:**
- `/public/modules/nefty-drop.html`
- `/public/modules/nefty-drop.js` (28 lines)

**Configuration:**
```javascript
{
  collection: "futuresrelic",
  drop_id: "229014",
  limit: "1"
}
```

**Architecture:**

Uses NeftyBlocks Web Component CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@neftyblocks/drops@latest" type="module"></script>

<neftyblocks-drops
  collection="futuresrelic"
  limit="1"
  options='{"ids": "229014"}'
></neftyblocks-drops>
```

**Features:**
- Native NeftyBlocks UI
- Built-in payment processing
- Automatic WAX integration
- No custom backend needed

---

### 9. TRANSFER MODE MODULE

**Purpose:** Batch NFT transfers to other accounts

**Files:**
- `/public/modules/transfer-mode.html`
- `/public/modules/transfer-mode.js` (460 lines)

**Configuration:**
```javascript
{
  collection: "",                        // Optional collection filter
  auto_connect: true
}
```

**Transfer Flow:**

```
┌─────────────────┐
│   User Wallet   │
│                 │
│  Selects assets │
│  to transfer    │
└────────┬────────┘
         │
         │ 1. User selects NFTs
         │    (batch selection supported)
         │
         │ 2. User enters recipient account
         │    + optional memo
         │
         │ 3. Sign transaction
         │    atomicassets::transfer
         │    from: user
         │    to: recipient
         │    asset_ids: [selected]
         │    memo: "custom message"
         ▼
┌──────────────────────┐
│  Recipient Wallet    │
│  Receives NFTs       │
└──────────────────────┘
```

**Features:**
- Batch asset selection
- Collection filtering
- Custom memo support
- Select all / Clear selection
- WAX account validation
- Visual asset preview

---

## AUTHENTICATION & WALLET INTEGRATION

### Global Wallet Manager

**File:** `/public/modules/wallet-manager.js` (307 lines)

**Architecture:**
Singleton pattern providing shared wallet state across all modules.

```javascript
window.WalletManager = {
  init: function() { /* Initialize libraries */ },
  connect: function(walletType) { /* Connect wallet */ },
  disconnect: function() { /* Disconnect wallet */ },
  transact: function(actions, options) { /* Sign transaction */ },
  subscribe: function(callback) { /* Subscribe to state changes */ },
  getState: function() { /* Get current state */ }
};
```

### Supported Wallets

**1. WAX Cloud Wallet (WCW)**

**Library:** WaxJS
```html
<script src="https://cdn.jsdelivr.net/npm/@waxio/waxjs@1.0.0/dist/waxjs.min.js"></script>
```

**Initialization:**
```javascript
const wax = new waxjs.WaxJS({
  rpcEndpoint: 'https://wax.greymass.com',
  tryAutoLogin: true
});
```

**Login:**
```javascript
await wax.login();  // Opens WCW popup
const account = wax.userAccount;
```

**2. Anchor Wallet**

**Library:** Anchor Link
```html
<script src="https://cdn.jsdelivr.net/npm/anchor-link@3.4.3/dist/anchor-link.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/anchor-link-browser-transport@3.4.3/dist/anchor-link-browser-transport.min.js"></script>
```

**Initialization:**
```javascript
const transport = new AnchorLinkBrowserTransport();
const link = new AnchorLink({
  transport,
  chains: [{
    chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    nodeUrl: 'https://wax.greymass.com'
  }]
});
```

**Login:**
```javascript
const identity = await link.login('futuresrelic');
const account = identity.session.auth.actor.toString();
```

### Session Management

**localStorage Keys:**
```javascript
wax_account_shared: "useraccount"    // Logged-in account
wax_wallet_shared: "wcw|anchor"      // Wallet type
```

**Auto-Login:**
- On page load, checks localStorage for saved session
- Automatically restores wallet connection
- Triggers `accountConnected` event for modules

### Module Subscription Pattern

Each module subscribes to wallet events:

```javascript
window.WalletManager.subscribe((account, walletType) => {
  if (account) {
    // User connected
    currentAccount = account;
    loadModuleData();
  } else {
    // User disconnected
    currentAccount = null;
    showLoginPrompt();
  }
});
```

### Transaction Signing

**Unified API:**
```javascript
await window.WalletManager.transact(actions, {
  blocksBehind: 3,
  expireSeconds: 30
});
```

**Actions Format:**
```javascript
const actions = [
  {
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{
      actor: currentAccount,
      permission: 'active'
    }],
    data: {
      from: currentAccount,
      to: 'futuresrelic',
      quantity: '10.00000000 WAX',
      memo: 'Purchase NFT'
    }
  }
];
```

---

## BLOCKCHAIN CONTRACT INTEGRATIONS

### 1. AtomicAssets (atomicassets)

**Contract:** `atomicassets`

**Actions Used:**

**mintasset (Server-side only)**
```javascript
{
  account: 'atomicassets',
  name: 'mintasset',
  authorization: [{ actor: mintWallet, permission: 'active' }],
  data: {
    authorized_minter: mintWallet,
    collection_name: 'futuresrelic',
    schema_name: 'schema',
    template_id: templateId,
    new_asset_owner: userAccount,
    immutable_data: [],
    mutable_data: [],
    tokens_to_back: []
  }
}
```

**transfer (User-side)**
```javascript
{
  account: 'atomicassets',
  name: 'transfer',
  authorization: [{ actor: userAccount, permission: 'active' }],
  data: {
    from: userAccount,
    to: recipientAccount,
    asset_ids: [assetId1, assetId2],
    memo: 'Transfer memo'
  }
}
```

**API Queries:**
```javascript
// Fetch user assets
GET https://aa-wax-public1.neftyblocks.com/atomicassets/v1/assets
  ?owner={account}
  &collection_name={collection}
  &template_id={template_id}
```

---

### 2. AtomicPacksX (atomicpacksx)

**Contract:** `atomicpacksx`

**Actions Used:**

**Unpack Flow (User-side):**
```javascript
// Step 1: Transfer pack to contract
{
  account: 'atomicassets',
  name: 'transfer',
  data: {
    from: userAccount,
    to: 'atomicpacksx',
    asset_ids: [packAssetId],
    memo: 'unbox'
  }
}

// Step 2: Claim unpacked assets
{
  account: 'atomicpacksx',
  name: 'claimunboxed',
  data: {
    pack_asset_id: packAssetId,
    origin_roll_ids: [rollId1, rollId2, ...]
  }
}
```

**Table Queries (Backend):**
```javascript
// Check for unboxed packs
rpc.get_table_rows({
  code: 'atomicpacksx',
  scope: 'atomicpacksx',
  table: 'unboxpacks',
  index_position: 2,
  key_type: 'name',
  lower_bound: account,
  upper_bound: account
})

// Get pack configuration
rpc.get_table_rows({
  code: 'atomicpacksx',
  scope: collection,
  table: 'packs',
  lower_bound: templateId,
  upper_bound: templateId
})
```

---

### 3. NeftyBlocks Blend (blend.nefty)

**Contract:** `blend.nefty`

**Actions Used (3-action transaction):**

```javascript
// Action 1: Announce deposit
{
  account: 'blend.nefty',
  name: 'announcedepo',
  data: {
    owner: userAccount,
    count: assetCount
  }
}

// Action 2: Transfer assets
{
  account: 'atomicassets',
  name: 'transfer',
  data: {
    from: userAccount,
    to: 'blend.nefty',
    asset_ids: ingredientAssetIds,
    memo: 'deposit'
  }
}

// Action 3: Execute blend
{
  account: 'blend.nefty',
  name: 'nosecfuse',
  data: {
    claimer: userAccount,
    blend_id: blendId,
    own_assets: [],
    transferred_assets: ingredientAssetIds
  }
}
```

**Table Queries (Backend):**
```javascript
// Fetch blend configuration
rpc.get_table_rows({
  code: 'blend.nefty',
  scope: 'blend.nefty',
  table: 'blends',
  lower_bound: blendId,
  upper_bound: blendId
})

// Returns blend schema with ingredients and results
```

**Blend Schema:**
```javascript
{
  blend_id: 12345,
  collection_name: "futuresrelic",
  max: 100,                              // Max blends
  use_count: 50,                         // Current use count
  ingredients: [
    {
      template_id: 111,
      amount: 1,
      effect: { type: 0 }                // Normal ingredient
    }
  ],
  results: [
    {
      template_id: 333,
      odds: 50,                          // 50% chance
      amount: 1
    }
  ]
}
```

---

### 4. eosio.token

**Contract:** `eosio.token`

**Actions Used:**

**transfer (User-side payment)**
```javascript
{
  account: 'eosio.token',
  name: 'transfer',
  authorization: [{ actor: userAccount, permission: 'active' }],
  data: {
    from: userAccount,
    to: paymentWallet,
    quantity: '10.00000000 WAX',         // MUST be 8 decimals
    memo: 'NFT Purchase - Template 123456'
  }
}
```

**CRITICAL: WAX Token Precision**
- WAX token REQUIRES exactly **8 decimal places**
- ✅ Correct: `"10.00000000 WAX"`
- ❌ Wrong: `"10.0 WAX"`, `"10 WAX"`, `"10.000 WAX"`

---

## PAYMENT & TRANSACTION FLOW

### End-to-End Payment Process

**Complete flow for Paid Claim module:**

```
┌────────────────────────────────────────────────────────────────┐
│ PHASE 1: USER INITIATES PURCHASE                               │
└────────────────────────────────────────────────────────────────┘

User clicks "Purchase" button
         │
         ▼
┌──────────────────────────────────┐
│  Frontend: Show purchase modal   │
│  - Template name                 │
│  - Price: 10.00000000 WAX        │
│  - Confirm button                │
└────────┬─────────────────────────┘
         │
         │ User confirms
         ▼
┌──────────────────────────────────┐
│  Frontend: Sign WAX transfer     │
│  WalletManager.transact([{       │
│    account: 'eosio.token',       │
│    name: 'transfer',             │
│    data: {                       │
│      from: 'useraccount',        │
│      to: 'futuresrelic',         │
│      quantity: '10.00000000 WAX',│
│      memo: 'NFT - Template 123'  │
│    }                             │
│  }])                             │
└────────┬─────────────────────────┘
         │
         │ User signs in wallet
         ▼
┌──────────────────────────────────┐
│  Blockchain: TX broadcasted      │
│  transaction_id: "abc123..."     │
└────────┬─────────────────────────┘
         │
         ▼

┌────────────────────────────────────────────────────────────────┐
│ PHASE 2: PAYMENT VERIFICATION                                  │
└────────────────────────────────────────────────────────────────┘

Frontend captures TX ID
         │
         ▼
┌──────────────────────────────────┐
│  POST /api/user/purchase         │
│  {                               │
│    account: 'useraccount',       │
│    template_id: '123456',        │
│    tx_id: 'abc123...',           │
│    quantity: 1                   │
│  }                               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Backend: Verify transaction     │
│  1. Query blockchain for TX      │
│  2. Validate:                    │
│     ✓ Recipient = payment_wallet │
│     ✓ Amount = expected price    │
│     ✓ Token = WAX                │
│  3. Check cooldowns              │
│  4. Check supply limits          │
└────────┬─────────────────────────┘
         │
         │ Verification successful
         ▼

┌────────────────────────────────────────────────────────────────┐
│ PHASE 3: NFT MINTING                                           │
└────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐
│  Backend: Sign mint transaction  │
│  (Server-side with mint wallet)  │
│                                  │
│  wax.mintAsset(                  │
│    recipientAccount: 'user',     │
│    templateId: '123456',         │
│    quantity: 1                   │
│  )                               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Blockchain: atomicassets        │
│  ::mintasset                     │
│                                  │
│  authorized_minter: mint_wallet  │
│  new_asset_owner: 'useraccount'  │
│  template_id: 123456             │
└────────┬─────────────────────────┘
         │
         │ NFT minted
         ▼
┌──────────────────────────────────┐
│  Backend: Update database        │
│  - Record purchase               │
│  - Update cooldown               │
│  - Increment supply counter      │
└────────┬─────────────────────────┘
         │
         │ Return success
         ▼
┌──────────────────────────────────┐
│  Frontend: Show success          │
│  - Display minted NFT            │
│  - Update cooldown timer         │
│  - Refresh purchase history      │
└──────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ERROR HANDLING: RECOVERY SYSTEM                                │
└────────────────────────────────────────────────────────────────┘

If minting fails after valid payment:
         │
         ▼
┌──────────────────────────────────┐
│  Backend: Store failed purchase  │
│  Database record:                │
│  - account                       │
│  - template_id                   │
│  - tx_id                         │
│  - status: 'pending_mint'        │
│  - timestamp                     │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Frontend: Show recovery button  │
│  "Retry Verification"            │
└────────┬─────────────────────────┘
         │
         │ User clicks retry
         ▼
┌──────────────────────────────────┐
│  POST /api/user/purchase/recover │
│  {                               │
│    account: 'useraccount',       │
│    tx_id: 'abc123...'            │
│  }                               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Backend: Re-verify & retry mint │
│  - Check blockchain again        │
│  - If valid, retry minting       │
│  - Update database status        │
└────────┬─────────────────────────┘
         │
         │ Retry successful
         ▼
┌──────────────────────────────────┐
│  NFT finally minted to user      │
└──────────────────────────────────┘
```

### Server-Side Transaction Signing

**Backend Configuration (`/server/wax.js`):**

```javascript
const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');

// Initialize RPC
const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

// Initialize signature provider with private key
const signatureProvider = new JsSignatureProvider([
  process.env.WAX_PRIVATE_KEY  // Mint wallet private key
]);

// Initialize API
const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder()
});

// Mint function
async function mintAsset(recipientAccount, templateId, quantity = 1) {
  const actions = [{
    account: 'atomicassets',
    name: 'mintasset',
    authorization: [{
      actor: process.env.WAX_ACCOUNT,
      permission: 'active'
    }],
    data: {
      authorized_minter: process.env.WAX_ACCOUNT,
      collection_name: 'futuresrelic',
      schema_name: 'schema',
      template_id: templateId,
      new_asset_owner: recipientAccount,
      immutable_data: [],
      mutable_data: [],
      tokens_to_back: []
    }
  }];

  return await api.transact({ actions }, {
    blocksBehind: 3,
    expireSeconds: 30
  });
}
```

**Environment Variables:**
```env
WAX_PRIVATE_KEY=5K...                    # Mint wallet private key
WAX_ACCOUNT=futuresrelic                 # Mint wallet account name
```

---

## MODULE CONSTRUCTION PATTERN

### Standard Module Template

**Every module follows this consistent pattern:**

```javascript
window.init_{module_name} = function(containerId, config = {}) {

  // ═══════════════════════════════════════════════════════════
  // 1. SCOPE SETUP
  // ═══════════════════════════════════════════════════════════

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // 2. MODULE STATE (Scoped to this instance)
  // ═══════════════════════════════════════════════════════════

  let currentAccount = null;
  let currentWalletType = null;
  let moduleData = [];
  let isLoading = false;

  // ═══════════════════════════════════════════════════════════
  // 3. DOM ELEMENT REFERENCES
  // ═══════════════════════════════════════════════════════════

  const elements = {
    section: container.querySelector('.module-section'),
    connectBtn: container.querySelector('.connect-wallet-btn'),
    content: container.querySelector('.module-content'),
    loading: container.querySelector('.loading-message'),
    error: container.querySelector('.error-message')
  };

  // ═══════════════════════════════════════════════════════════
  // 4. INITIALIZATION (IIFE - Auto-runs)
  // ═══════════════════════════════════════════════════════════

  (async function init() {
    console.log(`Initializing ${module_name} module with config:`, config);

    // Wait for required libraries
    await waitForLibraries();

    // Setup event listeners
    setupEventListeners();

    // Auto-connect if configured
    if (config.auto_connect) {
      const walletState = window.WalletManager.getState();
      if (walletState.connected) {
        currentAccount = walletState.account;
        currentWalletType = walletState.walletType;
        await loadModuleData();
      }
    }
  })();

  // ═══════════════════════════════════════════════════════════
  // 5. LIBRARY WAITING
  // ═══════════════════════════════════════════════════════════

  async function waitForLibraries() {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    while (!window.WalletManager) {
      if (Date.now() - startTime > maxWait) {
        showError('Failed to load required libraries');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Subscribe to wallet events
    window.WalletManager.subscribe((account, walletType) => {
      currentAccount = account;
      currentWalletType = walletType;

      if (account) {
        loadModuleData();
      } else {
        showLoginPrompt();
      }
    });

    // Module-specific listeners
    if (elements.connectBtn) {
      elements.connectBtn.addEventListener('click', async () => {
        await window.WalletManager.connect();
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 7. DATA LOADING
  // ═══════════════════════════════════════════════════════════

  async function loadModuleData() {
    if (!currentAccount) return;

    isLoading = true;
    showLoading();

    try {
      const response = await fetch(`/api/module/data/${currentAccount}`);
      const data = await response.json();

      moduleData = data;
      renderModuleContent();

    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load data');
    } finally {
      isLoading = false;
      hideLoading();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 8. BLOCKCHAIN INTERACTIONS
  // ═══════════════════════════════════════════════════════════

  async function performBlockchainAction() {
    if (!currentAccount) {
      showError('Please connect your wallet first');
      return;
    }

    try {
      const actions = [
        {
          account: 'contract',
          name: 'action',
          authorization: [{
            actor: currentAccount,
            permission: 'active'
          }],
          data: {
            // action data
          }
        }
      ];

      const result = await window.WalletManager.transact(actions, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      console.log('Transaction successful:', result);

      // Reload data after action
      await loadModuleData();

    } catch (error) {
      console.error('Transaction failed:', error);
      showError(error.message || 'Transaction failed');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 9. UI RENDERING
  // ═══════════════════════════════════════════════════════════

  function renderModuleContent() {
    if (!elements.content) return;

    elements.content.innerHTML = '';

    moduleData.forEach(item => {
      const itemElement = createItemElement(item);
      elements.content.appendChild(itemElement);
    });

    showSection('content');
  }

  function createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'module-item';
    div.innerHTML = `
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <button onclick="handleItemClick('${item.id}')">Action</button>
    `;
    return div;
  }

  // ═══════════════════════════════════════════════════════════
  // 10. UI STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  function showLoading() {
    if (elements.loading) elements.loading.style.display = 'block';
    if (elements.content) elements.content.style.display = 'none';
    if (elements.error) elements.error.style.display = 'none';
  }

  function hideLoading() {
    if (elements.loading) elements.loading.style.display = 'none';
  }

  function showError(message) {
    if (elements.error) {
      elements.error.textContent = message;
      elements.error.style.display = 'block';
    }
    if (elements.content) elements.content.style.display = 'none';
    hideLoading();
  }

  function showLoginPrompt() {
    if (elements.section) elements.section.classList.add('logged-out');
    if (elements.content) elements.content.style.display = 'none';
  }

  function showSection(sectionName) {
    if (elements.section) elements.section.classList.remove('logged-out');

    // Hide all sections
    Object.keys(elements).forEach(key => {
      if (elements[key] && key !== 'section' && key !== sectionName) {
        elements[key].style.display = 'none';
      }
    });

    // Show target section
    if (elements[sectionName]) {
      elements[sectionName].style.display = 'block';
    }
  }

}; // End module function
```

### Key Pattern Principles

**1. Scoped State**
- Each module instance has isolated variables
- No global state pollution
- Multiple instances can coexist on same page

**2. IIFE Initialization**
- Immediately Invoked Function Expression
- Auto-runs setup without external call
- Ensures libraries are loaded before execution

**3. Element Scoping**
- Uses `container.querySelector()` instead of `document.querySelector()`
- Prevents conflicts between multiple instances
- Enables same module type multiple times on page

**4. Config-Driven Behavior**
- All customization via `config` object
- No hard-coded values in module logic
- Makes modules reusable across different contexts

**5. Async/Await Pattern**
- All blockchain operations are async
- Proper error handling with try/catch
- Loading states during operations

**6. Event-Driven Architecture**
- Subscribes to wallet manager events
- Reacts to connect/disconnect
- Decoupled from wallet implementation

---

## TECHNICAL STACK

### Frontend Technologies

**Core:**
- HTML5
- CSS3 (with custom properties/variables)
- Vanilla JavaScript (ES6+)

**WAX Blockchain Libraries:**
- **WaxJS** v1.0.0 - WAX Cloud Wallet integration
- **Anchor Link** v3.4.3 - Anchor Wallet integration
- **Anchor Link Browser Transport** v3.4.3

**Third-Party Components:**
- **NeftyBlocks Drops** (Web Component) - Drop widget embedding

**No Build Process:**
- Direct script includes via CDN
- No bundling required
- No transpilation needed

### Backend Technologies

**Runtime:**
- Node.js

**Frameworks:**
- Express.js - HTTP server

**Blockchain:**
- **eosjs** v22.x - EOSIO/WAX blockchain interaction
- **node-fetch** - HTTP requests to RPC endpoints

**Database:**
- SQLite3 - Local data persistence

**Environment:**
- dotenv - Configuration management

### Database Schema

**Tables:**

```sql
-- User reward claims tracking
CREATE TABLE user_claims (
  account TEXT,
  template_id INTEGER,
  reward_id INTEGER,
  last_claim_time INTEGER,
  PRIMARY KEY (account, template_id, reward_id)
);

-- Paid claim cooldowns
CREATE TABLE paid_claim_cooldowns (
  account TEXT,
  template_id TEXT,
  claim_count INTEGER,
  last_claim_time INTEGER,
  total_supply_count INTEGER,
  last_supply_reset INTEGER,
  PRIMARY KEY (account, template_id)
);

-- Purchase history
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT,
  template_id TEXT,
  tx_id TEXT,
  status TEXT,
  timestamp INTEGER,
  error_message TEXT
);

-- Factory crafting records
CREATE TABLE factory_crafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT,
  recipe_id INTEGER,
  mode TEXT,
  batch_count INTEGER,
  timestamp INTEGER
);
```

### RPC Endpoints

**Primary:**
- `https://wax.greymass.com` - General WAX RPC

**AtomicAssets API:**
- `https://aa-wax-public1.neftyblocks.com` - NeftyBlocks AA API
- `https://wax.api.atomicassets.io` - Official AtomicAssets API

**Fallback:**
Multiple RPC endpoints configured for redundancy

### Configuration Files

**Backend (`/server/config.js`):**
```javascript
module.exports = {
  wax: {
    rpcEndpoint: 'https://wax.greymass.com',
    account: process.env.WAX_ACCOUNT,
    privateKey: process.env.WAX_PRIVATE_KEY
  },
  collection: 'futuresrelic',
  database: './data/rewards.db'
};
```

**Frontend (`/public/modules/config.js`):**
```javascript
window.WAX_CONFIG = {
  rpcEndpoint: 'https://wax.greymass.com',
  aaApi: 'https://aa-wax-public1.neftyblocks.com',
  collection: 'futuresrelic'
};
```

---

## DEPLOYMENT ARCHITECTURE

```
┌────────────────────────────────────────────────────────────┐
│                    Client Browser                          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │          Site Builder Interface                      │ │
│  │  - Drag & drop modules                              │ │
│  │  - Visual configuration                             │ │
│  └────────────┬─────────────────────────────────────────┘ │
│               │                                            │
│               │ Saves to /api/page/save                    │
│               ▼                                            │
└────────────────────────────────────────────────────────────┘
                │
                │ HTTPS
                ▼
┌────────────────────────────────────────────────────────────┐
│                   Node.js Server                           │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Express.js Routes                                   │ │
│  │  - /api/page/*      (Page management)               │ │
│  │  - /api/user/*      (User actions)                  │ │
│  │  - /api/factory/*   (Crafting)                      │ │
│  │  - /api/blends/*    (Blending)                      │ │
│  └────────┬──────────────────────────────────────────────┘ │
│           │                                                │
│           │                                                │
│  ┌────────▼──────────────────────────────────────────────┐ │
│  │  WAX Blockchain Service (/server/wax.js)            │ │
│  │  - Transaction signing                              │ │
│  │  - Minting                                          │ │
│  │  - Payment verification                             │ │
│  └────────┬──────────────────────────────────────────────┘ │
│           │                                                │
│  ┌────────▼──────────────────────────────────────────────┐ │
│  │  SQLite Database                                     │ │
│  │  - Cooldowns                                        │ │
│  │  - Purchase history                                 │ │
│  │  - Craft records                                    │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────┬───────────────────────────────┘
                             │
                             │ RPC / API Calls
                             ▼
┌────────────────────────────────────────────────────────────┐
│                   WAX Blockchain                           │
│                                                            │
│  - AtomicAssets (NFT management)                          │
│  - AtomicPacksX (Pack unpacking)                          │
│  - blend.nefty (Blending)                                 │
│  - eosio.token (WAX transfers)                            │
└────────────────────────────────────────────────────────────┘
```

---

## SUMMARY & CONCLUSIONS

### System Strengths

**1. Modularity**
- Self-contained, reusable modules
- Easy to add new module types
- Config-driven customization

**2. Security**
- Server-side transaction signing
- Payment verification before minting
- Cooldown enforcement
- Supply limit protection

**3. User Experience**
- Single sign-on across all modules
- Auto-login session restoration
- Real-time asset updates
- Responsive UI

**4. Reliability**
- Error recovery systems
- Multiple RPC fallbacks
- Client + server cooldown sync
- Transaction retry logic

**5. Flexibility**
- Visual page builder
- Custom CSS per page
- Template system
- Module filtering/highlighting

### Integration Points

**All modules integrate with:**
- Global wallet manager (auth)
- WAX blockchain (assets/transactions)
- Backend APIs (verification/minting)
- AtomicAssets API (asset data)

**Specialized integrations:**
- **Paid Claim** → eosio.token (payments)
- **Factory Craft** → Pool wallet (swaps)
- **Unpack** → atomicpacksx (pack opening)
- **Blend Array** → blend.nefty (blending)
- **Nefty Drop** → NeftyBlocks CDN (drops)

### Current Module Status

| Module | Lines of Code | Complexity | Blockchain Integration |
|--------|---------------|------------|------------------------|
| Text Block | ~50 | Low | None |
| Image Block | ~50 | Low | None |
| Claim Rewards | 601 | Medium | AtomicAssets (mint) |
| Paid Claim | 873 | High | eosio.token + AtomicAssets |
| Factory Craft | 919 | Very High | AtomicAssets (transfer + mint/swap) |
| Unpack | 789 | High | AtomicPacksX |
| Blend Array | 804 | High | blend.nefty |
| Nefty Drop | 28 | Low | NeftyBlocks CDN |
| Transfer Mode | 460 | Medium | AtomicAssets (transfer) |

**Total: 4,574 lines of module code**

---

## RECOMMENDATIONS FOR UNIFORM MODULE SYSTEM

Based on this analysis, creating a uniform module system should focus on:

**1. Standardize Visual Design**
- Common card layout for all modules
- Unified button styles
- Consistent color scheme
- Standardized spacing/padding

**2. Standardize Configuration**
- Common config properties (`auto_connect`, `collection`, `title`)
- Consistent naming conventions
- Validation schemas

**3. Standardize State Management**
- Shared loading states
- Unified error handling
- Common success/failure messaging

**4. Standardize Blockchain Patterns**
- Shared transaction signing helper
- Common asset selection UI
- Unified mint number display
- Shared retry logic

**5. Extract Common Components**
- Asset card component
- Connect wallet button
- Loading spinner
- Error message display
- Transaction status modal

This report provides the foundation for building a unified, consistent module system while preserving the specialized functionality of each module type.

---

**End of Report**
