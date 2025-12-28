# FR-REWARDS SYSTEM STATE REPORT
**Generated:** 2025-12-28
**Session:** claude/continue-project-review-aB6RT
**Purpose:** Lock-in current system state for future reference and debugging

---

## 📄 PAGES OVERVIEW

### 1. **CLAIM PAGE** (`index.html`)
**Purpose:** Main user-facing page for claiming NFT rewards
**JavaScript Files:**
- `waxjs-simple.js` - WAX wallet integration
- `anchor-simple.js` - Anchor wallet integration
- `nav-loader.js` - Navigation bar loader
- `app.js` - Main claim page logic

**Endpoints Used:**
- `GET /api/config/public` - Load page configuration
- `GET /api/user/eligibility/:account` - Check eligible NFTs (**LIVE BLOCKCHAIN**)
- `GET /api/user/cooldowns/:account` - Get cooldown status
- `GET /api/user/claims/:account` - Get claim history
- `POST /api/user/claim` - Claim reward

**Data Sources:**
- **LIVE BLOCKCHAIN QUERIES** via `getUserAssetsLive()` (wax.js)
- Direct RPC queries to atomicassets contract
- Real-time ownership verification (no cache delay)

**WAX RPC:**
- Endpoint: `https://wax.greymass.com` (via WaxJS)

---

### 2. **STORY PAGE** (`story.html`)
**Purpose:** Story progression with actions (claim, blend, unpack, etc.)
**JavaScript Files:**
- `marked.min.js` - Markdown parser for action descriptions
- `waxjs.js` - Full WAX integration
- `anchor-simple.js` - Anchor wallet
- `nav-loader.js` - Navigation
- `story.js` - Story logic

**Endpoints Used:**
- `GET /api/config/public` - Load configuration
- `GET /api/story/tabs` - Load story tabs
- `GET /api/workflow/progress/:account` - Get story progress
- `GET /api/user/check-ownership/:account` - Ownership checks
- `POST /api/workflow/complete` - Mark action complete
- `POST /api/claim` - NFT claim action
- `GET /api/user/assets-rpc/:account/:template_id` - Asset verification
- `GET /api/user/claimable-packs/:account` - Claimable packs
- `GET /api/pack/unboxed-rolls/:pack_asset_id` - Unpack details
- `GET /api/assets/:account` - User assets (for blends)

**Data Sources:**
- **CACHED AtomicAssets API** for asset fetches (fast)
- **LIVE RPC** for pack verification
- **Direct blockchain queries** for BLEND_ARRAY via public RPC

**AtomicAssets API Endpoints (Cached - for asset fetches):**
- `https://aa-wax-public1.neftyblocks.com`
- `https://wax-aa.eosdac.io`
- `https://atomic-wax-mainnet.wecan.dev`
- `https://wax-atomic-api.eosphere.io`

**WAX RPC Endpoints (Live - for blends):**
- `https://wax.greymass.com`
- `https://api.waxsweden.org`
- `https://wax.eosphere.io`
- `https://api.wax.alohaeos.com`

**WAX Signing:**
- Endpoint: `https://wax.greymass.com` (via WaxJS/Anchor)

---

### 3. **PACKS PAGE** (`packs.html`)
**Purpose:** View and unpack NFT packs
**JavaScript Files:**
- `waxjs.js` - WAX integration
- `anchor-simple.js` - Anchor wallet
- `nav-loader.js` - Navigation
- `packs.js` - Pack logic

**Endpoints Used:**
- `GET /api/config/public` - Configuration
- `GET /api/user/packs/:account?t=timestamp` - User's packs (cache-busted)
- `GET /api/user/claimable-packs/:account?t=timestamp` - Claimable packs

**Data Sources:**
- **LIVE RPC queries** via cache-busting timestamps
- Direct atomicpacksx contract queries

---

### 4. **ADMIN PANEL** (`admin.html`)
**Purpose:** System configuration and management
**Features:**
- Template management
- Reward configuration
- Branding (logo, favicon, titles)
- Export/Import settings
- AtomicAssets API management

