# Changelog

All notable changes to the WAX NFT Rewards System will be documented in this file.

## [Unreleased] - 2026-01-30

### Added

#### Custom Indexes System - Multi-Page Content Management
- **Complete Custom Index System**: New flexible content management system for creating unlimited custom index pages
  - **Database Schema**: Added 3 new tables (`custom_indexes`, `custom_phases`, `custom_phase_content`)
  - **Admin Interface**: New `/admin-custom-indexes.html` page for managing indexes, phases, and content
  - **Public Pages**: Dynamic `/custom-index.html` and `/custom-phase.html` for viewing content
  - **API Endpoints**: 15+ new REST API endpoints for CRUD operations on indexes, phases, and content
  - **Database Methods**: Comprehensive methods in `database.js` for managing custom indexes system
  - **Module Support**: Phase pages support all existing module types (text, images, NFT drops, crafting, etc.)
  - **Default Story Index**: System automatically creates "Story Progression" index with proper migration

- **Features**:
  - Create unlimited custom indexes (Story, Quests, Events, Guides, etc.)
  - Each index can have unlimited phase pages in sequential order
  - Add multiple content modules to each phase page
  - Flexible ordering and organization of phases and content
  - Enable/disable indexes and phases without deletion
  - System-protected indexes (cannot be deleted)
  - Navigation visibility controls
  - Automatic cascading deletes for data integrity
  - Rich module configuration with JSON storage

- **Admin Dashboard Integration**: Added "Custom Indexes" link to admin dashboard
- **Documentation Updates**:
  - Added Custom Indexes section to `CLAUDE_DEV_GUIDE.md` with database schema and examples
  - Added comprehensive Custom Indexes user guide to `USER_GUIDE.md` with use cases and tips

- **URLs**:
  - Admin: `/admin-custom-indexes.html`
  - View Index: `/custom-index.html?index=SLUG`
  - View Phase: `/custom-phase.html?index=SLUG&phase=SLUG`

#### Documentation Update - User Guide Refresh
- **Comprehensive Claim Page Documentation**: Updated USER_GUIDE.md with detailed claim system documentation
  - Added step-by-step claiming process with visual indicators
  - Documented eligibility checking and reward card displays
  - Explained live countdown timers and status indicators
  - Added claim history and bulk claiming features
  - Clarified quantity-matched vs standard reward types
- **Complete Story Mode Documentation**: Rewrote Story Mode section with accurate technical details
  - Documented all 6 action types (Claim, Unpack, Blend, Blend Array, Drop, Market Scout)
  - Added step-by-step quest completion flow
  - Explained progress tracking with visual indicators
  - Documented story tabs and filtering system
  - Added comparison table (Story Mode vs Regular Claims)
  - Included comprehensive troubleshooting section
- **Enhanced FAQ Section**: Updated FAQ with Story Mode questions and improved claim explanations
  - Added 10+ new Story Mode FAQs
  - Improved existing claim page FAQs with current details
  - Better organization by feature category
- **Updated Last Modified Date**: Changed from January 19 to January 29, 2026

#### PWA Admin Panel - Icon & Favicon Improvements
- **Separate Favicon Generator**: New independent favicon editor tool in PWA Admin panel
  - Generates 32x32 favicon.png separately from PWA app icons
  - Includes visual editor with scale, padding, background color, and corner roundness controls
  - Default transparent background for clean browser tab appearance
  - Allows different styling than app icons (e.g., app icons with background, favicon transparent)
  - New backend endpoint: `POST /api/pwa/upload-favicon`
  - File saved to `/public/favicon.png`

#### PWA Admin Panel - Icon Generator Updates
- **App Icon Generator Changes**: No longer generates favicon automatically
  - Generates only 8 PWA icon sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
  - Files saved to `/public/icons/` directory
  - Favicon now handled by separate generator tool

### Changed

#### Security Improvements
- **Removed Admin Link**: Removed admin panel link from public index.html footer
  - Prevents unauthorized access attempts
  - Admin panel still accessible via direct URL for authorized users only

### Technical Details

#### New Files & Endpoints
- `POST /api/pwa/upload-favicon` - Generate 32x32 favicon separately
- Frontend functions:
  - `setupFaviconUpload()` - Initialize favicon upload area
  - `handleFaviconFile()` - Process favicon file upload
  - `uploadFavicon()` - Submit favicon to backend
  - `initializeFaviconEditor()` - Setup favicon canvas editor
  - `updateFaviconEditor()` - Render favicon preview with adjustments
  - `resetFaviconEditor()` - Reset favicon editor to defaults
  - `syncFaviconBgColor()` - Sync color picker values
  - `setFaviconTransparentBg()` - Set favicon to transparent background

#### Modified Files
- `/public/admin-pwa.html` - Added separate favicon editor section (lines 657-737)
- `/public/admin-pwa.js` - Added favicon editor functions and variables
- `/server.js` - Added `/api/pwa/upload-favicon` endpoint, removed favicon generation from icon upload endpoint
- `/public/index.html` - Removed admin panel link from footer
- `/DEV_NOTES.md` - Added comprehensive PWA Admin Panel documentation

#### Frontend Variables
```javascript
// Favicon editor specific variables
let selectedFaviconFile = null;
let originalFaviconImage = null;
let isFaviconTransparent = true; // Default transparent for favicons
```

#### Why Separate Icon and Favicon Generators?
- App icons often look better with background colors for consistent branding
- Favicons look better with transparent backgrounds for browser tab display
- Different aesthetic requirements for different contexts (PWA install vs browser tab)
- Users can customize each independently for optimal appearance

### Benefits

#### For Users
- ✅ Complete control over favicon appearance separate from app icons
- ✅ Transparent favicon option for clean browser tabs
- ✅ Background color option for app icons without affecting favicon
- ✅ Enhanced security with hidden admin link

#### For Developers
- ✅ Clear separation of concerns between icon types
- ✅ Documented in DEV_NOTES.md with complete API reference
- ✅ Consistent canvas editor patterns for both tools

---

## [Released] - 2025-01-26

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
