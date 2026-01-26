# Unified Module Testing Plan

## Purpose
Systematically test all 10 module types in the Unified Module to ensure they work reliably every time.

## Test Environment
- Page: /story/phase1.html
- Browser: Chrome/Firefox
- Wallet: Connected (czkua.wam via WCW)

## Module Types to Test

### ✅ = Working | ⚠️ = Partial | ❌ = Broken | 🔧 = Needs Fix

| # | Module Type | Status | Issues Found | Fixed |
|---|-------------|--------|--------------|-------|
| 1 | paid-claim | ⚠️ | TBD | No |
| 2 | nefty-drop | ❌ | drop_id not passed to iframe, X-Frame-Options error | 🔧 |
| 3 | text-block | ⚠️ | TBD | No |
| 4 | image-block | ⚠️ | TBD | No |
| 5 | claim-rewards | ⚠️ | TBD | No |
| 6 | gated-paid-claim | ⚠️ | TBD | No |
| 7 | factory-craft | ⚠️ | TBD | No |
| 8 | transfer-mode | ⚠️ | TBD | No |
| 9 | unpack | ❌ | Old module checking for wax/anchor directly | 🔧 |
| 10 | blend-array | ❌ | Old module checking for wax/anchor directly | 🔧 |

## Test Procedure

For each module type:

1. **Configure in Site Builder**
   - Select module type from dropdown
   - Fill in all required fields
   - Save and export

2. **Load Page**
   - Open phase1.html
   - Check console for errors
   - Note initialization messages

3. **Check UI**
   - Does module render correctly?
   - Are all expected elements visible?
   - Does layout look correct?

4. **Test Wallet Connection** (for wallet-based modules)
   - Does auto-connect work?
   - Can manually connect?
   - Wallet state persists on reload?

5. **Test Core Functionality**
   - Can perform main action? (claim, purchase, transfer, etc.)
   - Transaction succeeds?
   - Error handling works?

6. **Document Results**
   - Copy console logs
   - Screenshot any errors
   - Note specific issues

## Known Issues

### Issue #1: NeftyDrop iframe URL missing drop_id
**Module:** nefty-drop
**Error:** `Refused to display 'https://neftyblocks.com/' in a frame`
**Root Cause:** Config has drop_id but unified-module.js not using it in iframe URL
**Fix:** Update initNeftyDrop() to use config.drop_id
**Status:** 🔧 Fix in progress

### Issue #2: Old modules checking for wax/anchor directly
**Modules:** unpack, blend-array, factory-craft, transfer-mode
**Error:** `❌ WaxJS not loaded after waiting`
**Root Cause:** These modules have waitForLibraries() that checks for global wax/anchor instead of WalletManager
**Fix:** Update modules to use WalletManager pattern or convert to UnifiedModuleBase
**Status:** 🔧 Fix in progress

### Issue #3: X-Frame-Options blocking NeftyBlocks embed
**Module:** nefty-drop
**Error:** `Refused to display 'https://neftyblocks.com/' in a frame because it set 'X-Frame-Options' to 'deny'`
**Root Cause:** NeftyBlocks.com homepage blocks iframe embedding
**Fix:** Must use correct embed URL format: `https://neftyblocks.com/c/{collection}/drops/{drop_id}/embed`
**Status:** 🔧 Fix in progress

## Testing Order

We'll test in this order (simple → complex):

1. ✅ **text-block** (no wallet needed, simple)
2. ✅ **image-block** (no wallet needed, simple)
3. ✅ **nefty-drop** (no wallet, but has iframe - fix first)
4. ✅ **paid-claim** (wallet-based, using UnifiedModuleBase)
5. ✅ **unpack** (wallet-based, old-style - needs fix)
6. ✅ **blend-array** (wallet-based, old-style - needs fix)
7. ✅ **factory-craft** (wallet-based, old-style - needs fix)
8. ✅ **transfer-mode** (wallet-based, old-style - needs fix)
9. ✅ **claim-rewards** (wallet-based, using UnifiedModuleBase)
10. ✅ **gated-paid-claim** (wallet-based, using UnifiedModuleBase with rewards builder)

## Test Configuration Examples

### 1. text-block
```json
{
  "module_type": "text-block",
  "heading": "Welcome to Future's Relic",
  "content": "This is a test of the text block module.",
  "style": "normal"
}
```

### 2. image-block
```json
{
  "module_type": "image-block",
  "image_url": "https://ipfs.io/ipfs/QmPQNbkVAh3ektjrYvwn...",
  "alt_text": "Test Image",
  "caption": "A test image",
  "width": "500px",
  "alignment": "center"
}
```

