# 🔧 Complete API & System Wiki

**Last Updated**: January 18, 2026
**Purpose**: Comprehensive reference for all endpoints, functions, and patterns

---

## 📡 API ENDPOINTS REFERENCE

### User Endpoints (No Auth Required)

#### GET `/api/user/eligibility/:account`
**Purpose**: Check if user is eligible for rewards and get all claimable rewards

**Parameters**:
- `account` (path) - WAX wallet name (e.g., "czkua.wam")

**Returns**:
```json
{
  "success": true,
  "account": "czkua.wam",
  "eligible": true,
  "whitelistTemplates": [247052, 247084],
  "eligibleAssets": [
    {
      "template_id": "247084",
      "name": "Intern Editor Card",
      "quantity_owned": 4,
      "image_url": "https://ipfs.io/ipfs/...",
      "is_video": false,
      "template_config": {...},
      "rewards": [
        {
          "reward_id": 1,
          "reward_template_id": 219904,
          "reward_name": "Wax Seal",
          "cooldown_hours": 24,
          "max_claims": 1,
          "match_quantity": false,
          "available_quantity": 1,
          "reward_image_url": "https://..."
        }
      ]
    }
  ]
}
```

**Key Details**:
- Uses `wax.getUserAssetsLive()` for LIVE blockchain verification
- Fetches template metadata for asset images/names
- Fetches reward template images
- Returns enriched data with all claimable rewards per template

---

#### GET `/api/user/cooldowns/:account`
**Purpose**: Get cooldown status for all user's rewards

**Parameters**:
- `account` (path) - WAX wallet name

**Returns**:
```json
{
  "success": true,
  "account": "czkua.wam",
  "cooldowns": [
    {
      "template_id": 247084,
      "reward_id": 1,
      "can_claim": false,
      "next_claim_at": "2026-01-19T12:00:00.000Z",
      "last_claimed_at": "2026-01-18T12:00:00.000Z",
      "remaining_seconds": 43200,
      "reward_config": {...}
    }
  ]
}
```

**Key Details**:
- Combines database cooldown records with reward configs
- Calculates remaining time in seconds
- Used by frontend to show countdown timers

---

#### POST `/api/user/claim`
**Purpose**: Claim a single reward

**Auth**: None (uses wallet verification)

**Body**:
```json
{
  "account": "czkua.wam",
  "template_id": 247084,
  "reward_id": 1
}
```

**Returns**:
```json
{
  "success": true,
  "message": "Reward claimed successfully! Minted 1x NFT(s)",
  "transaction_ids": ["abc123..."],
  "quantity_minted": 1,
  "reward_template": 219904,
  "next_claim_hours": 24
}
```

**Key Details**:
- CRITICAL: Mints FIRST, then records claim (prevents cooldown on failed mint)
- Verifies asset ownership via `wax.getUserAssetsLive()`
- Checks cooldown before minting
- Supports `match_quantity` mode (mint multiple if user owns multiple)

---

#### POST `/api/user/claim-all`
**Purpose**: Claim ALL available rewards at once

**Body**:
```json
{
  "account": "czkua.wam"
}
```

**Returns**:
```json
{
  "success": true,
  "message": "Claimed 3 of 3 available rewards",
  "results": [
    {
      "template_id": 247052,
      "reward_id": 1,
      "reward_name": "Wax Seal",
      "quantity_minted": 1,
      "transaction_ids": ["abc123"],
      "success": true
    }
  ],
  "total_claimed": 3,
  "total_attempted": 3,
  "errors": []  // If any failed
}
```

**Key Details**:
- Processes each reward sequentially
- Mints FIRST, records AFTER (same pattern as single claim)
- Handles partial failures gracefully
- Returns detailed results for each reward

---

#### GET `/api/user/claims/:account`
**Purpose**: Get claim history for a user

**Returns**: Array of claim records with timestamps

---

#### GET `/api/user/packs/:account`
**Purpose**: Get user's unopened packs

**Returns**: Pack assets filtered by pack template IDs

---

#### POST `/api/user/unpack-url`
**Purpose**: Generate WAX Cloud Wallet transaction for unpacking

**Body**:
```json
{
  "account": "czkua.wam",
  "asset_id": "1099512345678"
}
```

**Returns**:
```json
{
  "success": true,
  "signing_url": "https://www.mycloudwallet.com/cloud-wallet/signing/?transaction=...",
  "transaction": {...}
}
```

---

### Factory Endpoints

#### POST `/api/factory/craft`
**Purpose**: Execute a craft (mint or swap mode)

**Body**:
```json
{
  "recipe_id": 1,
  "batch_count": 2,
  "transfer_transaction_id": "abc123...",
  "asset_ids": ["1099512345678", "1099512345679"],
  "user_wallet": "czkua.wam",
  "mode": "pool"  // or "mint"
}
```