**Endpoints Used:** (all require authentication)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/config` - Get config
- `POST /api/admin/config` - Update config
- `GET /api/admin/stats` - System stats
- `GET /api/admin/claims` - Claim history
- `GET /api/admin/templates` - Template list
- `POST /api/admin/templates` - Add template
- `PUT /api/admin/templates/:id` - Update template
- `DELETE /api/admin/templates/:id` - Delete template
- `GET /api/admin/template-rewards/:template_id` - Rewards for template
- `POST /api/admin/template-rewards` - Add reward
- `PUT /api/admin/template-rewards/:id` - Update reward
- `DELETE /api/admin/template-rewards/:id` - Delete reward
- `GET /api/admin/export` - Export settings
- `POST /api/admin/import` - Import settings
- `POST /api/admin/upload-logo` - Upload logo
- `POST /api/admin/upload-favicon` - Upload favicon (base64)
- `PUT /api/admin/branding` - Update branding
- `GET /api/admin/atomic-apis` - List AtomicAssets APIs
- `POST /api/admin/atomic-apis/set-preferred` - Set preferred API
- `POST /api/admin/atomic-apis/add-custom` - Add custom API
- `POST /api/admin/atomic-apis/test-speed` - Test API speed

---

### 5. **WORKFLOW ADMIN** (`admin-workflow.html`)
**Purpose:** Manage story workflow steps and actions
**Endpoints Used:** (all require authentication)
- `GET /api/admin/workflow/steps` - Get steps
- `POST /api/admin/workflow/steps` - Add step
- `PUT /api/admin/workflow/steps/:id` - Update step
- `DELETE /api/admin/workflow/steps/:id` - Delete step
- `GET /api/admin/workflow/actions` - Get actions
- `POST /api/admin/workflow/actions` - Add action
- `PUT /api/admin/workflow/actions/:id` - Update action
- `DELETE /api/admin/workflow/actions/:id` - Delete action

---

### 6. **STORY TABS ADMIN** (`admin-story-tabs.html`)
**Purpose:** Manage story navigation tabs
**Endpoints Used:** (all require authentication)
- `GET /api/admin/story/tabs` - Get tabs
- `POST /api/admin/story/tabs` - Add tab
- `PUT /api/admin/story/tabs/:id` - Update tab
- `DELETE /api/admin/story/tabs/:id` - Delete tab
- `GET /api/admin/config/navigation` - Navigation config
- `PUT /api/admin/config/navigation` - Update navigation

---

### 7. **ASSET INSPECTOR** (`asset-inspector.html`)
**Purpose:** Debug tool for inspecting assets and packs
**Endpoints Used:**
- `GET /api/debug/inspect-asset/:assetId` - Inspect asset
- `GET /api/debug/inspect-claimable-pack/:assetId` - Inspect pack

---

## 🌐 EXTERNAL ENDPOINTS

### **AtomicAssets APIs** (Cached Indexers)
**Used For:** Asset fetches, template data (story page, general queries)
**Configuration:** `wax.js` lines 9-14

```javascript
ATOMIC_APIS = [
  'https://aa.wax.blacklusion.io',      // ⚡ Fastest - 86ms
  'https://atomic.wax.eosrio.io',       // Reliable - 594ms
  'https://wax.api.atomicassets.io',    // Official (can be slow)
  'https://aa.dapplica.io'              // Backup
]
```

**Preferred:** `https://aa.wax.blacklusion.io` (configurable via env)

---

### **WAX RPC Endpoints** (Live Blockchain)
**Used For:** Real-time queries, LIVE eligibility checks
**Configuration:** `wax.js` lines 459-466

```javascript
// LIVE blockchain RPC endpoints
rpcEndpoints = [
  'https://wax.greymass.com',
  'https://api.waxsweden.org',
  'https://wax.eosphere.io',
  'https://api.wax.alohaeos.com',
  'https://wax.eu.eosamsterdam.net',
  'https://wax.cryptolions.io'
]
```

**Default:** `https://api.waxsweden.org` (WAX_RPC_ENDPOINT env var)

---

### **IPFS Gateway**
**URL:** `https://ipfs.io/ipfs/`
**Used For:** NFT images/videos

---

### **External Links**
- **AtomicHub Market:** `https://wax.atomichub.io/market`
- **NeftyBlocks:** `https://neftyblocks.com/collection/{collection}`
- **WaxBlock Explorer:** `https://waxblock.io/transaction/{tx_id}`

---

## 🔧 BACKEND API ENDPOINTS

### **Public Endpoints** (No Auth Required)

#### Configuration
- `GET /api/config/public` - Public configuration
- `GET /api/config/navigation` - Navigation config
- `GET /api/story/tabs` - Story tabs

