const fetch = require('node-fetch');
const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextEncoder, TextDecoder } = require('util');
require('dotenv').config();

// Configuration - Multiple AtomicAssets API endpoints for fallback
// Expanded endpoint list from https://validate.eosnation.io/wax/reports/endpoints.html (Jan 2026)
let ATOMIC_APIS = [
  'https://aa.wax.blacklusion.io',              // Primary - Previously fastest (86ms), NL Hetzner
  'https://wax-aa.eosdac.io',                   // US Cloudflare - High reliability
  'https://atomic-wax-mainnet.wecan.dev',       // US Cloudflare - Reliable
  'https://atomic.hivebp.io',                   // US Cloudflare - Good uptime
  'https://wax-atomic.alcor.exchange',          // US Cloudflare - Exchange backed
  'https://wax-aa.eu.eosamsterdam.net',         // NL Hetzner - European backup
  'https://atomic-api.wax.cryptolions.io',      // US DigitalOcean - Alternative network
  'https://wax-atomic-api.eosphere.io',         // AU OVH - Pacific/Asia coverage
  'https://wax.eosusa.io',                      // US Charter - Diverse network
  'https://wax.api.atomicassets.io',            // Official endpoint - Can be slow
  'https://aa.dapplica.io'                      // NL Hetzner - Final backup
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

// In-memory template cache to prevent redundant blockchain fetches
// Cache structure: Map<cacheKey, {data, timestamp}>
const templateCache = new Map();
const TEMPLATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get template with caching to reduce redundant blockchain API calls
 * @param {string} collection - Collection name
 * @param {number|string} templateId - Template ID
 * @returns {Promise<Object>} Template data
 */
async function getTemplate(collection, templateId) {
  const cacheKey = `${collection}:${templateId}`;

  // Check cache first
  const cached = templateCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < TEMPLATE_CACHE_TTL) {
      console.log(`📦 Using cached template ${templateId} (age: ${Math.round(age/1000)}s)`);
      return cached.data;
    } else {
      // Cache expired, remove it
      templateCache.delete(cacheKey);
    }
  }

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

      // Cache the result
      templateCache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });

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
    // Cache the fallback result too
    templateCache.set(cacheKey, {
      data: assetSampleTemplate,
      timestamp: Date.now()
    });
    return assetSampleTemplate;
  }

  // Last resort: return minimal template data so asset can still be used
  console.error(`❌ All template fetch methods failed for ${templateId}, returning minimal data`);
  const minimalData = {
    template_id: templateId,
    immutable_data: {},
    collection_name: collection
  };

  // Cache even minimal data to avoid repeated failures
  templateCache.set(cacheKey, {
    data: minimalData,
    timestamp: Date.now()
  });

  return minimalData;
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
 * Verify a WAX token payment transaction
 * @param {string} transactionId - Transaction ID to verify
 * @param {string} expectedAmount - Expected amount in WAX (e.g., "10.00000000 WAX")
 * @param {string} expectedRecipient - Expected recipient wallet
 * @param {string} fromAccount - Expected sender wallet
 * @returns {Promise<Object>} Verification result with status and details
 */
