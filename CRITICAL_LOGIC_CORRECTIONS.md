# 🎯 CRITICAL LOGIC CORRECTIONS FOR NEW CLAUDE

**Purpose**: Help new Claude UNDERSTAND the system deeply, not just scan it superficially

**Context**: User owns 4x Intern Editor Cards (template 247084), but this does NOT mean they get 4 rewards. This is the EXACT misconception that needs correction.

---

## ⚠️ MOST CRITICAL: Match Quantity Behavior

### ❌ WRONG Understanding (Surface Level):
> "User owns 4x Intern Editor Cards, so they can claim 4 rewards"

### ✅ CORRECT Understanding (Deep Logic):

**The actual code logic** (from `server.js` line ~260):

```javascript
// Calculate how many NFTs to mint based on match_quantity flag
const quantityToMint = rewardConfig.match_quantity
  ? userAssets.length           // If TRUE: mint as many as user owns
  : (rewardConfig.max_claims || 1);  // If FALSE: mint max_claims (usually 1)
```

### 🔍 Concrete Example with Template 247084 (Intern Editor Card):

**Scenario**: User owns 4x Intern Editor Cards (template 247084)

**Reward Configuration**:
```javascript
{
  template_id: 247084,        // The required card
  reward_template_id: 247052, // What they get (1st Assistant Editor)
  match_quantity: false,      // ← THIS IS THE KEY FLAG
  max_claims: 1,
  cooldown_hours: 24
}
```

**What Happens When User Claims**:
1. System checks: User owns 4x template 247084 ✅
2. System checks match_quantity flag: **FALSE**
3. System calculates: `quantityToMint = max_claims = 1`
4. **Result**: User gets **1 NFT** of template 247052, NOT 4

**If match_quantity was TRUE**:
```javascript
{
  match_quantity: true  // ← Changed to TRUE
}
```
Then user would get **4 NFTs** because `quantityToMint = userAssets.length = 4`

### 📊 Real Database Configuration:

Check the actual database with:
```sql
SELECT template_id, reward_template_id, match_quantity, max_claims
FROM template_rewards
WHERE template_id = 247084;
```

**If match_quantity = 0** → User gets 1 reward regardless of how many cards owned
**If match_quantity = 1** → User gets as many rewards as cards owned

### 🎓 Why This Matters:

This is NOT just a UI detail - it's core business logic that determines:
- How many NFTs get minted
- How the economy works
- What users expect vs what they get

**User's frustration**: Documentation that says "owns 4 cards" without explaining the reward multiplier logic is MISLEADING.

---

## 🚨 OTHER CRITICAL LOGIC POINTS

### 1. LIVE vs Cached Blockchain Queries

#### ❌ WRONG Understanding:
> "We check user's assets from the blockchain"

#### ✅ CORRECT Understanding:

**There are TWO ways to query assets**:

```javascript
// METHOD 1: Cached (atomicassets API) - FAST but may be stale
const cachedAssets = await wax.getUserAssets(wallet, collection);

// METHOD 2: LIVE (direct RPC) - SLOWER but 100% accurate
const liveAssets = await wax.getUserAssetsLive(wallet, collection);
```

**The system uses LIVE queries for all eligibility checks** (`server.js` line ~172):

```javascript
// CRITICAL: Always use getUserAssetsLive for claims
const assets = await wax.getUserAssetsLive(account, config.collection_name);
```

**WHY?**
- Prevents double-claiming if user transfers asset between checks
- Prevents claiming with assets user no longer owns
- Security: LIVE = source of truth, Cached = convenience only

**Real Attack Scenario Without LIVE**:
1. User checks eligibility at 10:00 AM (cached shows 1 card)
2. User transfers card to another wallet at 10:01 AM
3. User claims at 10:02 AM
4. Without LIVE check: Claim succeeds even though user no longer owns card!
5. With LIVE check: Claim fails because RPC shows 0 cards