#### User Data
- `GET /api/user/holdings/:account` - User holdings
- `GET /api/user/eligibility/:account` - **LIVE** eligibility check
- `GET /api/user/claims/:account` - Claim history
- `GET /api/user/packs/:account` - User's packs
- `GET /api/user/cooldowns/:account` - Cooldown status
- `GET /api/user/assets-rpc/:account/:template_id` - Asset verification (RPC)
- `GET /api/user/assets/:account/:template_id` - Asset verification (API)
- `GET /api/user/check-ownership/:account` - Ownership check
- `GET /api/user/claimable-packs/:account` - Claimable packs
- `GET /api/assets/:account` - User assets (proxy to AtomicAssets)

#### Pack Operations
- `GET /api/pack/roll-count/:pack_template_id` - Pack roll count
- `GET /api/pack/unboxed-rolls/:pack_asset_id` - Unboxed pack details
- `POST /api/pack/check-claimable` - Check if pack is claimable

#### Workflow
- `GET /api/workflow/progress/:account` - Story progress
- `POST /api/workflow/complete` - Mark action complete

#### Actions
- `POST /api/user/claim` - Claim reward (rate limited)
- `POST /api/user/unpack-url` - Get unpack URL
- `POST /api/claim` - NFT claim action

#### Asset Verification
- `POST /api/asset/verify-ownership` - Verify via API
- `POST /api/asset/verify-ownership-rpc` - Verify via RPC (live)

#### Debug
- `GET /api/debug/inspect-asset/:assetId` - Inspect asset
- `GET /api/debug/inspect-claimable-pack/:assetId` - Inspect pack

---

### **Admin Endpoints** (Require JWT Auth)

#### Authentication
- `POST /api/admin/login` - Admin login

#### Configuration
- `GET /api/admin/config` - Get config
- `POST /api/admin/config` - Update config
- `GET /api/admin/stats` - System stats
- `PUT /api/admin/branding` - Update branding
- `GET /api/admin/config/navigation` - Navigation config
- `PUT /api/admin/config/navigation` - Update navigation

#### Templates
- `GET /api/admin/templates` - List templates
- `POST /api/admin/templates` - Add template
- `PUT /api/admin/templates/:template_id` - Update template
- `DELETE /api/admin/templates/:template_id` - Delete template

#### Template Rewards
- `GET /api/admin/template-rewards/:template_id` - Get rewards
- `POST /api/admin/template-rewards` - Add reward
- `PUT /api/admin/template-rewards/:id` - Update reward
- `DELETE /api/admin/template-rewards/:id` - Delete reward

#### Workflow Management
- `GET /api/admin/workflow/steps` - Get steps
- `POST /api/admin/workflow/steps` - Add step
- `PUT /api/admin/workflow/steps/:id` - Update step
- `DELETE /api/admin/workflow/steps/:id` - Delete step
- `GET /api/admin/workflow/actions` - Get actions
- `POST /api/admin/workflow/actions` - Add action
- `PUT /api/admin/workflow/actions/:id` - Update action
- `DELETE /api/admin/workflow/actions/:id` - Delete action

#### Story Tabs
- `GET /api/admin/story/tabs` - Get tabs
- `POST /api/admin/story/tabs` - Add tab
- `PUT /api/admin/story/tabs/:id` - Update tab
- `DELETE /api/admin/story/tabs/:id` - Delete tab

#### Data Management
- `GET /api/admin/claims` - All claims
- `GET /api/admin/export` - Export settings
- `POST /api/admin/import` - Import settings

#### Uploads
- `POST /api/admin/upload-logo` - Upload logo (file → /data/uploads/)
- `POST /api/admin/upload-favicon` - Upload favicon (converts to base64)

#### AtomicAssets API Management
- `GET /api/admin/atomic-apis` - List APIs
- `POST /api/admin/atomic-apis/set-preferred` - Set preferred
- `POST /api/admin/atomic-apis/add-custom` - Add custom
- `POST /api/admin/atomic-apis/test-speed` - Test speed

---

## 🗄️ DATABASE SCHEMA

**Location:** `/home/user/fr-rewards/data/nft_rewards.db` (SQLite)
**Mode:** WAL (Write-Ahead Logging)

### Tables