**Flow**:
1. Verify transaction on blockchain
2. Check assets were transferred to futuresrelic wallet
3. If mode="mint": Mint new NFTs
4. If mode="pool": Transfer from pool.fr wallet
5. Record craft in database

**Key Details**:
- MINT MODE: Uses `wax.mintNFT()` - creates new assets
- POOL MODE: Uses `wax.transferNFTs()` - swaps existing assets from pool.fr
- Verifies transfer BEFORE minting/swapping
- Creates craft record EARLY so failures are logged
- Updates record to 'completed' or 'failed'

---

#### GET `/api/admin/factory/crafts/failed`
**Purpose**: Get all failed crafts needing refunds

**Auth**: Admin token required

**Returns**:
```json
{
  "success": true,
  "failed_crafts": [
    {
      "id": 4,
      "recipe_id": 1,
      "recipe_name": "4x Wax Seals -> 1x crEDIT",
      "user_wallet": "czkua.wam",
      "batch_count": 1,
      "transfer_transaction_id": "abc123",
      "ingredient_asset_ids": ["1099...", "1099..."],
      "status": "failed",
      "error_message": "Insufficient pool inventory",
      "created_at": "2026-01-17T22:59:39.000Z"
    }
  ]
}
```

---

#### POST `/api/admin/factory/fulfill-failed`
**Purpose**: Complete a failed pool swap craft

**Auth**: Admin token required

**Body**:
```json
{
  "craft_id": 4
}
```

**Flow**:
1. Get failed craft record
2. Get recipe details
3. Query pool.fr wallet for available assets
4. Select required assets from pool
5. Transfer from pool.fr to user using `wax.transferNFTs()`
6. Update craft record to 'completed'

---

### Admin Endpoints (Require `Authorization: Bearer <token>`)

#### POST `/api/admin/login`
**Purpose**: Admin authentication

**Body**:
```json
{
  "password": "your-admin-password"
}
```

**Returns**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Usage**:
```javascript
const response = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'your-password' })
});
const { token } = await response.json();
localStorage.setItem('adminToken', token);
```

---

#### POST `/api/admin/template-rewards`
**Purpose**: Create a new reward for a template

**Auth**: Admin token

**Body**:
```json
{
  "template_id": 247084,
  "reward_template_id": 219904,
  "reward_name": "Wax Seal",
  "cooldown_hours": 24,
  "max_claims": 1,
  "match_quantity": false
}
```

---

#### PUT `/api/admin/template-rewards/:id`
**Purpose**: Update an existing reward

**Auth**: Admin token

**Body**: Same as POST, all fields optional (updates only provided fields)

---

#### DELETE `/api/admin/template-rewards/:id`
**Purpose**: Delete a reward

---

### Scheduler Endpoints

#### GET `/api/admin/scheduler/actions`
**Purpose**: Get all scheduled actions

**Returns**:
```json
{
  "success": true,
  "actions": [
    {
      "id": 4,
      "name": "1x crEDIT / 8h",
      "action_type": "mint",
      "action_params": {
        "to_wallet": "pool.fr",
        "template_id": 391378,
        "quantity": 1
      },
      "execution_time": "2026-01-18T19:00:00.000Z",
      "status": "pending",
      "is_recurring": true,
      "recurrence_interval_minutes": 480,
      "last_executed_at": "2026-01-18T11:00:00.000Z",
      "created_at": "2026-01-18T10:00:00.000Z"
    }
  ]
}
```

---

#### POST `/api/admin/scheduler/actions`
**Purpose**: Create a scheduled action

**Body**:
```json
{
  "name": "Daily crEDIT mint",
  "action_type": "mint",
  "action_params": {
    "to_wallet": "pool.fr",
    "template_id": 391378,
    "quantity": 1,
    "authorized_minter": "futuresrelic"
  },
  "execution_time": "2026-01-19T00:00:00.000Z",
  "is_recurring": true,
  "recurrence_interval_minutes": 1440,  // 24 hours
  "created_by": "admin"
}
```

**Action Types**:
- `mint` - Mint NFTs (implemented)
- `transfer` - Transfer NFTs (needs transferNFTs function)
- `drop` - Create claim drop (not implemented)
- `burn` - Burn NFTs (not implemented)

---