### 2. Mint FIRST, Record AFTER

#### ❌ WRONG Order:
```javascript
// BAD: Record claim in database first
db.claims.add(account, template_id, reward_template_id, tx_id, cooldown, reward_id);
// Then mint
const result = await wax.mintNFT(account, collection, reward_template_id);
```

#### ✅ CORRECT Order (from `server.js` line ~290):

```javascript
// GOOD: Mint NFTs first
const transactionIds = [];
for (let i = 0; i < quantityToMint; i++) {
  const mintResult = await wax.mintNFT(account, config.collection_name, parseInt(reward.reward_template_id));
  transactionIds.push(mintResult.transaction_id);
}

// ONLY record claim AFTER successful mint
db.claims.add(
  account,
  reward.template_id,
  reward.reward_template_id,
  transactionIds[0],
  reward.cooldown_hours,
  reward.id
);
```

**WHY?**
- If mint fails, user can retry immediately (no cooldown applied)
- Prevents "claimed but didn't receive NFT" situation
- Database claims table = successful mints only

**This was changed specifically to fix race conditions!**

### 3. JSON Field Parsing

#### ❌ WRONG Assumption:
> "Database returns JavaScript objects"

#### ✅ CORRECT Reality:

**SQLite stores JSON as TEXT strings**. You MUST parse them:

```javascript
// Reading from database
const recipe = db.craftRecipes.getById(recipeId);

// ❌ WRONG: Use directly
const firstIngredient = recipe.ingredients[0];  // ERROR: undefined

// ✅ CORRECT: Parse first
const ingredients = JSON.parse(recipe.ingredients);
const firstIngredient = ingredients[0];  // Works!
```

**Fields that require parsing**:
- `craft_recipes.ingredients` (array of objects)
- `craft_recipes.results` (array of objects)
- `scheduled_actions.action_params` (object)
- `action_executions.action_params` (object)

**Real code from `server.js` line ~3400**:
```javascript
const recipe = db.craftRecipes.getById(recipeId);
const ingredients = JSON.parse(recipe.ingredients);  // ← MUST parse
const results = JSON.parse(recipe.results);          // ← MUST parse
```

### 4. Recurring Actions Never Complete

#### ❌ WRONG Understanding:
> "Actions execute and then status becomes 'completed'"

#### ✅ CORRECT Understanding:

**Two types of actions with DIFFERENT lifecycle**:

```javascript
// ONE-TIME ACTION:
// Status: pending → executed → completed
db.scheduledActions.update(action.id, {
  status: 'completed',
  executed_at: now.toISOString()
});

// RECURRING ACTION:
// Status: pending → pending → pending → ... (forever)
db.scheduledActions.update(action.id, {
  status: 'pending',  // ← Stays pending!
  last_executed_at: now.toISOString(),
  execution_time: nextExecutionTime.toISOString()
});
```

**From `scheduler.js` line ~180**:

```javascript
if (action.is_recurring && action.recurrence_interval_minutes) {
  // Calculate next execution time
  const nextExecutionTime = new Date(now.getTime() + action.recurrence_interval_minutes * 60 * 1000);

  // Update time but KEEP status as 'pending'
  db.scheduledActions.update(action.id, {
    last_executed_at: now.toISOString(),
    execution_time: nextExecutionTime.toISOString(),
    error_message: null
    // NO status change! Stays 'pending'
  });
} else {
  // One-time: mark completed
  db.scheduledActions.update(action.id, {
    status: 'completed',
    executed_at: now.toISOString()
  });
}
```

**WHY?**
- Scheduler fetches `WHERE status = 'pending'` (line ~140)
- Recurring actions must stay "pending" to be picked up again
- Completed = "never run again"
- Pending + future execution_time = "run again later"

### 5. Template Metadata Requires Separate Fetch

#### ❌ WRONG Assumption:
> "getUserAssetsLive returns asset names"

