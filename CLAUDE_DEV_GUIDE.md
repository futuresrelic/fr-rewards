# 🤖 CLAUDE DEVELOPER GUIDE & PROJECT LOG
**Future Relic Rewards Platform**
**For: Future Claude AI Sessions**
**Purpose: Never Lose Context Again**

---

## 🚨 START HERE - NEW CLAUDE SESSION CHECKLIST

**If you're a new Claude session starting work on this project:**

1. ✅ **Read this entire document** (15-20 minutes)
2. ✅ **Read** `/COMPLETE_API_WIKI.md` - Technical reference for all APIs
3. ✅ **Read** `/SITE_BUILDER_REPORT.md` - Understanding the module system
4. ✅ **Check** the `## 📝 CHANGELOG` section at the bottom of THIS document
5. ✅ **Ask the user** if there's any new context since the last session
6. ✅ **Never assume** - always verify file contents before editing
7. ✅ **Test locally** before committing if possible

---

## 📖 TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Critical Rules - READ FIRST](#critical-rules)
3. [Current System Architecture](#current-system-architecture)
4. [Active Implementation: Option A](#active-implementation-option-a)
5. [Module System Explained](#module-system-explained)
6. [Database Schema](#database-schema)
7. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
8. [Testing Guide](#testing-guide)
9. [Deployment Notes](#deployment-notes)
10. [Changelog](#changelog)

---

## 🎯 PROJECT OVERVIEW

**What is this?**
Future Relic Rewards is a **WAX blockchain NFT rewards platform** with a **visual no-code site builder**. Users can create custom pages with drag-and-drop modules for:
- NFT claiming (free rewards with cooldowns)
- NFT sales (paid claims with WAX tokens)
- Crafting systems (ingredient-based NFT creation)
- Pack unpacking (AtomicPacksX integration)
- Blending (NeftyBlocks blend contracts)
- Transfers, drops, and content display

**Tech Stack:**
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (no framework)
- **Backend:** Node.js + Express.js
- **Database:** SQLite3
- **Blockchain:** WAX (EOSIO-based)
- **Libraries:** WaxJS, Anchor Link, eosjs

**User's Golden Rules:**
> "I don't code, you do! Make me proud and don't break anything!"

---

## 🚨 CRITICAL RULES - READ FIRST

### 1. **NEVER Make Direct Fixes Without Understanding**
- ❌ Don't rush to fix something
- ✅ Read the existing code first
- ✅ Understand the architecture
- ✅ Ask clarifying questions if unsure

### 2. **ALWAYS Check What Functions Exist**
- ❌ Don't call `wax.transferNFTs()` without checking if it exists
- ✅ Use `Grep` or `Read` to verify function availability
- ✅ Check `module.exports` in files like `wax.js`, `database.js`

### 3. **READ Files Before Writing**
- ❌ Don't use the `Edit` or `Write` tool on files you haven't read
- ✅ Always use `Read` first to understand current state
- ✅ Verify your assumptions with actual code

### 4. **Use Existing Patterns**
- ❌ Don't reinvent authentication, transactions, or database queries
- ✅ Copy patterns from working modules (e.g., Paid Claims is the gold standard)
- ✅ Reference `COMPLETE_API_WIKI.md` for established patterns

### 5. **Security First**
- ❌ Never expose private keys or sensitive data
- ✅ All private keys must come from `process.env`
- ✅ Validate all inputs server-side
- ✅ Enforce cooldowns and limits in the database, not client-side

### 6. **Consistency is Key**
- ❌ Don't create new styles or patterns without reason
- ✅ Match existing UI/UX patterns
- ✅ Use the unified module base system
- ✅ Follow the Paid Claims config UI as the standard

### 7. **Test, Don't Assume**
- ❌ Don't assume your code works
- ✅ Test endpoints with actual requests
- ✅ Verify database queries return expected data
- ✅ Check the Railway logs for errors

---

## 🏗️ CURRENT SYSTEM ARCHITECTURE

### File Structure (Key Files)

```
/fr-rewards/
├── server.js                          # Main Express server (4000+ lines)
├── database.js                        # All database operations
├── wax.js                             # WAX blockchain interactions
├── /public/
│   ├── site-builder.html              # Visual page builder interface
│   ├── site-builder.js                # Site builder logic (1130 lines)
│   ├── admin.html                     # Admin panel for templates/rewards
│   ├── admin-factory.html             # Factory crafts admin panel
│   ├── admin-wiki.html                # API documentation viewer
│   ├── /modules/
│   │   ├── wallet-manager.js          # Global wallet authentication (CRITICAL)
│   │   ├── module-loader.js           # Dynamic module injection system
│   │   ├── unified-module-base.js     # Base class for all modules
│   │   ├── unified-module.css         # Unified styling for modules
│   │   ├── claim-rewards.js           # Free NFT claiming module (601 lines)
│   │   ├── paid-claim.js              # NFT sales module (873 lines) ⭐ GOLD STANDARD
│   │   ├── factory-craft.js           # Crafting system (919 lines)
│   │   ├── unpack.js                  # Pack unpacking (789 lines)
│   │   ├── blend-array.js             # NeftyBlocks blending (804 lines)
│   │   ├── transfer-mode.js           # NFT transfers (460 lines)
│   │   └── nefty-drop.js              # NeftyBlocks drop widget (28 lines)
│   └── /story/
│       ├── phase2.html                # Example page with modules
│       └── phase3.html                # Example page with modules
├── COMPLETE_API_WIKI.md               # Comprehensive API documentation
├── SITE_BUILDER_REPORT.md             # Module system architecture
└── CLAUDE_DEV_GUIDE.md                # This file (you are here!)
```

### How It Works (High-Level Flow)

**1. User Creates a Page in Site-Builder:**
```
User drags "Claim Rewards" module → Configures settings → Saves page
                                         ↓
Site-builder generates HTML with data-config attribute
                                         ↓
                    Saved to /public/story/page.html
```

**2. User Visits the Page:**
```
Browser loads page.html → module-loader.js finds [data-module] elements
                                         ↓
                    Fetches module HTML template
                                         ↓
                    Injects template into container
                                         ↓
            Calls window.init_{module_name}(containerId, config)
                                         ↓
                    Module initializes with config
```

**3. User Connects Wallet (ONCE):**
```
User clicks "Connect Wallet" → WalletManager.connect() called
                                         ↓
                    WaxJS or Anchor authentication
                                         ↓
                Account saved to localStorage (wax_account_shared)
                                         ↓
            ALL modules on page receive accountConnected event
                                         ↓
                    No need to login again!
```

**4. User Claims Reward:**
```
Module checks eligibility → POST /api/user/claim → Server validates
                                         ↓
                    Server signs mint transaction
                                         ↓
                    NFT minted to user's wallet
                                         ↓
                    Cooldown recorded in database
```

---

## 🎯 ACTIVE IMPLEMENTATION: OPTION A

### **What We're Building: Full Database-Backed Module System**

**Problem:**
- Module configs stored in HTML `data-config` attributes (visible in DevTools)
- Claim Rewards module only exposes 3 basic config options
- Factory Crafts module only exposes 4 basic config options
- No centralized management of module instances
- Security concerns with client-side configs

**Solution: Option A**
Move ALL module configurations to a database table with server-side management.

### Architecture Changes

**Before (Current):**
```html
<!-- Config stored in HTML -->
<div
  data-module="claim-rewards"
  data-config='{"collection":"futuresrelic","auto_connect":true,"title":"Your Documents"}'
></div>
```

**After (Option A):**
```html
<!-- Config referenced by ID -->
<div
  data-module="claim-rewards"
  data-module-id="mod_claim_abc123"
></div>
```

```javascript
// Config stored in database
{
  id: "mod_claim_abc123",
  module_type: "claim-rewards",
  config: {
    collection: "futuresrelic",
    auto_connect: true,
    title: "Your Documents",
    verification_templates: [247050, 247051, 247052],  // ⭐ NEW
    rewards: [                                          // ⭐ NEW
      { template_id: 246504, cooldown_hours: 48, quantity: 1 },
      { template_id: 391378, cooldown_hours: 24, quantity: 2 }
    ]
  },
  created_by: "admin",
  created_at: 1737849600000,
  updated_at: 1737849600000
}
```

### Implementation Steps (16 Total)

**Phase 1: Database Layer** (Steps 1-3)
- [ ] 1. Design `module_instances` table schema
- [ ] 2. Create database migration script
- [ ] 3. Add database functions in `database.js`

**Phase 2: API Layer** (Steps 4-7)
- [ ] 4. Build `POST /api/modules/create` endpoint
- [ ] 5. Build `GET /api/modules/:id` endpoint
- [ ] 6. Build `PUT /api/modules/:id` endpoint
- [ ] 7. Build `DELETE /api/modules/:id` endpoint

**Phase 3: Site-Builder UI** (Steps 8-9)
- [ ] 8. Enhance Claim Rewards config UI (match Paid Claims quality)
- [ ] 9. Enhance Factory Crafts config UI (match Paid Claims quality)

**Phase 4: Module Loader** (Steps 10-11)
- [ ] 10. Update `module-loader.js` to fetch configs from database
- [ ] 11. Update `site-builder.js` to save/load modules with IDs

**Phase 5: Testing & Migration** (Steps 12-13)
- [ ] 12. Test existing pages with new system
- [ ] 13. Add server-side validation for all configs

**Phase 6: Documentation & Deployment** (Steps 14-16)
- [ ] 14. Update `COMPLETE_API_WIKI.md`
- [ ] 15. Test all modules with database-backed configs
- [ ] 16. Commit and push to branch

---

## 🧩 MODULE SYSTEM EXPLAINED

### What is a Module?

A **module** is a self-contained, reusable component that can be added to any page via the site-builder. Examples:
- **Claim Rewards** - Free NFT claiming with cooldowns
- **Paid Claim** - NFT sales with WAX token payments
- **Factory Craft** - Recipe-based NFT crafting
- **Unpack** - Mystery pack opening
- **Blend Array** - NeftyBlocks blending

### Module Anatomy (3 Parts)

**1. HTML Template** (`/public/modules/{module-name}.html`)
```html
<div class="module-section">
  <h2>Module Title</h2>
  <div class="module-content">
    <!-- Module UI goes here -->
  </div>
</div>
```

**2. JavaScript Logic** (`/public/modules/{module-name}.js`)
```javascript
window.init_{module_name} = function(containerId, config = {}) {
  const container = document.getElementById(containerId);

  // Module state (scoped to this instance)
  let currentAccount = null;

  // Subscribe to wallet events
  window.WalletManager.subscribe((account, walletType) => {
    currentAccount = account;
    if (account) loadData();
  });

  // Module logic...
};
```

**3. Configuration** (currently in HTML, moving to database)
```json
{
  "collection": "futuresrelic",
  "auto_connect": true,
  "template_id": "123456",
  "price_wax": "10.00000000"
}
```

### The Unified Module Base System

**Purpose:** Reduce code duplication, enforce consistent patterns

**How it works:**
```javascript
// OLD WAY (800+ lines per module)
window.init_claim_rewards = function(containerId, config) {
  // 800 lines of wallet management, UI state, error handling...
};

// NEW WAY (300 lines per module)
class ClaimRewardsModule extends UnifiedModuleBase {
  constructor(containerId, config) {
    super(containerId, config);
  }

  // Only implement module-specific logic
  async loadData() { /* ... */ }
  renderContent() { /* ... */ }
}
```

**Benefits:**
- 35-45% less code per module
- Consistent error handling, loading states, wallet integration
- Easier to maintain and debug

---

## 💾 DATABASE SCHEMA

### Existing Tables (Critical Ones)

**1. `templates` - Verification/Whitelist Templates**
```sql
CREATE TABLE templates (
  template_id INTEGER PRIMARY KEY,
  name TEXT,
  enabled INTEGER DEFAULT 1,
  collection TEXT DEFAULT 'futuresrelic',
  image_url TEXT
);
```

**2. `template_rewards` - Reward Configurations**
```sql
CREATE TABLE template_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER,       -- Whitelist template
  reward_template_id INTEGER, -- Reward to mint
  reward_quantity INTEGER DEFAULT 1,
  cooldown_hours INTEGER DEFAULT 24,
  enabled INTEGER DEFAULT 1,
  FOREIGN KEY (template_id) REFERENCES templates(template_id)
);
```

**3. `craft_recipes` - Factory Crafting Recipes**
```sql
CREATE TABLE craft_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  enabled INTEGER DEFAULT 1,
  max_batch_size INTEGER DEFAULT 1,
  cooldown_hours INTEGER DEFAULT 0,
  ingredients TEXT,  -- JSON: [{ template_id, quantity }]
  results TEXT       -- JSON: [{ template_id, quantity }]
);
```

**4. `claims` - User Claim History**
```sql
CREATE TABLE claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL,
  template_id INTEGER NOT NULL,
  reward_template_id INTEGER,
  claimed_at INTEGER NOT NULL,
  cooldown_ends INTEGER NOT NULL
);
```

### NEW Table for Option A

**`module_instances` - Database-Backed Module Configs**
```sql
CREATE TABLE module_instances (
  id TEXT PRIMARY KEY,           -- mod_{type}_{random} e.g., mod_claim_abc123
  module_type TEXT NOT NULL,     -- claim-rewards, factory-craft, paid-claim, etc.
  config TEXT NOT NULL,          -- JSON: All module configuration
  page_path TEXT,                -- /story/phase2.html (optional)
  created_by TEXT,               -- admin account
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Example Row:**
```json
{
  "id": "mod_claim_abc123",
  "module_type": "claim-rewards",
  "config": {
    "collection": "futuresrelic",
    "auto_connect": true,
    "title": "Chapter Rewards",
    "verification_templates": [247050, 247051, 247052],
    "rewards": [
      {
        "template_id": 246504,
        "cooldown_hours": 48,
        "quantity": 1,
        "enabled": true
      }
    ]
  },
  "page_path": "/story/phase3.html",
  "created_by": "admin",
  "created_at": 1737849600000,
  "updated_at": 1737849600000
}
```

---

## 🚧 COMMON PITFALLS & SOLUTIONS

### 1. **"db.craftHistory.getById is not a function"**

**Problem:** Calling a database function that doesn't exist

**Solution:**
```bash
# ALWAYS check what functions exist first
grep "craftHistory.*:" database.js
grep "module.exports" database.js
```

If function is missing, add it to `database.js` and include in `module.exports`.

---

### 2. **"transferNFTs is not a function"**

**Problem:** Calling `wax.transferNFTs()` but it wasn't implemented

**Solution:**
```bash
# Check what's exported from wax.js
grep "module.exports" wax.js
```

**Fixed:** This function was added on Jan 19, 2026 (commit 96b9061). It now exists and works!

---

### 3. **Double JSON.parse() Errors**

**Problem:** Backend already parses JSON fields, frontend tries to parse again

**Example:**
```javascript
// ❌ WRONG (double parse)
const data = await fetch('/api/data');
const json = await data.json();
const parsed = JSON.parse(json.field); // Field already parsed!

// ✅ CORRECT
const data = await fetch('/api/data');
const json = await data.json();
const field = json.field; // Already an object/array
```

**Fixed in:** admin-factory.js (commit c454155)

---

### 4. **Authentication Failures (401 Unauthorized)**

**Problem:** Wrong authentication header for admin endpoints

**Solution:**
```javascript
// ❌ WRONG
headers: {
  'x-admin-password': localStorage.getItem('admin_password')
}

// ✅ CORRECT
headers: {
  'Authorization': `Bearer ${authToken}`
}
```

**Pattern:** All admin endpoints use Bearer tokens, not custom headers.

---

### 5. **Module Config Not Showing in Site-Builder**

**Problem:** Config UI not implemented or using wrong pattern

**Solution:** Use Paid Claims module as the gold standard:
```javascript
// See site-builder.js lines 400-600 for Paid Claims config
// Copy that pattern for other modules
```

---

### 6. **Login Doesn't Persist Across Pages**

**Problem:** Each module creating its own wallet connection

**Solution:** Always use `WalletManager` (singleton pattern)
```javascript
// ❌ WRONG (each module creates new connection)
const wax = new waxjs.WaxJS({ ... });
await wax.login();

// ✅ CORRECT (use global manager)
window.WalletManager.subscribe((account) => {
  // React to login/logout
});
```

---

### 7. **Forgetting to Read Files Before Editing**

**Problem:** Using `Edit` or `Write` tool without reading file first

**Solution:**
```javascript
// ❌ WRONG
Edit('/home/user/fr-rewards/server.js', ...)  // Haven't read it!

// ✅ CORRECT
Read('/home/user/fr-rewards/server.js')
// Review the content
Edit('/home/user/fr-rewards/server.js', ...)
```

---

## 🧪 TESTING GUIDE

### Local Testing (If Possible)

1. **Start the server:**
   ```bash
   npm install
   npm start
   ```

2. **Check database:**
   ```bash
   sqlite3 data/database.sqlite
   .tables
   SELECT * FROM templates;
   .quit
   ```

3. **Test endpoints:**
   ```bash
   curl http://localhost:8080/api/health
   ```

### Railway Testing (Production)

1. **Check deployment logs:**
   - Go to Railway project
   - Click on deployment
   - View "Deploy Logs" and "HTTP Logs"

2. **Test live site:**
   - Visit https://claim.futuresrelic.com/admin-factory.html
   - Try the feature you just built
   - Check browser console for errors (F12)

3. **Check git push:**
   ```bash
   git push -u origin claude/your-branch-name
   ```
   - Branch must start with `claude/` and end with session ID
   - If 403 error, check branch naming

---

## 🚀 DEPLOYMENT NOTES

### Git Workflow

**Branch Naming:** MUST follow pattern `claude/{description}-{sessionId}`
```bash
# ✅ CORRECT
claude/fix-crafts-json-error-292nn
claude/review-previous-conversation-yWrBD

# ❌ WRONG (will fail with 403)
fix-crafts
main
develop
```

**Push with Retry:**
```bash
git push -u origin claude/your-branch-name

# If network error, retry with exponential backoff (2s, 4s, 8s, 16s)
sleep 2 && git push -u origin claude/your-branch-name
sleep 4 && git push -u origin claude/your-branch-name
```

### Railway Auto-Deploy

- Railway auto-deploys when you push to the configured branch
- Check deployment status in Railway dashboard
- Deployments typically take 1-2 minutes

### Environment Variables (Railway)

**Critical Variables:**
- `WAX_PRIVATE_KEY` - Mint wallet private key
- `WAX_ACCOUNT` - Mint wallet account name (futuresrelic)
- `POOL_FR_PRIVATE_KEY` - Pool wallet private key
- `POOL_FR_ACCOUNT` - Pool wallet account name (pool.fr)
- `ADMIN_PASSWORD` - Admin panel password

**Never hardcode these!** Always use `process.env.VARIABLE_NAME`

---

## 📝 CHANGELOG

### **January 24, 2026** - Current Session
**Session ID:** `claude/review-previous-conversation-yWrBD`

**Status:** 🚧 IN PROGRESS - Option A Implementation

**What's Happening:**
- User reviewed previous conversation where Option A was chosen
- Previous Claude lost context and said "I don't see any previous context"
- Created this CLAUDE_DEV_GUIDE.md to prevent future context loss
- Starting implementation of database-backed module system

**Tasks Assigned:**
1. ✅ Create CLAUDE_DEV_GUIDE.md (this file)
2. ⏳ Create `module_instances` database table
3. ⏳ Build API endpoints for module management
4. ⏳ Enhance site-builder config UI for Claim Rewards & Factory
5. ⏳ Update module-loader.js to support database IDs
6. ⏳ Test and deploy

**Decisions Made:**
- Using Paid Claims module as the gold standard for config UI
- All module configs will be stored in database (Option A)
- Existing pages will be migrated gradually
- Security is priority: all validation server-side

---

### **January 19, 2026** - Previous Session
**Session ID:** `claude/fix-crafts-json-error-292nn`

**Completed Work:**
- ✅ Fixed Failed Crafts JSON parsing error (double parse issue)
- ✅ Added `transferNFTs()` function to wax.js (commit 96b9061)
- ✅ Added `craftHistory.getById()` function to database.js
- ✅ Built Fulfill Failed Craft feature in admin panel
- ✅ Fixed authentication header bug (Bearer token)
- ✅ Updated COMPLETE_API_WIKI.md with accurate function docs
- ✅ Created admin-wiki.html viewer with dark mode

**Key Commits:**
- `c454155` - Fix Failed Crafts JSON parsing error
- `78dec23` - Add Fulfill Failed Craft feature
- `103736f` - Fix authentication header
- `74441d1` - Add missing getById function
- `96b9061` - Add transferNFTs function ⭐
- `93831c2` - Update wiki & add web viewer
- `a4fbe67` - Add dark mode to wiki

**Lessons Learned:**
- Always check what functions exist before calling them
- Don't assume database methods exist - verify first
- Previous Claude made mistake calling non-existent `transferNFTs()`
- User provided the solution by asking previous Claude

---

### **January 18, 2026** - Original Wiki Creation
**Session ID:** `claude/continue-project-review-aB6RT`

**Completed Work:**
- ✅ Created COMPLETE_API_WIKI.md
- ✅ Documented all API endpoints
- ✅ Documented database functions
- ✅ Documented WAX.js functions
- ✅ Created comprehensive system documentation

**Note:** Some inaccuracies found (transferNFTs marked as "MISSING") - corrected on Jan 19, 2026

---

## 🎯 QUICK START FOR NEW CLAUDE SESSIONS

**If you're starting fresh:**

1. **First 5 Minutes:**
   - Read this guide (you're doing it now!)
   - Read the Changelog section
   - Ask user: "What's the current priority?"

2. **Before Making Changes:**
   - Check the todo list (use TodoWrite to see current tasks)
   - Read the files you'll be modifying
   - Verify functions exist before calling them
   - Look at working examples (Paid Claims is the gold standard)

3. **While Working:**
   - Update todo list as you complete tasks
   - Add entries to Changelog when you finish work
   - Test your changes if possible
   - Commit with clear messages

4. **Before Ending Session:**
   - Update this guide's Changelog
   - Update todo list with remaining tasks
   - Commit all changes to branch
   - Leave clear notes for next Claude

---

## 🙏 FINAL WORDS

**User's Philosophy:**
> "I don't code, you do! Make me proud and don't break anything!"

**Remember:**
- The user is NOT a developer - they point, you build
- Don't ask technical questions - make informed decisions
- Reference existing working code
- Test before committing
- Document everything
- Break nothing!

**When in Doubt:**
- Check COMPLETE_API_WIKI.md
- Look at working modules (Paid Claims, Factory)
- Read the code before changing it
- Ask clarifying questions about GOALS, not implementation details

---

**Last Updated:** January 24, 2026
**Maintained By:** Claude AI Sessions
**Next Claude:** Read the Changelog first, then ask user for priority!

**Good luck! 🚀 Make the user proud!**
