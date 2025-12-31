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

    // Build enriched assets with multiple rewards
    const enrichedAssets = Object.entries(templateQuantities).map(([templateId, data]) => {
      const templateConfig = enabledTemplates.find(t => t.template_id === parseInt(templateId));
      const templateRewards = allRewards.filter(r => r.template_id === parseInt(templateId));

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
        name: data.asset.name,
        quantity_owned: data.quantity,
        image_url: data.asset.image_url || null,
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

    res.json({
      success: true,
      account,
      total: claims.length,
      claims
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

    // Mint NFTs (one or multiple)
    const transactionIds = [];
    for (let i = 0; i < quantityToMint; i++) {
      const mintResult = await wax.mintNFT(account, config.collection_name, parseInt(rewardConfig.reward_template_id));
      transactionIds.push(mintResult.transaction_id);
    }

    // Record claim with reward_id
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
  console.log();
});

module.exports = app;