### 3. nefty-drop
```json
{
  "module_type": "nefty-drop",
  "collection": "futuresrelic",
  "drop_id": "229014",
  "limit": "1"
}
```

### 4. paid-claim
```json
{
  "module_type": "paid-claim",
  "template_id": "858912",
  "template_name": "Starter Pack - Promo Pack",
  "template_image": "https://ipfs.io/ipfs/QmPQNbkVAh3ektjrYvwn...",
  "price_wax": "15.00000000",
  "payment_wallet": "futuresrelic",
  "collection_name": "futuresrelic",
  "auto_connect": true,
  "show_purchase_history": true
}
```

### 5. unpack
```json
{
  "module_type": "unpack",
  "collection": "futuresrelic",
  "template_id": "204194",
  "auto_connect": true
}
```

### 6. blend-array
```json
{
  "module_type": "blend-array",
  "collection": "futuresrelic",
  "blend_ids": "1234,5678",
  "auto_connect": true
}
```

## Current Test Session

**Date:** 2025-01-26
**Tester:** User
**Session:** Review and fix unified module issues

### Tests Completed

#### Test 1: nefty-drop
**Status:** ❌ FAILED
**Config Used:**
```json
{
  "module_type": "nefty-drop",
  "drop_id": "229014",
  "collection": "futuresrelic"
}
```
**Console Output:**
```
✅ Unified Module initialized in #module-2
Config: {module_type: 'nefty-drop', drop_id: '229014', collection: 'futuresrelic', ...}
🎯 Module Type: nefty-drop
✅ NeftyBlocks Drop initialized: futuresrelic - Drop #229014
Refused to display 'https://neftyblocks.com/' in a frame because it set 'X-Frame-Options' to 'deny'.
```
**Issues:**
1. drop_id not being used in iframe URL
2. URL is just 'https://neftyblocks.com/' instead of embed URL

**Next Step:** Fix initNeftyDrop() in unified-module.js

#### Test 2: unpack
**Status:** ❌ FAILED
**Config Used:**
```json
{
  "module_type": "unpack",
  "template_id": "204194",
  "collection": "futuresrelic"
}
```
**Console Output:**
```
✅ Calling init_unpack() with container #unified-module-1769438402494-zq79683c2
✅ Unpack module initialized
❌ WaxJS not loaded after waiting
⚠️ Anchor wallet not loaded after waiting
```
**Issues:**
1. Old unpack.js still checking for global wax/anchor
2. Needs to use WalletManager instead

**Next Step:** Fix unpack.js waitForLibraries

#### Test 3: blend-array
**Status:** ❌ FAILED
**Config Used:**
```json
{
  "module_type": "blend-array",
  "collection": "futuresrelic",
  "blend_ids": ""
}
```
**Console Output:**
```
✅ Calling init_blend_array() with container #unified-module-1769438501039-weh3vjk08
✅ Blend Array module initialized
❌ WaxJS not loaded
⚠️ Anchor wallet not loaded
```
**Issues:**
1. Same as unpack - checking for global wax/anchor
2. Needs WalletManager

**Next Step:** Fix blend-array.js waitForLibraries

## Fixes Applied

### Fix #1: NeftyDrop iframe URL
**File:** `/public/modules/unified-module.js`
**Function:** `initNeftyDrop()`
**Status:** 🔧 Pending

### Fix #2: Unpack WalletManager integration
**File:** `/public/modules/unpack.js`
**Function:** `init()` waitForLibraries
**Status:** 🔧 Pending

### Fix #3: Blend Array WalletManager integration
**File:** `/public/modules/blend-array.js`
**Function:** `init()` waitForLibraries
**Status:** 🔧 Pending

## Next Steps

1. ✅ Fix initNeftyDrop() to use drop_id
2. ✅ Fix old modules to remove wax/anchor checks
3. ✅ Test text-block (should work)
4. ✅ Test image-block (should work)
5. ✅ Test all fixed modules
6. ✅ Test remaining UnifiedModuleBase modules
7. ✅ Update this document with results
8. ✅ Commit all fixes with detailed messages

## Success Criteria

A module is considered ✅ WORKING when:
- No console errors
- UI renders correctly
- Wallet connects (if needed)
- Core functionality works
- Config options all work as expected

## Documentation Location

- This file: `/TESTING_PLAN.md`
- Related docs: `/CHANGELOG.md`, `/DEV_NOTES.md`
- Commit messages should reference test results
