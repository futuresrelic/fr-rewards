# Pool/Swap Mode Setup Instructions

The Pool/Swap Mode feature allows users to swap assets from a pool wallet instead of minting new ones, creating a circular NFT economy.

## Overview

- **Swap Mode**: Users transfer fewer ingredients to get existing assets from the pool (cheaper, encourages reuse)
- **Mint Mode**: Users transfer more ingredients to mint new assets (more expensive, feeds the pool)

## Required Environment Variable

To enable Pool/Swap Mode, you must add a private key for your pool wallet to Railway.

### Step 1: Get Your Pool Wallet Private Key

1. Open your WAX wallet (e.g., Anchor, Wombat, Cloud Wallet)
2. Navigate to the `pool.fr` account (or whatever pool wallet you're using)
3. Export or copy the **private key** for this account
   - ⚠️ **CRITICAL**: Keep this private key secure! Never share it publicly or commit it to git

### Step 2: Add to Railway Environment Variables

1. Go to your Railway project dashboard
2. Navigate to your service (deployment)
3. Click on the **"Variables"** tab
4. Click **"+ New Variable"**
5. Add the following:
   - **Variable Name**: `POOL_FR_PRIVATE_KEY`
   - **Value**: Your pool wallet's private key (starts with `5...`)
6. Click **"Add"** or **"Save"**

### Step 3: Redeploy

Railway will automatically redeploy your service with the new environment variable.

## How to Configure Pool Mode for Recipes

Once the environment variable is set, you can enable Pool Mode for any recipe:

1. Go to **Admin Panel** → **Factory Configuration**
2. Create a new recipe or edit an existing one
3. Scroll to the **"Pool/Swap Mode (Optional)"** section
4. Check **"Enable Pool/Swap Mode"**
5. Configure:
   - **Pool Wallet**: Enter your pool wallet name (e.g., `pool.fr`)
   - **Pool Ingredients**: Define the cheaper ingredient requirements for swap mode
     - Example: `3x Wax Seals` for swap vs `4x Wax Seals` for mint
6. Save the recipe

## Example Configuration

### Recipe: crEDIT Crafting

**Results**: 1x crEDIT (Template 123456)

**Mint Mode** (regular ingredients):
- 4x Wax Seal (Template 111111)

**Swap Mode** (pool ingredients):
- 3x Wax Seal (Template 111111)

**Pool Wallet**: pool.fr

**How it works**:
1. User with pool ingredients can choose to swap 3x Wax Seals for 1x crEDIT from the pool (if available)
2. User can alternatively mint a new crEDIT by transferring 4x Wax Seals
3. When minting, the new crEDIT goes to the user, and the 4x Wax Seals stay in pool.fr
4. This creates a circular economy where users are incentivized to reuse existing assets

## Security Notes

- ⚠️ **Never commit private keys to git**
- ⚠️ The `POOL_FR_PRIVATE_KEY` should only be stored in Railway's environment variables
- ⚠️ Only admins should have access to your Railway dashboard
- ⚠️ The pool wallet should only contain assets meant for swapping
- ⚠️ Regularly monitor your pool wallet for unexpected activity

## Testing the Feature

1. Set up a test recipe with pool mode enabled
2. Transfer some result assets to your pool wallet manually
3. As a user, try the swap option - it should transfer existing assets from the pool
4. Try the mint option - it should create new assets

## Troubleshooting

### "POOL_FR_PRIVATE_KEY not configured in environment"

- Make sure you added the environment variable in Railway
- Verify the variable name is exactly `POOL_FR_PRIVATE_KEY` (case-sensitive)
- Redeploy your service after adding the variable

### "Pool currently empty"

- The pool wallet doesn't have the required result assets
- Transfer some result assets to the pool wallet manually
- Or, mint some using the mint option (which feeds the pool)

### "Insufficient pool inventory"

- The pool doesn't have enough assets for the requested batch size
- Try a smaller batch size
- Or use mint mode instead

## Architecture

The system uses two different ingredient lists:
- `ingredients`: Used for mint mode (regular crafting)
- `pool_ingredients`: Used for swap mode (pool swapping)

Both produce the same `results`, but swap mode:
1. Requires fewer ingredients (cheaper)
2. Transfers existing assets from pool to user
3. Requires `POOL_FR_PRIVATE_KEY` to be configured

## Support

If you encounter issues:
1. Check Railway logs for detailed error messages
2. Verify your pool wallet has sufficient assets
3. Ensure the private key is correct and has proper permissions
4. Contact the developer if issues persist