#### ✅ CORRECT Reality:

**Raw blockchain data does NOT include names**:

```javascript
const assets = await wax.getUserAssetsLive(account, collection);
// Returns:
[
  {
    template_id: "247084",
    asset_id: "1099974502421"
    // NO NAME, NO IMAGE!
  }
]
```

**Must fetch metadata separately** (from `server.js` line ~213):

```javascript
const templateMetadata = new Map();

await Promise.all(uniqueAssetTemplates.map(async (templateId) => {
  const templateData = await wax.getTemplate(collection, templateId);
  if (templateData) {
    templateMetadata.set(templateId, {
      name: templateData.immutable_data.name,        // ← Get name here
      image_url: templateData.immutable_data.img,    // ← Get image here
      is_video: !!templateData.immutable_data.video
    });
  }
}));

// Later, merge with asset data
return {
  template_id: templateId,
  name: templateConfig?.name || metadata?.name || `Template #${templateId}`,
  image_url: metadata?.image_url || null
};
```

**Name Priority System**:
1. **Database config name** (admin-set custom name) - HIGHEST
2. **Blockchain template metadata name** (from immutable_data)
3. **Fallback**: "Template #12345" - LOWEST

### 6. transferNFTs Function Is MISSING

#### 🚨 CRITICAL BUG:

**Function is CALLED but NEVER IMPLEMENTED**:

```javascript
// server.js line ~3488 - CALLS transferNFTs
const transferResult = await wax.transferNFTs(
  'pool.fr',
  userWallet,
  assetIds,
  'Pool swap',
  process.env.POOL_FR_PRIVATE_KEY
);

// wax.js - FUNCTION DOESN'T EXIST!
module.exports = {
  getUserAssets,
  mintNFT,
  // transferNFTs - NOT EXPORTED!
};
```

**Impact**: Pool swap mode has NEVER worked!

**Solution**: See `TRANSFER_FUNCTION_MISSING.md` for complete implementation

**Called in 3 places**:
1. `server.js:3488` - Pool swap crafting
2. `scheduler.js:182` - Scheduled transfers
3. Failed craft fulfillment (new feature)

---

## 🏗️ SYSTEM ARCHITECTURE - UNDERSTANDING vs MEMORIZING

### ❌ Surface Understanding:
> "There's a claim endpoint that mints NFTs"

### ✅ Deep Understanding:

**Why the system is designed this way**:

```
User owns assets → Check eligibility → Mint rewards → Record claim → Apply cooldown
     ↓                    ↓                 ↓              ↓              ↓
  LIVE check       Double verify      Atomic action   Success only   Time-based
  (security)       (no race)          (all or none)   (no false cd)  (prevent spam)
```

**Security Layers**:

1. **Frontend check** (index.html) - UX only, NOT security
2. **Backend eligibility** (`GET /api/user/eligibility`) - Informational
3. **Claim execution** (`POST /api/user/claim`) - ENFORCES rules with LIVE check

**Why 3 layers?**
- Frontend: Show user what they can claim (fast, cached OK)
- Eligibility: Give accurate status before claim attempt (LIVE)
- Claim: Final authority, prevents all attacks (LIVE + transactional)

### Example Flow for "User owns 4 cards, claims reward":

```javascript
// STEP 1: Frontend loads claim page
async function loadUserData() {
  // Calls eligibility endpoint
  const response = await fetch(`/api/user/eligibility?account=${account}`);
  // Shows: "You own 4x Intern Editor Card"
}

// STEP 2: User clicks claim button
async function claimReward(templateId, rewardId) {
  // Calls claim endpoint
  const response = await fetch(`/api/user/claim`, {
    method: 'POST',
    body: JSON.stringify({ account, template_id: templateId, reward_id: rewardId })
  });
}