#### `config`
- `id` - Primary key (always 1)
- `whitelist_templates` - Comma-separated template IDs (legacy)
- `reward_template` - Default reward template (legacy)
- `cooldown_hours` - Default cooldown (legacy)
- `collection_name` - Collection name (e.g., "futuresrelic")
- `page_title` - Page title
- `page_subtitle` - Page subtitle
- `logo_url` - Logo URL (file path or URL)
- `favicon_url` - Favicon (base64 data URI)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

#### `templates`
- `template_id` - Template ID (primary key)
- `name` - Template name
- `reward_template_id` - Reward template
- `cooldown_hours` - Cooldown hours
- `enabled` - Enabled flag (1/0)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

#### `template_rewards`
- `id` - Auto-increment ID
- `template_id` - Foreign key to templates
- `reward_template_id` - Reward template ID
- `reward_name` - Reward name
- `cooldown_hours` - Cooldown hours
- `max_claims` - Max claims allowed
- `match_quantity` - Match user quantity (1/0)
- `enabled` - Enabled flag (1/0)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

#### `claims`
- `id` - Auto-increment ID
- `wallet_account` - User wallet
- `template_id` - Template claimed
- `reward_template` - Reward received
- `transaction_id` - Blockchain transaction
- `claimed_at` - Claim timestamp
- `next_claim_at` - Next eligible claim time
- **Unique:** `(wallet_account, template_id, claimed_at)`

#### `admin_accounts`
- `wallet_account` - Admin wallet (primary key)
- `created_at` - Creation timestamp

#### `workflow_steps`
- `id` - Auto-increment ID
- `step_order` - Display order
- `step_title` - Step title
- `step_subtitle` - Step subtitle
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

#### `workflow_actions`
- `id` - Auto-increment ID
- `step_id` - Foreign key to workflow_steps
- `action_order` - Display order
- `action_type` - Type (CLAIM, BLEND, UNPACK, etc.)
- `action_name` - Action name
- `action_description` - Markdown description
- `config` - JSON config
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

#### `workflow_progress`
- `id` - Auto-increment ID
- `account` - User wallet
- `action_id` - Foreign key to workflow_actions
- `completed` - Completion flag (1/0)
- `completed_at` - Completion timestamp
- `transaction_id` - Transaction ID
- `result_data` - JSON result
- `created_at` - Creation timestamp
- **Unique:** `(account, action_id)`

#### `story_tabs`
- `id` - Auto-increment ID
- `tab_order` - Display order
- `tab_title` - Tab title
- `tab_icon` - Icon (optional)
- `enabled` - Enabled flag (1/0)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

#### `nav_config`
- `id` - Primary key (always 1)
- `show_claim_nav` - Show claim link (1/0)
- `show_story_nav` - Show story link (1/0)
- `show_packs_nav` - Show packs link (1/0)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

---

## ⚙️ CURRENT SYSTEM SETTINGS

### Environment Variables
**Note:** Actual values are in `.env` file

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Admin JWT secret
- `DATABASE_FILE` - Database path (default: `./database.sqlite`)
- `WAX_ACCOUNT` - WAX account for minting
- `WAX_PRIVATE_KEY` - Private key for signing
- `WAX_RPC_ENDPOINT` - RPC endpoint (default: `https://api.waxsweden.org`)
- `PREFERRED_ATOMIC_API` - Preferred AtomicAssets API (default: `https://aa.wax.blacklusion.io`)
- `COLLECTION_NAME` - Default collection (default: `futuresrelic`)
- `WHITELIST_TEMPLATES` - Legacy template list
- `REWARD_TEMPLATE` - Legacy reward template
- `COOLDOWN_HOURS` - Legacy cooldown
- `ADMIN_ACCOUNTS` - Comma-separated admin wallets

### File Storage

#### Persistent (Survives Deployments)
- `/home/user/fr-rewards/data/` - Database and uploads
- `/home/user/fr-rewards/data/nft_rewards.db` - SQLite database
- `/home/user/fr-rewards/data/uploads/` - Logo files

#### Non-Persistent (Cleared on Deploy)
- `/home/user/fr-rewards/public/uploads/` - **DEPRECATED** (was for favicons)

### Branding Storage
- **Logo:** File stored in `/data/uploads/logo-{timestamp}.{ext}`
- **Favicon:** Base64 data URI stored in database (persists across deployments)

---

## 🎯 KEY BEHAVIORAL DIFFERENCES

