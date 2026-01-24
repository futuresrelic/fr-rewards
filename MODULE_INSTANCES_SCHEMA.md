# Module Instances Database Schema Design

## Purpose
Store all module instance configurations in the database instead of HTML `data-config` attributes for:
- Better security (no client-side config manipulation)
- Centralized management
- Audit trail
- Version control
- Easier migration and backups

---

## Table Schema

### `module_instances`

```sql
CREATE TABLE IF NOT EXISTS module_instances (
  id TEXT PRIMARY KEY,                  -- Unique identifier: mod_{type}_{random}
  module_type TEXT NOT NULL,            -- claim-rewards, factory-craft, paid-claim, etc.
  config TEXT NOT NULL,                 -- JSON: All module configuration
  page_path TEXT,                       -- /story/phase2.html (optional, for reference)
  created_by TEXT,                      -- Admin account that created it
  created_at INTEGER NOT NULL,          -- Unix timestamp
  updated_at INTEGER NOT NULL           -- Unix timestamp
);
```

### Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | TEXT PRIMARY KEY | Unique module instance ID | `mod_claim_abc123` |
| `module_type` | TEXT NOT NULL | Module type identifier | `claim-rewards` |
| `config` | TEXT NOT NULL | JSON string with all config | See examples below |
| `page_path` | TEXT | Optional page reference | `/story/phase3.html` |
| `created_by` | TEXT | Admin account | `admin` |
| `created_at` | INTEGER NOT NULL | Unix timestamp (ms) | `1737849600000` |
| `updated_at` | INTEGER NOT NULL | Unix timestamp (ms) | `1737849600000` |

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_module_instances_type
ON module_instances(module_type);

CREATE INDEX IF NOT EXISTS idx_module_instances_page
ON module_instances(page_path);

CREATE INDEX IF NOT EXISTS idx_module_instances_created
ON module_instances(created_at DESC);
```

---

## ID Format

**Pattern:** `mod_{type}_{random}`

**Components:**
- `mod_` - Prefix for all module instances
- `{type}` - Short module type code (4-8 chars)
  - `claim` - Claim Rewards
  - `paid` - Paid Claim
  - `craft` - Factory Craft
  - `unpack` - Unpack
  - `blend` - Blend Array
  - `drop` - NeftyBlocks Drop
  - `transfer` - Transfer Mode
  - `text` - Text Block
  - `image` - Image Block
- `{random}` - Random alphanumeric (8 chars)

**Examples:**
- `mod_claim_abc12345` - Claim Rewards module
- `mod_paid_xyz78901` - Paid Claim module
- `mod_craft_def23456` - Factory Craft module

**Generation Function:**
```javascript
function generateModuleId(moduleType) {
  const typeMap = {
    'claim-rewards': 'claim',
    'paid-claim': 'paid',
    'factory-craft': 'craft',
    'unpack': 'unpack',
    'blend-array': 'blend',
    'nefty-drop': 'drop',
    'transfer-mode': 'transfer',
    'text-block': 'text',
    'image-block': 'image'
  };

  const shortType = typeMap[moduleType] || 'mod';
  const random = Math.random().toString(36).substring(2, 10);
  return `mod_${shortType}_${random}`;
}
```

---

## Config JSON Examples

### 1. Claim Rewards Module

**Before (HTML attribute):**
```html
<div data-config='{"collection":"futuresrelic","auto_connect":true}'></div>
```

**After (Database):**
```json
{
  "collection": "futuresrelic",
  "auto_connect": true,
  "title": "Chapter Rewards",
  "verification_templates": [247050, 247051, 247052, 247053],
  "rewards": [
    {
      "reward_id": 1,
      "template_id": 246504,
      "name": "Wax Seal",
      "cooldown_hours": 48,
      "quantity": 1,
      "enabled": true
    },
    {
      "reward_id": 2,
      "template_id": 391378,
      "name": "crEDIT Card",
      "cooldown_hours": 24,
      "quantity": 2,
      "enabled": true
    }
  ],
  "show_only_reward_id": null,
  "highlight_reward_id": null
}
```

### 2. Paid Claim Module

**Before (HTML attribute):**
```html
<div data-config='{"template_id":"123456","price_wax":"10.00000000",...}'></div>
```

**After (Database):**
```json
{
  "template_id": "123456",
  "template_name": "Epic Sword",
  "template_image": "https://example.com/image.png",
  "price_wax": "10.00000000",
  "payment_wallet": "futuresrelic",
  "collection_name": "futuresrelic",
  "max_supply": 100,
  "per_wallet_limit": 5,
  "wallet_limit_cooldown": 24,
  "supply_limit_cooldown": 168,
  "auto_connect": true,
  "show_purchase_history": true
}
```

### 3. Factory Craft Module

**Before (HTML attribute):**
```html
<div data-config='{"collection":"futuresrelic","auto_connect":true}'></div>
```

**After (Database):**
```json
{
  "collection": "futuresrelic",
  "auto_connect": true,
  "title": "Crafting Station",
  "show_category": "Weapons",
  "show_recipe_id": 5,
  "recipes": [
    {
      "recipe_id": 5,
      "name": "4x Wax Seals -> 1x crEDIT",
      "category": "Wax Seals",
      "enabled": true,
      "ingredients": [
        { "template_id": 219904, "quantity": 4 }
      ],
      "results": [
        { "template_id": 391378, "quantity": 1 }
      ],
      "max_batch_size": 5,
      "cooldown_hours": 0,
      "pool_enabled": true,
      "pool_ingredients_discount": 1
    }
  ]
}
```

### 4. Simple Modules (Text, Image, etc.)

**Text Block:**
```json
{
  "heading": "Welcome to Phase 2",
  "content": "<p>This is the story content...</p>",
  "style": "narrative"
}
```

**Image Block:**
```json
{
  "image_url": "https://example.com/banner.png",
  "alt_text": "Chapter banner",
  "caption": "The journey begins",
  "width": "100%",
  "alignment": "center"
}
```

---

## Migration Strategy

### Phase 1: Add Table & APIs (No Breaking Changes)
1. Create `module_instances` table
2. Add API endpoints for CRUD operations
3. Update site-builder to support BOTH systems:
   - Old: `data-config` attribute (still works)
   - New: `data-module-id` attribute (fetches from database)
4. Module-loader checks for `data-module-id` first, falls back to `data-config`

### Phase 2: Migrate Existing Pages (Gradual)
1. Create migration script to convert existing pages
2. For each page with modules:
   - Extract `data-config` JSON
   - Create database record in `module_instances`
   - Replace `data-config` with `data-module-id`
   - Save updated HTML
3. Test each migrated page
4. Keep backups of original pages

### Phase 3: Remove Old System (Optional)
1. After all pages migrated, deprecate `data-config` support
2. Update documentation
3. Remove fallback code from module-loader

---

## API Endpoints

### POST `/api/modules/create`
**Request:**
```json
{
  "module_type": "claim-rewards",
  "config": { /* full config object */ },
  "page_path": "/story/phase3.html"
}
```

**Response:**
```json
{
  "success": true,
  "module_id": "mod_claim_abc12345",
  "created_at": 1737849600000
}
```

### GET `/api/modules/:id`
**Response:**
```json
{
  "success": true,
  "module": {
    "id": "mod_claim_abc12345",
    "module_type": "claim-rewards",
    "config": { /* full config object */ },
    "page_path": "/story/phase3.html",
    "created_by": "admin",
    "created_at": 1737849600000,
    "updated_at": 1737849600000
  }
}
```

### PUT `/api/modules/:id`
**Request:**
```json
{
  "config": { /* updated config object */ }
}
```

**Response:**
```json
{
  "success": true,
  "updated_at": 1737850000000
}
```

### DELETE `/api/modules/:id`
**Response:**
```json
{
  "success": true,
  "deleted_id": "mod_claim_abc12345"
}
```

### GET `/api/modules/list`
**Query Params:**
- `type` - Filter by module_type
- `page` - Filter by page_path
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "success": true,
  "modules": [ /* array of module objects */ ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

---

## Security Benefits

### Before (HTML Attributes)
```html
<!-- Visible and editable in DevTools -->
<div data-config='{"price_wax":"10.00000000","template_id":"123456"}'></div>
```

**Risks:**
- User could change price_wax to "0.00000001"
- User could change template_id to different NFT
- No audit trail of who changed what
- Hard to detect tampering

### After (Database)
```html
<!-- Just a reference ID -->
<div data-module-id="mod_paid_xyz78901"></div>
```

**Benefits:**
- ✅ User can't modify price or template ID
- ✅ Server validates everything before processing
- ✅ Admin-only write access via authenticated endpoints
- ✅ Full audit trail (created_by, created_at, updated_at)
- ✅ Easy to rollback changes (keep version history)
- ✅ Centralized management (view all module instances)

**Server-Side Validation Example:**
```javascript
// Even if user somehow modifies the ID, server validates
const module = db.moduleInstances.getById(module_id);
if (!module) {
  return res.status(404).json({ error: 'Module not found' });
}