// STEP 3: Backend processes claim
app.post('/api/user/claim', async (req, res) => {
  // 3a. Get LIVE assets (security)
  const assets = await wax.getUserAssetsLive(account, collection);

  // 3b. Verify user STILL owns required asset
  const userAssets = assets.filter(a => a.template_id === template_id);
  if (userAssets.length === 0) {
    return res.status(400).json({ error: 'No qualifying assets found' });
  }

  // 3c. Get reward config (includes match_quantity)
  const rewardConfig = db.templateRewards.getById(reward_id);

  // 3d. Calculate quantity (THE CRITICAL LOGIC!)
  const quantityToMint = rewardConfig.match_quantity
    ? userAssets.length
    : (rewardConfig.max_claims || 1);
  // If match_quantity=false: quantityToMint = 1 (NOT 4!)

  // 3e. Mint NFTs
  for (let i = 0; i < quantityToMint; i++) {
    await wax.mintNFT(account, collection, reward_template_id);
  }

  // 3f. Record claim (only after successful mint)
  db.claims.add(account, template_id, reward_template_id, tx_id, cooldown, reward_id);
});
```

**Key Insight**: Step 3d is where "owning 4 cards" becomes "getting 1 reward"!

---

## 🎯 TESTING YOUR UNDERSTANDING

If you truly understand the system, you should be able to answer:

### Question 1:
User owns 10x crEDIT Cards (template 391378). The reward is configured with:
- match_quantity: true
- max_claims: 3
- cooldown_hours: 48

How many NFTs does the user get when they claim?

<details>
<summary>Answer</summary>

**10 NFTs**

Because `match_quantity = true`, the code uses `userAssets.length` (10), NOT `max_claims` (3).

```javascript
const quantityToMint = rewardConfig.match_quantity
  ? userAssets.length     // TRUE: use this (10)
  : (rewardConfig.max_claims || 1);  // FALSE: would use this (3)