async function verifyTokenPayment(transactionId, expectedAmount, expectedRecipient, fromAccount) {
  // RPC endpoints for transaction verification
  // Expanded from eosnation report (Jan 2026)
  const rpcEndpoints = [
    'https://api.wax.alohaeos.com',           // PRIMARY - worldwide
    'https://wax.greymass.com',               // Reliable
    'https://api.waxsweden.org',              // NL Hetzner
    'https://wax.eosphere.io',                // CA OVH
    'https://api.wax.bountyblok.io',          // US Cloudflare
    'https://wax.eosdac.io',                  // US Cloudflare
    'https://wax.api.eosnation.io',           // CA FlexNetworks
    'https://api.hivebp.io'                   // US Cloudflare
  ];

  let lastError = null;

  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`🔍 Verifying payment transaction ${transactionId} via ${endpoint}...`);
      const rpc = new JsonRpc(endpoint, { fetch });

      // Get transaction details
      const txData = await rpc.history_get_transaction(transactionId);

      if (!txData || !txData.trx || !txData.trx.trx) {
        throw new Error('Transaction not found or invalid format');
      }

      const actions = txData.trx.trx.actions || [];

      // Find eosio.token transfer action
      const transferAction = actions.find(action =>
        action.account === 'eosio.token' &&
        action.name === 'transfer'
      );

      if (!transferAction) {
        return {
          verified: false,
          error: 'No token transfer action found in transaction'
        };
      }

      const transferData = transferAction.data;

      // Verify sender
      if (transferData.from !== fromAccount) {
        return {
          verified: false,
          error: `Payment sent from wrong account. Expected: ${fromAccount}, Got: ${transferData.from}`
        };
      }

      // Verify recipient
      if (transferData.to !== expectedRecipient) {
        return {
          verified: false,
          error: `Payment sent to wrong recipient. Expected: ${expectedRecipient}, Got: ${transferData.to}`
        };
      }

      // Verify amount - ensure both formats match (add " WAX" suffix if not present)
      const normalizedExpectedAmount = expectedAmount.includes(' WAX')
        ? expectedAmount
        : `${expectedAmount} WAX`;

      if (transferData.quantity !== normalizedExpectedAmount) {
        return {
          verified: false,
          error: `Incorrect payment amount. Expected: ${normalizedExpectedAmount}, Got: ${transferData.quantity}`
        };
      }

      // All checks passed
      console.log(`✅ Payment verified: ${transferData.quantity} from ${transferData.from} to ${transferData.to}`);

      return {
        verified: true,
        transaction_id: transactionId,
        from: transferData.from,
        to: transferData.to,
        amount: transferData.quantity,
        memo: transferData.memo || '',
        block_time: txData.block_time
      };

    } catch (error) {
      console.warn(`⚠️ RPC endpoint ${endpoint} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  // All endpoints failed
  throw new Error(`Failed to verify transaction: ${lastError?.message || 'All RPC endpoints failed'}`);
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
  // Expanded from https://validate.eosnation.io/wax/reports/endpoints.html (Jan 2026)
  const rpcEndpoints = [
    'https://api.wax.alohaeos.com',           // 🔴 PRIMARY - User requested, worldwide
    'https://wax.greymass.com',               // Reliable established endpoint
    'https://api.waxsweden.org',              // NL Hetzner - Fast EU
    'https://wax.eosphere.io',                // CA OVH - North America
    'https://api.wax.bountyblok.io',          // US Cloudflare - High reliability
    'https://wax.eosdac.io',                  // US Cloudflare - Established guild
    'https://wax-public1.neftyblocks.com',    // US Cloudflare - NFT platform backed
    'https://wax-public2.neftyblocks.com',    // US Cloudflare - Secondary NeftyBlocks
    'https://wax.api.eosnation.io',           // CA FlexNetworks - Validator backed
    'https://api.hivebp.io',                  // US Cloudflare - Hive BP primary
    'https://api2.hivebp.io',                 // US Cloudflare - Hive BP secondary
    'https://wax.eu.eosamsterdam.net',        // NL Hetzner - Amsterdam node
    'https://wax.cryptolions.io',             // DE Hetzner - CryptoLions
    'https://api-wax-mainnet.wecan.dev',      // US Cloudflare - WeCan guild
    'https://wax.dapplica.io'                 // NL Hetzner - dapplica backup
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
          'https://aa.wax.blacklusion.io',              // NL Hetzner - Primary fast
          'https://wax-aa.eosdac.io',                   // US Cloudflare - High reliability
          'https://atomic-wax-mainnet.wecan.dev',       // US Cloudflare - Reliable
          'https://atomic.hivebp.io',                   // US Cloudflare - Good uptime
          'https://wax-atomic.alcor.exchange',          // US Cloudflare - Exchange backed
          'https://wax-aa.eu.eosamsterdam.net',         // NL Hetzner - European backup
          'https://atomic-api.wax.cryptolions.io',      // US DigitalOcean - Alternative network
          'https://wax-atomic-api.eosphere.io'          // AU OVH - Pacific/Asia coverage
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
async function transferNFTs(fromWallet, toWallet, assetIds, memo, privateKey, options = {}) {
  const { Api, JsonRpc } = require('eosjs');
  const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
  const fetch = require('node-fetch');
  const { TextEncoder, TextDecoder } = require('util');

  const rpcEndpoints = [
    'https://api.waxsweden.org',              // NL Hetzner - Fast
    'https://wax.greymass.com',               // Reliable
    'https://api.wax.alohaeos.com',           // Worldwide - Fast
    'https://api.wax.bountyblok.io',          // US Cloudflare
    'https://wax.eosphere.io',                // CA OVH
    'https://wax.eosdac.io',                  // US Cloudflare
    'https://api.hivebp.io'                   // US Cloudflare
  ];

  const maxRetries = options.maxRetries || 3;
  const checkCpu = options.checkCpu !== false; // Default true
  const minCpuUs = options.minCpuUs || 500; // Minimum CPU microseconds needed

  // Helper function to check CPU availability
  const checkCpuAvailability = async (endpoint) => {
    if (!checkCpu) return true;

    try {
      const rpc = new JsonRpc(endpoint, { fetch });
      const accountInfo = await rpc.get_account(fromWallet);
      const cpuAvailable = accountInfo.cpu_limit?.available || 0;

      console.log(`   CPU check for ${fromWallet}: ${cpuAvailable} us available (need ~${minCpuUs} us)`);

      return cpuAvailable >= minCpuUs;
    } catch (error) {
      console.warn(`   ⚠️ CPU check failed, proceeding anyway:`, error.message);
      return true; // Proceed if check fails
    }
  };

  // Helper function to wait with exponential backoff
  const waitWithBackoff = (attemptNumber) => {
    const delayMs = Math.min(1000 * Math.pow(2, attemptNumber), 10000); // Max 10s
    console.log(`   ⏳ Waiting ${delayMs}ms before retry...`);
    return new Promise(resolve => setTimeout(resolve, delayMs));
  };

  let lastError = null;
  let globalAttempt = 0;

  // Retry loop with exponential backoff
  for (let retry = 0; retry < maxRetries; retry++) {
    if (retry > 0) {
      await waitWithBackoff(retry - 1);
      console.log(`🔄 Retry attempt ${retry + 1}/${maxRetries}`);
    }

    // Try each endpoint
    for (const endpoint of rpcEndpoints) {
      try {
        globalAttempt++;

        // Check CPU availability before attempting transfer
        const cpuOk = await checkCpuAvailability(endpoint);
        if (!cpuOk && retry < maxRetries - 1) {
          console.log(`   ⚠️ Low CPU detected, will retry after delay`);
          lastError = new Error(`Low CPU: account has less than ${minCpuUs} us available`);
          continue; // Try next endpoint
        }

        console.log(`🔗 Attempting transfer via ${endpoint}... (attempt ${globalAttempt})`);
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
        const isCpuError = error.message?.includes('cpu') || error.message?.includes('CPU');
        console.warn(`❌ ${endpoint} failed:`, error.message);
        lastError = error;

        // If CPU error and not last retry, wait longer before next attempt
        if (isCpuError && retry < maxRetries - 1) {
          console.log(`   🔋 CPU limit reached, will retry with longer delay`);
        }

        continue;
      }
    }
  }

  // All retries exhausted
  const errorMessage = lastError?.message || 'Unknown error';
  const isCpuError = errorMessage.includes('cpu') || errorMessage.includes('CPU');

  if (isCpuError) {
    // Special handling for pool.fr - attempt automatic PowerUp
    if (fromWallet === 'pool.fr' && options.autoPowerUp !== false) {
      console.log('🔋 Attempting automatic PowerUp for pool.fr...');

      const mintingWallet = process.env.WAX_ACCOUNT || 'futuresrelic';
      const mintingPrivateKey = process.env.WAX_PRIVATE_KEY;

      if (!mintingPrivateKey) {
        console.warn('⚠️ WAX_PRIVATE_KEY not configured - cannot perform automatic PowerUp');
        throw new Error(`CPU resources exhausted for account ${fromWallet}. The account needs more CPU staked or must wait for CPU to regenerate. Original error: ${errorMessage}`);
      }

      try {
        // Perform PowerUp - provide extra CPU to pool.fr
        await powerUpAccount(mintingWallet, fromWallet, mintingPrivateKey, {
          cpuFrac: 20000000000, // ~20ms CPU (double the default)
          netFrac: 10000000,    // ~10KB NET
          maxPayment: '2.00000000 WAX' // Allow up to 2 WAX
        });

        console.log('✅ PowerUp successful! Retrying transfer...');

        // Wait a moment for resources to be available
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Retry the transfer ONE MORE TIME with autoPowerUp disabled to prevent infinite loop
        return await transferNFTs(fromWallet, toWallet, assetIds, memo, privateKey, {
          ...options,
          autoPowerUp: false,
          maxRetries: 2 // Limit retries after PowerUp
        });

      } catch (powerUpError) {
        console.error('❌ Automatic PowerUp failed:', powerUpError.message);
        throw new Error(`CPU resources exhausted for account ${fromWallet}. Attempted automatic PowerUp but it failed: ${powerUpError.message}. Original error: ${errorMessage}`);
      }
    }

    throw new Error(`CPU resources exhausted for account ${fromWallet}. The account needs more CPU staked or must wait for CPU to regenerate. Original error: ${errorMessage}`);
  }

  throw new Error(`All RPC endpoints failed after ${maxRetries} retry attempts. Last error: ${errorMessage}`);
}

/**
 * PowerUp CPU/NET for a WAX account
 * @param {string} payer - Account paying for the PowerUp (e.g., 'futuresrelic')
 * @param {string} receiver - Account receiving the PowerUp (e.g., 'pool.fr')
 * @param {string} payerPrivateKey - Private key of the payer account
 * @param {Object} options - PowerUp options
 * @param {number} options.cpuFrac - CPU fraction (default: 10000000000 = ~10ms CPU)
 * @param {number} options.netFrac - NET fraction (default: 10000000 = ~10KB NET)
 * @param {number} options.maxPayment - Max WAX to spend (default: '1.00000000 WAX')
 * @returns {Promise<Object>} Transaction result
 */
async function powerUpAccount(payer, receiver, payerPrivateKey, options = {}) {
  const { Api, JsonRpc } = require('eosjs');
  const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
  const fetch = require('node-fetch');
  const { TextEncoder, TextDecoder } = require('util');

  const rpcEndpoints = [
    'https://api.waxsweden.org',              // NL Hetzner - Fast
    'https://wax.greymass.com',               // Reliable
    'https://api.wax.alohaeos.com',           // Worldwide - Fast
    'https://api.wax.bountyblok.io',          // US Cloudflare
    'https://wax.eosphere.io',                // CA OVH
    'https://wax.eosdac.io',                  // US Cloudflare
    'https://api.hivebp.io'                   // US Cloudflare
  ];

  // PowerUp parameters
  const cpuFrac = options.cpuFrac || 10000000000; // ~10ms CPU
  const netFrac = options.netFrac || 10000000; // ~10KB NET
  const maxPayment = options.maxPayment || '1.00000000 WAX';

  console.log(`⚡ PowerUp Request:`);
  console.log(`   Payer: ${payer}`);
  console.log(`   Receiver: ${receiver}`);
  console.log(`   CPU Fraction: ${cpuFrac}`);
  console.log(`   NET Fraction: ${netFrac}`);
  console.log(`   Max Payment: ${maxPayment}`);

  let lastError;

  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`🔗 Attempting PowerUp via ${endpoint}...`);
      const rpc = new JsonRpc(endpoint, { fetch });
      const signatureProvider = new JsSignatureProvider([payerPrivateKey]);
      const api = new Api({
        rpc,
        signatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder()
      });

      const result = await api.transact({
        actions: [{
          account: 'eosio',
          name: 'powerup',
          authorization: [{
            actor: payer,
            permission: 'active'
          }],
          data: {
            payer: payer,
            receiver: receiver,
            days: 1,
            net_frac: netFrac,
            cpu_frac: cpuFrac,
            max_payment: maxPayment
          }
        }]
      }, {
        blocksBehind: 3,
        expireSeconds: 30
      });

      console.log(`✅ PowerUp successful! TX: ${result.transaction_id}`);
      console.log(`   Provided ~${(cpuFrac / 1000000000).toFixed(1)}ms CPU to ${receiver}`);

      return {
        success: true,
        transaction_id: result.transaction_id,
        payer,
        receiver,
        cpuFrac,
        netFrac
      };

    } catch (error) {
      console.warn(`❌ PowerUp via ${endpoint} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`PowerUp failed on all endpoints. Last error: ${lastError?.message}`);
}