// Use ONLY database values, never trust client input
const price = module.config.price_wax;  // From database
const templateId = module.config.template_id;  // From database

// Validate transaction matches database values
if (txAmount !== price) {
  return res.status(400).json({ error: 'Payment mismatch' });
}
```

---

## Backward Compatibility

### Module Loader Logic

```javascript
// public/modules/module-loader.js

async function loadModule(container) {
  const moduleType = container.dataset.module;
  const moduleId = container.dataset.moduleId;
  const configAttr = container.dataset.config;

  let config = {};

  // NEW: Check for database ID first
  if (moduleId) {
    try {
      const response = await fetch(`/api/modules/${moduleId}`);
      const data = await response.json();

      if (data.success) {
        config = data.module.config;
      } else {
        console.error(`Failed to load module ${moduleId}`);
        return;
      }
    } catch (error) {
      console.error(`Error fetching module ${moduleId}:`, error);
      return;
    }
  }
  // OLD: Fall back to inline config
  else if (configAttr) {
    try {
      config = JSON.parse(configAttr);
    } catch (error) {
      console.error('Invalid config JSON:', error);
      return;
    }
  }

  // Load and initialize module with config
  // ... rest of module loading logic
}
```

### Site-Builder Save Logic

```javascript
// public/site-builder.js

async function saveModule(moduleType, moduleConfig) {
  // NEW: Save to database and use ID
  const response = await fetch('/api/modules/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      module_type: moduleType,
      config: moduleConfig,
      page_path: currentPagePath
    })
  });

  const data = await response.json();

  if (data.success) {
    return data.module_id;  // Use this in data-module-id attribute
  } else {
    throw new Error('Failed to save module config');
  }
}
```

---

## Testing Checklist

- [ ] Create module instance via API
- [ ] Retrieve module instance via API
- [ ] Update module instance via API
- [ ] Delete module instance via API
- [ ] Module-loader fetches config from database
- [ ] Module-loader falls back to data-config if no data-module-id
- [ ] Site-builder creates database records on save
- [ ] Site-builder loads database configs on edit
- [ ] Admin can view all module instances
- [ ] Non-admin cannot create/update/delete modules
- [ ] Config validation works (invalid JSON rejected)
- [ ] Migration script converts existing pages
- [ ] Existing pages still work during transition

---

**Schema Version:** 1.0
**Created:** January 24, 2026
**Status:** Ready for Implementation