### **CLAIM PAGE** (index.html)
- ✅ **LIVE blockchain queries** via `getUserAssetsLive()`
- ✅ Real-time ownership verification
- ✅ No cache delay
- ✅ Instant updates after transfers/blends/unpacks

### **STORY PAGE** (story.html)
- ⚡ **Cached AtomicAssets API** for asset fetches (faster)
- 🔴 **LIVE RPC** for pack verification
- 🔴 **LIVE RPC** for BLEND_ARRAY queries
- Mixed approach: cached for speed, live where accuracy critical

### **PACKS PAGE** (packs.html)
- 🔴 **Cache-busted queries** with timestamps
- Semi-live updates (forces fresh data)

---

## 🚨 CRITICAL RULES TO NEVER BREAK

### 1. **CLAIM PAGE MUST STAY LIVE**
- `/api/user/eligibility/:account` uses `getUserAssetsLive()` (wax.js:457)
- DO NOT switch back to `checkEligibility()` (cached)
- DO NOT remove cache-busting or RPC queries

### 2. **FAVICON STORAGE**
- Favicon stored as base64 in database (favicon_url column)
- DO NOT use file system for favicons
- Files in `/public/uploads/` are NOT persistent

### 3. **PACK VERIFICATION**
- Always use RPC queries for pack ownership
- AtomicAssets API can be stale for recent unpacks
- Use `get_table_rows` with scope=owner

### 4. **BLEND_ARRAY**
- Query blenderizerx contract directly via RPC
- Use fallback across multiple endpoints
- Extract ingredient templates from blend data

### 5. **SCROLL POSITION**
- Never use `window.scrollTo()` in `showError()`
- Always preserve scroll position in `markActionComplete()`

### 6. **TRANSACTION ASSET EXTRACTION**
- Extract asset IDs from `logtransfer` and `logmint` actions
- DO NOT assume roll IDs = asset IDs
- Parse transaction traces recursively

---

## 📊 QUICK REFERENCE

### Most Used Endpoints

**User Actions:**
1. Check eligibility: `/api/user/eligibility/:account` (LIVE)
2. Claim reward: `/api/user/claim`
3. Get packs: `/api/user/claimable-packs/:account`
4. Story progress: `/api/workflow/progress/:account`

**Admin Actions:**
1. Login: `/api/admin/login`
2. Configure templates: `/api/admin/templates`
3. Manage rewards: `/api/admin/template-rewards`
4. Update branding: `/api/admin/branding`

**External APIs:**
1. AtomicAssets: `https://aa.wax.blacklusion.io` (cached)
2. WAX RPC: `https://wax.greymass.com` (live)
3. IPFS: `https://ipfs.io/ipfs/`

---

## 🔄 DATA FLOW

### Claim Page Flow
1. User connects wallet → WaxJS/Anchor
2. Frontend calls `/api/user/eligibility/:account`
3. Backend calls `getUserAssetsLive()` → Direct RPC to blockchain
4. Query `atomicassets.assets` table (scope=account)
5. Fetch template data from AtomicAssets API
6. Return enriched assets with rewards
7. Frontend displays eligible NFTs with claim buttons
8. User clicks claim → `/api/user/claim`
9. Backend mints NFT via WAX account
10. Transaction recorded in database

### Story Page Flow
1. User connects wallet
2. Load tabs: `/api/story/tabs`
3. Load progress: `/api/workflow/progress/:account`
4. Display steps and actions
5. User executes action (CLAIM/BLEND/UNPACK/etc.)
6. Action queries blockchain (varies by type)
7. Transaction executed
8. Mark complete: `/api/workflow/complete`
9. Progress saved to database
10. Page reloads with updated progress

---

## 📝 NOTES FOR FUTURE SESSIONS

### When Starting New Session
1. Read this file first
2. Check git branch: `claude/continue-project-review-aB6RT`
3. Verify `/api/user/eligibility` still uses `getUserAssetsLive()`
4. Check favicon is base64 in database
5. Confirm RPC endpoints are working

### Before Making Changes
1. Document what you're changing and why
2. Check this file for critical rules
3. Test on claim page after changes
4. Verify story page still works
5. Update this file if architecture changes

### Common Pitfalls
- ❌ Switching claim page to cached API
- ❌ Using file system for favicon
- ❌ Breaking scroll position preservation
- ❌ Assuming pack roll IDs = asset IDs
- ❌ Removing RPC fallback logic

---

**END OF REPORT**