/**
 * Clear template cache - useful for admin operations or testing
 * @returns {number} Number of cached entries cleared
 */
function clearTemplateCache() {
  const size = templateCache.size;
  templateCache.clear();
  console.log(`🗑️ Cleared ${size} template cache entries`);
  return size;
}

/**
 * Get template cache statistics
 * @returns {Object} Cache stats (size, entries)
 */
function getTemplateCacheStats() {
  const entries = Array.from(templateCache.entries()).map(([key, value]) => ({
    key,
    age: Math.round((Date.now() - value.timestamp) / 1000),
    template_id: value.data.template_id
  }));

  return {
    size: templateCache.size,
    ttl_seconds: TEMPLATE_CACHE_TTL / 1000,
    entries
  };
}

module.exports = {
  getUserAssets,
  getUserAssetsLive,
  getTemplate,
  checkEligibility,
  mintNFT,
  transferNFTs,
  powerUpAccount,
  getCollection,
  verifyTransaction,
  verifyTokenPayment,
  getAccountResources,
  getIpfsUrl,
  getAtomicAPIs,
  setPreferredAtomicAPI,
  addCustomAtomicAPI,
  clearTemplateCache,
  getTemplateCacheStats,
  ATOMIC_APIS,
  WAX_ACCOUNT
};
