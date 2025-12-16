const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./database');
const wax = require('./wax');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10 // stricter limit for claim endpoints
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

    const eligibleAssets = await wax.checkEligibility(account, config.collection_name, whitelistTemplates);

    // Add template configuration to each eligible asset
    const enrichedAssets = eligibleAssets.map(asset => {
      const templateConfig = enabledTemplates.find(t => t.template_id === parseInt(asset.template.template_id));
      return {
        asset_id: asset.asset_id,
        template_id: asset.template.template_id,
        name: asset.name,
        template_config: templateConfig
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
    res.status(500).json({ error: error.message });
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
 * GET /api/user/cooldowns/:account
 * Get cooldown status for user's whitelisted templates
 */
app.get('/api/user/cooldowns/:account', async (req, res) => {
  try {
    const { account } = req.params;
    const enabledTemplates = db.templates.getEnabled();

    const cooldowns = db.claims.getCooldowns(account);
    const now = new Date();

    const cooldownStatus = enabledTemplates.map(template => {
      const cooldown = cooldowns.find(c => c.template_id === template.template_id);

      if (!cooldown) {
        return {
          template_id: template.template_id,
          can_claim: true,
          next_claim_at: null,
          last_claimed_at: null,
          remaining_seconds: 0,
          template_config: template
        };
      }

      const nextClaimDate = new Date(cooldown.next_claim_at);
      const canClaim = now >= nextClaimDate;
      const remainingSeconds = canClaim ? 0 : Math.floor((nextClaimDate - now) / 1000);

      return {
        template_id: template.template_id,
        can_claim: canClaim,
        next_claim_at: cooldown.next_claim_at,
        last_claimed_at: cooldown.last_claimed_at,
        remaining_seconds: remainingSeconds,
        template_config: template
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
    const { account, template_id } = req.body;

    if (!account || !template_id) {
      return res.status(400).json({ error: 'Missing required fields: account, template_id' });
    }

    const config = db.config.get();

    // Get template configuration
    const templateConfig = db.templates.getById(parseInt(template_id));
    if (!templateConfig || !templateConfig.enabled) {
      return res.status(400).json({ error: 'Template not enabled or does not exist' });
    }

    // Check eligibility
    const enabledTemplates = db.templates.getEnabled();
    const whitelistTemplates = enabledTemplates.map(t => t.template_id);
    const eligibleAssets = await wax.checkEligibility(account, config.collection_name, whitelistTemplates);
    const hasTemplate = eligibleAssets.some(asset => parseInt(asset.template.template_id) === parseInt(template_id));

    if (!hasTemplate) {
      return res.status(403).json({ error: 'You do not hold this whitelisted NFT' });
    }

    // Check cooldown
    const canClaim = db.claims.canClaim(account, template_id);
    if (!canClaim) {
      return res.status(429).json({ error: 'Cooldown period has not expired' });
    }

    // Mint reward NFT using template-specific reward
    console.log(`Minting reward NFT to ${account} (template: ${templateConfig.reward_template_id})`);
    const mintResult = await wax.mintNFT(account, config.collection_name, parseInt(templateConfig.reward_template_id));

    // Record claim using template-specific cooldown
    db.claims.add(account, template_id, templateConfig.reward_template_id, mintResult.transaction_id, templateConfig.cooldown_hours);

    res.json({
      success: true,
      message: 'Reward claimed successfully',
      transaction_id: mintResult.transaction_id,
      block_num: mintResult.block_num,
      reward_template: templateConfig.reward_template_id,
      next_claim_hours: templateConfig.cooldown_hours
    });
  } catch (error) {
    console.error('Error claiming reward:', error);
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
        templates: enabledTemplates
      }
    });
  } catch (error) {
    console.error('Error fetching public config:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FRONTEND ROUTES ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`\n🚀 WAX NFT Rewards System`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔧 Admin panel: http://localhost:${PORT}/admin`);

  try {
    const config = db.config.get();
    if (config) {
      console.log(`\n📋 Configuration:`);
      console.log(`   Collection: ${config.collection_name}`);
      console.log(`   Whitelist: ${config.whitelist_templates}`);
      console.log(`   Reward Template: ${config.reward_template}`);
      console.log(`   Cooldown: ${config.cooldown_hours} hours`);
    }
  } catch (error) {
    console.log(`\n⚠️  Configuration not loaded yet (database initializing...)`);
  }
  console.log();
});

module.exports = app;
