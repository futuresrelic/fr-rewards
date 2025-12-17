const fetch = require('node-fetch');
const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextEncoder, TextDecoder } = require('util');
require('dotenv').config();

// Configuration
const ATOMIC_API = process.env.ATOMIC_API || 'https://wax.api.atomicassets.io';
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
 * Get all NFT assets for a specific account
 * @param {string} account - WAX account name
 * @param {string} collection - Collection name (optional)
 * @returns {Promise<Array>} Array of assets
 */
async function getUserAssets(account, collection = null) {
  try {
    let url = `${ATOMIC_API}/atomicassets/v1/assets?owner=${account}&limit=1000`;
    if (collection) {
      url += `&collection_name=${collection}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AtomicAssets API error (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching user assets:', error);
    throw error;
  }
}

/**
 * Get template information
 * @param {string} collection - Collection name
 * @param {number} templateId - Template ID
 * @returns {Promise<Object>} Template data
 */
async function getTemplate(collection, templateId) {
  try {
    const url = `${ATOMIC_API}/atomicassets/v1/templates/${collection}/${templateId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
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
    const assets = await getUserAssets(account, collection);

    // Filter assets that match whitelisted templates
    const eligibleAssets = assets.filter(asset => {
      return whitelistTemplates.includes(parseInt(asset.template.template_id));
    });

    return eligibleAssets;
  } catch (error) {
    console.error('Error checking eligibility:', error);
    throw error;
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

  try {
    // Convert data to AtomicAssets format
    const immutableDataArray = Object.entries(immutableData).map(([key, value]) => ({
      key,
      value: [typeof value === 'string' ? 'string' : 'uint64', value]
    }));

    const mutableDataArray = Object.entries(mutableData).map(([key, value]) => ({
      key,
      value: [typeof value === 'string' ? 'string' : 'uint64', value]
    }));

    const actions = [{
      account: 'atomicassets',
      name: 'mintasset',
      authorization: [{
        actor: WAX_ACCOUNT,
        permission: 'active',
      }],
      data: {
        authorized_minter: WAX_ACCOUNT,
        collection_name: collection,
        schema_name: '', // Will be determined by template
        template_id: templateId,
        new_asset_owner: toAccount,
        immutable_data: immutableDataArray,
        mutable_data: mutableDataArray,
        tokens_to_back: []
      },
    }];

    const result = await waxApi.transact(
      { actions },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );

    return {
      success: true,
      transaction_id: result.transaction_id,
      block_num: result.processed.block_num,
      block_time: result.processed.block_time
    };
  } catch (error) {
    console.error('Error minting NFT:', error);
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

module.exports = {
  getUserAssets,
  getTemplate,
  checkEligibility,
  mintNFT,
  getCollection,
  verifyTransaction,
  ATOMIC_API,
  WAX_ACCOUNT
};
