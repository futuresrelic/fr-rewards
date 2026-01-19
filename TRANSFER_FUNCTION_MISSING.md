# 🚨 CRITICAL: Transfer Function Missing in wax.js

## The Problem

**Error**: `wax.transferNFTs is not a function`

**Root Cause**: The function `wax.transferNFTs()` is **CALLED** in two places but **NEVER IMPLEMENTED**:
1. `server.js:3488` - Pool swap mode in crafting
2. `scheduler.js:182` - Transfer scheduled actions
3. New code trying to fulfill failed crafts

**Impact**: Pool swap mode has NEVER worked! The function was planned but never coded.

---

## ✅ The Solution: Add transferNFTs to wax.js

Looking at the existing code patterns in wax.js (especially `mintNFT` function), here's what needs to be added:

### Step 1: Add the Transfer Function to wax.js

Add this function BEFORE the `module.exports` line (around line 658):

```javascript
/**
 * Transfer NFTs from one wallet to another using private key
 * @param {string} fromWallet - Wallet sending the assets
 * @param {string} toWallet - Wallet receiving the assets
 * @param {Array<string>} assetIds - Array of asset IDs to transfer
 * @param {string} memo - Transfer memo
 * @param {string} privateKey - Private key of from_wallet
 * @returns {Promise<{transaction_id: string}>}
 */
async function transferNFTs(fromWallet, toWallet, assetIds, memo, privateKey) {
  const { Api, JsonRpc } = require('eosjs');
  const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
  const fetch = require('node-fetch');
  const { TextEncoder, TextDecoder } = require('util');

  // RPC endpoints for transactions
  const rpcEndpoints = [
    'https://api.waxsweden.org',
    'https://wax.greymass.com',
    'https://api.wax.alohaeos.com'
  ];

  let lastError = null;

  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`🔗 Attempting transfer via ${endpoint}...`);

      const rpc = new JsonRpc(endpoint, { fetch });
      const signatureProvider = new JsSignatureProvider([privateKey]);

      const api = new Api({
        rpc,
        signatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder()
      });

      // Build the transfer action
      const result = await api.transact(
        {
          actions: [{
            account: 'atomicassets',
            name: 'transfer',
            authorization: [{
              actor: fromWallet,
              permission: 'active',
            }],
            data: {
              from: fromWallet,
              to: toWallet,
              asset_ids: assetIds,
              memo: memo || ''
            },
          }]
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        }
      );

      const txid = result.transaction_id;
      console.log(`✅ Transfer successful! TX: ${txid}`);

      return {
        transaction_id: txid,
        from: fromWallet,
        to: toWallet,
        asset_count: assetIds.length,
        asset_ids: assetIds
      };

    } catch (error) {
      console.warn(`❌ ${endpoint} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`All RPC endpoints failed for transfer. Last error: ${lastError?.message}`);
}
```

### Step 2: Export the Function

Update the `module.exports` section (line 658) to include `transferNFTs`:

```javascript
module.exports = {
  getUserAssets,
  getUserAssetsLive,
  getTemplate,
  checkEligibility,
  mintNFT,
  transferNFTs,  // ← ADD THIS LINE
  getCollection,
  verifyTransaction,
  getAccountResources,
  getIpfsUrl,
  getAtomicAPIs,
  setPreferredAtomicAPI,
  addCustomAtomicAPI,
  ATOMIC_APIS,
  WAX_ACCOUNT
};
```

---

## 📝 How It Works

### Transfer Action Structure:

```javascript
{
  account: 'atomicassets',      // The AtomicAssets contract
  name: 'transfer',             // The transfer action
  authorization: [{              // Who signs (from_wallet)
    actor: fromWallet,
    permission: 'active'
  }],
  data: {
    from: fromWallet,            // Sender
    to: toWallet,                // Receiver
    asset_ids: [assetIds],       // Assets to transfer
    memo: 'Fulfill failed craft' // Optional memo
  }
}
```

### Example Usage (From Server):

```javascript
// Transfer from pool.fr to user
const transferResult = await wax.transferNFTs(
  'pool.fr',                    // from
  'czkua.wam',                  // to
  ['1099974502421', '1099974321298'],  // asset IDs
  'Fulfill failed craft #4',    // memo
  process.env.POOL_FR_PRIVATE_KEY  // private key
);

console.log(`Transferred! TX: ${transferResult.transaction_id}`);
```

---

## 🔍 Code Pattern Reference

### Similar Pattern in wax.js (mintNFT function):

Look at line ~120-180 in wax.js to see the same pattern for `mintNFT`:
- Creates JsonRpc and Api instances
- Uses JsSignatureProvider with private key
- Calls `api.transact()` with action structure
- Returns transaction_id

**Transfer uses EXACT same pattern**, just different action name and data structure.

---

## ✅ After Adding This Function

These will work:
1. **Pool swap crafting** (`server.js:3488`) - Transfer assets from pool.fr to users
2. **Scheduled transfers** (`scheduler.js:182`) - Time-triggered asset transfers
3. **Fulfill failed crafts** (new feature) - Complete failed pool swaps

---

## 🧪 Testing

1. Add the function to `wax.js`
2. Add to `module.exports`
3. Commit and push
4. Test with: "Fulfill Craft" button on a failed craft
5. Should transfer assets from pool.fr to user successfully

---

## 📊 Current State

- ❌ `transferNFTs` - **MISSING** (needs to be added)
- ✅ `mintNFT` - Implemented and working
- ✅ `getUserAssetsLive` - Implemented and working
- ✅ `getTemplate` - Implemented and working

---

**Priority**: HIGH - Pool swap feature is broken without this!
**Difficulty**: Easy - Copy pattern from mintNFT, change action details
**Impact**: Unlocks pool-based crafting + failed craft fulfillment
