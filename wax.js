const fetch = require('node-fetch');
const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextEncoder, TextDecoder } = require('util');
require('dotenv').config();

// Configuration - Multiple AtomicAssets API endpoints for fallback
// Only verified working endpoints (tested Dec 2025)
let ATOMIC_APIS = [
  'https://aa.wax.blacklusion.io',      // ⚡ Fastest - 86ms
  'https://atomic.wax.eosrio.io',       // Reliable - 594ms
  'https://wax.api.atomicassets.io',    // Official (can be slow)
  'https://aa.dapplica.io'              // Backup
];

// Allow runtime configuration - default to fastest tested endpoint
let preferredAtomicAPI = process.env.PREFERRED_ATOMIC_API || 'https://aa.wax.blacklusion.io';

// Function to set preferred API endpoint
function setPreferredAtomicAPI(endpoint) {
  if (endpoint && !ATOMIC_APIS.includes(endpoint)) {
    ATOMIC_APIS.unshift(endpoint); // Add to front of list
  }
  preferredAtomicAPI = endpoint;
  console.log(`✅ Preferred Atomic API set to: ${endpoint}`);
}

// Function to add custom endpoint
function addCustomAtomicAPI(endpoint) {
  if (!ATOMIC_APIS.includes(endpoint)) {
    ATOMIC_APIS.push(endpoint);
    console.log(`✅ Added custom Atomic API: ${endpoint}`);
    return true;
  }
  return false;
}

// Function to get current endpoints list
function getAtomicAPIs() {
  return {
    preferred: preferredAtomicAPI,
    endpoints: ATOMIC_APIS
  };
}

const WAX_RPC_ENDPOINT = process.env.WAX_RPC_ENDPOINT || 'https://api.waxsweden.org';
const WAX_ACCOUNT = process.env.WAX_ACCOUNT;
const WAX_PRIVATE_KEY = process.env.WAX_PRIVATE_KEY;

// Initialize EOSJS
let waxApi = null;
if (WAX_PRIVATE_KEY) {
  const signatureProvider = new JsSignatureProvider([WAX_PRIVATE_KEY]);
  const rpc = new JsonRpc(WAX_RPC_ENDPOINT, { fetch });
  waxApi = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  });
}

/**
 * Get all NFT assets for a specific account (with pagination)
 * @param {string} account - WAX account name
 * @param {string} collection - Collection name (optional)
 * @returns {Promise<Array>} Array of assets
 */
