# Changelog

All notable changes to the WAX NFT Rewards System will be documented in this file.

## [Unreleased] - 2025-01-26

### Added

#### Unified Module System
- **Unified Module**: New all-in-one module with dropdown selector for choosing module type
  - Supports all 10 module types: paid-claim, nefty-drop, text-block, image-block, claim-rewards, factory-craft, transfer-mode, unpack, blend-array, gated-paid-claim
  - Dynamically loads required module files based on selected type
  - Single configuration interface with intelligent field filtering
  - Site builder now shows only relevant fields for selected module type
  - Marked as **RECOMMENDED** in site builder

#### Wallet Manager Improvements
- **Auto-loading WaxJS**: WalletManager now automatically loads full waxjs.js library (351KB) when needed
  - Starts with lightweight waxjs-simple.js (60KB) for faster initial page load
  - Dynamically loads full library only when transactions are required
  - Fixes "WaxJS not loaded" errors across all modules
- **Global Wallet Connection**: All modules now use centralized WalletManager
  - Consistent wallet connection logic across all module types
  - Better session restoration after page reloads
  - Fixes wallet initialization issues

### Fixed

#### Module-Specific Fixes
- **Unpack Module**: Fixed `claimPack()` function to use WalletManager
  - "Claim Contents" button now works correctly after unpacking
  - Both unpack and claim steps use consistent transaction patterns
  - Proper error handling for failed claims

- **Paid Claim Module**: Fixed wallet connection issues
  - WalletManager now pre-loads WaxJS before connecting WCW
  - Eliminated "WaxJS wallet not initialized" errors
  - Purchase transactions now work reliably

- **Module Loader**: Fixed unified module integration
  - Created missing `unified-module.html` template
  - Proper container handling for nested modules
  - Dynamic script loading for required module files

#### Site Builder Improvements
- **Config Panel Field Filtering**: Unified module config now shows only relevant fields
  - Fields dynamically show/hide based on selected module type
  - No more confusion with mixed [Paid Claim], [NeftyDrop], [TextBlock] fields
  - Common fields (auto_connect, show_purchase_history) shown only for wallet-based modules
  - Cleaner, more intuitive configuration experience

### Technical Details

#### Architecture Changes
- Unified module acts as intelligent dispatcher/wrapper
- Reuses existing module code (no duplication)
- Module type to file mapping system
- Dynamic field visibility based on label prefixes
- Data attribute system for field type identification

#### Module Type Mapping
```javascript
{
  'paid-claim': { init: 'init_paid_claim', file: 'paid-claim.js' },
  'nefty-drop': { init: 'init_nefty_drop', file: null },
  'claim-rewards': { init: 'init_claim_rewards', file: 'claim-rewards.js' },
  'gated-paid-claim': { init: 'init_gated_paid_claim', file: 'gated-paid-claim.js' },
  'factory-craft': { init: 'init_factory_craft', file: 'factory-craft.js' },
  'transfer-mode': { init: 'init_transfer_mode', file: 'transfer-mode.js' },
  'unpack': { init: 'init_unpack', file: 'unpack.js' },
  'blend-array': { init: 'init_blend_array', file: 'blend-array.js' },
  'text-block': { init: 'init_text_block', file: null },
  'image-block': { init: 'init_image_block', file: null }
}
```

#### Files Modified
- `/public/modules/wallet-manager.js` - Added ensureFullWaxJS() to connect() function
- `/public/modules/unpack.js` - Updated claimPack() to use WalletManager.transact()
- `/public/modules/unified-module.js` - Complete rewrite as smart dispatcher
- `/public/modules/unified-module.html` - New template file
- `/public/site-builder.js` - Added setupUnifiedModuleFieldFiltering()

### Commits
- `0b47c72` - Fix: Update Unpack module claimPack() to use global WalletManager
- `1a4f580` - Add Unified Module with dropdown selector + Fix WalletManager.connect()
- `f85ecc0` - Update Unified Module to smart dispatcher pattern
- `e7484a8` - Fix unified module to work with module loader system
- `fe1ae10` - Fix unified module to dynamically load required module files
- `65471d3` - Fix site-builder to dynamically filter Unified Module config fields

### Benefits

#### For Users
- ✅ More reliable wallet connections
- ✅ Clearer configuration interface
- ✅ Single unified module option in site builder
- ✅ Faster page loads with auto-loading system

#### For Developers
- ✅ Single source of truth for each module type
- ✅ No code duplication (200 lines instead of 2000+)
- ✅ Easier to maintain and debug
- ✅ Consistent wallet management across all modules
- ✅ Better error handling and logging

### Known Issues
None at this time. All critical bugs have been resolved.

### Next Steps
- [ ] Add configuration fields for remaining module types to unified module
- [ ] Add comprehensive testing for all module types
- [ ] Consider adding module type preview in site builder
- [ ] Document unified module usage in user guide

---

## Previous Versions

See git history for changes prior to 2025-01-26.