#### POST `/api/admin/scheduler/run-now`
**Purpose**: Trigger scheduler immediately (don't wait for next 60s cycle)

**Auth**: Admin token

**Returns**: Success message

---

## 💾 DATABASE FUNCTIONS REFERENCE

### db.config

#### `get()`
Returns config object with all settings

#### `update(data)`
Updates config fields
```javascript
db.config.update({
  page_title: "New Title",
  cooldown_hours: 48,
  logo_url: "/uploads/logo.png"
});
```

---

### db.templates

#### `getAll()`
Returns all templates (enabled and disabled)

#### `getEnabled()`
Returns only enabled templates

#### `getById(template_id)`
```javascript
const template = db.templates.getById(247084);
// Returns: { template_id, name, reward_template_id, cooldown_hours, enabled, ... }
```

#### `add(template_id, name, reward_template_id, cooldown_hours)`
```javascript
db.templates.add(247084, "Intern Editor Card", 219904, 24);
```

#### `update(template_id, data)`
```javascript
db.templates.update(247084, {
  name: "Updated Name",
  enabled: 1
});
```

#### `delete(template_id)`

#### `enable(template_id)` / `disable(template_id)`

---

### db.templateRewards

#### `getAll()`
Returns all rewards

#### `getByTemplateId(template_id)`
Returns all rewards for a specific template

#### `getEnabledByTemplateId(template_id)`
Returns only enabled rewards for a template

#### `getAllEnabled()`
**MOST USED** - Returns all enabled rewards across all templates
```javascript
const rewards = db.templateRewards.getAllEnabled();
// Used by eligibility and cooldown endpoints
```

#### `getById(id)`
Get specific reward by its ID (not template_id!)
```javascript
const reward = db.templateRewards.getById(1);
// Returns: { id, template_id, reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity, enabled }
```

#### `add(template_id, reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity)`
```javascript
db.templateRewards.add(
  247084,      // template requiring this
  219904,      // template to mint as reward
  "Wax Seal",  // display name
  24,          // cooldown in hours
  1,           // max claims (or null if match_quantity)
  false        // match_quantity boolean
);
```

#### `update(id, data)`
Updates reward by ID

#### `delete(id)`

---

### db.claims

#### `add(wallet_account, template_id, reward_template, transaction_id, cooldown_hours, reward_id)`
```javascript
db.claims.add(
  'czkua.wam',
  247084,
  219904,
  'abc123...',
  24,
  1  // reward_id
);
```

**CRITICAL**:
- NO UNIQUE constraint anymore (removed to fix race condition)
- Call AFTER successful mint, not before!

#### `getByAccount(wallet_account)`
Returns all claims for a user

#### `getCooldowns(wallet_account)`
Returns claims where next_claim_at > now (active cooldowns)

#### `canClaim(wallet_account, template_id, reward_id)`
Returns true/false if user can claim this reward
```javascript
if (db.claims.canClaim('czkua.wam', 247084, 1)) {
  // User can claim!
}
```

---

### db.craftRecipes

#### `getAll()`
Returns all craft recipes

#### `getById(id)`
```javascript
const recipe = db.craftRecipes.getById(1);
// Returns: {
//   id, name, enabled,
//   ingredients: [{template_id: 219904, amount: 4}],
//   results: [{template_id: 391378, amount: 1}],
//   max_batch_size, cooldown_hours, pool_enabled, pool_wallet
// }
```

**IMPORTANT**: `ingredients` and `results` are JSON strings in DB, parsed to arrays

#### `create(data)`
```javascript
db.craftRecipes.create({
  name: "4x Wax Seals -> 1x crEDIT",
  ingredients: JSON.stringify([{template_id: 219904, amount: 4}]),
  results: JSON.stringify([{template_id: 391378, amount: 1}]),
  enabled: true,
  max_batch_size: 5,
  cooldown_hours: 0,
  pool_enabled: true,
  pool_wallet: 'pool.fr'
});
```

#### `update(id, data)`

#### `delete(id)`

---

### db.craftHistory

#### `create(data)`
```javascript
const craftId = db.craftHistory.create({
  recipe_id: 1,
  user_wallet: 'czkua.wam',
  batch_count: 2,
  transfer_transaction_id: 'abc123',
  ingredient_asset_ids: JSON.stringify(['1099...', '1099...']),
  status: 'pending_verification'
});
```

**Statuses**: `pending_verification`, `pending_execution`, `completed`, `failed`

#### `getById(id)`
**CRITICAL**: Added by new Claude! Returns parsed craft record
```javascript
const craft = db.craftHistory.getById(4);
// Returns: { id, recipe_id, user_wallet, ingredient_asset_ids: [...], status, error_message, ... }
```

#### `getByTransactionId(transfer_tx_id)`
Checks for duplicate crafts (idempotency)

#### `getAll(limit)`
Returns recent crafts

#### `getByUser(wallet_account, limit)`

#### `getFailed()`
**NEW** - Returns all failed crafts needing refunds
```javascript
const failed = db.craftHistory.getFailed();
```

#### `update(id, data)`
```javascript
db.craftHistory.update(craftId, {
  status: 'completed',
  mint_transaction_id: 'xyz789',
  result_info: JSON.stringify(results)
});
```

---

### db.scheduledActions

#### `create(data)`
```javascript
const actionId = db.scheduledActions.create({
  name: "Daily Mint",
  action_type: "mint",
  action_params: JSON.stringify({...}),
  execution_time: "2026-01-19T00:00:00.000Z",
  status: "pending",
  is_recurring: true,
  recurrence_interval_minutes: 1440,
  created_by: "admin"
});
```

#### `getAll()` / `getAllPending()`

#### `getById(id)`

#### `update(id, data)`
```javascript
// For recurring: update execution_time to next run
db.scheduledActions.update(actionId, {
  execution_time: nextRunTime.toISOString(),
  last_executed_at: now.toISOString()
});

// For one-time: mark completed
db.scheduledActions.update(actionId, {
  status: 'completed',
  executed_at: now.toISOString()
});
```

#### `cancel(id)` / `delete(id)`

---

### db.actionExecutions

#### `create(data)`
Logs each execution attempt
```javascript
db.actionExecutions.create({
  action_id: 4,
  action_type: "mint",
  status: "success",
  transaction_id: "abc123",
  executed_at: now.toISOString()
});
```

#### `getAll(limit)`

#### `getByActionId(action_id)`

---

## 🌐 WAX.JS FUNCTIONS REFERENCE

### CRITICAL: Current Status

**Implemented Functions**:
- ✅ `getUserAssets()` - Cached API queries (avoid using)
- ✅ `getUserAssetsLive()` - LIVE blockchain queries (USE THIS!)
- ✅ `getTemplate()` - Get template metadata
- ✅ `mintNFT()` - Mint NFTs with private key
- ✅ `getCollection()` - Get collection info
- ✅ `verifyTransaction()` - Verify TX on blockchain
- ✅ `getAccountResources()` - Check CPU/NET/RAM
- ✅ `getIpfsUrl()` - Convert IPFS hash to URL

**NOT Implemented** (called but missing):
- ❌ `transferNFTs()` - Transfer assets (see TRANSFER_FUNCTION_MISSING.md)
- ❌ `transferNFT()` - Single asset transfer (doesn't exist)

---

### getUserAssetsLive(account, collection, templateFilter)

**Purpose**: Query blockchain DIRECTLY for user's assets

**Parameters**:
- `account` - Wallet name
- `collection` - Filter by collection (optional)
- `templateFilter` - Array of template IDs to filter (optional)

**Returns**: Array of raw blockchain assets
```javascript
const assets = await wax.getUserAssetsLive('czkua.wam', 'futuresrelic', [247084, 391378]);
// Returns: [
//   {
//     asset_id: "1099512345678",
//     template_mint: 123,
//     template: { template_id: "247084" },
//     backed_tokens: [],
//     collection: { collection_name: "futuresrelic" }
//   }
// ]
```

**Key Details**:
- Uses RPC endpoints (alohaeos primary)
- Paginates through assets table (scoped by owner)
- Fetches mint numbers from AtomicAssets API
- Returns RAW data (no template metadata)
- **ALWAYS use this for eligibility/claim verification**

**RPC Priority**:
1. `https://api.wax.alohaeos.com` (primary)
2. `https://wax.greymass.com`
3. `https://api.waxsweden.org`
4. Others...

---

### mintNFT(to_wallet, collection, template_id, authorized_minter = 'futuresrelic')

**Purpose**: Mint NFTs using private key

**Parameters**:
- `to_wallet` - Recipient wallet
- `collection` - Collection name
- `template_id` - Template to mint
- `authorized_minter` - Minter account (default: futuresrelic)

**Returns**:
```javascript
const result = await wax.mintNFT('czkua.wam', 'futuresrelic', 391378);
// Returns: {
//   transaction_id: "abc123...",
//   block_num: 414563542,
//   block_time: "2026-01-18T19:00:04.500"
// }
```

**Environment**:
Requires `MINTER_PRIVATE_KEY` env variable

**Action Structure**:
```javascript
{
  account: 'atomicassets',
  name: 'mintasset',
  authorization: [{
    actor: authorized_minter,
    permission: 'active'
  }],
  data: {
    authorized_minter,
    collection_name,
    schema_name,
    template_id,
    new_asset_owner: to_wallet,
    immutable_data: [],
    mutable_data: [],
    tokens_to_back: []
  }
}
```

---

### transferNFTs(fromWallet, toWallet, assetIds, memo, privateKey)

**STATUS**: ❌ **MISSING** - See `TRANSFER_FUNCTION_MISSING.md` for implementation

**Purpose**: Transfer NFTs from one wallet to another

**Expected Usage**:
```javascript
const result = await wax.transferNFTs(
  'pool.fr',                    // from
  'czkua.wam',                  // to
  ['1099512345678', '1099512345679'],  // asset IDs
  'Fulfill failed craft',       // memo
  process.env.POOL_FR_PRIVATE_KEY  // private key
);
// Should return: { transaction_id, from, to, asset_count, asset_ids }
```

**Where Called**:
1. `server.js:3488` - Pool swap crafting
2. `scheduler.js:182` - Scheduled transfers
3. New fulfill/refund endpoints

**Action Structure** (when implemented):
```javascript
{
  account: 'atomicassets',
  name: 'transfer',
  authorization: [{
    actor: fromWallet,
    permission: 'active'
  }],
  data: {
    from: fromWallet,
    to: toWallet,
    asset_ids: assetIds,
    memo: memo
  }
}
```

---

### getTemplate(collection, template_id)

**Purpose**: Fetch template metadata from AtomicAssets API

**Returns**:
```javascript
const template = await wax.getTemplate('futuresrelic', 391378);
// Returns: {
//   template_id: 391378,
//   schema: { schema_name: "production" },
//   immutable_data: {
//     name: "crEDIT",
//     img: "QmXXXXX...",
//     video: null
//   },
//   issued_supply: "32099"
// }
```

**API Endpoints** (tries in order):
1. Preferred (set via admin panel)
2. `https://aa-wax-public1.neftyblocks.com`
3. `https://wax-aa.eosdac.io`
4. `https://atomic-wax-mainnet.wecan.dev`
5. `https://wax-atomic-api.eosphere.io`

---

### getIpfsUrl(ipfsHash)

**Purpose**: Convert IPFS hash to accessible URL

```javascript
const url = wax.getIpfsUrl('QmXXXXX...');
// Returns: "https://ipfs.io/ipfs/QmXXXXX..."
```

---

## 🔐 ENVIRONMENT VARIABLES

### Required Variables

```bash
# Admin Authentication
ADMIN_PASSWORD="your-secure-password"

# NFT Minting
MINTER_PRIVATE_KEY="5K..." # futuresrelic account private key
WAX_ACCOUNT="futuresrelic"

# Pool Swapping (for factory pool mode)
POOL_FR_PRIVATE_KEY="5K..." # pool.fr account private key

# Database
DATABASE_FILE="/app/data/database.sqlite" # Railway volume mount

# Server
PORT=8080 # Railway sets this automatically
```

### Optional Variables

```bash
# Atomic API (can be set via admin panel instead)
PREFERRED_ATOMIC_API="https://aa-wax-public1.neftyblocks.com"
```

---

## 🏗️ SYSTEM ARCHITECTURE

### Rewards System Flow

```
1. User connects wallet (WaxJS or Anchor)
   ↓
2. Frontend calls GET /api/user/eligibility/:account
   ↓
3. Backend calls wax.getUserAssetsLive() → LIVE blockchain query
   ↓
4. Backend queries db.templateRewards.getAllEnabled()
   ↓
5. Backend enriches data with template metadata and images
   ↓
6. Frontend displays eligible templates with claimable rewards
   ↓
7. User clicks "Claim" or "Claim All"
   ↓
8. Backend verifies ownership AGAIN (security)
   ↓
9. Backend checks cooldown via db.claims.canClaim()
   ↓
10. Backend calls wax.mintNFT() → Blockchain transaction
   ↓
11. IF mint succeeds → db.claims.add() (record cooldown)
   ↓
12. Frontend shows success with transaction link
```

**Key Security Points**:
- Always verify ownership via LIVE blockchain query (not cached)
- Check cooldown before minting
- Record claim AFTER successful mint (prevents cooldown on failures)
- Use idempotency checks (check for duplicate transaction IDs)

---

### Factory Crafting Flow

```
1. User selects recipe and ingredients in frontend
   ↓
2. User signs transfer transaction (sends ingredients to futuresrelic)
   ↓
3. User submits transfer TX ID to POST /api/factory/craft
   ↓
4. Backend queries blockchain for transaction details
   ↓
5. Backend verifies:
   - Transaction exists
   - Assets were transferred to futuresrelic wallet
   - Correct assets (template IDs match recipe)
   - Correct quantity
   ↓
6. Backend creates craft record (status: pending_verification)
   ↓
7. IF mode = "mint":
   - Backend calls wax.mintNFT() for each result
   ↓
8. IF mode = "pool":
   - Backend queries pool.fr wallet for available assets
   - Backend checks inventory (enough assets?)
   - Backend calls wax.transferNFTs() from pool.fr to user
   ↓
9. Backend updates craft record (status: completed or failed)
   ↓
10. Frontend shows result
```

**Mint vs Pool Mode**:

**MINT MODE** (default):
- Creates NEW assets from scratch
- Uses `wax.mintNFT()`
- No inventory needed
- Template ID determines what's created

**POOL MODE** (swap):
- Transfers EXISTING assets from pool.fr
- Uses `wax.transferNFTs()`
- Requires inventory in pool.fr wallet
- Limited by available assets
- More circular economy (NFTs recirculate)

---

### Scheduler System Flow

```
1. scheduler.js starts when server boots
   ↓
2. Runs checkAndExecute() every 60 seconds
   ↓
3. Queries db.scheduledActions.getAllPending()
   ↓
4. Filters actions where execution_time <= now
   ↓
5. For each action:
   - Execute based on action_type (mint, transfer, etc.)
   - Log execution in db.actionExecutions
   ↓
6. If action.is_recurring:
   - Calculate next_execution = now + interval_minutes
   - Update action with new execution_time
   - Keep status = "pending"
   ↓
7. If action is one-time:
   - Update status = "completed"
   - Set executed_at timestamp
```

**Manual Trigger**:
- POST /api/admin/scheduler/run-now
- Bypasses 60-second wait
- Immediately runs checkAndExecute()

---

### Authentication Flow

**Admin Endpoints**:
```javascript
// 1. Login
const response = await fetch('/api/admin/login', {
  method: 'POST',
  body: JSON.stringify({ password: 'secret' })
});
const { token } = await response.json();

// 2. Store token
localStorage.setItem('adminToken', token);

// 3. Use token
await fetch('/api/admin/scheduler/actions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Middleware** (server.js):
```javascript
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}
```

---

## 🚨 COMMON PATTERNS & GOTCHAS

### Pattern 1: JSON Fields in Database

**PROBLEM**: Some DB fields store JSON strings, not objects

**Affected Tables**:
- `craft_recipes.ingredients` - JSON string
- `craft_recipes.results` - JSON string
- `craft_history.ingredient_asset_ids` - JSON string
- `craft_history.result_info` - JSON string
- `scheduled_actions.action_params` - JSON string

**Solution**:
```javascript
// ❌ WRONG
const recipe = db.craftRecipes.getById(1);
console.log(recipe.ingredients[0]); // undefined! It's a string!

// ✅ CORRECT
const recipe = db.craftRecipes.getById(1);
const ingredients = JSON.parse(recipe.ingredients);
console.log(ingredients[0].template_id); // 219904
```

**Helper Pattern**:
```javascript
// Some methods auto-parse (like craftHistory.getById)
const craft = db.craftHistory.getById(4);
console.log(craft.ingredient_asset_ids); // Already an array!
```

**When Writing**:
```javascript
// Always stringify before writing
db.craftRecipes.create({
  ingredients: JSON.stringify([{template_id: 219904, amount: 4}]),
  results: JSON.stringify([{template_id: 391378, amount: 1}])
});
```

---

### Pattern 2: LIVE vs Cached Blockchain Queries

**CRITICAL**: Always use LIVE queries for eligibility/verification

```javascript
// ❌ WRONG - Uses cached API (can be outdated)
const assets = await wax.getUserAssets(account);

// ✅ CORRECT - Queries blockchain directly
const assets = await wax.getUserAssetsLive(account, collection, templates);
```

**Why**:
- User claims NFT → shows in wallet immediately on blockchain
- Cached APIs can be 5-30 seconds behind
- User tries to claim again → cached API still shows old data
- LIVE query shows NFT is gone → prevents double claim

**Where to Use LIVE**:
- `/api/user/eligibility` ✅
- `/api/user/claim` ✅
- `/api/user/claim-all` ✅
- Factory craft verification ✅
- Anywhere checking asset ownership

---

### Pattern 3: Mint FIRST, Record AFTER

**CRITICAL**: Prevents cooldown on failed mints

```javascript
// ❌ WRONG ORDER
db.claims.add(wallet, template_id, reward_id, ...); // Records cooldown
await wax.mintNFT(...); // Might fail!
// User is on cooldown but got no NFT!

// ✅ CORRECT ORDER
const mintResult = await wax.mintNFT(...); // Might fail - OK, no cooldown yet
db.claims.add(wallet, template_id, reward_id, mintResult.transaction_id, ...);
// Only records if mint succeeded
```

**Applied in**:
- `/api/user/claim` - line ~503
- `/api/user/claim-all` - for each reward
- Any minting operation

---

### Pattern 4: Cooldown Checking

```javascript
// Check if user can claim
const canClaim = db.claims.canClaim(wallet, template_id, reward_id);

if (!canClaim) {
  return res.status(429).json({ error: 'Cooldown active' });
}

// Proceed with mint...
```

**How it works** (database.js):
```javascript
canClaim: (wallet_account, template_id, reward_id) => {
  const cooldown = db.prepare(`
    SELECT next_claim_at FROM claims
    WHERE wallet_account = ? AND template_id = ? AND reward_id = ?
    ORDER BY claimed_at DESC LIMIT 1
  `).get(wallet_account, template_id, reward_id);

  if (!cooldown) return true; // Never claimed

  const nextClaim = new Date(cooldown.next_claim_at);
  return new Date() >= nextClaim; // Can claim if time passed
}
```

---

### Pattern 5: Transaction Verification

**Factory Crafting Pattern**:
```javascript
// Get transaction from blockchain
const { JsonRpc } = require('eosjs');
const rpc = new JsonRpc('https://api.waxsweden.org', { fetch });
const txData = await rpc.history_get_transaction(transfer_tx_id);

// Extract transfer actions
const transfers = [];
if (txData.traces) {
  for (const trace of txData.traces) {
    if (trace.act?.account === 'atomicassets' && trace.act?.name === 'transfer') {
      transfers.push({
        from: trace.act.data.from,
        to: trace.act.data.to,
        asset_ids: trace.act.data.asset_ids,
        memo: trace.act.data.memo
      });
    }
  }
}

// Verify transfer to futuresrelic
const validTransfer = transfers.find(t =>
  t.from === user_wallet &&
  t.to === 'futuresrelic' &&
  t.asset_ids.length === expected_count
);
```

---

### Pattern 6: Resource Checking Before Minting

```javascript
// Check minter account has enough CPU/NET
const resources = await wax.getAccountResources('futuresrelic');
console.log(`CPU: ${resources.cpu.available} / ${resources.cpu.max}`);

if (resources.cpu.available < 1000) {
  throw new Error('Insufficient CPU - wait a few minutes');
}
```

**Shown in mint logs**:
```
📊 Checking minter account resources...
   CPU: 18,550 / 32,195 available (42.38% used)
   NET: 678,348 / 681,129 available (0.41% used)
   RAM: 898,943 bytes available
```

---

### Gotcha 1: Race Condition on Multi-Claim

**FIXED**: Removed UNIQUE constraint from claims table

**Old Problem**:
```sql
UNIQUE(wallet_account, template_id, claimed_at)
```
- User claims 2 rewards in same second
- Both get same `claimed_at` timestamp
- Second insert fails: "UNIQUE constraint violation"

**New Solution**:
- No UNIQUE constraint
- Cooldown logic handles duplicates
- Multiple claims at same timestamp are fine

---

### Gotcha 2: Recurring Actions Status

**IMPORTANT**: Recurring actions stay "pending" forever!

```javascript
// ❌ WRONG - Don't check if status = 'completed' for recurring
if (action.status === 'completed') {
  // Recurring actions never reach here!
}

// ✅ CORRECT - Check is_recurring flag
if (action.is_recurring) {
  // Reschedule
  const nextTime = new Date(Date.now() + action.recurrence_interval_minutes * 60000);
  db.scheduledActions.update(action.id, {
    execution_time: nextTime.toISOString(),
    last_executed_at: new Date().toISOString()
  });
} else {
  // Mark completed
  db.scheduledActions.update(action.id, {
    status: 'completed',
    executed_at: new Date().toISOString()
  });
}
```

---

### Gotcha 3: Template Metadata vs Asset Data

**getUserAssetsLive() returns RAW blockchain data** (no names/images):
```javascript
{
  asset_id: "1099512345678",
  template: { template_id: "247084" } // Just ID!
}
```

**Must fetch metadata separately**:
```javascript
const templateData = await wax.getTemplate('futuresrelic', 247084);
const name = templateData.immutable_data?.name; // "Intern Editor Card"
const img = templateData.immutable_data?.img;   // IPFS hash
```

**Pattern in eligibility endpoint** (server.js ~206):
```javascript
// Fetch metadata for all unique templates
await Promise.all(uniqueTemplates.map(async (templateId) => {
  const data = await wax.getTemplate(collection, templateId);
  templateMetadata.set(templateId, {
    name: data.immutable_data?.name,
    image_url: wax.getIpfsUrl(data.immutable_data?.img)
  });
}));
```

---

### Gotcha 4: Private Keys in Environment

**CRITICAL**: Never hardcode private keys!

```javascript
// ❌ WRONG
const privateKey = "5K..."; // Exposed in code!

// ✅ CORRECT
const privateKey = process.env.MINTER_PRIVATE_KEY;
if (!privateKey) {
  throw new Error('MINTER_PRIVATE_KEY not configured');
}
```

**Multiple Private Keys**:
- `MINTER_PRIVATE_KEY` - For futuresrelic account (minting)
- `POOL_FR_PRIVATE_KEY` - For pool.fr account (swapping)

**Each account needs its own key** for signing transactions

---

## 🔗 FRONTEND-BACKEND CONNECTIONS

### Claim Page (`public/index.html` + `public/app.js`)

**On Load**:
```javascript
// app.js
loadUserData() {
  // Calls 3 endpoints in parallel
  await Promise.all([
    fetch('/api/user/eligibility/' + account),
    fetch('/api/user/cooldowns/' + account),
    fetch('/api/user/claims/' + account)
  ]);

  // Enriches and displays UI
  showEligibleState(eligibility, cooldowns, claims);
}
```

**Claim Button**:
```javascript
async function claimReward(templateId, rewardId, button) {
  button.disabled = true;
  button.textContent = 'Claiming...';

  const response = await fetch('/api/user/claim', {
    method: 'POST',
    body: JSON.stringify({
      account: currentAccount,
      template_id: templateId,
      reward_id: rewardId
    })
  });

  // Show success, reload data
  loadUserData();
}
```

**Claim All Button**:
```javascript
async function claimAll() {
  const response = await fetch('/api/user/claim-all', {
    method: 'POST',
    body: JSON.stringify({ account: currentAccount })
  });

  // Shows detailed results for each reward
}
```

---

### Factory Page (`public/factory.html` + `public/factory.js`)

**Flow**:
```javascript
// 1. User selects recipe
selectRecipe(recipe) {
  currentRecipe = recipe;
  showIngredientSelection();
}

// 2. User selects assets from wallet
selectAssets() {
  const userAssets = await wax.getUserAssetsLive(account);
  // Filter by required template IDs
  displayAssetSelection(userAssets);
}

// 3. User initiates transfer
async function initiateTransfer() {
  // Sign transaction to send assets to futuresrelic
  const result = await wax.signTransaction([{
    account: 'atomicassets',
    name: 'transfer',
    data: {
      from: currentAccount,
      to: 'futuresrelic',
      asset_ids: selectedAssets,
      memo: `Craft: ${recipe.id}`
    }
  }]);

  const transferTxId = result.transaction_id;

  // 4. Submit to backend for processing
  await submitCraft(transferTxId);
}

async function submitCraft(transferTxId) {
  const response = await fetch('/api/factory/craft', {
    method: 'POST',
    body: JSON.stringify({
      recipe_id: currentRecipe.id,
      batch_count: currentBatchCount,
      transfer_transaction_id: transferTxId,
      asset_ids: selectedAssets,
      user_wallet: currentAccount,
      mode: currentRecipe.pool_enabled ? 'pool' : 'mint'
    })
  });

  // Show result modal with minted/swapped NFTs
}
```

---

### Admin Factory (`public/admin-factory.html` + `public/admin-factory.js`)

**Load Failed Crafts**:
```javascript
async function loadFailedCrafts() {
  const response = await fetch('/api/admin/factory/crafts/failed', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const data = await response.json();
  displayFailedCrafts(data.failed_crafts);
}
```

**Fulfill Failed Craft**:
```javascript
async function fulfillCraft(craftId) {
  const response = await fetch('/api/admin/factory/fulfill-failed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ craft_id: craftId })
  });

  // Reloads failed crafts list
}
```

---

### Admin Scheduler (`public/admin-scheduler.html` + `public/admin-scheduler.js`)

**Create Action**:
```javascript
document.getElementById('save-action-btn').addEventListener('click', async () => {
  const isRecurring = document.getElementById('is-recurring').checked;
  const interval = calculateIntervalMinutes(); // From UI inputs

  const response = await fetch('/api/admin/scheduler/actions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      action_type: 'mint',
      action_params: {
        to_wallet: wallet,
        template_id: templateId,
        quantity: 1
      },
      execution_time: new Date(executionTime).toISOString(),
      is_recurring: isRecurring,
      recurrence_interval_minutes: interval
    })
  });
});
```

**Manual Trigger**:
```javascript
document.getElementById('run-now-btn').addEventListener('click', async () => {
  await fetch('/api/admin/scheduler/run-now', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  // Reloads actions after 2 seconds
  setTimeout(loadActions, 2000);
});
```

---

## 🎓 SUMMARY

### Key Takeaways

1. **Always use `wax.getUserAssetsLive()`** for ownership verification
2. **Always mint FIRST, record AFTER** to prevent cooldown on failures
3. **JSON fields must be parsed** from database (ingredients, results, params)
4. **Recurring actions stay "pending"** - they reschedule, never complete
5. **transferNFTs is MISSING** - see TRANSFER_FUNCTION_MISSING.md
6. **Private keys from env only** - never hardcode
7. **Admin endpoints need Bearer token** - get from /api/admin/login
8. **Pool mode needs inventory** - check pool.fr wallet before swapping

### Common Mistakes to Avoid

- ❌ Using cached `getUserAssets()` instead of LIVE
- ❌ Recording claim before mint completes
- ❌ Forgetting to JSON.parse() database fields
- ❌ Calling `wax.transferNFTs()` (doesn't exist yet!)
- ❌ Hardcoding private keys
- ❌ Missing Authorization header on admin endpoints
- ❌ Marking recurring actions as "completed"

### When Adding New Features

1. Check if function exists in wax.js first!
2. Use existing patterns (copy from mintNFT, etc.)
3. Add to module.exports if adding to wax.js
4. Follow mint-first-record-after pattern
5. Use LIVE blockchain queries
6. Handle JSON parsing for DB fields
7. Add admin auth if needed
8. Update this wiki!

---

**Last Updated**: January 18, 2026
**Maintained By**: Claude AI Sessions
**Questions?**: Check HANDOFF_CONTINUATION_2026-01-18.md for session context
