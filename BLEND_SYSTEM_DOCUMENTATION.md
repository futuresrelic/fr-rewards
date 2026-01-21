# Blend System - Complete Documentation & Method Lock-in

**Last Updated:** 2026-01-21
**Status:** ✅ WORKING - DO NOT MODIFY WITHOUT TESTING

This document serves as a complete reference for how the Blend Array system works from scratch. Use this to understand the architecture before making any changes.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Flow](#architecture-flow)
3. [Server-Side Methods](#server-side-methods)
4. [Client-Side Methods](#client-side-methods)
5. [Performance Analysis](#performance-analysis)
6. [Data Structures](#data-structures)
7. [Transaction Flow](#transaction-flow)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Overview

The Blend Array system is a **NeftyBlocks blend interface** that:
- Fetches blend schemas from the WAX blockchain
- Checks which blends a user can execute based on their assets
- Allows users to select specific assets and execute blends
- Displays the resulting NFT after successful blend execution

### Key Components
- **Frontend Module:** `/public/modules/blend-array.js` (803 lines)
- **Backend API:** `/server.js` - `/api/blends/analyze` endpoint (lines 838-1087)
- **Blockchain Contract:** `blend.nefty` on WAX blockchain
- **Asset API:** NeftyBlocks AtomicAssets API

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER CONNECTS WALLET (WCW or Anchor)                        │
│    - Auto-login from localStorage if available                  │
│    - Stores: currentAccount, wax/anchor instance               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. USER ENTERS: Collection Name + Blend IDs (comma-separated)  │
│    Example: "futuresrelic", "36,37,38,39,40,41,42,43..."       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CLICK "LOAD BLENDS" → loadBlends() function                 │
│                                                                 │
│    Client fetches:                                              │
│    a) User's assets: /api/assets/{account}?collection=...      │
│    b) Blend analysis: POST /api/blends/analyze                 │
│                                                                 │
│    Server does (EFFICIENT - SEE PERFORMANCE SECTION):          │
│    → For each blend ID:                                         │
│      • Fetch blend schema from blockchain (blend.nefty table)  │
│      • Parse ingredients (what's needed)                        │
│      • Parse results (what you get)                             │
│      • Fetch template metadata (names, images)                  │
│                                                                 │
│    → Fetch ALL user assets ONCE (with pagination)              │
│    → Group assets by template_id into dictionary                │
│    → Check each blend against the dictionary                    │
│    → Return: blends with can_execute + missing_ingredients      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DISPLAY BLENDS (displayBlends() function)                   │
│    - Show blend cards with:                                     │
│      • Result NFT image                                         │
│      • Ingredients list with owned/required counts              │
│      • Green border if can_execute, gray if not                 │
│      • Clickable only if can_execute                            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. USER CLICKS BLEND CARD → selectBlend() function             │
│    - Display asset selection screen                             │
│    - Group user's assets by template ID                         │
│    - Sort by mint number DESCENDING (highest first)             │
│      → Protects low mints!                                      │
│    - Show images for each asset                                 │
│    - Allow user to click assets to select/deselect             │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. USER SELECTS EXACT # OF ASSETS → toggleAssetSelection()     │
│    - Validates: can't select more than required per template    │
│    - Visual feedback: blue border when selected                 │
│    - Updates count: "Selected X / Y Required"                   │
│    - Enables "Execute Blend" button when count matches          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. CLICK "EXECUTE BLEND" → executeBlend() function             │
│                                                                 │
│    Creates 3-action transaction to blend.nefty:                │
│                                                                 │
│    Action 1: announcedepo                                       │
│      - Announces deposit to contract                            │
│      - Data: {owner: account, count: asset_count}              │
│                                                                 │
│    Action 2: atomicassets::transfer                             │
│      - Transfers assets to blend.nefty                          │
│      - Memo: "deposit"                                          │
│      - Data: {from, to: "blend.nefty", asset_ids, memo}        │
│                                                                 │
│    Action 3: nosecfuse                                          │
│      - Executes the blend                                       │
│      - Burns transferred assets                                 │
│      - Mints result NFT                                         │
│      - Data: {claimer, blend_id, own_assets: [],               │
│               transferred_assets: asset_ids}                    │
│                                                                 │
│    User signs in wallet → Transaction executes                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. SUCCESS! extractNewAssetId() + Display Result               │
│    - Parse transaction result for new asset_id                  │
│    - Fetch new asset data from AtomicAssets API                │
│    - Display image, name, mint number in success modal          │
│    - Show transaction link (waxblock.io)                        │
│    - "Close & Refresh" reloads blends                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Server-Side Methods

### Method: `POST /api/blends/analyze`

**Location:** `server.js` lines 838-1087

**Purpose:** Fetches blend schemas from blockchain, checks user's assets, returns which blends are executable

**Input:**
```json
{
  "collection": "futuresrelic",
  "blend_ids": ["36", "37", "38"],
  "account": "waxaccountname"
}
```

**Process (Step-by-Step):**

1. **Validate Inputs** (lines 842-850)
   - Check collection, blend_ids array, account are present
   - Validate WAX account name format

2. **Fetch Each Blend Schema** (lines 863-994)
   ```javascript
   for (const blendId of blend_ids) {
     // Query blockchain table: blend.nefty::blends
     const blendResult = await rpcEndpoint.get_table_rows({
       code: 'blend.nefty',
       scope: 'blend.nefty',
       table: 'blends',
       lower_bound: blendId,
       upper_bound: blendId,
       limit: 1
     });

     // Parse ingredients from blockchain format
     // Format: ["TEMPLATE_INGREDIENT", {template_id: 123, amount: 2}]

     // Parse results from blockchain format
     // Format: rolls[{outcomes[{results[["ON_DEMAND_NFT_RESULT", {template_id: 456}]]}]}]

     // Fetch template metadata (names, images) from AtomicAssets API
   }
   ```

3. **Fetch ALL User Assets ONCE** (lines 1004-1036)
   ```javascript
   let userAssets = [];
   let page = 1;
   let hasMore = true;

   // Pagination loop - handles users with 1000+ assets
   while (hasMore) {
     const assetsUrl = `${rpc}/atomicassets/v1/assets?owner=${account}&collection_name=${collection}&page=${page}&limit=${limit}`;
     const assetsResponse = await fetch(assetsUrl);
     const assetsData = await assetsResponse.json();

     userAssets = userAssets.concat(assetsData.data || []);

     if (assetsData.data.length < limit) {
       hasMore = false; // Last page
     } else {
       page++;
     }
   }
   ```

4. **Group Assets by Template ID** (lines 1038-1048)
   ```javascript
   const assetsByTemplate = {};
   userAssets.forEach(asset => {
     const templateId = asset.template?.template_id;
     if (templateId) {
       if (!assetsByTemplate[templateId]) {
         assetsByTemplate[templateId] = 0;
       }
       assetsByTemplate[templateId]++; // Count per template
     }
   });
   ```

5. **Check Each Blend Against Assets** (lines 1050-1072)
   ```javascript
   for (const blend of blends) {
     let canExecute = true;
     const missingIngredients = [];

     for (const ing of blend.ingredients) {
       const owned = assetsByTemplate[ing.template_id] || 0;
       ing.owned = owned; // Add to ingredient object

       if (owned < ing.amount) {
         canExecute = false;
         missingIngredients.push({
           template_id: ing.template_id,
           needed: ing.amount,
           owned: owned,
           missing: ing.amount - owned
         });
       }
     }

     blend.can_execute = canExecute;
     blend.missing_ingredients = missingIngredients;
   }
   ```

**Output:**
```json
{
  "success": true,
  "blends": [
    {
      "blend_id": "36",
      "name": "Blend #36",
      "collection": "futuresrelic",
      "ingredients": [
        {
          "template_id": 202914,
          "name": "Copper Wire",
          "img": "QmXXX...",
          "amount": 2,
          "owned": 5
        }
      ],
      "results": [
        {
          "template_id": 211094,
          "name": "Circuit Board",
          "img": "QmYYY...",
          "odds": 100,
          "total_odds": 100
        }
      ],
      "can_execute": true,
      "missing_ingredients": []
    }
  ],
  "total_assets": 1234
}
```

---

## Client-Side Methods

### Method: `loadBlends()`

**Location:** `blend-array.js` lines 217-291

**Purpose:** Fetches user assets and blend analysis, displays results

**Process:**
1. Validate collection and blend IDs inputs
2. Show loading screen
3. Fetch user assets: `GET /api/assets/{account}?collection_name={collection}&live=true`
4. Fetch blend analysis: `POST /api/blends/analyze`
5. Store results in `availableBlends` array
6. Call `displayBlends()`

---

### Method: `displayBlends()`

**Location:** `blend-array.js` lines 293-397

**Purpose:** Renders blend cards in the UI

**Process:**
1. Clear blends grid
2. For each blend:
   - Create card with result image, ingredients list, result info
   - Set border color: green if `can_execute`, gray otherwise
   - Add click handler if executable
   - Show "✅ Can Execute" or "❌ Missing X ingredient(s)"

---

### Method: `selectBlend(blend)`

**Location:** `blend-array.js` lines 399-515

**Purpose:** Show asset selection screen for a specific blend

**Process:**
1. Store `selectedBlend`, clear `selectedAssetIds`
2. Group user assets by template ID
3. For each ingredient:
   - Get assets matching that template
   - **Sort by mint DESCENDING (highest first) - protects low mints!**
   - Show at least 5 assets or `amount + 3` (whichever is more)
   - Display with images, asset ID, mint number
   - Add click handler for selection

---

### Method: `toggleAssetSelection(asset, ingredient)`

**Location:** `blend-array.js` lines 517-546

**Purpose:** Handle user clicking an asset to select/deselect

**Process:**
1. Count how many from this template are already selected
2. If asset is selected → Deselect (remove from set, reset styling)
3. If asset is not selected:
   - Check if we can select more of this template
   - If at limit → Show error
   - Otherwise → Select (add to set, highlight with blue border)
4. Update selection count display
5. Enable/disable "Execute Blend" button based on count

---

### Method: `executeBlend()`

**Location:** `blend-array.js` lines 594-745

**Purpose:** Execute the blend transaction on blockchain

**Process:**
1. Validate blend is selected and correct # of assets selected
2. Show processing modal
3. Get wallet API (Anchor or WCW)
4. **Build 3-action transaction:**
   ```javascript
   const actions = [
     {
       account: 'blend.nefty',
       name: 'announcedepo',
       authorization: [{actor: currentAccount, permission: 'active'}],
       data: {
         owner: currentAccount,
         count: assetIdsArray.length
       }
     },
     {
       account: 'atomicassets',
       name: 'transfer',
       authorization: [{actor: currentAccount, permission: 'active'}],
       data: {
         from: currentAccount,
         to: 'blend.nefty',
         asset_ids: assetIdsArray,
         memo: 'deposit'
       }
     },
     {
       account: 'blend.nefty',
       name: 'nosecfuse',
       authorization: [{actor: currentAccount, permission: 'active'}],
       data: {
         claimer: currentAccount,
         blend_id: parseInt(selectedBlend.blend_id),
         own_assets: [],
         transferred_assets: assetIdsArray
       }
     }
   ];
   ```
5. Execute transaction: `walletApi.transact({actions}, {blocksBehind: 3, expireSeconds: 30})`
6. Wait 3 seconds for blockchain to process
7. Extract new asset ID from transaction result
8. Fetch new asset data and image
9. Show success modal with image, name, mint, transaction link
10. Allow user to close and refresh

---

### Method: `extractNewAssetId(result)`

**Location:** `blend-array.js` lines 564-592

**Purpose:** Parse transaction result to find the newly minted asset ID

**Process:**
1. Look through `result.processed.action_traces`
2. Check each trace and inline traces
3. Find action where:
   - `account === 'atomicassets'`
   - `name === 'logmint' || name === 'lognewasset'`
4. Extract `asset_id` from action data
5. Return asset ID or null

---

## Performance Analysis

### Current Implementation: ✅ ALREADY OPTIMIZED!

You asked if we could optimize by analyzing all blends first, then checking assets once. **Good news: That's exactly what we're already doing!**

**Server-Side Efficiency (lines 1004-1072):**

```
1. Fetch ALL user assets ONCE (with pagination)     ← Single operation
2. Group by template_id into dictionary              ← O(n) operation
3. For each blend, check dictionary                  ← O(blends × ingredients)
   - Dictionary lookup is O(1)                       ← Very fast!
```

**Why This is Optimal:**

| What We DON'T Do (Slow) | What We DO (Fast) |
|-------------------------|-------------------|
| ❌ Fetch assets for blend 1 | ✅ Fetch ALL assets once |
| ❌ Fetch assets for blend 2 | ✅ Group into template dictionary |
| ❌ Fetch assets for blend 3 | ✅ Loop through blends |
| ❌ ... 36 times! | ✅ Check dictionary (instant lookup) |
| **Result: 36 API calls** | **Result: 1 API call + fast lookups** |

**Time Complexity:**
- Asset fetch: O(total_assets / 1000) API calls (pagination)
- Grouping: O(total_assets)
- Checking 36 blends: O(36 × avg_ingredients_per_blend) × O(1) lookup
- **Total: O(total_assets) - Linear time, optimal!**

### Minor Client-Side Redundancy (Not a Problem)

The client DOES fetch assets twice:
1. Line 244-253: Fetches for local use (display purposes)
2. Server fetches again in `/api/blends/analyze`

**Why this is OK:**
- Client needs full asset objects for display (images, mints, etc.)
- Server needs them for counting/matching
- Both requests are necessary for their purposes
- Asset API is fast and cached

**Possible Future Optimization (LOW PRIORITY):**
- Server could return user assets along with blends
- Client could skip its asset fetch
- **Tradeoff:** Larger response payload vs. one less request
- **Verdict:** Current approach is fine, don't fix what works!

---

## Data Structures

### Blend Object (Server Response)
```typescript
interface Blend {
  blend_id: string;
  name: string;
  description: string;
  collection: string;
  ingredients: Ingredient[];
  results: Result[];
  total_required: number;
  can_execute: boolean;
  missing_ingredients: MissingIngredient[];
  contract: string; // "blend.nefty"
}
```

### Ingredient Object
```typescript
interface Ingredient {
  template_id: number;
  name: string;
  img: string | null;
  amount: number;    // How many needed
  owned: number;     // How many user has
}
```

### Result Object
```typescript
interface Result {
  template_id: number;
  name: string;
  img: string | null;
  odds: number;
  total_odds: number;
}
```

### Asset Object (from AtomicAssets API)
```typescript
interface Asset {
  asset_id: string;
  template: {
    template_id: string;
  };
  template_mint: string;
  data: {
    img?: string;
    video?: string;
    name?: string;
  };
  // ... other fields
}
```

---

## Transaction Flow

### NeftyBlends 3-Action Pattern

**This is CRITICAL - do not change without testing!**

```
Action 1: announcedepo
  ↓
  Tells blend.nefty contract:
  "I'm about to deposit X assets"

Action 2: atomicassets::transfer
  ↓
  Transfers assets to blend.nefty
  Memo: "deposit"

Action 3: nosecfuse
  ↓
  blend.nefty receives assets
  Burns them
  Executes blend logic
  Mints result NFT to claimer
  Logs mint action (logmint/lognewasset)
```

**Why 3 actions?**
- NeftyBlocks requires this specific flow
- announcedepo prevents front-running
- transfer moves assets
- nosecfuse is non-secure fuse (no security check needed since assets already deposited)

**Parameters:**
- `own_assets`: Empty array (we're using transferred_assets)
- `transferred_assets`: Array of asset IDs we just transferred
- `blend_id`: Must be parsed to integer

---

## Troubleshooting Guide

### Issue: "Blend not found on blockchain"
**Cause:** Blend ID doesn't exist or wrong collection
**Fix:** Verify blend ID exists on NeftyBlocks website

### Issue: "Can't select more assets"
**Cause:** Already selected the required amount for that template
**Fix:** Deselect other assets first

### Issue: "Transaction failed"
**Causes:**
1. Not enough CPU/NET
2. Wrong asset IDs
3. Assets already transferred/burned
**Fix:** Check wallet resources, verify assets still owned

### Issue: "No new asset image displayed"
**Cause:** extractNewAssetId() couldn't find logmint action
**Fix:** Check transaction traces, verify blend actually minted NFT

### Issue: "Missing ingredients"
**Cause:** User doesn't have enough of required templates
**Fix:** Acquire more NFTs or select different blend

---

## Critical Notes for Future Modifications

### ⚠️ DO NOT CHANGE:

1. **3-Action Transaction Structure** (lines 620-661)
   - Order matters: announcedepo → transfer → nosecfuse
   - Memo must be "deposit"
   - own_assets must be empty array

2. **Mint Sorting Direction** (line 439)
   - DESCENDING (highest first) protects low mints
   - Users blend high mints, keep low mints

3. **Asset Grouping Dictionary** (server.js lines 1038-1048)
   - Enables O(1) lookups
   - Don't change to array lookups

### ✅ SAFE TO MODIFY:

1. **UI Styling** (CSS in blend-array.html)
2. **Display Text** (user-facing strings)
3. **Image Sizes** (lines 335, 455, 497, 708)
4. **Number of Assets Shown** (line 443: currently shows min 5 or amount+3)

---

## Summary

This system is **production-ready and optimized**. The architecture efficiently:
- Fetches assets once per load
- Uses dictionary lookups for O(1) matching
- Handles pagination for large collections
- Executes blends with proper NeftyBlocks protocol
- Displays results with images and transaction links

**Before making ANY changes, re-read this document and test thoroughly!**

---

**End of Documentation**
