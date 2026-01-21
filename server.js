const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

const db = require('./database');
const wax = require('./wax');
const validators = require('./validators');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Create uploads directory in persistent volume
const uploadsDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory in persistent volume');
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP, SVG)'));
    }
  }
});

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve WaxJS from node_modules
app.use('/libs/waxjs', express.static('node_modules/@waxio/waxjs/dist'));
app.use('/libs/eosjs', express.static('node_modules/eosjs/dist'));

// Serve wiki markdown file
app.get('/COMPLETE_API_WIKI.md', (req, res) => {
  res.sendFile(__dirname + '/COMPLETE_API_WIKI.md');
});

// Serve user guide markdown file
app.get('/USER_GUIDE.md', (req, res) => {
  res.sendFile(__dirname + '/USER_GUIDE.md');
});

// Serve uploads from persistent volume
app.use('/uploads', express.static(uploadsDir));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased for testing)
  validate: { trustProxy: false } // Disable trust proxy validation warning
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // stricter limit for claim endpoints (increased for testing)
  validate: { trustProxy: false } // Disable trust proxy validation warning
});

app.use('/api/', limiter);

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ==================== USER ENDPOINTS ====================

/**
 * GET /api/user/holdings/:account
 * Get user's NFT holdings from the configured collection
 */
