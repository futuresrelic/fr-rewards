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

    const eligibleAssets = await wax.checkEligibility(account, config.collection_name, whitelistTemplates);

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

    if (!account || !template_id || !reward_id) {
      return res.status(400).json({ error: 'Missing required fields: account, template_id, reward_id' });
    }

    const config = db.config.get();

    // Get template configuration
    const templateConfig = db.templates.getById(parseInt(template_id));
    if (!templateConfig || !templateConfig.enabled) {
      return res.status(400).json({ error: 'Template not enabled or does not exist' });
    }

    // Get reward configuration
    const rewardConfig = db.templateRewards.getById(parseInt(reward_id));
    if (!rewardConfig || !rewardConfig.enabled || rewardConfig.template_id !== parseInt(template_id)) {
      return res.status(400).json({ error: 'Reward not found or not enabled for this template' });
    }

    // Check eligibility
    const enabledTemplates = db.templates.getEnabled();
    const whitelistTemplates = enabledTemplates.map(t => t.template_id);
    const eligibleAssets = await wax.checkEligibility(account, config.collection_name, whitelistTemplates);
    const userAssets = eligibleAssets.filter(asset => parseInt(asset.template.template_id) === parseInt(template_id));

    if (userAssets.length === 0) {
      return res.status(403).json({ error: 'You do not hold this whitelisted NFT' });
    }

    // Check cooldown
    const canClaim = db.claims.canClaim(account, template_id, reward_id);
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
      template_id,
      rewardConfig.reward_template_id,
      transactionIds[0], // Use first transaction ID
      rewardConfig.cooldown_hours,
      reward_id
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

    if (!template_id || !reward_template_id || !cooldown_hours) {
      return res.status(400).json({ error: 'Missing required fields: template_id, reward_template_id, cooldown_hours' });
    }

    // Verify template exists
    const template = db.templates.getById(parseInt(template_id));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.templateRewards.add(
      parseInt(template_id),
      parseInt(reward_template_id),
      reward_name || null,
      parseInt(cooldown_hours),
      max_claims ? parseInt(max_claims) : null,
      match_quantity || false
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
    const path = require('path');
    const fs = require('fs');

    // Generate filename for favicon
    const timestamp = Date.now();
    const faviconFilename = `favicon-${timestamp}.png`;
    const faviconPath = path.join(__dirname, 'public', 'uploads', faviconFilename);

    // Resize image to 32x32 and save as PNG
    await sharp(req.file.path)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(faviconPath);

    // Delete the original uploaded file
    fs.unlinkSync(req.file.path);

    const faviconUrl = `/uploads/${faviconFilename}`;

    // Update database with new favicon URL
    db.config.updateBranding({ favicon_url: faviconUrl });

    res.json({
      success: true,
      favicon_url: faviconUrl,
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
    if (page_title !== undefined) updates.page_title = page_title;
    if (page_subtitle !== undefined) updates.page_subtitle = page_subtitle;

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
        favicon_url: config.favicon_url || null
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
    const validActionTypes = ['CLAIM', 'UNPACK', 'BLEND', 'DROP', 'MARKET_SCOUT'];
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
      const validActionTypes = ['CLAIM', 'UNPACK', 'BLEND', 'DROP', 'MARKET_SCOUT'];
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
    const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

    let allMatchingAssets = [];
    let hasMore = true;
    let lowerBound = '';
    let totalChecked = 0;

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

    console.log(`✅ Blockchain query complete: checked ${totalChecked} assets, found ${allMatchingAssets.length} with template ${template_id}`);

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
 * Uses wax.getUserAssets with timeout and fallback endpoints
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

    // Fetch all user assets once (more efficient)
    const allAssets = await wax.getUserAssets(account);

    // Check each template ID
    for (const templateId of templateIdArray) {
      const ownsTemplate = allAssets.some(asset =>
        asset.template && asset.template.template_id === templateId
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
      return res.status(400).json({ error: 'pack_asset_id is required' });
    }

    console.log(`Querying unboxed rolls for pack asset ${pack_asset_id}...`);

    const { JsonRpc } = require('eosjs');
    const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

    // Query the unboxassets table from atomicpacksx contract
    // This table is populated AFTER the pack is transferred for unpacking
    // The scope is the pack_asset_id itself!
    const result = await rpc.get_table_rows({
      json: true,
      code: 'atomicpacksx',
      scope: pack_asset_id,
      table: 'unboxassets',
      limit: 1000,
      reverse: false,
      show_payer: false
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        error: `No unboxed rolls found for pack asset ${pack_asset_id}. Pack may not have been unpacked yet, or blockchain may need more time to process.`,
        success: false
      });
    }

    // Extract all roll IDs - scope is already filtered to this pack
    const rollIds = result.rows
      .map(row => parseInt(row.origin_roll_id))
      .sort((a, b) => a - b);  // Sort numerically

    console.log(`✅ Found ${rollIds.length} rolls for pack ${pack_asset_id}: [${rollIds.join(', ')}]`);
    console.log(`Raw table data: ${JSON.stringify(result.rows.slice(0, 3))}`);

    res.json({
      success: true,
      pack_asset_id: pack_asset_id,
      roll_ids: rollIds,
      roll_count: rollIds.length
    });
  } catch (error) {
    console.error('Error fetching unboxed rolls:', error);
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

    console.log(`Querying claimable packs for ${account}...`);

    const { JsonRpc } = require('eosjs');
    const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

    // Query the unboxpacks table - scope is the user's account
    // This table contains all packs that have been unpacked but not claimed
    const result = await rpc.get_table_rows({
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

    console.log(`Found ${result.rows.length} entries in unboxpacks table`);

    if (!result.rows || result.rows.length === 0) {
      return res.json({
        success: true,
        claimable_packs: [],
        count: 0
      });
    }

    // For each pack, fetch the roll details from unboxassets table
    const claimablePacks = [];

    for (const row of result.rows) {
      try {
        const packAssetId = row.pack_asset_id;

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

        const rollIds = rollsResult.rows
          .map(r => parseInt(r.origin_roll_id))
          .sort((a, b) => a - b);

        if (rollIds.length > 0) {
          // Fetch asset details from AtomicAssets API to get template_mint
          // Use reliable endpoints with fallback
          const atomicEndpoints = [
            'https://aa-wax-public1.neftyblocks.com',
            'https://wax-aa.eosdac.io',
            'https://atomic-wax-mainnet.wecan.dev',
            'https://wax-atomic-api.eosphere.io'
          ];

          let templateMint = null;
          for (const endpoint of atomicEndpoints) {
            try {
              const apiResponse = await fetch(`${endpoint}/atomicassets/v1/assets/${packAssetId}`, {
                timeout: 3000
              });
              if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                templateMint = apiData.data.template_mint;
                break; // Success, exit loop
              }
            } catch (err) {
              // Try next endpoint
              continue;
            }
          }

          if (!templateMint) {
            console.warn(`Could not fetch template_mint for pack ${packAssetId} from any API endpoint`);
          }

          claimablePacks.push({
            pack_asset_id: packAssetId,
            pack_template_id: row.pack_template_id || null,
            template_mint: templateMint,
            roll_ids: rollIds,
            roll_count: rollIds.length,
            unlock_time: row.unlock_time || null
          });

          console.log(`  ✅ Pack ${packAssetId}: ${rollIds.length} rolls ready to claim (Mint #${templateMint || 'Unknown'})`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Error fetching rolls for pack ${row.pack_asset_id}:`, error.message);
      }
    }

    console.log(`✅ Found ${claimablePacks.length} claimable packs for ${account}`);

    res.json({
      success: true,
      claimable_packs: claimablePacks,
      count: claimablePacks.length
    });
  } catch (error) {
    console.error('Error fetching claimable packs:', error);
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
    const { collection_name, limit } = req.query;

    if (!account) {
      return res.status(400).json({ error: 'account parameter required', success: false });
    }

    console.log(`📦 Fetching assets for ${account} in collection ${collection_name || 'all'}`);

    // Use wax.getUserAssets which has fallback/retry logic and preferred endpoint
    const assets = await wax.getUserAssets(account, collection_name || null);

    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching user assets:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== DEBUG ENDPOINTS ====================

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
  console.log(`\n🚀 WAX NFT Rewards System v1.0`);
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