```

`max_claims` only matters when `match_quantity = false`.
</details>

### Question 2:
Scheduler shows a recurring action with:
- status: "pending"
- execution_time: "2026-01-19T03:00:00Z"
- last_executed_at: "2026-01-19T02:00:00Z"
- is_recurring: true
- recurrence_interval_minutes: 60

What does this mean? Has it run yet? Will it run again?

<details>
<summary>Answer</summary>

**Yes, it has already run once (at 02:00), and YES it will run again (at 03:00).**

Evidence:
- `last_executed_at` shows it ran at 02:00
- `execution_time` shows next run at 03:00 (1 hour later)
- `status = pending` means scheduler will pick it up again
- Recurring actions NEVER become "completed"

If it was one-time, status would be "completed" and execution_time wouldn't update.
</details>

### Question 3:
User tries to claim but gets error "No qualifying assets found" even though they just bought the required NFT 30 seconds ago. The frontend shows they own it. Why?

<details>
<summary>Answer</summary>

**This should NOT happen if the system is implemented correctly.**

The claim endpoint uses `getUserAssetsLive()` which queries blockchain directly (not cached). Even if purchased 30 seconds ago, LIVE query should see it immediately.

**Possible causes**:
1. Frontend is using cached API but claim endpoint is LIVE (most likely - just UI lag)
2. Transaction hasn't been confirmed on blockchain yet (very rare, <3 seconds)
3. Bug: Claim endpoint mistakenly using cached `getUserAssets()` instead of `getUserAssetsLive()` (critical bug!)

**Check**: Look at claim endpoint code. If it's NOT using `getUserAssetsLive()`, that's the bug!
</details>

### Question 4:
Admin creates a scheduled mint action. It executes successfully, but the action is marked "completed" and never runs again, even though they set is_recurring=true with 5-minute interval. What's wrong?

<details>
<summary>Answer</summary>

**Bug in scheduler.js execution logic.**

The code is treating recurring actions like one-time actions. Check `scheduler.js` around line 180.

**Should be**:
```javascript
if (action.is_recurring && action.recurrence_interval_minutes) {
  const nextTime = new Date(now.getTime() + action.recurrence_interval_minutes * 60 * 1000);
  db.scheduledActions.update(action.id, {
    status: 'pending',  // ← MUST stay pending
    execution_time: nextTime.toISOString()
  });
}
```

**Bug would be**:
```javascript
// Wrong: Always marks completed
db.scheduledActions.update(action.id, {
  status: 'completed'  // ← BUG: Should check is_recurring first!
});
```
</details>

---

## 📚 HOW TO USE THIS DOCUMENT

### For New Claude:

1. **Don't just read it - INTERNALIZE it**
   - Understand WHY each design decision was made
   - Think about what would break if it was different
   - Consider edge cases and attack scenarios

2. **When writing documentation**:
   - Always explain match_quantity when mentioning owned assets
   - Always clarify LIVE vs cached queries
   - Always note JSON parsing requirements
   - Don't gloss over critical flags

3. **When debugging**:
   - Check if issue relates to these critical points
   - Don't assume - verify with actual code
   - Think about the data flow, not just endpoints

4. **When adding features**:
   - Follow existing patterns (mint-first-record-after)
   - Maintain security layers (LIVE checks)
   - Consider recurring vs one-time logic

### For User:

Use this document to verify new Claude's understanding. If they:
- Mention asset quantities without explaining match_quantity → Point here
- Talk about queries without LIVE distinction → Point here
- Show database code without JSON.parse() → Point here
- Say actions "complete" without noting recurring exception → Point here

---

## 🔍 VERIFY NEW CLAUDE'S DOCS AGAINST THESE POINTS

### Checklist for User Guide:

- [ ] When mentioning "owns X assets", does it explain match_quantity?
- [ ] When showing claim examples, does it show both match_quantity modes?
- [ ] Does it explain cooldowns only apply AFTER successful mint?
- [ ] Does it mention LIVE blockchain verification?

### Checklist for Admin Wiki:

- [ ] Does reward configuration section explain match_quantity flag in detail?
- [ ] Does it warn about JSON field parsing?
- [ ] Does it explain recurring actions stay "pending"?
- [ ] Does it document transferNFTs as missing/needed?
- [ ] Does it explain the mint-first-record-after pattern?
- [ ] Does it explain LIVE vs cached queries?

### Red Flags (Signs of Surface-Level Understanding):

- ❌ "User owns 4 cards so gets 4 rewards" (without if/then)
- ❌ "System checks blockchain" (without LIVE specification)
- ❌ "Actions execute and complete" (without recurring exception)
- ❌ "Database stores action parameters" (without JSON.parse note)
- ❌ Lists endpoints without explaining WHY they exist
- ❌ Shows code snippets without explaining the logic

### Green Flags (Signs of Deep Understanding):

- ✅ "If match_quantity=true, user gets N rewards; if false, gets 1"
- ✅ "Uses getUserAssetsLive for security, not cached API"
- ✅ "Recurring actions stay pending and reschedule"
- ✅ "Must JSON.parse() these specific fields"
- ✅ Explains security reasoning behind design choices
- ✅ Shows code with comments explaining the WHY

---

## 💡 FINAL THOUGHT

**The difference between a good Claude and a great Claude**:

- **Good Claude**: Scans codebase, lists what exists, describes features
- **Great Claude**: Understands WHY it exists, explains implications, prevents bugs

**This system has been built through multiple sessions with careful bug fixes**. Each design decision (LIVE queries, mint-first-record-after, match_quantity flag) exists because of a REAL problem that was solved.

**Don't undo that work by oversimplifying in documentation!**

---

**Created by**: Previous Claude session (claude/continue-project-review-aB6RT)
**Date**: 2026-01-19
**For**: New Claude to deeply understand the fr-rewards system
**User's Request**: "Help him piece it all together and UNDERSTAND it. I want details so we can fix the problems when they show up."