async function getUserAssets(account, collection = null) {
  let lastError = null;

  // Prioritize preferred endpoint, then try others
  const endpointsToTry = preferredAtomicAPI
    ? [preferredAtomicAPI, ...ATOMIC_APIS.filter(api => api !== preferredAtomicAPI)]
    : ATOMIC_APIS;

  // Try multiple API endpoints with fallback
  for (const ATOMIC_API of endpointsToTry) {
    try {
      console.log(`🔄 Fetching assets from ${ATOMIC_API}...`);

      let allAssets = [];
      let page = 1;
      let hasMore = true;
      const limit = 1000;

      // Paginate through all results
      while (hasMore) {
        let url = `${ATOMIC_API}/atomicassets/v1/assets?owner=${account}&limit=${limit}&page=${page}`;
        if (collection) {
          url += `&collection_name=${collection}`;
        }
        // Add cache-busting timestamp
        url += `&_t=${Date.now()}`;

        const response = await fetch(url, { timeout: 15000 });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const assets = data.data || [];

        console.log(`   Page ${page}: ${assets.length} assets`);

        allAssets = allAssets.concat(assets);

        // If we got fewer results than the limit, we've reached the end
        if (assets.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(`✅ Fetched ${allAssets.length} total assets from ${ATOMIC_API}`);
      return allAssets;
    } catch (error) {
      console.warn(`❌ Failed ${ATOMIC_API}:`, error.message);
      lastError = error;
      continue; // Try next endpoint
    }
  }

  // All endpoints failed
  throw new Error(`All AtomicAssets APIs unavailable. Last error: ${lastError?.message}`);
}

/**
 * Get template information
 * @param {string} collection - Collection name
 * @param {number} templateId - Template ID
 * @returns {Promise<Object>} Template data
 */
/**
 * Fetch template data by querying a sample asset from AtomicAssets API
 * This is a fallback when the templates endpoint fails
 * @param {string} collection - Collection name
 * @param {number} templateId - Template ID
 * @returns {Promise<Object>} Template data from a sample asset
 */
async function getTemplateFromAssetSample(collection, templateId) {
  for (const ATOMIC_API of ATOMIC_APIS) {
    try {
      // Query for one asset with this template_id to get full template metadata
      const url = `${ATOMIC_API}/atomicassets/v1/assets?collection_name=${collection}&template_id=${templateId}&limit=1`;
      const response = await fetch(url, { timeout: 10000 });

      if (!response.ok) {
        throw new Error(`Assets query failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const sampleAsset = data.data[0];
        console.log(`✅ Fetched template ${templateId} metadata from sample asset (${ATOMIC_API})`);

        // Return template data extracted from the sample asset
        return {
          template_id: sampleAsset.template?.template_id || templateId,
          immutable_data: sampleAsset.template?.immutable_data || sampleAsset.data || {},
          schema: sampleAsset.schema?.schema_name,
          collection_name: collection
        };
      }
    } catch (error) {
      console.warn(`❌ Failed to fetch template from assets API (${ATOMIC_API}):`, error.message);
      continue;
    }
  }

  return null;
}

async function getTemplate(collection, templateId) {
  let lastError = null;

  // Try multiple API endpoints with fallback
  for (const ATOMIC_API of ATOMIC_APIS) {
    try {
      const url = `${ATOMIC_API}/atomicassets/v1/templates/${collection}/${templateId}`;
      const response = await fetch(url, { timeout: 10000 });

      if (!response.ok) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched template ${templateId} from ${ATOMIC_API}`);
      return data.data;
    } catch (error) {
      console.warn(`❌ Failed to fetch template from ${ATOMIC_API}:`, error.message);
      lastError = error;
      continue;
    }
  }

  // All template API endpoints failed - try fetching from a sample asset
  console.warn(`⚠️ All AtomicAssets template endpoints failed for template ${templateId}, trying asset sample fallback...`);
  const assetSampleTemplate = await getTemplateFromAssetSample(collection, templateId);
  if (assetSampleTemplate) {
    return assetSampleTemplate;
  }

  // Last resort: return minimal template data so asset can still be used
  console.error(`❌ All template fetch methods failed for ${templateId}, returning minimal data`);
  return {
    template_id: templateId,
    immutable_data: {},
    collection_name: collection
  };
}

/**
 * Convert IPFS hash to usable URL
 * @param {string} ipfsHash - IPFS hash (e.g., "QmXXX" or "ipfs://QmXXX")
 * @returns {string} Full IPFS URL
 */
function getIpfsUrl(ipfsHash) {
  if (!ipfsHash) return null;

  // Remove ipfs:// prefix if present
  const hash = ipfsHash.replace('ipfs://', '');

  // Use ipfs.io gateway
  return `https://ipfs.io/ipfs/${hash}`;
}

/**
 * Check if user holds any whitelisted NFTs
 * @param {string} account - WAX account name
 * @param {string} collection - Collection name
 * @param {Array<number>} whitelistTemplates - Array of template IDs
 * @returns {Promise<Array>} Array of matching assets
 */
async function checkEligibility(account, collection, whitelistTemplates) {
  try {
    console.log(`🔍 Checking eligibility for ${account}`);
    console.log(`📋 Collection: ${collection}`);
    console.log(`✅ Whitelist templates:`, whitelistTemplates);

    const assets = await getUserAssets(account, collection);
    console.log(`📦 Found ${assets.length} total assets in collection`);

    // Filter assets that match whitelisted templates
    const eligibleAssets = assets.filter(asset => {
      const templateId = parseInt(asset.template.template_id);
      const isEligible = whitelistTemplates.includes(templateId);

      if (isEligible) {
        console.log(`✅ MATCH: Asset ${asset.asset_id} with template ${templateId}`);
      }

      return isEligible;
    });

    console.log(`🎯 Found ${eligibleAssets.length} eligible assets`);

    if (eligibleAssets.length === 0) {
      console.log('❌ No eligible assets found');
      console.log('📝 User template IDs:', assets.map(a => a.template.template_id).slice(0, 20));
    }

    // Enhance eligible assets with image/video URLs (prioritize video over img)
    const enhancedAssets = eligibleAssets.map(asset => {
      const video = asset.data?.video || asset.template?.immutable_data?.video;
      const img = asset.data?.img || asset.template?.immutable_data?.img;
      const media = video || img;

      return {
        ...asset,
        image_url: media ? getIpfsUrl(media) : null,
        is_video: !!video
      };
    });

    return enhancedAssets;
  } catch (error) {
    console.error('Error checking eligibility:', error);
    throw error;
  }
}

/**
 * Check account CPU resources
 * @param {string} account - WAX account name
 * @returns {Promise<Object>} Resource information
 */
async function getAccountResources(account) {
  try {
    const rpc = new JsonRpc(WAX_RPC_ENDPOINT, { fetch });
    const accountInfo = await rpc.get_account(account);

    const cpuLimit = accountInfo.cpu_limit || {};
    const netLimit = accountInfo.net_limit || {};

    return {
      cpu: {
        used: cpuLimit.used || 0,
        available: cpuLimit.available || 0,
        max: cpuLimit.max || 0,
        percentage: cpuLimit.max > 0 ? ((cpuLimit.used / cpuLimit.max) * 100).toFixed(2) : 0
      },
      net: {
        used: netLimit.used || 0,
        available: netLimit.available || 0,
        max: netLimit.max || 0,
        percentage: netLimit.max > 0 ? ((netLimit.used / netLimit.max) * 100).toFixed(2) : 0
      },
      ram: {
        used: accountInfo.ram_usage || 0,
        quota: accountInfo.ram_quota || 0,
        available: (accountInfo.ram_quota || 0) - (accountInfo.ram_usage || 0)
      }
    };
  } catch (error) {
    console.error('Error fetching account resources:', error);
    return null;
  }
}

/**
 * Mint a new NFT to a user's account
 * @param {string} toAccount - Recipient account
 * @param {string} collection - Collection name
 * @param {number} templateId - Template ID to mint
 * @param {Object} immutableData - Immutable data (optional)
 * @param {Object} mutableData - Mutable data (optional)
 * @returns {Promise<Object>} Transaction result
 */
async function mintNFT(toAccount, collection, templateId, immutableData = {}, mutableData = {}) {
  if (!waxApi) {
    throw new Error('WAX API not initialized. Check WAX_PRIVATE_KEY configuration.');
  }

  if (!WAX_ACCOUNT) {
    throw new Error('WAX_ACCOUNT not configured.');
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('🔨 MINT NFT REQUEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Minter Account: ${WAX_ACCOUNT}`);
  console.log(`   Recipient: ${toAccount}`);
  console.log(`   Collection: ${collection}`);
  console.log(`   Template ID: ${templateId}`);
  console.log(`   RPC Endpoint: ${WAX_RPC_ENDPOINT}`);
  console.log('───────────────────────────────────────────────────────');

  try {
    // Step 1: Check minter account resources
    console.log('📊 Checking minter account resources...');
    const resources = await getAccountResources(WAX_ACCOUNT);

    if (resources) {
      console.log(`   CPU: ${resources.cpu.available.toLocaleString()} / ${resources.cpu.max.toLocaleString()} available (${resources.cpu.percentage}% used)`);
      console.log(`   NET: ${resources.net.available.toLocaleString()} / ${resources.net.max.toLocaleString()} available (${resources.net.percentage}% used)`);
      console.log(`   RAM: ${resources.ram.available.toLocaleString()} bytes available`);

      if (resources.cpu.available < 1000) {
        console.warn('⚠️  WARNING: Very low CPU available!');
      }
    } else {
      console.warn('⚠️  Could not fetch account resources');
    }

    // Step 2: Fetch template to get schema name
    console.log('───────────────────────────────────────────────────────');
    console.log('📋 Fetching template information...');
    const template = await getTemplate(collection, templateId);

    if (!template || !template.schema) {
      throw new Error(`Template ${templateId} not found or has no schema`);
    }

    const schemaName = template.schema.schema_name;
    console.log(`   Schema: ${schemaName}`);
    console.log(`   Template Name: ${template.name || 'N/A'}`);
    console.log(`   Issued Supply: ${template.issued_supply || 0}`);

    // Step 3: Prepare transaction data
    console.log('───────────────────────────────────────────────────────');
    console.log('🔧 Preparing transaction...');

    // Convert data to AtomicAssets format
    const immutableDataArray = Object.entries(immutableData).map(([key, value]) => ({
      key,
      value: [typeof value === 'string' ? 'string' : 'uint64', value]
    }));

    const mutableDataArray = Object.entries(mutableData).map(([key, value]) => ({
      key,
      value: [typeof value === 'string' ? 'string' : 'uint64', value]
    }));

    const actionData = {
      authorized_minter: WAX_ACCOUNT,
      collection_name: collection,
      schema_name: schemaName, // Use actual schema from template
      template_id: templateId,
      new_asset_owner: toAccount,
      immutable_data: immutableDataArray,
      mutable_data: mutableDataArray,
      tokens_to_back: []
    };

    console.log('   Action Data:');
    console.log('   ', JSON.stringify(actionData, null, 2).split('\n').join('\n    '));

    const actions = [{
      account: 'atomicassets',
      name: 'mintasset',
      authorization: [{
        actor: WAX_ACCOUNT,
        permission: 'active',
      }],
      data: actionData,
    }];

    // Step 4: Send transaction
    console.log('───────────────────────────────────────────────────────');
    console.log('📤 Sending transaction to blockchain...');
    console.log(`   Transaction expiration: 30 seconds`);
    console.log(`   Blocks behind: 3`);

    const result = await waxApi.transact(
      { actions },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ MINT SUCCESSFUL!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Transaction ID: ${result.transaction_id}`);
    console.log(`   Block Number: ${result.processed.block_num}`);
    console.log(`   Block Time: ${result.processed.block_time}`);
    console.log('═══════════════════════════════════════════════════════');

    return {
      success: true,
      transaction_id: result.transaction_id,
      block_num: result.processed.block_num,
      block_time: result.processed.block_time
    };
  } catch (error) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('❌ MINT FAILED');
    console.log('═══════════════════════════════════════════════════════');
    console.error('Error details:', error);

    if (error.json) {
      console.log('Error JSON:', JSON.stringify(error.json, null, 2));
    }

    console.log('═══════════════════════════════════════════════════════');
    throw error;
  }
}

/**
 * Get collection information
 * @param {string} collection - Collection name
 * @returns {Promise<Object>} Collection data
 */
async function getCollection(collection) {
  try {
    const url = `${ATOMIC_API}/atomicassets/v1/collections/${collection}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Collection not found: ${collection}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching collection:', error);
    throw error;
  }
}

/**
 * Verify transaction on blockchain
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Transaction data
 */
async function verifyTransaction(transactionId) {
  try {
    const rpc = new JsonRpc(WAX_RPC_ENDPOINT, { fetch });
    const transaction = await rpc.history_get_transaction(transactionId);
    return transaction;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    throw error;
  }
}

/**
 * Get user assets LIVE from blockchain RPC (not cached)
 * Queries atomicassets contract directly for real-time data
 * @param {string} account - WAX account name
 * @param {string} collection - Collection name (optional filter)
 * @param {Array<number>} templateFilter - Template IDs to filter (optional)
 * @returns {Promise<Array>} Array of assets with template data
 */
async function getUserAssetsLive(account, collection = null, templateFilter = null) {
  // Live RPC endpoints - prioritize alohaeos per user request
  // These query blockchain DIRECTLY for real-time wallet ownership
  const rpcEndpoints = [
    'https://api.wax.alohaeos.com',      // 🔴 PRIMARY - User requested
    'https://wax.greymass.com',
    'https://api.waxsweden.org',
    'https://wax.eosphere.io',
    'https://wax.eu.eosamsterdam.net',
    'https://wax.cryptolions.io'
  ];

  let lastError = null;

  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`🔗 Querying LIVE blockchain via ${endpoint}...`);
      const rpc = new JsonRpc(endpoint, { fetch });

      let allAssets = [];
      let lowerBound = null;
      let hasMore = true;

      // Paginate through assets table (scoped by owner)
      while (hasMore && allAssets.length < 10000) {
        const result = await rpc.get_table_rows({
          json: true,
          code: 'atomicassets',
          scope: account,  // Assets are scoped by owner
          table: 'assets',
          lower_bound: lowerBound,
          limit: 1000,
          reverse: false,
          show_payer: false
        });

        if (!result.rows || result.rows.length === 0) {
          hasMore = false;
          break;
        }

        // Filter by collection if specified
        let filteredAssets = result.rows;
        if (collection) {
          filteredAssets = filteredAssets.filter(asset =>
            asset.collection_name === collection
          );
        }

        // Filter by template IDs if specified
        if (templateFilter && templateFilter.length > 0) {
          filteredAssets = filteredAssets.filter(asset =>
            templateFilter.includes(parseInt(asset.template_id))
          );
        }

        allAssets = allAssets.concat(filteredAssets);

        // Check if more results
        if (result.rows.length < 1000) {
          hasMore = false;
        } else {
          lowerBound = result.next_key;
        }
      }

      console.log(`✅ Found ${allAssets.length} assets LIVE from blockchain`);

      // Fetch mint numbers from AtomicAssets API (blockchain doesn't have them)
      if (allAssets.length > 0) {
        const atomicEndpoints = [
          'https://aa-wax-public1.neftyblocks.com',
          'https://wax-aa.eosdac.io',
          'https://atomic-wax-mainnet.wecan.dev',
          'https://wax-atomic-api.eosphere.io'
        ];

        // Fetch in batches of 100 to avoid URL length limits
        const batchSize = 100;
        for (let i = 0; i < allAssets.length; i += batchSize) {
          const batch = allAssets.slice(i, i + batchSize);
          const assetIds = batch.map(a => a.asset_id).join(',');

          let mintsFetched = false;
          for (const atomicEndpoint of atomicEndpoints) {
            try {
              const response = await fetch(`${atomicEndpoint}/atomicassets/v1/assets?ids=${assetIds}&limit=${batchSize}`, {
                timeout: 5000
              });

              if (response.ok) {
                const apiData = await response.json();
                const apiAssets = apiData.data;

                // Map mint numbers to blockchain assets
                const mintMap = {};
                apiAssets.forEach(apiAsset => {
                  mintMap[apiAsset.asset_id] = apiAsset.template_mint;
                });

                // Add mint numbers to this batch
                batch.forEach(asset => {
                  asset.template_mint = mintMap[asset.asset_id] || null;
                });

                const mintsFound = batch.filter(a => a.template_mint).length;
                console.log(`✅ Fetched mint numbers for ${mintsFound}/${batch.length} assets from ${atomicEndpoint}`);
                mintsFetched = true;
                break;
              }
            } catch (err) {
              console.warn(`Failed to fetch mints from ${atomicEndpoint}:`, err.message);
              continue;
            }
          }

          if (!mintsFetched) {
            console.warn(`Could not fetch mint numbers for batch ${i / batchSize + 1}`);
          }
        }
      }

      // Return RAW blockchain data with mint numbers, but without template metadata
      // Frontend will enrich with template data from its cache
      const rawAssets = allAssets.map(asset => ({
        asset_id: asset.asset_id,
        template_mint: asset.template_mint || null,
        template: {
          template_id: asset.template_id
        },
        backed_tokens: asset.backed_tokens || [],
        collection: {
          collection_name: asset.collection_name
        }
      }));

      return rawAssets;

    } catch (error) {
      console.warn(`❌ RPC ${endpoint} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
}

/**
 * Transfer NFTs from one wallet to another
 * @param {string} fromWallet - Source wallet
 * @param {string} toWallet - Destination wallet
 * @param {string[]} assetIds - Array of asset IDs to transfer
 * @param {string} memo - Transfer memo
 * @param {string} privateKey - Private key of source wallet
 * @returns {Promise<object>} Transaction result
 */
async function transferNFTs(fromWallet, toWallet, assetIds, memo, privateKey) {
  const { Api, JsonRpc } = require('eosjs');
  const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
  const fetch = require('node-fetch');
  const { TextEncoder, TextDecoder } = require('util');

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

      console.log(`✅ Transfer successful! TX: ${result.transaction_id}`);
      return {
        transaction_id: result.transaction_id,
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

  throw new Error(`All RPC endpoints failed. Last: ${lastError?.message}`);
}

module.exports = {
  getUserAssets,
  getUserAssetsLive,
  getTemplate,
  checkEligibility,
  mintNFT,
  transferNFTs,
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