app.get('/api/user/holdings/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const config = db.config.get();

    const assets = await wax.getUserAssets(account, config.collection_name);

    res.json({
      success: true,
      account,
      collection: config.collection_name,
      total: assets.length,
      assets: assets.map(asset => ({
        asset_id: asset.asset_id,
        template_id: asset.template.template_id,
        name: asset.name,
        data: asset.data,
        immutable_data: asset.immutable_data
      }))
    });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/eligibility/:account
 * Check if user is eligible to claim rewards
 */
app.get('/api/user/eligibility/:account', async (req, res) => {
  try {
    const { account } = req.params;

    // Validate WAX account name format
    if (!validators.isValidWaxAccount(account)) {
      return res.status(400).json({ error: 'Invalid WAX account name format' });
    }

    const config = db.config.get();
    const enabledTemplates = db.templates.getEnabled();
    const whitelistTemplates = enabledTemplates.map(t => t.template_id);

    // Check if templates are configured
    if (whitelistTemplates.length === 0) {
      return res.json({
        success: true,
        account,
        eligible: false,
        whitelistTemplates: [],
        eligibleAssets: [],
        message: 'No templates configured'
      });
    }

    // Use LIVE blockchain query (not cached API) for real-time eligibility
    console.log(`🔴 LIVE MODE: Querying blockchain directly for ${account}`);
    const eligibleAssets = await wax.getUserAssetsLive(account, config.collection_name, whitelistTemplates);

    // Get all template rewards for enabled templates
    const allRewards = db.templateRewards.getAllEnabled();

    // Fetch reward template images for all unique reward templates
    const rewardTemplateImages = new Map();
    const uniqueRewardTemplates = [...new Set(allRewards.map(r => r.reward_template_id))];

    await Promise.all(uniqueRewardTemplates.map(async (rewardTemplateId) => {
      try {
        const templateData = await wax.getTemplate(config.collection_name, rewardTemplateId);
        // Prioritize video over img
        const video = templateData?.immutable_data?.video;
        const img = templateData?.immutable_data?.img;
        const media = video || img;
        if (media) {
          rewardTemplateImages.set(rewardTemplateId, wax.getIpfsUrl ? wax.getIpfsUrl(media) : null);
        }
      } catch (error) {
        console.warn(`Failed to fetch reward template ${rewardTemplateId}:`, error.message);
      }
    }));

    // Group assets by template_id and count quantity
    const templateQuantities = {};
    eligibleAssets.forEach(asset => {
      const templateId = parseInt(asset.template.template_id);
      if (!templateQuantities[templateId]) {
        templateQuantities[templateId] = {
          quantity: 0,
          asset: asset
        };
      }
      templateQuantities[templateId].quantity++;
    });

    // Fetch template metadata for asset images/videos
    const templateMetadata = new Map();
    const uniqueAssetTemplates = Object.keys(templateQuantities).map(t => parseInt(t));

    await Promise.all(uniqueAssetTemplates.map(async (templateId) => {
      try {
        const templateData = await wax.getTemplate(config.collection_name, templateId);
        if (templateData) {
          const video = templateData?.immutable_data?.video;
          const img = templateData?.immutable_data?.img;
          const name = templateData?.immutable_data?.name;
          const media = video || img;
          templateMetadata.set(templateId, {
            image_url: media ? (wax.getIpfsUrl ? wax.getIpfsUrl(media) : null) : null,
            is_video: !!video,
            name: name
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch metadata for template ${templateId}:`, error.message);
      }
    }));

    // Build enriched assets with multiple rewards
    const enrichedAssets = Object.entries(templateQuantities).map(([templateId, data]) => {
      const templateConfig = enabledTemplates.find(t => t.template_id === parseInt(templateId));
      const templateRewards = allRewards.filter(r => r.template_id === parseInt(templateId));
      const metadata = templateMetadata.get(parseInt(templateId));

      // Enrich each reward with image and available quantity
      const rewards = templateRewards.map(reward => {
        const availableQuantity = reward.match_quantity ? data.quantity : (reward.max_claims || 1);

        return {
          reward_id: reward.id,
          reward_template_id: reward.reward_template_id,
          reward_name: reward.reward_name,
          cooldown_hours: reward.cooldown_hours,
          max_claims: reward.max_claims,
          match_quantity: reward.match_quantity,
          available_quantity: availableQuantity,
          reward_image_url: rewardTemplateImages.get(reward.reward_template_id) || null
        };
      });

      return {
        template_id: templateId,
        name: templateConfig?.name || metadata?.name || `Template #${templateId}`,
        quantity_owned: data.quantity,
        image_url: metadata?.image_url || null,
        is_video: metadata?.is_video || false,
        template_config: templateConfig,
        rewards: rewards
      };
    });

    res.json({
      success: true,
      account,
      eligible: eligibleAssets.length > 0,
      whitelistTemplates,
      eligibleAssets: enrichedAssets
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      whitelistTemplates: []
    });
  }
});

/**
 * GET /api/user/claims/:account
 * Get claim history for a user
 */
app.get('/api/user/claims/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const claims = db.claims.getByAccount(account);
    const config = db.config.get();

    // Enrich claims with template names
    const enrichedClaims = await Promise.all(claims.map(async (claim) => {
      // Get reward template name from template_rewards table first
      let rewardName = null;
      if (claim.reward_id) {
        const rewardConfig = db.templateRewards.getById(claim.reward_id);
        if (rewardConfig && rewardConfig.reward_name) {
          rewardName = rewardConfig.reward_name;
        }
      }

      // If no custom reward name, fetch from blockchain
      if (!rewardName) {
        try {
          const rewardTemplate = await wax.getTemplate(config.collection_name, claim.reward_template);
          if (rewardTemplate && rewardTemplate.immutable_data && rewardTemplate.immutable_data.name) {
            rewardName = rewardTemplate.immutable_data.name;
          }
        } catch (err) {
          console.warn(`Could not fetch reward template ${claim.reward_template}:`, err.message);
        }
      }

      // Get qualifying template name
      let qualifyingTemplateName = null;
      const templateConfig = db.templates.getById(claim.template_id);
      if (templateConfig && templateConfig.name) {
        qualifyingTemplateName = templateConfig.name;
      } else {
        try {
          const qualifyingTemplate = await wax.getTemplate(config.collection_name, claim.template_id);
          if (qualifyingTemplate && qualifyingTemplate.immutable_data && qualifyingTemplate.immutable_data.name) {
            qualifyingTemplateName = qualifyingTemplate.immutable_data.name;
          }
        } catch (err) {
          console.warn(`Could not fetch template ${claim.template_id}:`, err.message);
        }
      }

      return {
        ...claim,
        reward_name: rewardName || `Template #${claim.reward_template}`,
        qualifying_template_name: qualifyingTemplateName || `Template #${claim.template_id}`
      };
    }));

    res.json({
      success: true,
      account,
      total: enrichedClaims.length,
      claims: enrichedClaims
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/packs/:account
 * Get user's packs (filtered by pack template IDs)
 */
app.get('/api/user/packs/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const packTemplates = [204194]; // Help Wanted pack - can be made configurable later

    // Get all user's assets
    const allAssets = await wax.getUserAssets(account);

    // Filter for pack templates
    const packs = allAssets.filter(asset =>
      packTemplates.includes(parseInt(asset.template.template_id))
    );

    res.json({
      success: true,
      account,
      total: packs.length,
      packs
    });
  } catch (error) {
    console.error('Error fetching packs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/unpack-url
 * Generate properly formatted transaction for WAX Cloud Wallet unpacking
 */
app.post('/api/user/unpack-url', async (req, res) => {
  try {
    const { account, asset_id } = req.body;

    if (!account || !asset_id) {
      return res.status(400).json({ error: 'Missing account or asset_id' });
    }

    // Get blockchain info for transaction header
    const { JsonRpc, Serialize } = require('eosjs');
    const { TextEncoder, TextDecoder } = require('util');
    const fetch = require('node-fetch');
    const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

    const info = await rpc.get_info();
    const blockInfo = await rpc.get_block(info.head_block_num);

    // Fetch ABI for atomicassets contract to serialize data
    const abiResponse = await rpc.get_abi('atomicassets');
    const abi = abiResponse.abi;

    // Serialize the action data
    const buffer = new Serialize.SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
    const abiTypes = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), abi);
    const actionType = abiTypes.get('transfer');

    actionType.serialize(buffer, {
      from: account,
      to: 'atomicpacksx',
      asset_ids: [asset_id],
      memo: 'unbox'
    });

    const serializedData = Buffer.from(buffer.asUint8Array()).toString('hex');

    // Build proper transaction with serialized data
    const transaction = {
      expiration: new Date(Date.now() + 90000).toISOString().slice(0, -1),
      ref_block_num: info.head_block_num & 0xFFFF,
      ref_block_prefix: blockInfo.ref_block_prefix,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [{
        account: 'atomicassets',
        name: 'transfer',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: serializedData
      }],
      transaction_extensions: []
    };

    // Create signing URL for new WAX Cloud Wallet
    const txJson = JSON.stringify(transaction);
    const signingUrl = `https://www.mycloudwallet.com/cloud-wallet/signing/?transaction=${encodeURIComponent(txJson)}`;

    console.log('📝 Built transaction:', JSON.stringify(transaction, null, 2));
    console.log('🔗 Signing URL:', signingUrl);

    res.json({
      success: true,
      signing_url: signingUrl,
      transaction: transaction
    });
  } catch (error) {
    console.error('Error generating unpack URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/cooldowns/:account
 * Get cooldown status for user's whitelisted templates
 */
app.get('/api/user/cooldowns/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const allRewards = db.templateRewards.getAllEnabled();

    const cooldowns = db.claims.getCooldowns(account);
    const now = new Date();

    const cooldownStatus = allRewards.map(reward => {
      const cooldown = cooldowns.find(c =>
        c.template_id === reward.template_id &&
        c.reward_id === reward.id
      );

      if (!cooldown) {
        return {
          template_id: reward.template_id,
          reward_id: reward.id,
          can_claim: true,
          next_claim_at: null,
          last_claimed_at: null,
          remaining_seconds: 0,
          reward_config: reward
        };
      }

      const nextClaimDate = new Date(cooldown.next_claim_at);
      const canClaim = now >= nextClaimDate;
      const remainingSeconds = canClaim ? 0 : Math.floor((nextClaimDate - now) / 1000);

      return {
        template_id: reward.template_id,
        reward_id: reward.id,
        can_claim: canClaim,
        next_claim_at: cooldown.next_claim_at,
        last_claimed_at: cooldown.last_claimed_at,
        remaining_seconds: remainingSeconds,
        reward_config: reward
      };
    });

    res.json({
      success: true,
      account,
      cooldowns: cooldownStatus
    });
  } catch (error) {
    console.error('Error fetching cooldowns:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/claim
 * Claim a reward NFT
 */
app.post('/api/user/claim', strictLimiter, async (req, res) => {
  try {
    const { account, template_id, reward_id } = req.body;

    // Validate required fields
    if (!account || !template_id || !reward_id) {
      return res.status(400).json({ error: 'Missing required fields: account, template_id, reward_id' });
    }

    // Validate WAX account name format
    if (!validators.isValidWaxAccount(account)) {
      return res.status(400).json({ error: 'Invalid WAX account name format' });
    }

    // Validate and parse template_id
    const validatedTemplateId = validators.validateTemplateId(template_id);
    if (validatedTemplateId === null) {
      return res.status(400).json({ error: 'Invalid template_id - must be a positive integer' });
    }

    // Validate and parse reward_id
    const validatedRewardId = validators.validateInteger(reward_id, { min: 1 });
    if (validatedRewardId === null) {
      return res.status(400).json({ error: 'Invalid reward_id - must be a positive integer' });
    }

    const config = db.config.get();

    // Get template configuration
    const templateConfig = db.templates.getById(validatedTemplateId);
    if (!templateConfig || !templateConfig.enabled) {
      return res.status(400).json({ error: 'Template not enabled or does not exist' });
    }

    // Get reward configuration
    const rewardConfig = db.templateRewards.getById(validatedRewardId);
    if (!rewardConfig || !rewardConfig.enabled || rewardConfig.template_id !== validatedTemplateId) {
      return res.status(400).json({ error: 'Reward not found or not enabled for this template' });
    }

    // Check eligibility using LIVE blockchain query (not cached)
    // CRITICAL: Must use same method as eligibility page to avoid mismatches
    const enabledTemplates = db.templates.getEnabled();
    const whitelistTemplates = enabledTemplates.map(t => t.template_id);
    const eligibleAssets = await wax.getUserAssetsLive(account, config.collection_name, whitelistTemplates);
    const userAssets = eligibleAssets.filter(asset => parseInt(asset.template.template_id) === validatedTemplateId);

    if (userAssets.length === 0) {
      return res.status(403).json({ error: 'You do not hold this whitelisted NFT' });
    }

    // Check cooldown
    const canClaim = db.claims.canClaim(account, validatedTemplateId, validatedRewardId);
    if (!canClaim) {
      return res.status(429).json({ error: 'Cooldown period has not expired' });
    }

    // Calculate how many NFTs to mint
    const quantityToMint = rewardConfig.match_quantity ? userAssets.length : (rewardConfig.max_claims || 1);

    console.log(`Minting ${quantityToMint}x reward NFT to ${account} (reward: ${rewardConfig.reward_template_id})`);

    // Mint NFTs (one or multiple) - FIRST mint, THEN record
    const transactionIds = [];
    for (let i = 0; i < quantityToMint; i++) {
      const mintResult = await wax.mintNFT(account, config.collection_name, parseInt(rewardConfig.reward_template_id));
      transactionIds.push(mintResult.transaction_id);
    }

    // ONLY record claim AFTER successful mints (prevents cooldown if mint fails)
    db.claims.add(
      account,
      validatedTemplateId,
      rewardConfig.reward_template_id,
      transactionIds[0], // Use first transaction ID
      rewardConfig.cooldown_hours,
      validatedRewardId
    );

    res.json({
      success: true,
      message: `Reward claimed successfully! Minted ${quantityToMint}x NFT(s)`,
      transaction_ids: transactionIds,
      quantity_minted: quantityToMint,
      reward_template: rewardConfig.reward_template_id,
      next_claim_hours: rewardConfig.cooldown_hours
    });
  } catch (error) {
    console.error('Error claiming reward:', error);

    // Handle CPU exhaustion errors
    if (error.message && error.message.toLowerCase().includes('cpu')) {
      return res.status(503).json({
        error: 'Server temporarily unavailable - insufficient CPU resources. Please try again in a few minutes or contact admin.'
      });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/claim-all
 * Claim all available rewards at once
 */
app.post('/api/user/claim-all', strictLimiter, async (req, res) => {
  try {
    const { account } = req.body;

    // Validate required fields
    if (!account) {
      return res.status(400).json({ error: 'Missing required field: account' });
    }

    // Validate WAX account name format
    if (!validators.isValidWaxAccount(account)) {
      return res.status(400).json({ error: 'Invalid WAX account name format' });
    }

    const config = db.config.get();

    // Get user's assets from blockchain
    const enabledTemplates = db.templates.getEnabled();
    const whitelistTemplates = enabledTemplates.map(t => t.template_id);
    const eligibleAssets = await wax.getUserAssetsLive(account, config.collection_name, whitelistTemplates);

    if (eligibleAssets.length === 0) {
      return res.status(403).json({ error: 'You do not hold any whitelisted NFTs' });
    }

    // Get all enabled rewards
    const allRewards = db.templateRewards.getAllEnabled();
    const cooldowns = db.claims.getCooldowns(account);
    const now = new Date();

    // Find claimable rewards
    const claimableRewards = [];

    for (const reward of allRewards) {
      // Check if user has assets for this template
      const userAssets = eligibleAssets.filter(asset =>
        parseInt(asset.template.template_id) === reward.template_id
      );

      if (userAssets.length === 0) continue;

      // Check cooldown
      const cooldown = cooldowns.find(c =>
        c.template_id === reward.template_id &&
        c.reward_id === reward.id
      );

      const canClaim = !cooldown || new Date(cooldown.next_claim_at) <= now;

      if (canClaim) {
        const quantityToMint = reward.match_quantity ? userAssets.length : (reward.max_claims || 1);
        claimableRewards.push({
          ...reward,
          quantityToMint
        });
      }
    }

    if (claimableRewards.length === 0) {
      return res.status(429).json({
        error: 'No rewards available to claim. All are on cooldown.',
        success: false
      });
    }

    console.log(`🎁 Claim All: Processing ${claimableRewards.length} reward(s) for ${account}`);

    // Claim each reward
    const results = [];
    const errors = [];

    for (const reward of claimableRewards) {
      try {
        console.log(`   Minting ${reward.quantityToMint}x Template ${reward.reward_template_id} (reward #${reward.id})`);

        // Mint NFTs
        const transactionIds = [];
        for (let i = 0; i < reward.quantityToMint; i++) {
          const mintResult = await wax.mintNFT(account, config.collection_name, parseInt(reward.reward_template_id));
          transactionIds.push(mintResult.transaction_id);

          // Add delay between mints to prevent duplicate transaction errors
          if (i < reward.quantityToMint - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }
        }

        // ONLY record claim AFTER successful mint
        db.claims.add(
          account,
          reward.template_id,
          reward.reward_template_id,
          transactionIds[0],
          reward.cooldown_hours,
          reward.id
        );

        results.push({
          template_id: reward.template_id,
          reward_id: reward.id,
          reward_name: reward.reward_name,
          reward_template_id: reward.reward_template_id,
          quantity_minted: reward.quantityToMint,
          transaction_ids: transactionIds,
          success: true
        });

        console.log(`   ✅ Success: ${reward.quantityToMint}x minted - TXs: ${transactionIds.join(', ')}`);

        // Add delay between different rewards to prevent duplicate transaction errors
        if (claimableRewards.indexOf(reward) < claimableRewards.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }

      } catch (error) {
        console.error(`   ❌ Failed to mint reward ${reward.id}:`, error.message);
        errors.push({
          template_id: reward.template_id,
          reward_id: reward.id,
          reward_name: reward.reward_name,
          error: error.message
        });
      }
    }

    // Return results
    const response = {
      success: results.length > 0,
      message: `Claimed ${results.length} of ${claimableRewards.length} available rewards`,
      results,
      total_claimed: results.length,
      total_attempted: claimableRewards.length
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.partial_success = true;
    }

    res.json(response);

  } catch (error) {
    console.error('Error in claim-all:', error);

    // Handle CPU exhaustion errors
    if (error.message && error.message.toLowerCase().includes('cpu')) {
      return res.status(503).json({
        error: 'Server temporarily unavailable - insufficient CPU resources. Please try again in a few minutes or contact admin.'
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// ==================== BLEND ENDPOINTS ====================

/**
 * POST /api/blend/mint
 * Mint result NFT after burning ingredients
 */
app.post('/api/blend/mint', strictLimiter, async (req, res) => {
  try {
    const { account, collection, template_id, burn_transaction_id, burned_asset_ids } = req.body;

    // Validate required fields
    if (!account || !collection || !template_id || !burn_transaction_id || !burned_asset_ids) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate WAX account name format
    if (!validators.isValidWaxAccount(account)) {
      return res.status(400).json({ error: 'Invalid WAX account name format' });
    }

    console.log(`🔀 Blend Mint Request:`);
    console.log(`   Account: ${account}`);
    console.log(`   Collection: ${collection}`);
    console.log(`   Result Template: ${template_id}`);
    console.log(`   Burned Assets: ${burned_asset_ids.length}`);
    console.log(`   Burn TX: ${burn_transaction_id}`);

    // Verify burn transaction (optional but recommended)
    try {
      await wax.verifyTransaction(burn_transaction_id);
      console.log('   ✅ Burn transaction verified');
    } catch (error) {
      console.warn('   ⚠️ Could not verify burn transaction:', error.message);
      // Continue anyway - user already burned their assets
    }

    // Mint the result NFT
    const mintResult = await wax.mintNFT(account, collection, parseInt(template_id));

    console.log(`   ✅ Result minted: ${mintResult.transaction_id}`);

    res.json({
      success: true,
      transaction_id: mintResult.transaction_id,
      template_id: template_id,
      burned_count: burned_asset_ids.length
    });

  } catch (error) {
    console.error('Error in blend mint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/blends/analyze
 * Analyze NeftyBlocks blends against user's assets
 */
app.post('/api/blends/analyze', strictLimiter, async (req, res) => {
  try {
    const { collection, blend_ids, account } = req.body;

    // Validate required fields
    if (!collection || !blend_ids || !Array.isArray(blend_ids) || !account) {
      return res.status(400).json({ error: 'Missing required fields: collection, blend_ids (array), account' });
    }

    // Validate WAX account name format
    if (!validators.isValidWaxAccount(account)) {
      return res.status(400).json({ error: 'Invalid WAX account name format' });
    }

    console.log(`🔍 Blend Analysis Request:`);
    console.log(`   Collection: ${collection}`);
    console.log(`   Blend IDs: ${blend_ids.join(', ')}`);
    console.log(`   Account: ${account}`);

    const blends = [];

    // Fetch each blend schema from blend.nefty contract on-chain
    const { JsonRpc } = require('eosjs');
    const rpcEndpoint = new JsonRpc('https://wax.greymass.com', { fetch });

    for (const blendId of blend_ids) {
      try {
        console.log(`   Fetching blend #${blendId} from blockchain...`);

        // Query blend.nefty contract for blend data
        const blendResult = await rpcEndpoint.get_table_rows({
          json: true,
          code: 'blend.nefty',
          scope: 'blend.nefty',
          table: 'blends',
          lower_bound: blendId,
          upper_bound: blendId,
          limit: 1
        });

        if (!blendResult.rows || blendResult.rows.length === 0) {
          console.warn(`   ⚠️ Blend #${blendId} not found on blockchain`);
          continue;
        }

        const blend = blendResult.rows[0];

        // Check if blend matches the requested collection
        if (blend.collection_name !== collection) {
          console.warn(`   ⚠️ Blend #${blendId} is for collection ${blend.collection_name}, not ${collection}`);
          continue;
        }

        // Parse ingredients (what you need to burn)
        // Format: ["TEMPLATE_INGREDIENT", {"template_id": 202914, "amount": 1, ...}]
        const ingredients = [];
        let totalRequired = 0;

        if (blend.ingredients && Array.isArray(blend.ingredients)) {
          for (const ingredient of blend.ingredients) {
            // Ingredients are tuples: ["TEMPLATE_INGREDIENT", {...}]
            if (Array.isArray(ingredient) && ingredient[0] === 'TEMPLATE_INGREDIENT' && ingredient[1]) {
              const ing = ingredient[1];
              const templateId = ing.template_id;
              const amount = parseInt(ing.amount || 1);

              if (templateId) {
                // Fetch template data for display name and image
                let templateName = `Template #${templateId}`;
                let templateImg = null;
                try {
                  const templateRes = await fetch(`https://aa-wax-public1.neftyblocks.com/atomicassets/v1/templates/${collection}/${templateId}`);
                  if (templateRes.ok) {
                    const templateData = await templateRes.json();
                    templateName = templateData.data.immutable_data?.name || templateName;
                    templateImg = templateData.data.immutable_data?.img || null;
                  }
                } catch (err) {
                  console.warn(`   Could not fetch template ${templateId} name:`, err.message);
                }

                ingredients.push({
                  template_id: templateId,
                  name: templateName,
                  img: templateImg,
                  amount: amount,
                  owned: 0 // Will be populated below
                });
                totalRequired += amount;
              }
            }
          }
        }

        // Parse results (what you get after blend)
        // Format: rolls[{outcomes[{results[["ON_DEMAND_NFT_RESULT", {"template_id": 211094}]]}]}]
        const results = [];
        if (blend.rolls && Array.isArray(blend.rolls)) {
          for (const roll of blend.rolls) {
            if (roll.outcomes && Array.isArray(roll.outcomes)) {
              for (const outcome of roll.outcomes) {
                if (outcome.results && Array.isArray(outcome.results)) {
                  for (const result of outcome.results) {
                    // Results are tuples: ["ON_DEMAND_NFT_RESULT", {"template_id": ...}]
                    if (Array.isArray(result) && result[0] === 'ON_DEMAND_NFT_RESULT' && result[1]) {
                      const templateId = result[1].template_id;
                      if (templateId) {
                        // Fetch template data
                        let templateName = `Template #${templateId}`;
                        let templateImg = null;
                        try {
                          const templateRes = await fetch(`https://aa-wax-public1.neftyblocks.com/atomicassets/v1/templates/${collection}/${templateId}`);
                          if (templateRes.ok) {
                            const templateData = await templateRes.json();
                            templateName = templateData.data.immutable_data?.name || templateName;
                            templateImg = templateData.data.immutable_data?.img || null;
                          }
                        } catch (err) {
                          console.warn(`   Could not fetch result template ${templateId}:`, err.message);
                        }

                        results.push({
                          template_id: templateId,
                          name: templateName,
                          img: templateImg,
                          odds: outcome.odds,
                          total_odds: roll.total_odds
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Add to blends list
        blends.push({
          blend_id: blendId,
          name: blend.display_data || `Blend #${blendId}`,
          description: `Requires ${totalRequired} ingredients`,
          collection: collection,
          ingredients: ingredients,
          results: results,
          total_required: totalRequired,
          can_execute: false, // Will be calculated after checking user's assets
          missing_ingredients: [],
          contract: 'blend.nefty'
        });

        console.log(`   ✅ Loaded blend #${blendId}: ${blend.display_data || 'Unnamed'}`);

      } catch (error) {
        console.error(`   ❌ Error fetching blend #${blendId}:`, error.message);
      }
    }

    if (blends.length === 0) {
      return res.json({
        success: true,
        blends: [],
        message: 'No valid blends found'
      });
    }

    // Fetch ALL user's assets from AtomicAssets API (with pagination)
    console.log(`   Fetching ALL assets for ${account}...`);
    const rpc = 'https://aa-wax-public1.neftyblocks.com';

    let userAssets = [];
    let page = 1;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const assetsUrl = `${rpc}/atomicassets/v1/assets?owner=${account}&collection_name=${collection}&page=${page}&limit=${limit}&order=desc&sort=asset_id`;
      const assetsResponse = await fetch(assetsUrl);

      if (!assetsResponse.ok) {
        throw new Error('Failed to fetch user assets');
      }

      const assetsData = await assetsResponse.json();
      const pageAssets = assetsData.data || [];

      userAssets = userAssets.concat(pageAssets);

      console.log(`   📄 Fetched page ${page}: ${pageAssets.length} assets (total so far: ${userAssets.length})`);

      // If we got fewer assets than the limit, we've reached the last page
      if (pageAssets.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`   ✅ Fetched all ${userAssets.length} assets from ${page} page(s)`);

    // Group user's assets by template ID
    const assetsByTemplate = {};
    userAssets.forEach(asset => {
      const templateId = asset.template?.template_id;
      if (templateId) {
        if (!assetsByTemplate[templateId]) {
          assetsByTemplate[templateId] = 0;
        }
        assetsByTemplate[templateId]++;
      }
    });

    // Check each blend against user's assets
    for (const blend of blends) {
      let canExecute = true;
      const missingIngredients = [];

      for (const ing of blend.ingredients) {
        const owned = assetsByTemplate[ing.template_id] || 0;
        ing.owned = owned;

        if (owned < ing.amount) {
          canExecute = false;
          missingIngredients.push({
            template_id: ing.template_id,
            needed: ing.amount,
            owned: owned,
            missing: ing.amount - owned
          });
        }
      }

      blend.can_execute = canExecute;
      blend.missing_ingredients = missingIngredients;
    }

    console.log(`   ✅ Analyzed ${blends.length} blend(s)`);
    console.log(`   ✅ ${blends.filter(b => b.can_execute).length} blend(s) available`);

    res.json({
      success: true,
      blends: blends,
      total_assets: userAssets.length
    });

  } catch (error) {
    console.error('Error in blend analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/blends/execute
 * Execute a NeftyBlocks blend (client sends signed transaction)
 * Note: This is a placeholder - actual blend execution should be done client-side
 * with user's wallet signing the transaction to NeftyBlocks contract
 */
app.post('/api/blends/execute', strictLimiter, async (req, res) => {
  try {
    const { account, collection, blend_id, asset_ids } = req.body;

    // Validate required fields
    if (!account || !collection || !blend_id || !asset_ids || !Array.isArray(asset_ids)) {
      return res.status(400).json({ error: 'Missing required fields: account, collection, blend_id, asset_ids' });
    }

    // Validate WAX account name format
    if (!validators.isValidWaxAccount(account)) {
      return res.status(400).json({ error: 'Invalid WAX account name format' });
    }

    console.log(`🔀 Blend Execute Request:`);
    console.log(`   Account: ${account}`);
    console.log(`   Collection: ${collection}`);
    console.log(`   Blend ID: ${blend_id}`);
    console.log(`   Asset IDs: ${asset_ids.join(', ')}`);

    // Note: NeftyBlocks blends are executed client-side via the blends contract
    // The user's wallet must sign the transaction
    // This endpoint serves as a verification/logging point

    // Return instructions for client-side execution
    res.json({
      success: true,
      message: 'Blend should be executed client-side',
      blend_contract: 'blend.nefty',
      blend_action: 'claimblend',
      blend_data: {
        claimer: account,
        blend_id: parseInt(blend_id),
        asset_ids: asset_ids
      },
      note: 'User must sign this transaction with their wallet'
    });

  } catch (error) {
    console.error('Error in blend execute:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * POST /api/admin/login
 * Admin authentication
 */
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password, wallet_account } = req.body;

    // Check password-based auth
    if (password) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        return res.status(500).json({ error: 'Admin password not configured' });
      }

      if (password === adminPassword) {
        const token = jwt.sign({ admin: true, method: 'password' }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, method: 'password' });
      }
    }

    // Check wallet-based auth
    if (wallet_account) {
      const isAdmin = db.admin.isAdmin(wallet_account);
      if (isAdmin) {
        const token = jwt.sign({ admin: true, wallet_account, method: 'wallet' }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, method: 'wallet', wallet_account });
      }
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/config
 * Get system configuration
 */
app.get('/api/admin/config', authenticateAdmin, async (req, res) => {
  try {
    const config = db.config.get();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/config
 * Update system configuration
 */
app.post('/api/admin/config', authenticateAdmin, async (req, res) => {
  try {
    const { whitelist_templates, reward_template, cooldown_hours, collection_name } = req.body;

    // Validate input
    if (!whitelist_templates || !reward_template || !cooldown_hours || !collection_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    db.config.update({
      whitelist_templates,
      reward_template: parseInt(reward_template),
      cooldown_hours: parseInt(cooldown_hours),
      collection_name
    });

    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stats
 * Get system statistics
 */
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = db.claims.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/claims
 * Get all claims
 */
app.get('/api/admin/claims', authenticateAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const claims = db.claims.getAll(limit);

    res.json({
      success: true,
      total: claims.length,
      claims
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/claims/full
 * Get comprehensive claim history with filtering and sorting
 * Query params:
 *   - groupBy: "claim" (default) or "wallet"
 *   - sortBy: "date" (default), "wallet", "reward"
 *   - sortOrder: "desc" (default) or "asc"
 *   - limit: number of results (default: all)
 *   - offset: pagination offset (default: 0)
 */
app.get('/api/admin/claims/full', authenticateAdmin, async (req, res) => {
  try {
    const groupBy = req.query.groupBy || 'claim';
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.sortOrder || 'desc';
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;

    // Get all claims from database (using large limit to get all)
    const allClaims = db.claims.getAll(999999);
    const config = db.config.get();

    // Enrich claims with template names
    const enrichedClaims = await Promise.all(allClaims.map(async (claim) => {
      // Get reward name
      let rewardName = null;
      if (claim.reward_id) {
        const rewardConfig = db.templateRewards.getById(claim.reward_id);
        if (rewardConfig && rewardConfig.reward_name) {
          rewardName = rewardConfig.reward_name;
        }
      }

      if (!rewardName) {
        try {
          const rewardTemplate = await wax.getTemplate(config.collection_name, claim.reward_template);
          if (rewardTemplate && rewardTemplate.immutable_data && rewardTemplate.immutable_data.name) {
            rewardName = rewardTemplate.immutable_data.name;
          }
        } catch (err) {
          console.warn(`Could not fetch reward template ${claim.reward_template}:`, err.message);
        }
      }

      // Get qualifying template name
      let qualifyingTemplateName = null;
      const templateConfig = db.templates.getById(claim.template_id);
      if (templateConfig && templateConfig.name) {
        qualifyingTemplateName = templateConfig.name;
      } else {
        try {
          const qualifyingTemplate = await wax.getTemplate(config.collection_name, claim.template_id);
          if (qualifyingTemplate && qualifyingTemplate.immutable_data && qualifyingTemplate.immutable_data.name) {
            qualifyingTemplateName = qualifyingTemplate.immutable_data.name;
          }
        } catch (err) {
          console.warn(`Could not fetch template ${claim.template_id}:`, err.message);
        }
      }

      return {
        ...claim,
        reward_name: rewardName || `Template #${claim.reward_template}`,
        qualifying_template_name: qualifyingTemplateName || `Template #${claim.template_id}`
      };
    }));

    let result;

    if (groupBy === 'wallet') {
      // Group by wallet
      const walletGroups = {};
      enrichedClaims.forEach(claim => {
        if (!walletGroups[claim.wallet_account]) {
          walletGroups[claim.wallet_account] = {
            wallet: claim.wallet_account,
            total_claims: 0,
            first_claim: claim.claimed_at,
            last_claim: claim.claimed_at,
            claims: []
          };
        }
        walletGroups[claim.wallet_account].total_claims++;
        walletGroups[claim.wallet_account].claims.push(claim);

        // Update first/last claim dates
        if (claim.claimed_at < walletGroups[claim.wallet_account].first_claim) {
          walletGroups[claim.wallet_account].first_claim = claim.claimed_at;
        }
        if (claim.claimed_at > walletGroups[claim.wallet_account].last_claim) {
          walletGroups[claim.wallet_account].last_claim = claim.claimed_at;
        }
      });

      result = Object.values(walletGroups);

      // Sort grouped results
      if (sortBy === 'wallet') {
        result.sort((a, b) => {
          const comparison = a.wallet.localeCompare(b.wallet);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      } else if (sortBy === 'date') {
        result.sort((a, b) => {
          const comparison = new Date(a.last_claim) - new Date(b.last_claim);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      } else if (sortBy === 'count') {
        result.sort((a, b) => {
          const comparison = a.total_claims - b.total_claims;
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      }

      // Sort claims within each group by date
      result.forEach(group => {
        group.claims.sort((a, b) => {
          const comparison = new Date(a.claimed_at) - new Date(b.claimed_at);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      });
    } else {
      // Individual claims
      result = enrichedClaims;

      // Sort results
      if (sortBy === 'wallet') {
        result.sort((a, b) => {
          const comparison = a.wallet_account.localeCompare(b.wallet_account);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      } else if (sortBy === 'reward') {
        result.sort((a, b) => {
          const comparison = a.reward_name.localeCompare(b.reward_name);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      } else { // date
        result.sort((a, b) => {
          const comparison = new Date(a.claimed_at) - new Date(b.claimed_at);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      }
    }

    // Apply pagination
    const total = result.length;
    if (limit > 0) {
      result = result.slice(offset, offset + limit);
    }

    res.json({
      success: true,
      total,
      count: result.length,
      groupBy,
      sortBy,
      sortOrder,
      data: result
    });
  } catch (error) {
    console.error('Error fetching full claim history:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== TEMPLATE MANAGEMENT ENDPOINTS ====================

/**
 * GET /api/admin/templates
 * Get all templates
 */
app.get('/api/admin/templates', authenticateAdmin, async (req, res) => {
  try {
    const templates = db.templates.getAll();
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/templates
 * Add a new template
 */
app.post('/api/admin/templates', authenticateAdmin, async (req, res) => {
  try {
    const { template_id, name, reward_template_id, cooldown_hours } = req.body;

    if (!template_id || !reward_template_id || !cooldown_hours) {
      return res.status(400).json({ error: 'Missing required fields: template_id, reward_template_id, cooldown_hours' });
    }

    // Check if template already exists
    const existing = db.templates.getById(parseInt(template_id));
    if (existing) {
      return res.status(400).json({ error: 'Template already exists' });
    }

    db.templates.add(
      parseInt(template_id),
      name || null,
      parseInt(reward_template_id),
      parseInt(cooldown_hours)
    );

    res.json({ success: true, message: 'Template added successfully' });
  } catch (error) {
    console.error('Error adding template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/templates/:template_id
 * Update a template
 */
app.put('/api/admin/templates/:template_id', authenticateAdmin, async (req, res) => {
  try {
    const { template_id } = req.params;
    const { name, reward_template_id, cooldown_hours, enabled } = req.body;

    // Check if template exists
    const existing = db.templates.getById(parseInt(template_id));
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.templates.update(parseInt(template_id), {
      name: name !== undefined ? name : existing.name,
      reward_template_id: reward_template_id !== undefined ? parseInt(reward_template_id) : existing.reward_template_id,
      cooldown_hours: cooldown_hours !== undefined ? parseInt(cooldown_hours) : existing.cooldown_hours,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled
    });

    res.json({ success: true, message: 'Template updated successfully' });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/templates/:template_id
 * Delete a template
 */
app.delete('/api/admin/templates/:template_id', authenticateAdmin, async (req, res) => {
  try {
    const { template_id } = req.params;

    const existing = db.templates.getById(parseInt(template_id));
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.templates.delete(parseInt(template_id));

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEMPLATE REWARDS ENDPOINTS ====================

/**
 * GET /api/admin/template-rewards/:template_id
 * Get all rewards for a specific template
 */
app.get('/api/admin/template-rewards/:template_id', authenticateAdmin, async (req, res) => {
  try {
    const { template_id } = req.params;
    const rewards = db.templateRewards.getByTemplateId(parseInt(template_id));
    res.json({ success: true, rewards });
  } catch (error) {
    console.error('Error fetching template rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/template-rewards
 * Add a new reward to a template
 */
app.post('/api/admin/template-rewards', authenticateAdmin, async (req, res) => {
  try {
    const { template_id, reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity } = req.body;

    if (!template_id || !reward_template_id || cooldown_hours === undefined) {
      return res.status(400).json({ error: 'Missing required fields: template_id, reward_template_id, cooldown_hours' });
    }

    // Validate template_id
    const validatedTemplateId = validators.validateTemplateId(template_id);
    if (validatedTemplateId === null) {
      return res.status(400).json({ error: 'Invalid template_id - must be a positive integer' });
    }

    // Validate reward_template_id
    const validatedRewardTemplateId = validators.validateTemplateId(reward_template_id);
    if (validatedRewardTemplateId === null) {
      return res.status(400).json({ error: 'Invalid reward_template_id - must be a positive integer' });
    }

    // Validate cooldown_hours
    const validatedCooldownHours = validators.validateCooldownHours(cooldown_hours);
    if (validatedCooldownHours === null) {
      return res.status(400).json({ error: 'Invalid cooldown_hours - must be between 0 and 8760 (1 year)' });
    }

    // Validate max_claims (optional)
    let validatedMaxClaims = null;
    if (max_claims !== null && max_claims !== undefined) {
      validatedMaxClaims = validators.validateInteger(max_claims, { min: 1, max: 1000 });
      if (validatedMaxClaims === null) {
        return res.status(400).json({ error: 'Invalid max_claims - must be between 1 and 1000' });
      }
    }

    // Validate reward_name (optional)
    const validatedRewardName = validators.validateString(reward_name || '', {
      maxLength: 100,
      required: false
    });

    // Verify template exists
    const template = db.templates.getById(validatedTemplateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.templateRewards.add(
      validatedTemplateId,
      validatedRewardTemplateId,
      validatedRewardName || null,
      validatedCooldownHours,
      validatedMaxClaims,
      validators.validateBoolean(match_quantity)
    );

    res.json({ success: true, message: 'Reward added successfully' });
  } catch (error) {
    console.error('Error adding template reward:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/template-rewards/:id
 * Update a template reward
 */
app.put('/api/admin/template-rewards/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity, enabled } = req.body;

    const existing = db.templateRewards.getById(parseInt(id));
    if (!existing) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    db.templateRewards.update(parseInt(id), {
      reward_template_id: reward_template_id !== undefined ? parseInt(reward_template_id) : existing.reward_template_id,
      reward_name: reward_name !== undefined ? reward_name : existing.reward_name,
      cooldown_hours: cooldown_hours !== undefined ? parseInt(cooldown_hours) : existing.cooldown_hours,
      max_claims: max_claims !== undefined ? (max_claims ? parseInt(max_claims) : null) : existing.max_claims,
      match_quantity: match_quantity !== undefined ? match_quantity : existing.match_quantity,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled
    });

    res.json({ success: true, message: 'Reward updated successfully' });
  } catch (error) {
    console.error('Error updating template reward:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/template-rewards/:id
 * Delete a template reward
 */
app.delete('/api/admin/template-rewards/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.templateRewards.getById(parseInt(id));
    if (!existing) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    db.templateRewards.delete(parseInt(id));

    res.json({ success: true, message: 'Reward deleted successfully' });
  } catch (error) {
    console.error('Error deleting template reward:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/export
 * Export all templates and configuration as JSON backup
 */
app.get('/api/admin/export', authenticateAdmin, async (req, res) => {
  try {
    const config = db.config.get();
    const templates = db.templates.getAll();
    const adminAccounts = db.admin.getAll();

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      config: {
        collection_name: config.collection_name,
        whitelist_templates: config.whitelist_templates,
        reward_template: config.reward_template,
        cooldown_hours: config.cooldown_hours
      },
      templates: templates,
      admin_accounts: adminAccounts.map(a => a.wallet_account)
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="fr-rewards-backup-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/import
 * Import templates from JSON backup
 */
app.post('/api/admin/import', authenticateAdmin, async (req, res) => {
  try {
    const { templates, config, admin_accounts, replace } = req.body;

    if (!templates || !Array.isArray(templates)) {
      return res.status(400).json({ error: 'Invalid import data: templates array required' });
    }

    let imported = 0;
    let skipped = 0;
    let updated = 0;

    // Import templates
    for (const template of templates) {
      const exists = db.templates.getById(template.template_id);

      if (exists) {
        if (replace) {
          db.templates.update(template.template_id, {
            name: template.name,
            reward_template_id: template.reward_template_id,
            cooldown_hours: template.cooldown_hours,
            enabled: template.enabled
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        db.templates.add(
          template.template_id,
          template.name,
          template.reward_template_id,
          template.cooldown_hours
        );
        if (template.enabled === 0) {
          db.templates.disable(template.template_id);
        }
        imported++;
      }
    }

    // Update config if provided
    if (config) {
      db.config.update({
        whitelist_templates: config.whitelist_templates,
        reward_template: config.reward_template,
        cooldown_hours: config.cooldown_hours,
        collection_name: config.collection_name
      });
    }

    // Import admin accounts if provided
    if (admin_accounts && Array.isArray(admin_accounts)) {
      for (const account of admin_accounts) {
        db.admin.add(account);
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      stats: {
        imported,
        updated,
        skipped,
        total: templates.length
      }
    });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/upload-logo
 * Upload a logo image
 */
app.post('/api/admin/upload-logo', authenticateAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoUrl = `/uploads/${req.file.filename}`;

    // Update database with new logo URL
    db.config.updateBranding({ logo_url: logoUrl });

    res.json({
      success: true,
      logo_url: logoUrl,
      message: 'Logo uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/upload-favicon
 * Upload and resize a favicon image (auto-resize to 32x32)
 */
app.post('/api/admin/upload-favicon', authenticateAdmin, upload.single('favicon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sharp = require('sharp');
    const fs = require('fs');

    // Resize image to 32x32 and convert to PNG buffer
    const resizedBuffer = await sharp(req.file.path)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Convert to base64 data URI
    const base64Data = `data:image/png;base64,${resizedBuffer.toString('base64')}`;

    // Delete the original uploaded file
    fs.unlinkSync(req.file.path);

    // Update database with base64 favicon data (stored in favicon_url for now)
    db.config.updateBranding({ favicon_url: base64Data });

    res.json({
      success: true,
      favicon_url: base64Data,
      message: 'Favicon uploaded and resized to 32x32 successfully'
    });
  } catch (error) {
    console.error('Error uploading favicon:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/branding
 * Update page branding (title, subtitle)
 */
app.put('/api/admin/branding', authenticateAdmin, async (req, res) => {
  try {
    const { page_title, page_subtitle } = req.body;

    const updates = {};

    // Validate page_title (max 100 chars)
    if (page_title !== undefined) {
      const validatedTitle = validators.validateString(page_title, {
        maxLength: 100,
        required: false
      });
      if (validatedTitle === null) {
        return res.status(400).json({ error: 'Invalid page_title - max length 100 characters' });
      }
      updates.page_title = validatedTitle;
    }

    // Validate page_subtitle (max 200 chars)
    if (page_subtitle !== undefined) {
      const validatedSubtitle = validators.validateString(page_subtitle, {
        maxLength: 200,
        required: false
      });
      if (validatedSubtitle === null) {
        return res.status(400).json({ error: 'Invalid page_subtitle - max length 200 characters' });
      }
      updates.page_subtitle = validatedSubtitle;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No branding fields provided' });
    }

    db.config.updateBranding(updates);

    res.json({
      success: true,
      message: 'Branding updated successfully'
    });
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/config/public
 * Get public configuration (no auth required)
 */
app.get('/api/config/public', async (req, res) => {
  try {
    const config = db.config.get();
    const enabledTemplates = db.templates.getEnabled();

    res.json({
      success: true,
      config: {
        collection_name: config.collection_name,
        templates: enabledTemplates,
        page_title: config.page_title || 'NFT Holder Rewards',
        page_subtitle: config.page_subtitle || 'Connect your wallet to claim rewards!',
        logo_url: config.logo_url || null,
        favicon_url: config.favicon_url || null  // Now returns base64 data URI
      }
    });
  } catch (error) {
    console.error('Error fetching public config:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FRONTEND ROUTES ====================

// ==================== WORKFLOW ADMIN ENDPOINTS ====================

/**
 * GET /api/admin/workflow/steps
 * Get all workflow steps
 */
app.get('/api/admin/workflow/steps', authenticateAdmin, async (req, res) => {
  try {
    const steps = db.workflowSteps.getAll();
    res.json({ success: true, steps });
  } catch (error) {
    console.error('Error fetching workflow steps:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/workflow/steps
 * Add a new workflow step
 */
app.post('/api/admin/workflow/steps', authenticateAdmin, async (req, res) => {
  try {
    const { step_order, name, description } = req.body;

    if (!step_order || !name) {
      return res.status(400).json({ error: 'step_order and name are required' });
    }

    const result = db.workflowSteps.add(
      parseInt(step_order),
      name,
      description || null
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error adding workflow step:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/workflow/steps/:id
 * Update a workflow step
 */
app.put('/api/admin/workflow/steps/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { step_order, name, description, enabled } = req.body;

    const existingStep = db.workflowSteps.getById(parseInt(id));
    if (!existingStep) {
      return res.status(404).json({ error: 'Step not found' });
    }

    const updateData = {
      step_order: step_order !== undefined ? parseInt(step_order) : existingStep.step_order,
      name: name !== undefined ? name : existingStep.name,
      description: description !== undefined ? description : existingStep.description,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : existingStep.enabled
    };

    db.workflowSteps.update(parseInt(id), updateData);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating workflow step:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/workflow/steps/:id
 * Delete a workflow step
 */
app.delete('/api/admin/workflow/steps/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    db.workflowSteps.delete(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow step:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/workflow/actions
 * Get workflow actions (optionally filtered by step_id)
 */
app.get('/api/admin/workflow/actions', authenticateAdmin, async (req, res) => {
  try {
    const { step_id } = req.query;

    let actions;
    if (step_id) {
      actions = db.workflowActions.getByStepId(parseInt(step_id));
    } else {
      actions = db.workflowActions.getAll();
    }

    res.json({ success: true, actions });
  } catch (error) {
    console.error('Error fetching workflow actions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/workflow/actions
 * Add a new workflow action
 */
app.post('/api/admin/workflow/actions', authenticateAdmin, async (req, res) => {
  try {
    const { step_id, action_order, action_type, name, description, config } = req.body;

    if (!step_id || action_order === undefined || !action_type || !name) {
      return res.status(400).json({ error: 'step_id, action_order, action_type, and name are required' });
    }

    // Validate action_type
    const validActionTypes = ['CLAIM', 'UNPACK', 'BLEND', 'BLEND_ARRAY', 'DROP', 'MARKET_SCOUT'];
    if (!validActionTypes.includes(action_type)) {
      return res.status(400).json({ error: 'Invalid action_type' });
    }

    const result = db.workflowActions.add(
      parseInt(step_id),
      parseInt(action_order),
      action_type,
      name,
      description || null,
      config || null
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error adding workflow action:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/workflow/actions/:id
 * Update a workflow action (order, type, name, config, etc.)
 */
app.put('/api/admin/workflow/actions/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action_order, action_type, name, description, config, enabled } = req.body;

    const existingAction = db.workflowActions.getById(parseInt(id));
    if (!existingAction) {
      return res.status(404).json({ error: 'Action not found' });
    }

    // Validate action_type if provided
    if (action_type) {
      const validActionTypes = ['CLAIM', 'UNPACK', 'BLEND', 'BLEND_ARRAY', 'DROP', 'MARKET_SCOUT'];
      if (!validActionTypes.includes(action_type)) {
        return res.status(400).json({ error: 'Invalid action_type' });
      }
    }

    const updateData = {
      step_id: existingAction.step_id,  // Keep same step
      action_order: action_order !== undefined ? parseInt(action_order) : existingAction.action_order,
      action_type: action_type !== undefined ? action_type : existingAction.action_type,
      name: name !== undefined ? name : existingAction.name,
      description: description !== undefined ? description : existingAction.description,
      config: config !== undefined ? JSON.stringify(config) : existingAction.config,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : existingAction.enabled
    };

    db.workflowActions.update(parseInt(id), updateData);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating workflow action:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/workflow/actions/:id
 * Delete a workflow action
 */
app.delete('/api/admin/workflow/actions/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    db.workflowActions.delete(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow action:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workflow/progress/:account
 * Get user's workflow progress (public endpoint)
 */
app.get('/api/workflow/progress/:account', async (req, res) => {
  try {
    const { account } = req.params;

    if (!account) {
      return res.status(400).json({ error: 'account parameter required' });
    }

    const progress = db.userWorkflowProgress.getProgressWithContext(account);

    res.json({ success: true, progress });
  } catch (error) {
    console.error('Error fetching user workflow progress:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/workflow/complete
 * Mark an action as completed for a user
 */
app.post('/api/workflow/complete', async (req, res) => {
  try {
    const { account, action_id, transaction_id, result_data } = req.body;

    if (!account || !action_id) {
      return res.status(400).json({ error: 'account and action_id are required' });
    }

    // Check if already completed
    if (db.userWorkflowProgress.hasCompletedAction(account, action_id)) {
      return res.json({ success: true, message: 'Action already completed' });
    }

    // Mark as complete
    db.userWorkflowProgress.add(
      account,
      action_id,
      transaction_id || null,
      result_data || null
    );

    console.log(`✅ Action ${action_id} marked complete for ${account}`);

    res.json({ success: true, message: 'Action marked as completed' });
  } catch (error) {
    console.error('Error marking action complete:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== STORY TABS ADMIN ENDPOINTS ====================

/**
 * GET /api/admin/story/tabs
 * Get all story tabs
 */
app.get('/api/admin/story/tabs', authenticateAdmin, async (req, res) => {
  try {
    const tabs = db.storyTabs.getAll();
    res.json({ success: true, tabs });
  } catch (error) {
    console.error('Error fetching story tabs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/story/tabs
 * Add a new story tab
 */
app.post('/api/admin/story/tabs', authenticateAdmin, async (req, res) => {
  try {
    const { tab_order, tab_name, tab_icon } = req.body;

    if (!tab_order || !tab_name) {
      return res.status(400).json({ error: 'tab_order and tab_name are required' });
    }

    const result = db.storyTabs.add(
      parseInt(tab_order),
      tab_name,
      tab_icon || '📖'
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error adding story tab:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/story/tabs/:id
 * Update a story tab
 */
app.put('/api/admin/story/tabs/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tab_order, tab_name, tab_icon, enabled } = req.body;

    const existingTab = db.storyTabs.getById(parseInt(id));
    if (!existingTab) {
      return res.status(404).json({ error: 'Story tab not found' });
    }

    const updateData = {
      tab_order: tab_order !== undefined ? parseInt(tab_order) : existingTab.tab_order,
      tab_name: tab_name !== undefined ? tab_name : existingTab.tab_name,
      tab_icon: tab_icon !== undefined ? tab_icon : existingTab.tab_icon,
      enabled: enabled !== undefined ? enabled : existingTab.enabled
    };

    db.storyTabs.update(parseInt(id), updateData);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating story tab:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/story/tabs/:id
 * Delete a story tab
 */
app.delete('/api/admin/story/tabs/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    db.storyTabs.delete(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting story tab:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/story/tabs
 * Get enabled story tabs (public endpoint)
 */
app.get('/api/story/tabs', async (req, res) => {
  try {
    const tabs = db.storyTabs.getEnabled();
    res.json({ success: true, tabs });
  } catch (error) {
    console.error('Error fetching story tabs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== NAVIGATION CONFIG ENDPOINTS ====================

/**
 * GET /api/admin/config/navigation
 * Get navigation configuration
 */
app.get('/api/admin/config/navigation', authenticateAdmin, async (req, res) => {
  try {
    const navConfig = db.config.getNavConfig();
    res.json({ success: true, config: navConfig });
  } catch (error) {
    console.error('Error fetching navigation config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/config/navigation
 * Update navigation configuration
 */
app.put('/api/admin/config/navigation', authenticateAdmin, async (req, res) => {
  try {
    const { show_claims, show_unpack, show_story } = req.body;

    const navConfig = {
      show_claims: show_claims !== undefined ? show_claims : true,
      show_unpack: show_unpack !== undefined ? show_unpack : true,
      show_story: show_story !== undefined ? show_story : true
    };

    db.config.updateNavConfig(navConfig);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating navigation config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/config/navigation
 * Get navigation configuration (public endpoint)
 */
app.get('/api/config/navigation', async (req, res) => {
  try {
    const navConfig = db.config.getNavConfig();
    res.json({ success: true, config: navConfig });
  } catch (error) {
    console.error('Error fetching navigation config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/assets-rpc/:account/:template_id
 * Query atomicassets contract DIRECTLY via blockchain RPC (no API cache!)
 * Uses EOSNation/blockchain nodes to get real-time ownership data
 */
app.get('/api/user/assets-rpc/:account/:template_id', async (req, res) => {
  try {
    const { account, template_id } = req.params;

    if (!account || !template_id) {
      return res.status(400).json({ error: 'account and template_id are required' });
    }

    console.log(`Querying blockchain for ${account}'s assets, template ${template_id}...`);

    const { JsonRpc } = require('eosjs');

    // LIVE RPC endpoints - wallet ownership check
    const rpcEndpoints = [
      'https://api.wax.alohaeos.com',    // PRIMARY per user request
      'https://wax.greymass.com',
      'https://api.waxsweden.org',
      'https://wax.eosphere.io',
      'https://wax.eu.eosamsterdam.net',
      'https://wax.cryptolions.io'
    ];

    let allMatchingAssets = [];
    let querySuccess = false;
    let totalChecked = 0; // Declare outside loop so it's accessible in response

    // Try each RPC endpoint until one succeeds
    for (const endpoint of rpcEndpoints) {
      try {
        console.log(`  Trying RPC endpoint: ${endpoint}`);
        const rpc = new JsonRpc(endpoint, { fetch });

        let hasMore = true;
        let lowerBound = '';
        totalChecked = 0; // Reset for each endpoint attempt

        // Paginate through all assets until we find all matching templates
        while (hasMore && totalChecked < 10000) { // Safety limit: max 10k assets to check
          const result = await rpc.get_table_rows({
            json: true,
            code: 'atomicassets',
            scope: account,
            table: 'assets',
            lower_bound: lowerBound,
            upper_bound: '',
            limit: 1000,
            reverse: false,
            show_payer: false
          });

          totalChecked += result.rows.length;

          // Filter this batch for matching template
          const matchingInBatch = result.rows.filter(row =>
            row.template_id == template_id
          );

          allMatchingAssets = allMatchingAssets.concat(matchingInBatch);

          console.log(`  Page ${Math.ceil(totalChecked / 1000)}: checked ${result.rows.length} assets, found ${matchingInBatch.length} matching (total: ${allMatchingAssets.length})`);

          // Check if there are more results
          if (result.more) {
            // Set lower_bound to the next asset_id
            const lastAsset = result.rows[result.rows.length - 1];
            lowerBound = (BigInt(lastAsset.asset_id) + BigInt(1)).toString();
          } else {
            hasMore = false;
          }
        }

        console.log(`✅ Blockchain query complete via ${endpoint}: checked ${totalChecked} assets, found ${allMatchingAssets.length} with template ${template_id}`);
        querySuccess = true;
        break; // Success, exit endpoint loop
      } catch (error) {
        console.warn(`  ❌ RPC endpoint ${endpoint} failed:`, error.message);
        continue; // Try next endpoint
      }
    }

    if (!querySuccess) {
      throw new Error('All RPC endpoints failed for wallet ownership check');
    }

    // Fetch template_mint for all assets from AtomicAssets API (blockchain doesn't always have it)
    // Use bulk endpoint for efficiency
    if (allMatchingAssets.length > 0) {
      const atomicEndpoints = [
        'https://aa-wax-public1.neftyblocks.com',
        'https://wax-aa.eosdac.io',
        'https://atomic-wax-mainnet.wecan.dev',
        'https://wax-atomic-api.eosphere.io'
      ];

      const assetIds = allMatchingAssets.map(a => a.asset_id).join(',');

      // Try each endpoint until one works
      let mintsFetched = false;
      for (const endpoint of atomicEndpoints) {
        try {
          const response = await fetch(`${endpoint}/atomicassets/v1/assets?ids=${assetIds}&limit=1000`, {
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

            // Add mint numbers to blockchain assets
            allMatchingAssets.forEach(asset => {
              asset.template_mint = mintMap[asset.asset_id] || null;
            });

            const mintsFound = allMatchingAssets.filter(a => a.template_mint).length;
            console.log(`✅ Fetched mint numbers for ${mintsFound}/${allMatchingAssets.length} assets from ${endpoint}`);
            mintsFetched = true;
            break; // Success, exit loop
          }
        } catch (err) {
          console.warn(`Failed to fetch mints from ${endpoint}:`, err.message);
          continue; // Try next endpoint
        }
      }

      if (!mintsFetched) {
        console.warn(`Could not fetch mint numbers from any AtomicAssets API endpoint`);
      }
    }

    // Convert blockchain format to AtomicAssets API format for compatibility
    const formattedAssets = allMatchingAssets.map(row => ({
      asset_id: row.asset_id,
      template: {
        template_id: row.template_id.toString()
      },
      template_mint: row.template_mint || null,
      owner: account,
      collection_name: row.collection_name,
      schema_name: row.schema_name,
      backed_tokens: row.backed_tokens || [],
      immutable_data: row.immutable_data || {},
      mutable_data: row.mutable_data || {}
    }));

    res.json({
      success: true,
      source: 'blockchain_rpc',
      total_checked: totalChecked,
      data: formattedAssets
    });
  } catch (error) {
    console.error('Error querying blockchain assets:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/user/assets/:account/:template_id
 * Proxy endpoint to fetch user's assets from AtomicAssets API (avoids CORS)
 * Uses wax.getUserAssets with timeout and fallback endpoints
 */
app.get('/api/user/assets/:account/:template_id', async (req, res) => {
  try {
    const { account, template_id } = req.params;

    if (!account || !template_id) {
      return res.status(400).json({ error: 'account and template_id are required' });
    }

    console.log(`Fetching assets for ${account}, template ${template_id}...`);

    // Use wax.getUserAssets which has timeout and fallback logic
    const allAssets = await wax.getUserAssets(account);

    // Filter by template ID
    const matchingAssets = allAssets.filter(asset =>
      asset.template && asset.template.template_id === template_id
    );

    console.log(`Found ${matchingAssets.length} assets with template ${template_id}`);

    res.json({
      success: true,
      data: matchingAssets
    });
  } catch (error) {
    console.error('Error fetching user assets:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/user/check-ownership/:account
 * Check if user owns specific template IDs (for action status checking)
 * Query params: template_ids (comma-separated list of template IDs)
 * Uses blockchain RPC for real-time ownership checking (no cache)
 */
app.get('/api/user/check-ownership/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const { template_ids } = req.query;

    if (!account || !template_ids) {
      return res.status(400).json({ error: 'account and template_ids query param are required' });
    }

    const templateIdArray = template_ids.split(',').map(id => id.trim());
    const ownershipStatus = {};

    console.log(`Checking ownership for ${account}:`, templateIdArray);

    // Use blockchain RPC to check ownership (real-time, no cache)
    const { JsonRpc } = require('eosjs');
    // LIVE RPC endpoints - same as getUserAssetsLive() for consistency
    const rpcEndpoints = [
      'https://api.wax.alohaeos.com',    // PRIMARY per user request
      'https://wax.greymass.com',
      'https://api.waxsweden.org',
      'https://wax.eosphere.io',
      'https://wax.eu.eosamsterdam.net',
      'https://wax.cryptolions.io'
    ];

    let allAssets = [];
    let success = false;

    // Try RPC endpoints until one works
    for (const endpoint of rpcEndpoints) {
      try {
        const rpc = new JsonRpc(endpoint, { fetch });
        let hasMore = true;
        let lowerBound = '';

        // Paginate through all assets
        while (hasMore) {
          const result = await rpc.get_table_rows({
            json: true,
            code: 'atomicassets',
            scope: account,
            table: 'assets',
            lower_bound: lowerBound,
            limit: 1000
          });

          if (result.rows && result.rows.length > 0) {
            allAssets = allAssets.concat(result.rows);
            hasMore = result.more;
            if (hasMore) {
              lowerBound = result.next_key;
            }
          } else {
            hasMore = false;
          }
        }

        success = true;
        break; // Exit endpoint loop on success
      } catch (err) {
        console.warn(`RPC endpoint ${endpoint} failed:`, err.message);
        continue; // Try next endpoint
      }
    }

    if (!success) {
      throw new Error('All RPC endpoints failed');
    }

    // Check each template ID
    for (const templateId of templateIdArray) {
      const ownsTemplate = allAssets.some(asset =>
        asset.template_id && asset.template_id.toString() === templateId.toString()
      );
      ownershipStatus[templateId] = ownsTemplate;
      console.log(`Template ${templateId}: ${ownsTemplate ? 'OWNED' : 'NOT OWNED'}`);
    }

    res.json({ success: true, ownership: ownershipStatus });
  } catch (error) {
    console.error('Error checking asset ownership:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/pack/roll-count/:pack_template_id
 * Query atomicpacksx contract to get exact roll count for a pack template
 */
app.get('/api/pack/roll-count/:pack_template_id', async (req, res) => {
  try {
    const { pack_template_id } = req.params;

    if (!pack_template_id) {
      return res.status(400).json({ error: 'pack_template_id is required' });
    }

    console.log(`Querying roll count for pack template ${pack_template_id}...`);

    const { JsonRpc } = require('eosjs');
    const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

    // Query the packs table from atomicpacksx contract
    const result = await rpc.get_table_rows({
      json: true,
      code: 'atomicpacksx',
      scope: 'atomicpacksx',
      table: 'packs',
      limit: 1000,
      reverse: false,
      show_payer: false
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        error: 'No packs found in atomicpacksx table',
        success: false
      });
    }

    // Find the pack with matching pack_template_id
    const pack = result.rows.find(row => row.pack_template_id === parseInt(pack_template_id));

    if (!pack) {
      return res.status(404).json({
        error: `Pack template ${pack_template_id} not found in atomicpacksx`,
        success: false
      });
    }

    const rollCount = parseInt(pack.roll_counter);
    console.log(`✅ Pack template ${pack_template_id}: ${rollCount} rolls (pack_id: ${pack.pack_id})`);

    res.json({
      success: true,
      pack_template_id: parseInt(pack_template_id),
      pack_id: pack.pack_id,
      roll_count: rollCount,
      collection_name: pack.collection_name,
      unlock_time: pack.unlock_time
    });
  } catch (error) {
    console.error('Error fetching pack roll count:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/pack/unboxed-rolls/:pack_asset_id
 * Query atomicpacksx unboxassets table to get actual rolls created after unpacking
 * This is the EXACT method - queries what the blockchain actually created
 */
app.get('/api/pack/unboxed-rolls/:pack_asset_id', async (req, res) => {
  try {
    const { pack_asset_id } = req.params;

    if (!pack_asset_id) {
      console.log('❌ STEP 1 FAILED: No pack_asset_id provided');
      return res.status(400).json({ error: 'pack_asset_id is required' });
    }

    console.log(`\n🔍 ========== CHECKING PACK ${pack_asset_id} ==========`);
    console.log(`STEP 1: ✅ Pack asset ID received: ${pack_asset_id}`);

    const { JsonRpc } = require('eosjs');

    // Use greymass and neftyblocks as requested
    const rpcEndpoints = [
      'https://wax.greymass.com',
      'https://wax-aa.neftyblocks.com',
      'https://wax.api.eosnation.io',
      'https://wax.eosphere.io'
    ];

    console.log(`STEP 2: Will try ${rpcEndpoints.length} RPC endpoints...`);

    let result = null;
    let success = false;
    let successEndpoint = null;

    // Try each RPC endpoint until one works
    for (let i = 0; i < rpcEndpoints.length; i++) {
      const endpoint = rpcEndpoints[i];
      console.log(`\n  STEP 2.${i+1}: Trying RPC endpoint: ${endpoint}`);

      try {
        const rpc = new JsonRpc(endpoint, { fetch });
        console.log(`    - JsonRpc instance created`);

        // Query the unboxassets table from atomicpacksx contract
        // This table is populated AFTER the pack is transferred for unpacking
        // The scope is the pack_asset_id itself!
        console.log(`    - Querying table: atomicpacksx::unboxassets with scope=${pack_asset_id}`);

        result = await rpc.get_table_rows({
          json: true,
          code: 'atomicpacksx',
          scope: pack_asset_id,
          table: 'unboxassets',
          limit: 1000,
          reverse: false,
          show_payer: false
        });

        console.log(`    - ✅ Query successful! Got ${result.rows ? result.rows.length : 0} rows`);
        success = true;
        successEndpoint = endpoint;
        break;
      } catch (err) {
        console.log(`    - ❌ Failed: ${err.message}`);
        continue;
      }
    }

    if (!success) {
      console.log(`\n❌ STEP 2 FAILED: All ${rpcEndpoints.length} RPC endpoints failed!`);
      return res.status(503).json({
        error: 'All RPC endpoints failed',
        success: false
      });
    }

    console.log(`\nSTEP 3: ✅ Successfully queried using ${successEndpoint}`);
    console.log(`STEP 4: Checking if pack has been unpacked...`);

    if (!result.rows || result.rows.length === 0) {
      console.log(`  ℹ️  Pack ${pack_asset_id} has NOT been unpacked yet (no rows in unboxassets)`);
      console.log(`  This is NORMAL for packs still in wallet - ready to unpack!`);
      console.log(`========== END CHECK (Pack Not Unpacked) ==========\n`);

      return res.status(404).json({
        error: `Pack not unpacked yet`,
        success: false,
        is_ready_to_unpack: true
      });
    }

    // Extract all roll IDs - scope is already filtered to this pack
    console.log(`STEP 5: Extracting roll IDs from ${result.rows.length} rows...`);

    const rollIds = result.rows
      .map(row => parseInt(row.origin_roll_id))
      .sort((a, b) => a - b);  // Sort numerically

    console.log(`STEP 6: ✅ Found ${rollIds.length} rolls for pack ${pack_asset_id}`);
    console.log(`  Roll IDs: [${rollIds.join(', ')}]`);
    console.log(`  Sample row data:`, JSON.stringify(result.rows[0]));
    console.log(`========== END CHECK (Pack Ready to Claim) ==========\n`);

    res.json({
      success: true,
      pack_asset_id: pack_asset_id,
      roll_ids: rollIds,
      roll_count: rollIds.length
    });
  } catch (error) {
    console.log(`\n❌ UNEXPECTED ERROR in /api/pack/unboxed-rolls:`, error.message);
    console.log(`Full error:`, error);
    console.log(`========== END CHECK (Error) ==========\n`);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/user/claimable-packs/:account
 * Query atomicpacksx unboxpacks table to find all packs ready to claim for a user
 * Returns packs that have been unpacked but not yet claimed
 */
app.get('/api/user/claimable-packs/:account', async (req, res) => {
  try {
    const { account } = req.params;

    if (!account) {
      return res.status(400).json({ error: 'account is required' });
    }

    console.log(`\n🎁 ========== QUERYING CLAIMABLE PACKS FOR ${account} ==========`);

    const { JsonRpc } = require('eosjs');

    // Use greymass and neftyblocks as requested
    const rpcEndpoints = [
      'https://wax.greymass.com',
      'https://wax-aa.neftyblocks.com',
      'https://wax.api.eosnation.io',
      'https://wax.eosphere.io'
    ];

    console.log(`STEP 1: Will try ${rpcEndpoints.length} RPC endpoints for unboxpacks table...`);

    let result = null;
    let rpc = null;
    let successEndpoint = null;

    // Try each RPC endpoint until one works
    for (let i = 0; i < rpcEndpoints.length; i++) {
      const endpoint = rpcEndpoints[i];
      try {
        console.log(`\n  STEP 1.${i+1}: Trying RPC endpoint: ${endpoint}`);
        rpc = new JsonRpc(endpoint, { fetch });

        // Query the unboxpacks table - scope is the user's account
        // This table contains all packs that have been unpacked but not claimed
        console.log(`    - Querying atomicpacksx::unboxpacks with account=${account}`);

        result = await rpc.get_table_rows({
          json: true,
          code: 'atomicpacksx',
          scope: 'atomicpacksx',  // Global scope for unboxpacks
          table: 'unboxpacks',
          lower_bound: account,
          upper_bound: account,
          key_type: 'name',
          index_position: 2,  // Secondary index by unlock_account (claimer)
          limit: 100,
          reverse: false,
          show_payer: false
        });

        console.log(`    - ✅ Success! Found ${result.rows.length} entries in unboxpacks table`);
        successEndpoint = endpoint;
        break; // Success, exit loop
      } catch (err) {
        console.log(`    - ❌ Failed: ${err.message}`);
        continue; // Try next endpoint
      }
    }

    if (!result) {
      throw new Error('All RPC endpoints failed for claimable packs query');
    }

    if (!result.rows || result.rows.length === 0) {
      console.log(`STEP 2: No claimable packs found in unboxpacks table`);
      console.log(`========== END CLAIMABLE PACKS QUERY ==========\n`);
      return res.json({
        success: true,
        claimable_packs: [],
        count: 0
      });
    }

    console.log(`\nSTEP 2: Processing ${result.rows.length} claimable packs from unboxpacks table...`);
    // For each pack, fetch the roll details from unboxassets table
    const claimablePacks = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      try {
        const packAssetId = row.pack_asset_id;
        console.log(`\n  STEP 2.${i+1}: Processing pack ${packAssetId}...`);

        // Query unboxassets table for this pack's rolls
        console.log(`    - Querying unboxassets table for pack ${packAssetId}...`);
        const rollsResult = await rpc.get_table_rows({
          json: true,
          code: 'atomicpacksx',
          scope: packAssetId,
          table: 'unboxassets',
          limit: 1000,
          reverse: false,
          show_payer: false
        });

        const rollIds = rollsResult.rows
          .map(r => parseInt(r.origin_roll_id))
          .sort((a, b) => a - b);

        console.log(`    - Found ${rollIds.length} rolls for pack ${packAssetId}`);

        if (rollIds.length > 0) {
          // Fetch asset details from AtomicAssets API to get template_mint, template_id, name
          console.log(`    - Fetching pack metadata from AtomicAssets API...`);
          const atomicEndpoints = [
            'https://aa-wax-public1.neftyblocks.com',
            'https://wax-aa.eosdac.io',
            'https://atomic-wax-mainnet.wecan.dev',
            'https://wax-atomic-api.eosphere.io'
          ];

          let packData = null;
          for (const endpoint of atomicEndpoints) {
            try {
              const apiResponse = await fetch(`${endpoint}/atomicassets/v1/assets/${packAssetId}`, {
                timeout: 3000
              });
              if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                const asset = apiData.data;

                // Extract ALL the data we need from the API response
                packData = {
                  template_mint: asset.template_mint,
                  template_id: asset.template?.template_id || null,
                  name: asset.name || asset.data?.name || 'Unknown Pack'
                };
                console.log(`    - ✅ Got metadata: Template ${packData.template_id}, Mint #${packData.template_mint}, Name: ${packData.name}`);
                break; // Success, exit loop
              }
            } catch (err) {
              // Try next endpoint
              continue;
            }
          }

          if (!packData) {
            console.warn(`Could not fetch pack data for ${packAssetId} from any API endpoint`);
            // Use fallback values
            packData = {
              template_mint: null,
              template_id: row.pack_template_id || null,
              name: 'Unknown Pack'
            };
          }

          claimablePacks.push({
            pack_asset_id: packAssetId,
            pack_template_id: packData.template_id,
            template_mint: packData.template_mint,
            name: packData.name,
            roll_ids: rollIds,
            roll_count: rollIds.length,
            unlock_time: row.unlock_time || null
          });

          console.log(`  ✅ Pack ${packAssetId} (${packData.name}): template ${packData.template_id}, mint #${packData.template_mint || 'Unknown'}, ${rollIds.length} rolls ready`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Error fetching rolls for pack ${row.pack_asset_id}:`, error.message);
      }
    }

    console.log(`\nSTEP 3: ✅ FINAL RESULT - Found ${claimablePacks.length} claimable packs for ${account}`);
    console.log(`========== END CLAIMABLE PACKS QUERY ==========\n`);

    res.json({
      success: true,
      claimable_packs: claimablePacks,
      count: claimablePacks.length
    });
  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR in /api/user/claimable-packs:', error.message);
    console.error('Full error:', error);
    console.log(`========== END CLAIMABLE PACKS QUERY (Error) ==========\n`);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/pack/unbox-details/:pack_asset_id
 * Get details about what's inside an unpacked (but not yet claimed) pack
 * Returns template info and images for each roll
 */
app.get('/api/pack/unbox-details/:pack_asset_id', async (req, res) => {
  try {
    const packAssetId = req.params.pack_asset_id;

    console.log(`📦 Fetching unbox details for pack ${packAssetId}...`);

    const { JsonRpc } = require('eosjs');
    const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

    // Query unboxassets table for this pack's rolls
    const rollsResult = await rpc.get_table_rows({
      json: true,
      code: 'atomicpacksx',
      scope: packAssetId,
      table: 'unboxassets',
      limit: 1000,
      reverse: false,
      show_payer: false
    });

    if (!rollsResult.rows || rollsResult.rows.length === 0) {
      return res.json({
        success: true,
        assets: [],
        count: 0
      });
    }

    console.log(`Found ${rollsResult.rows.length} rolls in pack ${packAssetId}`);

    // Fetch template details for each roll
    const atomicEndpoint = 'https://aa-wax-public1.neftyblocks.com';
    const assets = [];

    for (const row of rollsResult.rows) {
      try {
        // Get template details from AtomicAssets API
        const templateResponse = await fetch(`${atomicEndpoint}/atomicassets/v1/templates/futuresrelic/${row.template_id}`);

        if (templateResponse.ok) {
          const templateData = await templateResponse.json();
          const template = templateData.data;

          const assetData = {
            template_id: row.template_id,
            origin_roll_id: row.origin_roll_id,
            name: template.immutable_data?.name || `Template #${row.template_id}`,
            img: template.immutable_data?.img || null,
            video: template.immutable_data?.video || null,
            rarity: template.immutable_data?.rarity || null
          };

          assets.push(assetData);
          console.log(`  - Roll ${row.origin_roll_id}: ${assetData.name} (Template ${row.template_id})`);
        } else {
          // Fallback if template fetch fails
          assets.push({
            template_id: row.template_id,
            origin_roll_id: row.origin_roll_id,
            name: `Template #${row.template_id}`,
            img: null,
            video: null,
            rarity: null
          });
        }
      } catch (err) {
        console.warn(`Could not fetch template ${row.template_id}:`, err.message);
        // Add fallback entry
        assets.push({
          template_id: row.template_id,
          origin_roll_id: row.origin_roll_id,
          name: `Template #${row.template_id}`,
          img: null,
          video: null,
          rarity: null
        });
      }
    }

    res.json({
      success: true,
      assets: assets,
      count: assets.length
    });

  } catch (error) {
    console.error('Error fetching unbox details:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/page/load/:filepath
 * Load an HTML page for editing in Site Builder
 * Example: /api/page/load/story/phase2.html
 */
app.get('/api/page/load/:filepath(*)', async (req, res) => {
  try {
    const filepath = req.params.filepath;

    // Security: only allow loading from public directory
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(__dirname, 'public', filepath);

    // Prevent directory traversal
    if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
      return res.status(403).json({ error: 'Access denied', success: false });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found', success: false });
    }

    // Read the file
    const htmlContent = fs.readFileSync(fullPath, 'utf8');

    // Parse modules from HTML
    const { parse } = require('node-html-parser');
    const root = parse(htmlContent);
    const modules = [];

    const moduleElements = root.querySelectorAll('[data-module]');
    moduleElements.forEach((element, index) => {
      const moduleType = element.getAttribute('data-module');
      const configStr = element.getAttribute('data-config') || '{}';

      try {
        const config = JSON.parse(configStr);
        modules.push({
          id: index + 1,
          moduleType: moduleType,
          config: config
        });
      } catch (err) {
        console.warn(`Could not parse config for module ${moduleType}:`, err);
      }
    });

    res.json({
      success: true,
      filepath: filepath,
      modules: modules,
      html: htmlContent
    });

  } catch (error) {
    console.error('Error loading page:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/page/save
 * Save edited page back to file
 * Body: { filepath: 'story/phase2.html', modules: [...] }
 */
app.post('/api/page/save', async (req, res) => {
  try {
    const { filepath, modules } = req.body;

    if (!filepath || !modules) {
      return res.status(400).json({ error: 'filepath and modules are required', success: false });
    }

    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(__dirname, 'public', filepath);

    // Security: only allow saving to public directory
    if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
      return res.status(403).json({ error: 'Access denied', success: false });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found', success: false });
    }

    // Read current HTML
    const htmlContent = fs.readFileSync(fullPath, 'utf8');
    const { parse } = require('node-html-parser');
    const root = parse(htmlContent);

    // Update each module's config
    const moduleElements = root.querySelectorAll('[data-module]');
    moduleElements.forEach((element, index) => {
      const moduleInUpdate = modules[index];

      if (moduleInUpdate) {
        // Update the data-config attribute
        element.setAttribute('data-config', JSON.stringify(moduleInUpdate.config));
      }
    });

    // Write back to file
    fs.writeFileSync(fullPath, root.toString(), 'utf8');

    console.log(`✅ Saved page: ${filepath}`);

    res.json({
      success: true,
      message: 'Page saved successfully',
      filepath: filepath
    });

  } catch (error) {
    console.error('Error saving page:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/pack/check-claimable
 * Check which pack asset IDs are in the unboxassets table (ready to claim)
 * Body: { asset_ids: [id1, id2, ...] }
 */
app.post('/api/pack/check-claimable', async (req, res) => {
  try {
    const { asset_ids } = req.body;

    if (!asset_ids || !Array.isArray(asset_ids)) {
      return res.status(400).json({ error: 'asset_ids array is required' });
    }

    console.log(`Checking claimable status for ${asset_ids.length} packs...`);

    const { JsonRpc } = require('eosjs');
    const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

    const claimableStatus = {};

    // Check each asset_id individually using the same query method as /api/pack/unboxed-rolls
    for (const assetId of asset_ids) {
      try {
        // Query unboxassets table - scope is the pack_asset_id itself
        const result = await rpc.get_table_rows({
          json: true,
          code: 'atomicpacksx',
          scope: assetId,
          table: 'unboxassets',
          limit: 1000,
          reverse: false,
          show_payer: false
        });

        // Extract roll IDs - scope is already filtered to this pack
        const rolls = result.rows
          .map(row => parseInt(row.origin_roll_id))
          .sort((a, b) => a - b);

        claimableStatus[assetId] = {
          is_claimable: rolls.length > 0,
          roll_ids: rolls,
          roll_count: rolls.length
        };

        if (rolls.length > 0) {
          console.log(`  ✅ Pack ${assetId} is CLAIMABLE (${rolls.length} rolls: [${rolls.join(', ')}])`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Error checking pack ${assetId}:`, error.message);
        claimableStatus[assetId] = {
          is_claimable: false,
          roll_ids: [],
          roll_count: 0
        };
      }
    }

    const claimableCount = Object.values(claimableStatus).filter(s => s.is_claimable).length;
    console.log(`✅ Checked ${asset_ids.length} packs, ${claimableCount} are claimable`);

    res.json({
      success: true,
      claimable_status: claimableStatus
    });
  } catch (error) {
    console.error('Error checking claimable packs:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/asset/verify-ownership
 * Verify current ownership of an asset by querying AtomicAssets API
 * Body: { asset_id: string, expected_owner: string }
 */
app.post('/api/asset/verify-ownership', async (req, res) => {
  try {
    const { asset_id, expected_owner } = req.body;

    if (!asset_id || !expected_owner) {
      return res.status(400).json({ error: 'asset_id and expected_owner are required' });
    }

    console.log(`Verifying ownership of asset ${asset_id} (expecting: ${expected_owner})...`);

    // Query AtomicAssets API for current asset state (with fallback)
    const atomicEndpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax-aa.eosdac.io',
      'https://atomic-wax-mainnet.wecan.dev',
      'https://wax-atomic-api.eosphere.io'
    ];

    let assetData = null;
    for (const endpoint of atomicEndpoints) {
      try {
        const assetResponse = await fetch(`${endpoint}/atomicassets/v1/assets/${asset_id}`, {
          timeout: 3000
        });

        if (assetResponse.ok) {
          assetData = await assetResponse.json();
          break;
        }
      } catch (err) {
        continue; // Try next endpoint
      }
    }

    if (!assetData) {
      return res.status(404).json({
        success: false,
        is_owned: false,
        error: `Asset ${asset_id} not found on any API endpoint`,
        current_owner: null
      });
    }

    const asset = assetData.data;

    // Check if asset is burned
    if (asset.burned_at_block || asset.burned_at_time || asset.burned_by_account) {
      console.log(`  ❌ Asset ${asset_id} is BURNED`);
      return res.json({
        success: true,
        is_owned: false,
        is_burned: true,
        current_owner: asset.burned_by_account || 'unknown',
        asset_id: asset_id
      });
    }

    // Check current owner
    const currentOwner = asset.owner;
    const isOwned = currentOwner === expected_owner;

    console.log(`  ${isOwned ? '✅' : '❌'} Asset ${asset_id} owner: ${currentOwner} (expected: ${expected_owner})`);

    res.json({
      success: true,
      is_owned: isOwned,
      is_burned: false,
      current_owner: currentOwner,
      asset_id: asset_id
    });
  } catch (error) {
    console.error('Error verifying asset ownership:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/blends/details
 * Fetch blend details from blockchain for multiple blend IDs
 * Body: { blend_ids: [id1, id2, ...] }
 * Returns blend configurations including ingredient requirements
 */
app.post('/api/blends/details', async (req, res) => {
  try {
    const { blend_ids, refresh = false } = req.body;

    if (!blend_ids || !Array.isArray(blend_ids)) {
      return res.status(400).json({ error: 'blend_ids array is required' });
    }

    console.log(`📋 Fetching details for ${blend_ids.length} blends...`);

    const blendDetails = [];
    const blendsToFetch = [];

    // Check cache first (unless refresh is true)
    if (!refresh) {
      const cachedBlends = db.blendCache.getMultiple(blend_ids);
      console.log(`💾 Found ${cachedBlends.length}/${blend_ids.length} blends in cache`);

      const cachedIds = new Set(cachedBlends.map(b => b.blend_id));

      for (const cached of cachedBlends) {
        blendDetails.push(cached.blend_data);
      }

      // Identify which blends need to be fetched from blockchain
      for (const blend_id of blend_ids) {
        if (!cachedIds.has(blend_id)) {
          blendsToFetch.push(blend_id);
        }
      }
    } else {
      console.log('🔄 Refresh requested, bypassing cache');
      blendsToFetch.push(...blend_ids);
    }

    // Fetch missing blends from blockchain
    if (blendsToFetch.length > 0) {
      console.log(`🔗 Fetching ${blendsToFetch.length} blends from blockchain...`);
      console.log(`🎯 TRYING HTTP API + RPC METHODS`);

      const { JsonRpc } = require('eosjs');

      // Try HTTP APIs first (faster and more reliable)
      const httpApiEndpoints = [
        'https://aa.neftyblocks.com/atomictools/v1/config/blend.nefty',
        'https://wax.api.atomicassets.io/atomictools/v1/config/blend.nefty'
      ];

      // Fallback RPC endpoints
      const rpcEndpoints = [
        'https://api.wax.alohaeos.com',
        'https://wax.greymass.com',
        'https://api.waxsweden.org',
        'https://wax.eosphere.io'
      ];

      const newlyFetchedBlends = [];

      // Fetch each blend sequentially to avoid rate limits
      for (const blendId of blendsToFetch) {
        let blendData = null;

        // METHOD 1: Try HTTP API endpoints first
        for (const apiEndpoint of httpApiEndpoints) {
          try {
            const url = `${apiEndpoint}/${blendId}`;
            console.log(`  🌐 Trying HTTP API: ${url}`);

            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              if (data && (data.data || data.blend_id)) {
                blendData = data.data || data;
                console.log(`  ✅ Fetched blend ${blendId} from HTTP API: ${apiEndpoint}`);
                break;
              }
            } else {
              console.log(`  ⚠️ HTTP API returned ${response.status}`);
            }
          } catch (error) {
            console.log(`  ⚠️ HTTP API error: ${error.message}`);
            continue;
          }
        }

        // METHOD 2: If HTTP API failed, try RPC with multiple scopes
        if (!blendData) {
          console.log(`  🔄 Falling back to RPC for blend ${blendId}...`);

          for (const endpoint of rpcEndpoints) {
            try {
              const rpc = new JsonRpc(endpoint, { fetch });

              // Try different scopes - NeftyBlocks often uses collection name as scope
              const scopesToTry = [
                'futuresrelic',  // Collection name (most likely)
                'blend.nefty',   // Contract name
                blendId.toString()  // Blend ID itself
              ];

              for (const scopeToTry of scopesToTry) {
                try {
                  const result = await rpc.get_table_rows({
                    json: true,
                    code: 'blend.nefty',
                    scope: scopeToTry,
                    table: 'config',
                    lower_bound: blendId,
                    upper_bound: blendId,
                    limit: 1
                  });

                  if (result.rows && result.rows.length > 0) {
                    blendData = result.rows[0];
                    console.log(`  ✅ Fetched blend ${blendId} from RPC ${endpoint} (scope: ${scopeToTry})`);
                    break; // Success, move to next blend
                  }
                } catch (scopeError) {
                  // Try next scope
                  continue;
                }
              }

              if (blendData) break; // Found data, move to next endpoint
            } catch (error) {
              console.warn(`  ⚠️ RPC failed for ${endpoint}:`, error.message);
              continue; // Try next endpoint
            }
          }
        }

        if (blendData) {
          // Parse ingredients from blockchain format: [["TEMPLATE_INGREDIENT", {template_id, amount}], ...]
          if (blendData.ingredients && Array.isArray(blendData.ingredients)) {
            blendData.ingredients = blendData.ingredients.map(ing => {
              if (Array.isArray(ing) && ing.length >= 2 && ing[0] === 'TEMPLATE_INGREDIENT') {
                const data = ing[1];
                return {
                  template_id: data.template_id,
                  amount: data.amount || 1
                };
              }
              // If already parsed or unknown format, return as-is
              return ing;
            }).filter(ing => ing && ing.template_id); // Remove any invalid entries
          }

          newlyFetchedBlends.push(blendData);
          blendDetails.push(blendData);
        } else {
          console.warn(`  ❌ Failed to fetch blend ${blendId} from all endpoints`);
        }
      }

      // Cache newly fetched blends
      if (newlyFetchedBlends.length > 0) {
        db.blendCache.setMultiple(newlyFetchedBlends);
        console.log(`💾 Cached ${newlyFetchedBlends.length} new blends`);
      }
    }

    console.log(`✅ Returning ${blendDetails.length}/${blend_ids.length} blends (${blend_ids.length - blendsToFetch.length} from cache, ${blendsToFetch.length} newly fetched)`);

    res.json({
      success: true,
      blend_count: blendDetails.length,
      blends: blendDetails,
      cached_count: blend_ids.length - blendsToFetch.length,
      fetched_count: blendsToFetch.length - (blend_ids.length - blendDetails.length)
    });
  } catch (error) {
    console.error('Error fetching blend details:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/blend-recipes
 * Get cached blend recipes (ingredients + display data)
 * Query params: blend_ids (comma-separated), collection (optional), refresh (optional)
 * Returns cached blend recipes or fetches from blockchain if not cached
 */
app.get('/api/blend-recipes', async (req, res) => {
  try {
    const { blend_ids, collection = 'futuresrelic', refresh = 'false' } = req.query;

    if (!blend_ids) {
      return res.status(400).json({ error: 'blend_ids query parameter is required' });
    }

    const blendIdArray = blend_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (blendIdArray.length === 0) {
      return res.status(400).json({ error: 'No valid blend_ids provided' });
    }

    console.log(`📋 Fetching recipes for ${blendIdArray.length} blends...`);

    let recipes = [];
    let recipesToFetch = [];

    // Check cache first (unless refresh requested)
    if (refresh !== 'true') {
      const cachedRecipes = db.blendRecipes.getMultiple(blendIdArray);
      console.log(`💾 Found ${cachedRecipes.length}/${blendIdArray.length} recipes in cache`);

      recipes = cachedRecipes;

      // Identify which recipes need fetching
      const cachedIds = new Set(cachedRecipes.map(r => r.blend_id));
      recipesToFetch = blendIdArray.filter(id => !cachedIds.has(id));
    } else {
      console.log('🔄 Refresh requested, bypassing cache');
      recipesToFetch = blendIdArray;
    }

    // Fetch missing recipes from blockchain
    if (recipesToFetch.length > 0) {
      console.log(`🔗 Fetching ${recipesToFetch.length} recipes from blockchain...`);

      const { JsonRpc } = require('eosjs');

      // Try HTTP APIs first (faster and more reliable)
      const httpApiEndpoints = [
        'https://aa.neftyblocks.com/atomictools/v1/config/blend.nefty',
        'https://wax.api.atomicassets.io/atomictools/v1/config/blend.nefty'
      ];

      // Fallback RPC endpoints
      const rpcEndpoints = [
        'https://api.wax.alohaeos.com',
        'https://wax.greymass.com',
        'https://api.waxsweden.org',
        'https://wax.eosphere.io'
      ];

      const newlyFetchedRecipes = [];

      // Fetch each blend recipe
      for (const blendId of recipesToFetch) {
        let recipeData = null;

        // METHOD 1: Try HTTP API endpoints first
        for (const apiEndpoint of httpApiEndpoints) {
          try {
            const url = `${apiEndpoint}/${blendId}`;
            const response = await fetch(url);

            if (response.ok) {
              const data = await response.json();
              if (data && (data.data || data.blend_id)) {
                recipeData = data.data || data;
                console.log(`  ✅ Fetched recipe ${blendId} from HTTP API`);
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }

        // METHOD 2: If HTTP API failed, try RPC
        if (!recipeData) {
          for (const endpoint of rpcEndpoints) {
            try {
              const rpc = new JsonRpc(endpoint, { fetch });

              const scopesToTry = [collection, 'blend.nefty', blendId.toString()];

              for (const scope of scopesToTry) {
                try {
                  const result = await rpc.get_table_rows({
                    json: true,
                    code: 'blend.nefty',
                    scope: scope,
                    table: 'config',
                    lower_bound: blendId,
                    upper_bound: blendId,
                    limit: 1
                  });

                  if (result.rows && result.rows.length > 0) {
                    recipeData = result.rows[0];
                    console.log(`  ✅ Fetched recipe ${blendId} from RPC (scope: ${scope})`);
                    break;
                  }
                } catch (scopeError) {
                  continue;
                }
              }

              if (recipeData) break;
            } catch (error) {
              continue;
            }
          }
        }

        if (recipeData) {
          // Parse ingredients from blockchain format
          let ingredients = recipeData.ingredients || [];
          if (Array.isArray(ingredients)) {
            ingredients = ingredients.map(ing => {
              if (Array.isArray(ing) && ing.length >= 2 && ing[0] === 'TEMPLATE_INGREDIENT') {
                return {
                  template_id: ing[1].template_id,
                  amount: ing[1].amount || 1
                };
              }
              return ing;
            }).filter(ing => ing && ing.template_id);
          }

          const recipe = {
            blend_id: blendId,
            collection_name: collection,
            contract_name: 'blend.nefty',
            ingredients: ingredients,
            display_data: recipeData.display_data || null
          };

          newlyFetchedRecipes.push(recipe);
          recipes.push(recipe);
        } else {
          console.warn(`  ❌ Failed to fetch recipe ${blendId}`);
        }
      }

      // Cache newly fetched recipes
      if (newlyFetchedRecipes.length > 0) {
        db.blendRecipes.setMultiple(newlyFetchedRecipes);
        console.log(`💾 Cached ${newlyFetchedRecipes.length} new recipes`);
      }
    }

    console.log(`✅ Returning ${recipes.length}/${blendIdArray.length} recipes`);

    res.json({
      success: true,
      recipe_count: recipes.length,
      recipes: recipes,
      cached_count: blendIdArray.length - recipesToFetch.length,
      fetched_count: recipes.length - (blendIdArray.length - recipesToFetch.length)
    });
  } catch (error) {
    console.error('Error fetching blend recipes:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/blend-recipes/clear
 * Clear cached blend recipes (admin only)
 * Body: { collection: string (optional), blend_id: number (optional) }
 */
app.post('/api/blend-recipes/clear', authenticateAdmin, async (req, res) => {
  try {
    const { collection, blend_id } = req.body;

    if (blend_id) {
      // Clear specific blend
      db.blendRecipes.clear(blend_id);
      console.log(`🗑️ Cleared cache for blend ${blend_id}`);
      res.json({ success: true, message: `Cleared cache for blend ${blend_id}` });
    } else if (collection) {
      // Clear all blends for collection
      db.blendRecipes.clearCollection(collection);
      console.log(`🗑️ Cleared cache for collection ${collection}`);
      res.json({ success: true, message: `Cleared cache for collection ${collection}` });
    } else {
      // Clear all blends
      db.blendRecipes.clearAll();
      console.log(`🗑️ Cleared all blend recipe cache`);
      res.json({ success: true, message: 'Cleared all blend recipe cache' });
    }
  } catch (error) {
    console.error('Error clearing blend recipe cache:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==========================================
// FACTORY / CRAFTING ENDPOINTS
// ==========================================

/**
 * GET /api/factory/categories
 * Get all recipe categories (lightweight - no asset checking!)
 */
app.get('/api/factory/categories', async (req, res) => {
  try {
    const recipes = db.craftRecipes.getEnabled();

    // Group recipes by category
    const categories = {};
    recipes.forEach(recipe => {
      const category = recipe.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = {
          name: category,
          recipeCount: 0,
          recipeIds: []
        };
      }
      categories[category].recipeCount++;
      categories[category].recipeIds.push(recipe.id);
    });

    // Convert to array
    const categoriesArray = Object.values(categories);

    res.json({ success: true, categories: categoriesArray });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/factory/recipes
 * Get all enabled recipes with user's crafting ability
 * Query params: wallet (optional), category (optional)
 */
app.get('/api/factory/recipes', async (req, res) => {
  try {
    const { wallet, category } = req.query;
    let recipes = db.craftRecipes.getEnabled();

    // Filter by category if specified
    if (category) {
      recipes = recipes.filter(r => (r.category || 'Uncategorized') === category);
    }

    // If no wallet provided, just return recipes without user data
    if (!wallet) {
      return res.json({ success: true, recipes });
    }

    // Collect all unique template IDs needed for these recipes
    const neededTemplateIds = new Set();
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        neededTemplateIds.add(parseInt(ing.template_id));
      });
    });

    const templateFilter = Array.from(neededTemplateIds);
    console.log(`📦 Fetching assets for ${recipes.length} recipe(s), templates: [${templateFilter.join(', ')}]`);

    // Fetch user's assets FILTERED by needed templates only!
    const userAssets = await wax.getUserAssetsLive(wallet, 'futuresrelic', templateFilter);
    console.log(`   ✅ Found and enriched ${userAssets.length} assets`);

    // Count assets by template ID
    const templateCounts = {};
    userAssets.forEach(asset => {
      const templateId = asset.template.template_id.toString();
      templateCounts[templateId] = (templateCounts[templateId] || 0) + 1;
    });

    // Enrich recipes with user's crafting ability
    const enrichedRecipes = recipes.map(recipe => {
      // Check how many times user can craft this recipe
      let maxCrafts = Infinity;
      let missingIngredients = [];

      recipe.ingredients.forEach(ing => {
        const templateId = ing.template_id.toString();
        const owned = templateCounts[templateId] || 0;
        const needed = ing.amount;

        if (owned < needed) {
          missingIngredients.push({
            template_id: templateId,
            needed: needed,
            owned: owned
          });
          maxCrafts = 0;
        } else {
          const possibleCrafts = Math.floor(owned / needed);
          maxCrafts = Math.min(maxCrafts, possibleCrafts);
        }
      });

      // Cap by max_batch_multiplier
      if (maxCrafts !== Infinity) {
        maxCrafts = Math.min(maxCrafts, recipe.max_batch_multiplier);
      } else {
        maxCrafts = 0;
      }

      // Check cooldown
      let cooldownRemaining = 0;
      if (recipe.cooldown_enabled && recipe.cooldown_hours) {
        const lastCraft = db.craftHistory.getLastCraft(wallet, recipe.id);
        if (lastCraft) {
          const hoursSince = (Date.now() - new Date(lastCraft.crafted_at).getTime()) / 3600000;
          if (hoursSince < recipe.cooldown_hours) {
            cooldownRemaining = recipe.cooldown_hours - hoursSince;
            maxCrafts = 0;
          }
        }
      }

      return {
        ...recipe,
        user_can_craft: maxCrafts,
        missing_ingredients: missingIngredients,
        cooldown_remaining: cooldownRemaining,
        ingredients_enriched: recipe.ingredients.map(ing => ({
          ...ing,
          owned: templateCounts[ing.template_id.toString()] || 0
        }))
      };
    });

    res.json({ success: true, recipes: enrichedRecipes });
  } catch (error) {
    console.error('Error fetching factory recipes:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/factory/templates
 * Fetch template data from AtomicAssets API (server-side to avoid CORS)
 * Query params: ids (comma-separated template IDs)
 */
app.get('/api/factory/templates', async (req, res) => {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({ error: 'Template IDs required', success: false });
    }

    const templateIds = ids.split(',').filter(id => id.trim());
    if (templateIds.length === 0) {
      return res.json({ success: true, templates: {} });
    }

    // Fetch template data from AtomicAssets API
    const fetch = require('node-fetch');
    const templateCache = {};

    // Multiple API endpoints as fallbacks
    const apiEndpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax.api.atomicassets.io',
      'https://atomic-wax-mainnet.wecan.dev'
    ];

    // Batch fetch (max 50 per request for reliability)
    const batchSize = 50;
    for (let i = 0; i < templateIds.length; i += batchSize) {
      const batch = templateIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      let fetchSucceeded = false;

      // Try each API endpoint until one succeeds
      for (const apiUrl of apiEndpoints) {
        if (fetchSucceeded) break;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

          const response = await fetch(
            `${apiUrl}/atomicassets/v1/templates?ids=${idsParam}&collection_name=futuresrelic`,
            { signal: controller.signal }
          );

          clearTimeout(timeout);

          if (!response.ok) {
            console.warn(`Failed to fetch from ${apiUrl}: ${response.status}`);
            continue;
          }

          const data = await response.json();

          if (data.data) {
            data.data.forEach(template => {
              templateCache[template.template_id] = {
                name: template.immutable_data?.name || template.name || `Template ${template.template_id}`,
                img: template.immutable_data?.img || template.immutable_data?.image,
                video: template.immutable_data?.video
              };
            });
            console.log(`✅ Fetched ${data.data.length} templates from ${apiUrl}`);
            fetchSucceeded = true;
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.warn(`Timeout fetching from ${apiUrl}`);
          } else {
            console.warn(`Failed to fetch from ${apiUrl}:`, error.message);
          }
        }
      }

      if (!fetchSucceeded) {
        console.error(`Failed to fetch batch ${i / batchSize + 1} from all API endpoints`);
      }
    }

    res.json({ success: true, templates: templateCache });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/factory/recipe-assets
 * Fetch user's assets filtered by recipe templates, with mint numbers
 * Query params: wallet, recipe_id
 * This is MUCH faster than fetching all assets - only enriches what's needed!
 */
app.get('/api/factory/recipe-assets', async (req, res) => {
  try {
    const { wallet, recipe_id } = req.query;

    if (!wallet || !recipe_id) {
      return res.status(400).json({ error: 'wallet and recipe_id required', success: false });
    }

    // Get recipe to know which templates we need
    const recipe = db.craftRecipes.getById(parseInt(recipe_id));
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found', success: false });
    }

    const templateIds = recipe.ingredients.map(ing => parseInt(ing.template_id));
    console.log(`📦 Fetching assets for recipe ${recipe_id}, templates: [${templateIds.join(', ')}]`);

    // getUserAssetsLive filters by template AND enriches with mints automatically!
    const enrichedAssets = await wax.getUserAssetsLive(wallet, 'futuresrelic', templateIds);
    console.log(`   ✅ Found and enriched ${enrichedAssets.length} assets`);

    res.json({ success: true, assets: enrichedAssets });
  } catch (error) {
    console.error('Error fetching recipe assets:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/factory/craft
 * Execute a craft: verify transfer, then mint results OR swap from pool
 * Body: {
 *   recipe_id: number,
 *   batch_count: number,
 *   transfer_transaction_id: string,
 *   asset_ids: string[],
 *   user_wallet: string,
 *   mode: 'mint' | 'swap' (optional, defaults to 'mint')
 * }
 */
app.post('/api/factory/craft', async (req, res) => {
  try {
    const { recipe_id, batch_count, transfer_transaction_id, asset_ids, user_wallet, mode = 'mint' } = req.body;

    console.log('🏭 FACTORY CRAFT REQUEST');
    console.log(`   Recipe ID: ${recipe_id}`);
    console.log(`   Batch Count: ${batch_count}`);
    console.log(`   Mode: ${mode}`);
    console.log(`   User: ${user_wallet}`);
    console.log(`   Transfer TX: ${transfer_transaction_id}`);

    // 1. Validate inputs
    if (!recipe_id || !batch_count || !transfer_transaction_id || !asset_ids || !user_wallet) {
      return res.status(400).json({ error: 'Missing required fields', success: false });
    }

    // Validate mode
    if (mode !== 'mint' && mode !== 'swap') {
      return res.status(400).json({ error: 'Invalid mode. Must be "mint" or "swap"', success: false });
    }

    // 2. Get recipe
    const recipe = db.craftRecipes.getById(recipe_id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found', success: false });
    }

    if (!recipe.enabled) {
      return res.status(400).json({ error: 'Recipe is disabled', success: false });
    }

    // Validate swap mode requirements
    if (mode === 'swap') {
      if (!recipe.pool_mode_enabled) {
        return res.status(400).json({ error: 'Pool/swap mode not enabled for this recipe', success: false });
      }
      if (!recipe.pool_wallet || !recipe.pool_ingredients) {
        return res.status(400).json({ error: 'Recipe pool configuration incomplete', success: false });
      }
    }

    // 3. Validate batch count
    if (batch_count < 1 || batch_count > recipe.max_batch_multiplier) {
      return res.status(400).json({
        error: `Invalid batch count. Must be between 1 and ${recipe.max_batch_multiplier}`,
        success: false
      });
    }

    // 4. Check cooldown
    if (recipe.cooldown_enabled && recipe.cooldown_hours) {
      const lastCraft = db.craftHistory.getLastCraft(user_wallet, recipe_id);
      if (lastCraft) {
        const hoursSince = (Date.now() - new Date(lastCraft.crafted_at).getTime()) / 3600000;
        if (hoursSince < recipe.cooldown_hours) {
          const remaining = (recipe.cooldown_hours - hoursSince).toFixed(1);
          return res.status(429).json({
            error: `Cooldown active. ${remaining} hours remaining`,
            cooldown_remaining: remaining,
            success: false
          });
        }
      }
    }

    // 5. Check for duplicate transaction (idempotency)
    const existingCraft = db.craftHistory.getByTransactionId(transfer_transaction_id);
    if (existingCraft) {
      if (existingCraft.status === 'completed') {
        console.log('✅ Transaction already processed, returning cached result');
        return res.json({
          success: true,
          already_processed: true,
          mint_transaction_id: existingCraft.mint_transaction_id,
          craft_id: existingCraft.id,
          results: existingCraft.result_info
        });
      } else if (existingCraft.status === 'failed') {
        return res.status(400).json({
          error: 'This transaction previously failed: ' + existingCraft.error_message,
          success: false,
          craft_id: existingCraft.id
        });
      }
    }

    // 5b. Create craft record EARLY (so failed attempts get saved for retry)
    const craftId = db.craftHistory.create({
      recipe_id: recipe_id,
      user_wallet: user_wallet,
      batch_count: batch_count,
      transfer_transaction_id: transfer_transaction_id,
      ingredient_asset_ids: asset_ids,
      status: 'pending_verification'
    });

    console.log(`📝 Created craft record #${craftId} (pending verification)`);

    // 6. Verify transaction on blockchain
    console.log('🔍 Verifying transfer transaction on blockchain...');
    const { JsonRpc } = require('eosjs');
    const rpc = new JsonRpc('https://api.waxsweden.org', { fetch });

    let txData;
    try {
      txData = await rpc.history_get_transaction(transfer_transaction_id);
    } catch (txError) {
      db.craftHistory.update(craftId, {
        status: 'failed',
        error_message: 'Transfer transaction not found on blockchain'
      });
      return res.status(400).json({
        error: 'Transfer transaction not found on blockchain',
        success: false,
        craft_id: craftId
      });
    }

    // 7. Extract and verify transfers
    console.log('🔍 Extracting transfer actions from transaction...');
    const transfers = [];

    if (txData.traces) {
      for (const trace of txData.traces) {
        if (trace.act && trace.act.account === 'atomicassets' && trace.act.name === 'transfer') {
          const data = trace.act.data;
          transfers.push({
            from: data.from,
            to: data.to,
            asset_ids: data.asset_ids,
            memo: data.memo
          });
        }
      }
    }

    console.log(`   Found ${transfers.length} transfer action(s)`);

    // 8. Verify transfers
    if (transfers.length === 0) {
      db.craftHistory.update(craftId, {
        status: 'failed',
        error_message: 'No transfer actions found in transaction'
      });
      return res.status(400).json({
        error: 'No transfer actions found in transaction',
        success: false,
        craft_id: craftId
      });
    }

    // Verify recipient is correct (based on recipe configuration)
    const expectedRecipient = recipe.transfer_to_wallet || 'futuresrelic';
    const validTransfer = transfers.find(t => t.to === expectedRecipient);
    if (!validTransfer) {
      db.craftHistory.update(craftId, {
        status: 'failed',
        error_message: `Assets not transferred to ${expectedRecipient} wallet`
      });
      return res.status(400).json({
        error: `Assets not transferred to ${expectedRecipient} wallet`,
        success: false,
        craft_id: craftId
      });
    }

    // Verify sender is user
    if (validTransfer.from !== user_wallet) {
      db.craftHistory.update(craftId, {
        status: 'failed',
        error_message: `Transfer sender mismatch. Expected ${user_wallet}, got ${validTransfer.from}`
      });
      return res.status(400).json({
        error: `Transfer sender mismatch. Expected ${user_wallet}, got ${validTransfer.from}`,
        success: false,
        craft_id: craftId
      });
    }

    // Verify asset IDs match (use pool_ingredients for swap mode, regular ingredients for mint mode)
    const transferredAssetIds = validTransfer.asset_ids;
    const ingredientsToCheck = mode === 'swap' ? recipe.pool_ingredients : recipe.ingredients;
    const expectedCount = ingredientsToCheck.reduce((sum, ing) => sum + ing.amount, 0) * batch_count;

    if (transferredAssetIds.length !== expectedCount) {
      db.craftHistory.update(craftId, {
        status: 'failed',
        error_message: `Asset count mismatch. Expected ${expectedCount}, got ${transferredAssetIds.length}`
      });
      return res.status(400).json({
        error: `Asset count mismatch. Expected ${expectedCount}, got ${transferredAssetIds.length}`,
        success: false,
        craft_id: craftId
      });
    }

    // Verify all asset IDs match what user submitted
    const missingAssets = asset_ids.filter(id => !transferredAssetIds.includes(id));
    if (missingAssets.length > 0) {
      db.craftHistory.update(craftId, {
        status: 'failed',
        error_message: 'Some assets were not transferred'
      });
      return res.status(400).json({
        error: 'Some assets were not transferred',
        missing_assets: missingAssets,
        success: false,
        craft_id: craftId
      });
    }

    console.log('✅ Transfer verification passed!');

    // 9. Update craft record status
    db.craftHistory.update(craftId, {
      status: mode === 'swap' ? 'pending_swap' : 'pending_mint'
    });

    console.log(`📝 Craft record #${craftId} verified, ready for ${mode}`);

    // 10. Execute craft based on mode
    const transactions = [];

    try {
      if (mode === 'mint') {
        // MINT MODE: Mint new assets to user
        console.log('🔨 Minting results...');

        for (const result of recipe.results) {
          const mintCount = result.amount * batch_count;
          console.log(`   Minting ${mintCount}x Template ${result.template_id}...`);

          for (let i = 0; i < mintCount; i++) {
            const mintResult = await wax.mintNFT(
              user_wallet,
              'futuresrelic',
              result.template_id
            );
            transactions.push(mintResult.transaction_id);
          }
        }

        console.log('✅ All results minted successfully!');

      } else {
        // SWAP MODE: Transfer existing assets from pool to user
        console.log('🔄 Swapping from pool...');

        // Get pool private key from environment
        const poolPrivateKey = process.env.POOL_FR_PRIVATE_KEY;
        if (!poolPrivateKey) {
          throw new Error('POOL_FR_PRIVATE_KEY not configured in environment');
        }

        // Get pool wallet name
        const poolWallet = recipe.pool_wallet;
        console.log(`   Pool wallet: ${poolWallet}`);

        // Fetch pool assets
        const resultTemplateIds = recipe.results.map(r => parseInt(r.template_id));
        const poolAssets = await wax.getUserAssetsLive(poolWallet, 'futuresrelic', resultTemplateIds);

        console.log(`   Found ${poolAssets.length} asset(s) in pool`);

        // Select assets to transfer
        const assetsToTransfer = [];
        for (const result of recipe.results) {
          const templateId = parseInt(result.template_id);
          const neededCount = result.amount * batch_count;

          const availableAssets = poolAssets.filter(a =>
            parseInt(a.template.template_id) === templateId &&
            !assetsToTransfer.includes(a.asset_id)
          );

          if (availableAssets.length < neededCount) {
            throw new Error(`Insufficient pool inventory for template ${templateId}. Need ${neededCount}, have ${availableAssets.length}`);
          }

          // Take the first N assets
          for (let i = 0; i < neededCount; i++) {
            assetsToTransfer.push(availableAssets[i].asset_id);
          }
        }

        console.log(`   Transferring ${assetsToTransfer.length} asset(s) from pool to user...`);

        // Transfer assets from pool to user
        const transferResult = await wax.transferNFTs(
          poolWallet,
          user_wallet,
          assetsToTransfer,
          `Crafted via recipe: ${recipe.name}`,
          poolPrivateKey
        );

        transactions.push(transferResult.transaction_id);
        console.log(`✅ Swap completed! TX: ${transferResult.transaction_id}`);
      }

      // 11. Update craft record as completed
      db.craftHistory.update(craftId, {
        mint_transaction_id: transactions[0], // Store first tx (mint or swap)
        result_info: recipe.results,
        status: 'completed'
      });

      res.json({
        success: true,
        craft_id: craftId,
        mode: mode,
        transaction_id: transactions[0],
        all_transactions: transactions,
        results: recipe.results.map(r => ({
          template_id: r.template_id,
          amount: r.amount * batch_count
        }))
      });

    } catch (executionError) {
      console.error(`❌ ${mode} failed:`, executionError);

      // Update craft record as failed
      db.craftHistory.update(craftId, {
        status: 'failed',
        error_message: executionError.message
      });

      return res.status(500).json({
        error: `${mode} failed: ` + executionError.message,
        craft_id: craftId,
        success: false,
        note: `Assets have been transferred to ${expectedRecipient}. Contact admin for manual refund.`
      });
    }

  } catch (error) {
    console.error('Error executing craft:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/factory/retry-failed
 * Retry failed crafts for a user (mints assets for verified transfers)
 */
app.post('/api/factory/retry-failed', async (req, res) => {
  try {
    const { user_wallet } = req.body;

    if (!user_wallet) {
      return res.status(400).json({ error: 'user_wallet required', success: false });
    }

    console.log(`🔄 RETRY FAILED CRAFTS REQUEST for ${user_wallet}`);

    // 1. Get all failed crafts for this user
    const allHistory = db.craftHistory.getByUser(user_wallet);
    const failedCrafts = allHistory.filter(h => h.status === 'failed');

    console.log(`   Found ${failedCrafts.length} failed craft(s)`);

    if (failedCrafts.length === 0) {
      return res.json({
        success: true,
        message: 'No failed crafts found',
        retried: 0,
        results: []
      });
    }

    const { JsonRpc } = require('eosjs');
    const rpc = new JsonRpc('https://api.waxsweden.org', { fetch });

    const results = [];
    let retriedCount = 0;

    // 2. Process each failed craft
    for (const craft of failedCrafts) {
      try {
        console.log(`   Processing craft #${craft.id} (TX: ${craft.transfer_transaction_id})`);

        // Get recipe
        const recipe = db.craftRecipes.getById(craft.recipe_id);
        if (!recipe) {
          console.log(`      ❌ Recipe not found`);
          results.push({
            craft_id: craft.id,
            success: false,
            error: 'Recipe not found'
          });
          continue;
        }

        // Verify transfer on blockchain
        console.log(`      🔍 Checking blockchain for transfer...`);
        let txData;
        try {
          txData = await rpc.history_get_transaction(craft.transfer_transaction_id);
          console.log(`      ✅ Found transfer on blockchain`);
        } catch (txError) {
          console.log(`      ❌ Transfer transaction not found on blockchain`);
          results.push({
            craft_id: craft.id,
            recipe_name: recipe.name,
            success: false,
            error: 'Transfer not found on blockchain'
          });
          continue;
        }

        // Extract transfers
        const transfers = [];
        if (txData.traces) {
          for (const trace of txData.traces) {
            if (trace.act && trace.act.account === 'atomicassets' && trace.act.name === 'transfer') {
              transfers.push(trace.act.data);
            }
          }
        }

        if (transfers.length === 0) {
          console.log(`      ❌ No transfer actions found in transaction`);
          results.push({
            craft_id: craft.id,
            recipe_name: recipe.name,
            success: false,
            error: 'No transfer found'
          });
          continue;
        }

        // Verify transfer recipient matches recipe
        const expectedRecipient = recipe.transfer_to_wallet || 'futuresrelic';
        console.log(`      🔍 Checking if assets were transferred to ${expectedRecipient}...`);
        const validTransfer = transfers.find(t => t.to === expectedRecipient && t.from === user_wallet);

        if (!validTransfer) {
          console.log(`      ❌ Transfer not to correct wallet (expected: ${expectedRecipient})`);
          results.push({
            craft_id: craft.id,
            recipe_name: recipe.name,
            success: false,
            error: `Transfer not to ${expectedRecipient}`
          });
          continue;
        }

        console.log(`      ✅ Transfer to ${expectedRecipient} verified!`);
        console.log(`      🔨 Attempting to mint results from futuresrelic wallet...`);

        // Mint results
        const mintTransactions = [];
        try {
          for (const result of recipe.results) {
            const mintCount = result.amount * craft.batch_count;
            console.log(`         Minting ${mintCount}x Template ${result.template_id}...`);

            for (let i = 0; i < mintCount; i++) {
              const mintResult = await wax.mintNFT(
                user_wallet,
                'futuresrelic',
                result.template_id
              );
              mintTransactions.push(mintResult.transaction_id);
            }
          }

          // Update craft as completed
          db.craftHistory.update(craft.id, {
            mint_transaction_id: mintTransactions[0],
            result_info: recipe.results,
            status: 'completed'
          });

          console.log(`      ✅ Mint successful! Craft #${craft.id} completed`);

          results.push({
            craft_id: craft.id,
            recipe_name: recipe.name,
            success: true,
            mint_transaction_id: mintTransactions[0],
            results: recipe.results.map(r => ({
              template_id: r.template_id,
              amount: r.amount * craft.batch_count
            }))
          });

          retriedCount++;

        } catch (mintError) {
          console.error(`      ❌ Mint failed:`, mintError);
          results.push({
            craft_id: craft.id,
            recipe_name: recipe.name,
            success: false,
            error: 'Mint failed: ' + mintError.message
          });
        }

      } catch (error) {
        console.error(`   ❌ Error processing craft #${craft.id}:`, error);
        results.push({
          craft_id: craft.id,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Retry complete: ${retriedCount}/${failedCrafts.length} succeeded`);

    res.json({
      success: true,
      retried: retriedCount,
      total_failed: failedCrafts.length,
      results: results
    });

  } catch (error) {
    console.error('Error retrying failed crafts:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/factory/history/:wallet
 * Get craft history for a user
 */
app.get('/api/factory/history/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const history = db.craftHistory.getByUser(wallet, 50);

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching craft history:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==========================================
// ADMIN FACTORY ENDPOINTS
// ==========================================

/**
 * GET /api/admin/factory/recipes
 * Get all recipes (admin)
 */
app.get('/api/admin/factory/recipes', authenticateAdmin, async (req, res) => {
  try {
    const recipes = db.craftRecipes.getAll();

    // Add stats for each recipe
    const recipesWithStats = recipes.map(recipe => {
      const stats = db.craftRecipes.getStats(recipe.id);
      return {
        ...recipe,
        ingredients: JSON.parse(recipe.ingredients),
        results: JSON.parse(recipe.results),
        stats: stats
      };
    });

    res.json({ success: true, recipes: recipesWithStats });
  } catch (error) {
    console.error('Error fetching admin recipes:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/admin/factory/recipes
 * Create new recipe (admin)
 */
app.post('/api/admin/factory/recipes', authenticateAdmin, async (req, res) => {
  try {
    const { name, description, category, transfer_to_wallet, ingredients, results, max_batch_multiplier, cooldown_hours, cooldown_enabled, enabled, pool_mode_enabled, pool_wallet, pool_ingredients } = req.body;

    // Validate inputs
    if (!name || !ingredients || !results) {
      return res.status(400).json({ error: 'Missing required fields', success: false });
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Ingredients must be a non-empty array', success: false });
    }

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'Results must be a non-empty array', success: false });
    }

    // Validate pool mode settings if enabled
    if (pool_mode_enabled) {
      if (!pool_wallet) {
        return res.status(400).json({ error: 'pool_wallet required when pool mode enabled', success: false });
      }
      if (!pool_ingredients || !Array.isArray(pool_ingredients) || pool_ingredients.length === 0) {
        return res.status(400).json({ error: 'pool_ingredients required when pool mode enabled', success: false });
      }
    }

    const recipeId = db.craftRecipes.create({
      name,
      description,
      category: category || 'Uncategorized',
      transfer_to_wallet: transfer_to_wallet || 'futuresrelic',
      ingredients,
      results,
      max_batch_multiplier: max_batch_multiplier || 1,
      cooldown_hours: cooldown_hours || null,
      cooldown_enabled: cooldown_enabled || false,
      enabled: enabled !== false, // Default to true
      pool_mode_enabled: pool_mode_enabled || false,
      pool_wallet: pool_wallet || null,
      pool_ingredients: pool_ingredients || null
    });

    console.log(`✅ Created recipe #${recipeId}: ${name}${pool_mode_enabled ? ' (Pool Mode)' : ''}`);

    res.json({ success: true, recipe_id: recipeId });
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * PUT /api/admin/factory/recipes/:id
 * Update recipe (admin)
 */
app.put('/api/admin/factory/recipes/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, transfer_to_wallet, ingredients, results, max_batch_multiplier, cooldown_hours, cooldown_enabled, enabled, pool_mode_enabled, pool_wallet, pool_ingredients } = req.body;

    const existing = db.craftRecipes.getById(parseInt(id));
    if (!existing) {
      return res.status(404).json({ error: 'Recipe not found', success: false });
    }

    // Validate pool mode settings if enabled
    if (pool_mode_enabled) {
      if (!pool_wallet) {
        return res.status(400).json({ error: 'pool_wallet required when pool mode enabled', success: false });
      }
      if (!pool_ingredients || !Array.isArray(pool_ingredients) || pool_ingredients.length === 0) {
        return res.status(400).json({ error: 'pool_ingredients required when pool mode enabled', success: false });
      }
    }

    db.craftRecipes.update(parseInt(id), {
      name,
      description,
      category: category || 'Uncategorized',
      transfer_to_wallet: transfer_to_wallet || 'futuresrelic',
      ingredients,
      results,
      max_batch_multiplier,
      cooldown_hours,
      cooldown_enabled,
      enabled,
      pool_mode_enabled: pool_mode_enabled || false,
      pool_wallet: pool_wallet || null,
      pool_ingredients: pool_ingredients || null
    });

    console.log(`✅ Updated recipe #${id}: ${name}${pool_mode_enabled ? ' (Pool Mode)' : ''}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * DELETE /api/admin/factory/recipes/:id
 * Delete recipe (admin)
 */
app.delete('/api/admin/factory/recipes/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.craftRecipes.getById(parseInt(id));
    if (!existing) {
      return res.status(404).json({ error: 'Recipe not found', success: false });
    }

    db.craftRecipes.delete(parseInt(id));

    console.log(`✅ Deleted recipe #${id}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/factory/pool-inventory/:recipe_id
 * Check pool wallet inventory for swap availability
 */
app.get('/api/factory/pool-inventory/:recipe_id', async (req, res) => {
  try {
    const { recipe_id } = req.params;
    const { batch_count = 1 } = req.query;

    const recipe = db.craftRecipes.getById(parseInt(recipe_id));
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found', success: false });
    }

    // If pool mode not enabled, swap not available
    if (!recipe.pool_mode_enabled) {
      return res.json({
        success: true,
        swap_available: false,
        reason: 'Pool mode not enabled for this recipe'
      });
    }

    // Check pool wallet for result assets
    const poolWallet = recipe.pool_wallet;
    const collection = 'futuresrelic';

    // Collect template IDs from results
    const resultTemplateIds = recipe.results.map(r => parseInt(r.template_id));

    console.log(`🔍 Checking pool inventory for recipe #${recipe_id} (wallet: ${poolWallet})`);
    console.log(`   Looking for templates: [${resultTemplateIds.join(', ')}]`);

    // Fetch pool wallet assets filtered by result templates
    const poolAssets = await wax.getUserAssetsLive(poolWallet, collection, resultTemplateIds);

    console.log(`   Found ${poolAssets.length} asset(s) in pool`);

    // Check if pool has enough of each result
    const availability = {};
    let allAvailable = true;

    // If no results defined, can't swap
    if (!recipe.results || recipe.results.length === 0) {
      console.log(`   ❌ No results defined for recipe`);
      allAvailable = false;
    }

    for (const result of recipe.results) {
      const templateId = parseInt(result.template_id);
      const requiredCount = result.amount * parseInt(batch_count); // Fixed: use result.amount not result.count

      // Count how many of this template are in the pool
      const available = poolAssets.filter(a => parseInt(a.template.template_id) === templateId);
      const availableCount = available.length;

      availability[templateId] = {
        template_id: templateId,
        template_name: available[0]?.template?.name || `Template ${templateId}`,
        required: requiredCount,
        available: availableCount,
        has_enough: availableCount >= requiredCount
      };

      console.log(`   Template ${templateId}: need ${requiredCount}, have ${availableCount}`);

      if (availableCount < requiredCount) {
        allAvailable = false;
      }
    }

    console.log(`   Swap available: ${allAvailable}`);

    res.json({
      success: true,
      swap_available: allAvailable,
      pool_wallet: poolWallet,
      availability: Object.values(availability),
      batch_count: parseInt(batch_count)
    });

  } catch (error) {
    console.error('Error checking pool inventory:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/admin/factory/history
 * Get all craft history (admin)
 */
app.get('/api/admin/factory/history', authenticateAdmin, async (req, res) => {
  try {
    const history = db.craftHistory.getAll(200);

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching admin history:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/admin/factory/failed
 * Get failed crafts (for manual refunds)
 */
app.get('/api/admin/factory/failed', authenticateAdmin, async (req, res) => {
  try {
    const failed = db.craftHistory.getFailed(100);

    res.json({ success: true, failed });
  } catch (error) {
    console.error('Error fetching failed crafts:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/factory/check-pool-inventory
 * PRE-FLIGHT CHECK: Verify pool has required assets BEFORE user transfers
 * Body: { recipe_id: number, batch_count: number }
 */
app.post('/api/factory/check-pool-inventory', async (req, res) => {
  try {
    const { recipe_id, batch_count } = req.body;

    console.log('🔍 PRE-FLIGHT POOL CHECK');
    console.log(`   Recipe ID: ${recipe_id}`);
    console.log(`   Batch Count: ${batch_count}`);

    if (!recipe_id || !batch_count) {
      return res.status(400).json({ error: 'Missing recipe_id or batch_count', success: false });
    }

    // Get recipe
    const recipe = db.craftRecipes.getById(recipe_id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found', success: false });
    }

    // Only applies to swap/pool mode
    if (!recipe.pool_mode_enabled) {
      return res.json({
        success: true,
        pool_mode: false,
        message: 'Recipe is mint mode, no pool check needed'
      });
    }

    if (!recipe.pool_wallet || !recipe.results) {
      return res.status(400).json({
        error: 'Recipe pool configuration incomplete',
        success: false
      });
    }

    // Get pool wallet name
    const poolWallet = recipe.pool_wallet;
    console.log(`   Checking pool wallet: ${poolWallet}`);

    // Fetch pool assets for all result templates
    const resultTemplateIds = recipe.results.map(r => parseInt(r.template_id));
    const poolAssets = await wax.getUserAssetsLive(poolWallet, 'futuresrelic', resultTemplateIds);

    console.log(`   Found ${poolAssets.length} total asset(s) in pool`);

    // Check if pool has sufficient inventory for each result
    const inventoryCheck = [];
    let hasAllInventory = true;

    for (const result of recipe.results) {
      const templateId = parseInt(result.template_id);
      const neededCount = result.amount * batch_count;

      const availableAssets = poolAssets.filter(a =>
        parseInt(a.template.template_id) === templateId
      );

      const templateName = availableAssets.length > 0
        ? availableAssets[0].template.immutable_data.name || `Template #${templateId}`
        : `Template #${templateId}`;

      const hasSufficient = availableAssets.length >= neededCount;
      if (!hasSufficient) {
        hasAllInventory = false;
      }

      inventoryCheck.push({
        template_id: templateId,
        template_name: templateName,
        needed: neededCount,
        available: availableAssets.length,
        sufficient: hasSufficient
      });

      console.log(`   ${templateName}: need ${neededCount}, have ${availableAssets.length} ${hasSufficient ? '✅' : '❌'}`);
    }

    if (hasAllInventory) {
      console.log('✅ Pool has all required inventory!');
      return res.json({
        success: true,
        pool_available: true,
        inventory: inventoryCheck,
        message: 'Pool has all required assets'
      });
    } else {
      console.log('❌ Pool missing some inventory');
      return res.json({
        success: true,
        pool_available: false,
        inventory: inventoryCheck,
        message: 'Pool does not have sufficient inventory. Use MINT mode instead.'
      });
    }

  } catch (error) {
    console.error('Error checking pool inventory:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/admin/factory/fulfill-failed
 * ADMIN: Retry completing a failed pool swap craft
 * Body: { craft_id: number }
 */
app.post('/api/admin/factory/fulfill-failed', authenticateAdmin, async (req, res) => {
  try {
    const { craft_id } = req.body;

    console.log('🔄 FULFILL FAILED CRAFT');
    console.log(`   Craft ID: ${craft_id}`);

    if (!craft_id) {
      return res.status(400).json({ error: 'Missing craft_id', success: false });
    }

    // Get craft record
    const craft = db.craftHistory.getById(craft_id);
    if (!craft) {
      return res.status(404).json({ error: 'Craft not found', success: false });
    }

    if (craft.status !== 'failed') {
      return res.status(400).json({
        error: `Craft is not failed (status: ${craft.status})`,
        success: false
      });
    }

    // Get recipe
    const recipe = db.craftRecipes.getById(craft.recipe_id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found', success: false });
    }

    // Only works for pool mode crafts
    if (!recipe.pool_mode_enabled || !recipe.pool_wallet) {
      return res.status(400).json({
        error: 'This craft is not a pool swap, cannot fulfill',
        success: false
      });
    }

    console.log(`   Recipe: ${recipe.name}`);
    console.log(`   User: ${craft.user_wallet}`);
    console.log(`   Batch: ${craft.batch_count}x`);

    // Get pool private key
    const poolPrivateKey = process.env.POOL_FR_PRIVATE_KEY;
    if (!poolPrivateKey) {
      return res.status(500).json({
        error: 'POOL_FR_PRIVATE_KEY not configured',
        success: false
      });
    }

    const poolWallet = recipe.pool_wallet;
    console.log(`   Pool wallet: ${poolWallet}`);

    // Fetch pool assets
    const resultTemplateIds = recipe.results.map(r => parseInt(r.template_id));
    const poolAssets = await wax.getUserAssetsLive(poolWallet, 'futuresrelic', resultTemplateIds);

    console.log(`   Found ${poolAssets.length} asset(s) in pool`);

    // Select assets to transfer
    const assetsToTransfer = [];
    for (const result of recipe.results) {
      const templateId = parseInt(result.template_id);
      const neededCount = result.amount * craft.batch_count;

      const availableAssets = poolAssets.filter(a =>
        parseInt(a.template.template_id) === templateId &&
        !assetsToTransfer.includes(a.asset_id)
      );

      if (availableAssets.length < neededCount) {
        return res.status(400).json({
          error: `Insufficient pool inventory for template ${templateId}. Need ${neededCount}, have ${availableAssets.length}`,
          success: false,
          pool_still_empty: true
        });
      }

      // Take the first N assets
      for (let i = 0; i < neededCount; i++) {
        assetsToTransfer.push(availableAssets[i].asset_id);
      }
    }

    console.log(`   Transferring ${assetsToTransfer.length} asset(s) from pool to ${craft.user_wallet}...`);

    // Transfer assets from pool to user
    const transferResult = await wax.transferNFTs(
      poolWallet,
      craft.user_wallet,
      assetsToTransfer,
      `Crafted via recipe: ${recipe.name} (fulfilled)`,
      poolPrivateKey
    );

    console.log(`✅ Swap completed! TX: ${transferResult.transaction_id}`);

    // Update craft record as completed
    db.craftHistory.update(craft_id, {
      mint_transaction_id: transferResult.transaction_id,
      result_info: recipe.results,
      status: 'completed',
      error_message: null
    });

    res.json({
      success: true,
      craft_id: craft_id,
      transaction_id: transferResult.transaction_id,
      transferred_assets: assetsToTransfer,
      message: 'Failed craft fulfilled successfully!'
    });

  } catch (error) {
    console.error('Error fulfilling failed craft:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ========================================
// Scheduled Actions API
// ========================================

/**
 * GET /api/admin/scheduler/actions
 * Get all scheduled actions
 */
app.get('/api/admin/scheduler/actions', authenticateAdmin, async (req, res) => {
  try {
    const actions = db.scheduledActions.getAll();
    res.json({ success: true, actions });
  } catch (error) {
    console.error('Error fetching scheduled actions:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/admin/scheduler/actions/:id
 * Get a specific scheduled action
 */
app.get('/api/admin/scheduler/actions/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const action = db.scheduledActions.getById(parseInt(id));

    if (!action) {
      return res.status(404).json({ error: 'Action not found', success: false });
    }

    res.json({ success: true, action });
  } catch (error) {
    console.error('Error fetching action:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/admin/scheduler/actions
 * Create a new scheduled action
 */
app.post('/api/admin/scheduler/actions', authenticateAdmin, async (req, res) => {
  try {
    const { name, action_type, action_params, execution_time, created_by, is_recurring, recurrence_interval_minutes } = req.body;

    // Validate inputs
    if (!name || !action_type || !action_params || !execution_time) {
      return res.status(400).json({ error: 'Missing required fields', success: false });
    }

    // Validate action_type
    const validTypes = ['mint', 'transfer', 'drop', 'burn'];
    if (!validTypes.includes(action_type)) {
      return res.status(400).json({ error: `Invalid action_type. Must be one of: ${validTypes.join(', ')}`, success: false });
    }

    // Validate execution_time is in the future
    const execTime = new Date(execution_time);
    if (execTime <= new Date()) {
      return res.status(400).json({ error: 'execution_time must be in the future', success: false });
    }

    // Validate recurring settings
    if (is_recurring && !recurrence_interval_minutes) {
      return res.status(400).json({ error: 'Recurring actions require recurrence_interval_minutes', success: false });
    }

    if (is_recurring && recurrence_interval_minutes < 1) {
      return res.status(400).json({ error: 'recurrence_interval_minutes must be at least 1', success: false });
    }

    // Validate action_params based on type
    if (action_type === 'mint') {
      if (!action_params.to_wallet || !action_params.template_id) {
        return res.status(400).json({ error: 'Mint action requires: to_wallet, template_id', success: false });
      }
    } else if (action_type === 'transfer') {
      if (!action_params.from_wallet || !action_params.to_wallet) {
        return res.status(400).json({ error: 'Transfer action requires: from_wallet, to_wallet', success: false });
      }
      if (!action_params.template_id && !action_params.asset_ids) {
        return res.status(400).json({ error: 'Transfer action requires either: template_id or asset_ids', success: false });
      }
    }

    const actionId = db.scheduledActions.create({
      name,
      action_type,
      action_params,
      execution_time: execTime.toISOString(),
      created_by: created_by || 'admin',
      is_recurring: is_recurring || false,
      recurrence_interval_minutes: recurrence_interval_minutes || null
    });

    console.log(`✅ Created scheduled action #${actionId}: ${name} (${action_type}) at ${execution_time}`);

    res.json({ success: true, action_id: actionId });
  } catch (error) {
    console.error('Error creating scheduled action:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * PUT /api/admin/scheduler/actions/:id/cancel
 * Cancel a pending scheduled action
 */
app.put('/api/admin/scheduler/actions/:id/cancel', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = db.scheduledActions.cancel(parseInt(id));

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Action not found or already executed/cancelled', success: false });
    }

    console.log(`🚫 Cancelled scheduled action #${id}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling action:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * DELETE /api/admin/scheduler/actions/:id
 * Delete a scheduled action
 */
app.delete('/api/admin/scheduler/actions/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    db.scheduledActions.delete(parseInt(id));

    console.log(`🗑️ Deleted scheduled action #${id}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting action:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/admin/scheduler/executions
 * Get execution history
 */
app.get('/api/admin/scheduler/executions', authenticateAdmin, async (req, res) => {
  try {
    const executions = db.actionExecutions.getAll();
    res.json({ success: true, executions });
  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/admin/scheduler/run-now
 * Manually trigger the scheduler to check and execute pending actions
 */
app.post('/api/admin/scheduler/run-now', authenticateAdmin, async (req, res) => {
  try {
    console.log('🔄 Manual scheduler trigger requested');

    // Run scheduler asynchronously
    scheduler.checkAndExecuteActions().catch(err => {
      console.error('Error in manual scheduler run:', err);
    });

    res.json({ success: true, message: 'Scheduler triggered' });
  } catch (error) {
    console.error('Error triggering scheduler:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/asset/verify-ownership-rpc
 * Verify current ownership of an asset by querying BLOCKCHAIN DIRECTLY via RPC
 * This bypasses AtomicAssets API cache and gets real-time blockchain state
 * Body: { asset_id: string, expected_owner: string }
 */
app.post('/api/asset/verify-ownership-rpc', async (req, res) => {
  try {
    const { asset_id, expected_owner } = req.body;

    if (!asset_id || !expected_owner) {
      return res.status(400).json({ error: 'asset_id and expected_owner are required' });
    }

    console.log(`🔗 Verifying ownership via RPC for asset ${asset_id} (expecting: ${expected_owner})...`);

    // Query atomicassets contract DIRECTLY via RPC - this is the SOURCE OF TRUTH
    // IMPORTANT: The 'assets' table is scoped by OWNER, not by contract!
    const result = await rpc.get_table_rows({
      code: 'atomicassets',
      scope: expected_owner,  // ← Assets are scoped by owner!
      table: 'assets',
      lower_bound: asset_id,
      upper_bound: asset_id,
      limit: 1,
      reverse: false,
      show_payer: false
    });

    // If asset not found in expected owner's scope, they don't own it
    if (!result.rows || result.rows.length === 0 || result.rows[0].asset_id !== asset_id) {
      console.log(`  ❌ Asset ${asset_id} NOT owned by ${expected_owner} (not found in their assets scope)`);

      // Asset is not in the expected owner's scope = they don't own it
      // It could be burned or owned by someone else (we can't tell which without more checks)
      return res.json({
        success: true,
        is_owned: false,
        is_burned: false,  // Can't confirm burned without checking if it exists anywhere
        current_owner: null,
        asset_id: asset_id,
        source: 'blockchain_rpc'
      });
    }

    const assetRow = result.rows[0];
    // Double-check the owner field in the row (should match scope, but verify)
    const currentOwner = assetRow.owner || expected_owner;
    const isOwned = true;  // If it's in their scope, they own it

    console.log(`  ✅ Asset ${asset_id} blockchain owner: ${currentOwner} (confirmed in owner's scope)`);

    res.json({
      success: true,
      is_owned: isOwned,
      is_burned: false,
      current_owner: currentOwner,
      asset_id: asset_id,
      source: 'blockchain_rpc'
    });
  } catch (error) {
    console.error('Error verifying asset ownership via RPC:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/assets/:account
 * Proxy endpoint to fetch user's assets (avoids CORS issues with frontend)
 * Query params: collection_name (optional), limit (optional, default 1000)
 */
app.get('/api/assets/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const { collection_name, template_id, live } = req.query;

    if (!account) {
      return res.status(400).json({ error: 'account parameter required', success: false });
    }

    const useLive = live === 'true';
    console.log(`📦 Fetching ${useLive ? 'LIVE' : 'CACHED'} assets for ${account} in collection ${collection_name || 'all'}${template_id ? ` (template ${template_id})` : ''}`);

    let allAssets;
    let source;

    if (useLive) {
      // LIVE RPC for real-time data (use for newly claimed assets)
      allAssets = await wax.getUserAssetsLive(account, collection_name || null, null);
      source = 'blockchain_rpc_live';
    } else {
      // CACHED API for browsing (fast, has full metadata)
      allAssets = await wax.getUserAssets(account, collection_name || null);
      source = 'atomicassets_api_cached';
    }

    // Filter by template if specified
    let assets = allAssets;
    if (template_id) {
      assets = allAssets.filter(asset =>
        asset.template && asset.template.template_id.toString() === template_id.toString()
      );
      console.log(`  📊 Filtered: ${assets.length} assets with template ${template_id} (out of ${allAssets.length} total)`);
    }

    res.json({
      success: true,
      data: assets,
      source,
      total_assets: allAssets.length,
      filtered_assets: template_id ? assets.length : null,
      filter: template_id ? { template_id } : null
    });
  } catch (error) {
    console.error('Error fetching user assets:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== DEBUG ENDPOINTS ====================

/**
 * GET /api/debug/raw-assets/:account
 * Shows RAW blockchain data for first 50 assets to debug structure
 */
app.get('/api/debug/raw-assets/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const { collection_name } = req.query;

    console.log(`🔍 DEBUG: Fetching raw assets for ${account}`);

    const allAssets = await wax.getUserAssetsLive(account, collection_name || null, null);
    const first50 = allAssets.slice(0, 50);

    // Show raw structure
    res.json({
      success: true,
      total_assets: allAssets.length,
      showing_first: first50.length,
      raw_assets: first50,
      sample_structure: first50[0] || null,
      // Show ALL unique template IDs in first 50
      template_ids_found: [...new Set(first50.map(a => a.template?.template_id || 'NO_TEMPLATE'))]
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/inspect-asset/:assetId
 * Debug tool: Inspect full asset details from AtomicAssets API
 */
app.get('/api/debug/inspect-asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    console.log(`🔍 Inspecting asset ${assetId}...`);

    // Use reliable AtomicAssets API endpoints (with fallback)
    const atomicEndpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax-aa.eosdac.io',
      'https://atomic-wax-mainnet.wecan.dev',
      'https://wax-atomic-api.eosphere.io'
    ];

    let apiData = null;
    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of atomicEndpoints) {
      try {
        console.log(`  Trying ${endpoint}...`);
        const response = await fetch(`${endpoint}/atomicassets/v1/assets/${assetId}`, {
          timeout: 5000
        });

        if (response.ok) {
          apiData = await response.json();
          console.log(`  ✅ Success with ${endpoint}`);
          break;
        }
      } catch (err) {
        lastError = err;
        console.log(`  ❌ Failed with ${endpoint}: ${err.message}`);
      }
    }

    if (!apiData) {
      return res.status(404).json({
        success: false,
        error: `Asset ${assetId} not found on any AtomicAssets API`,
        last_error: lastError?.message
      });
    }

    const asset = apiData.data;

    res.json({
      success: true,
      asset_id: asset.asset_id,
      collection_name: asset.collection.collection_name,
      schema_name: asset.schema.schema_name,
      template_id: asset.template?.template_id || null,
      template_mint: asset.template_mint,
      owner: asset.owner,
      backed_tokens: asset.backed_tokens,
      immutable_data: asset.immutable_data || {},
      mutable_data: asset.mutable_data || {},
      raw_response: asset
    });
  } catch (error) {
    console.error('Error inspecting asset:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/debug/inspect-claimable-pack/:assetId
 * Debug tool: Inspect claimable pack from both blockchain table and API
 */
app.get('/api/debug/inspect-claimable-pack/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    console.log(`🔍 Inspecting claimable pack ${assetId}...`);

    // Create RPC client for blockchain queries
    const { JsonRpc } = require('eosjs');
    const rpcEndpoints = [
      'https://wax.api.eosnation.io',
      'https://wax.eosphere.io',
      'https://api-wax-mainnet.wecan.dev',
      'https://wax.eosdac.io'
    ];

    const results = {};

    // 1. Try to fetch from atomicassets table (blockchain RPC)
    let rpcSuccess = false;
    for (const endpoint of rpcEndpoints) {
      try {
        console.log(`  Trying RPC endpoint ${endpoint}...`);
        const rpc = new JsonRpc(endpoint, { fetch });

        const tableResult = await rpc.get_table_rows({
          json: true,
          code: 'atomicassets',
          scope: 'atomicpacksx',
          table: 'assets',
          lower_bound: assetId,
          limit: 5
        });

        const matchingAsset = tableResult.rows.find(r => r.asset_id === assetId);
        results.asset_table_result = matchingAsset || null;
        results.asset_table_all_rows = tableResult.rows;
        results.rpc_endpoint_used = endpoint;
        console.log(`  ✅ RPC Success - Found in table: ${matchingAsset ? 'YES' : 'NO'}`);
        if (matchingAsset) {
          console.log(`  template_mint from table: ${matchingAsset.template_mint}`);
        }
        rpcSuccess = true;
        break;
      } catch (err) {
        console.log(`  ❌ RPC Failed with ${endpoint}: ${err.message}`);
        results.asset_table_error = err.message;
      }
    }

    // 2. Fetch from AtomicAssets API
    const atomicEndpoints = [
      'https://aa-wax-public1.neftyblocks.com',
      'https://wax-aa.eosdac.io',
      'https://atomic-wax-mainnet.wecan.dev',
      'https://wax-atomic-api.eosphere.io'
    ];

    for (const endpoint of atomicEndpoints) {
      try {
        console.log(`  Trying AtomicAssets API ${endpoint}...`);
        const apiResponse = await fetch(`${endpoint}/atomicassets/v1/assets/${assetId}`, {
          timeout: 5000
        });

        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          results.atomic_api_result = {
            success: true,
            data: apiData.data,
            endpoint_used: endpoint
          };
          console.log(`  ✅ API Success - template_mint: ${apiData.data.template_mint}`);
          break;
        } else {
          console.log(`  ❌ API returned status ${apiResponse.status}`);
        }
      } catch (err) {
        console.log(`  ❌ API Failed with ${endpoint}: ${err.message}`);
        results.atomic_api_error = err.message;
      }
    }

    res.json({
      success: true,
      asset_id: assetId,
      ...results
    });
  } catch (error) {
    console.error('Error inspecting claimable pack:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * GET /api/admin/atomic-apis
 * Get list of available Atomic API endpoints and current preferred one
 */
app.get('/api/admin/atomic-apis', (req, res) => {
  try {
    const apis = wax.getAtomicAPIs();
    res.json({
      success: true,
      ...apis
    });
  } catch (error) {
    console.error('Error getting Atomic APIs:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/admin/atomic-apis/set-preferred
 * Set preferred Atomic API endpoint
 * Body: { endpoint: string }
 */
app.post('/api/admin/atomic-apis/set-preferred', (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }

    wax.setPreferredAtomicAPI(endpoint);

    res.json({
      success: true,
      message: `Preferred API set to: ${endpoint}`
    });
  } catch (error) {
    console.error('Error setting preferred API:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/admin/atomic-apis/add-custom
 * Add custom Atomic API endpoint
 * Body: { endpoint: string }
 */
app.post('/api/admin/atomic-apis/add-custom', (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }

    const added = wax.addCustomAtomicAPI(endpoint);

    res.json({
      success: true,
      added: added,
      message: added ? `Added custom API: ${endpoint}` : `API already exists: ${endpoint}`
    });
  } catch (error) {
    console.error('Error adding custom API:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

/**
 * POST /api/admin/atomic-apis/test-speed
 * Test speed of an Atomic API endpoint
 * Body: { endpoint: string }
 */
app.post('/api/admin/atomic-apis/test-speed', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }

    const testAccount = 'wax';
    const startTime = Date.now();

    const testUrl = `${endpoint}/atomicassets/v1/assets?owner=${testAccount}&limit=10&_t=${Date.now()}`;
    const response = await fetch(testUrl, { timeout: 10000 });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (!response.ok) {
      return res.json({
        success: false,
        endpoint: endpoint,
        error: `HTTP ${response.status}`,
        responseTime: responseTime
      });
    }

    const data = await response.json();

    res.json({
      success: true,
      endpoint: endpoint,
      responseTime: responseTime,
      assetsReturned: data.data?.length || 0
    });
  } catch (error) {
    res.json({
      success: false,
      endpoint: req.body.endpoint,
      error: error.message,
      responseTime: null
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`\n🚀 WAX NFT Rewards System v1.1 (blend.nefty fix)`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔧 Admin panel: http://localhost:${PORT}/admin`);

  // Debug: Show database file location
  const dbPath = process.env.DATABASE_FILE || './database.sqlite';
  const fs = require('fs');
  const dbExists = fs.existsSync(dbPath);
  const dbSize = dbExists ? fs.statSync(dbPath).size : 0;
  console.log(`\n💾 Database File:`);
  console.log(`   Path: ${dbPath}`);
  console.log(`   Exists: ${dbExists ? '✅ Yes' : '❌ No'}`);
  console.log(`   Size: ${(dbSize / 1024).toFixed(2)} KB`);

  try {
    const config = db.config.get();
    if (config) {
      console.log(`\n📋 Configuration:`);
      console.log(`   Collection: ${config.collection_name}`);
      console.log(`   Whitelist: ${config.whitelist_templates}`);
      console.log(`   Reward Template: ${config.reward_template}`);
      console.log(`   Cooldown: ${config.cooldown_hours} hours`);
    }

    // Debug: Show all templates
    const allTemplates = db.templates.getAll();
    console.log(`\n📦 Templates in Database: ${allTemplates.length}`);
    allTemplates.forEach(t => {
      console.log(`   ${t.template_id}: ${t.name || 'Unnamed'} (${t.enabled ? 'Enabled' : 'Disabled'})`);
    });
  } catch (error) {
    console.log(`\n⚠️  Configuration not loaded yet (database initializing...)`);
  }

  // Start the action scheduler
  console.log();
  scheduler.startScheduler();
  console.log();
});

module.exports = app;
