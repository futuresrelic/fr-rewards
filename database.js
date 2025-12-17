const Database = require('better-sqlite3');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DATABASE_FILE || './database.sqlite';
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize database tables if they don't exist
function initializeTables() {
  // Check if config table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='config'
  `).get();

  if (!tableExists) {
    console.log('🔧 Initializing database tables...');

    // Create config table
    db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        whitelist_templates TEXT NOT NULL,
        reward_template INTEGER NOT NULL,
        cooldown_hours INTEGER NOT NULL DEFAULT 24,
        collection_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create claims table
    db.exec(`
      CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_account TEXT NOT NULL,
        template_id INTEGER NOT NULL,
        reward_template INTEGER NOT NULL,
        transaction_id TEXT NOT NULL,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_claim_at TIMESTAMP NOT NULL,
        UNIQUE(wallet_account, template_id, claimed_at)
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_claims_wallet
      ON claims(wallet_account);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_claims_next_claim
      ON claims(wallet_account, template_id, next_claim_at);
    `);

    // Create admin_accounts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        wallet_account TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create templates table for per-template configuration
    db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        template_id INTEGER PRIMARY KEY,
        name TEXT,
        reward_template_id INTEGER NOT NULL,
        cooldown_hours INTEGER NOT NULL DEFAULT 24,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default configuration (keeping for backward compatibility)
    const whitelistTemplates = process.env.WHITELIST_TEMPLATES || '217679,217680,217682';
    const rewardTemplate = process.env.REWARD_TEMPLATE || '251276';
    const cooldownHours = process.env.COOLDOWN_HOURS || '24';
    const collectionName = process.env.COLLECTION_NAME || 'futuresrelic';

    db.prepare(`
      INSERT INTO config (id, whitelist_templates, reward_template, cooldown_hours, collection_name)
      VALUES (1, ?, ?, ?, ?)
    `).run(whitelistTemplates, rewardTemplate, cooldownHours, collectionName);

    // Migrate existing whitelist templates to new templates table
    const templateIds = whitelistTemplates.split(',').map(id => parseInt(id.trim()));
    for (const templateId of templateIds) {
      db.prepare(`
        INSERT OR IGNORE INTO templates (template_id, reward_template_id, cooldown_hours, enabled)
        VALUES (?, ?, ?, 1)
      `).run(templateId, parseInt(rewardTemplate), parseInt(cooldownHours));
    }

    // Insert default admin accounts
    const adminAccounts = (process.env.ADMIN_ACCOUNTS || 'futuresrelic').split(',');
    for (const account of adminAccounts) {
      const trimmedAccount = account.trim();
      if (trimmedAccount) {
        db.prepare(`
          INSERT OR IGNORE INTO admin_accounts (wallet_account)
          VALUES (?)
        `).run(trimmedAccount);
      }
    }

    console.log('✅ Database tables initialized successfully!');
  }

  // Seed default templates if they don't exist (runs every time)
  console.log('🌱 Checking default templates...');

  const defaultTemplates = [
    { id: 247050, name: 'Apprentice Editor Card', reward: 246504, cooldown: 96 },
    { id: 247051, name: '2nd Assistant Editor Card', reward: 246504, cooldown: 72 },
    { id: 247052, name: '1st Assistant Editor Card', reward: 246504, cooldown: 48 },
    { id: 247053, name: 'Associate Editor Card', reward: 246504, cooldown: 24 }
  ];

  for (const template of defaultTemplates) {
    const exists = db.prepare('SELECT template_id FROM templates WHERE template_id = ?').get(template.id);
    if (!exists) {
      db.prepare(`
        INSERT INTO templates (template_id, name, reward_template_id, cooldown_hours, enabled)
        VALUES (?, ?, ?, ?, 1)
      `).run(template.id, template.name, template.reward, template.cooldown);
      console.log(`✅ Seeded template: ${template.id} (${template.name})`);
    } else {
      console.log(`   Template ${template.id} already exists`);
    }
  }
}

// Initialize tables immediately
initializeTables();

// Configuration methods
const config = {
  get: () => {
    return db.prepare('SELECT * FROM config WHERE id = 1').get();
  },

  update: (data) => {
    const stmt = db.prepare(`
      UPDATE config
      SET whitelist_templates = ?,
          reward_template = ?,
          cooldown_hours = ?,
          collection_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);
    return stmt.run(
      data.whitelist_templates,
      data.reward_template,
      data.cooldown_hours,
      data.collection_name
    );
  }
};

// Claims methods
const claims = {
  add: (wallet_account, template_id, reward_template, transaction_id, cooldown_hours) => {
    const stmt = db.prepare(`
      INSERT INTO claims (wallet_account, template_id, reward_template, transaction_id, next_claim_at)
      VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' hours'))
    `);
    return stmt.run(wallet_account, template_id, reward_template, transaction_id, cooldown_hours);
  },

  getByAccount: (wallet_account) => {
    return db.prepare(`
      SELECT * FROM claims
      WHERE wallet_account = ?
      ORDER BY claimed_at DESC
    `).all(wallet_account);
  },

  getAll: (limit = 100) => {
    return db.prepare(`
      SELECT * FROM claims
      ORDER BY claimed_at DESC
      LIMIT ?
    `).all(limit);
  },

  getCooldowns: (wallet_account) => {
    return db.prepare(`
      SELECT
        template_id,
        MAX(next_claim_at) as next_claim_at,
        MAX(claimed_at) as last_claimed_at
      FROM claims
      WHERE wallet_account = ?
      GROUP BY template_id
    `).all(wallet_account);
  },

  canClaim: (wallet_account, template_id) => {
    const result = db.prepare(`
      SELECT next_claim_at
      FROM claims
      WHERE wallet_account = ? AND template_id = ?
      ORDER BY next_claim_at DESC
      LIMIT 1
    `).get(wallet_account, template_id);

    if (!result) return true;

    const now = new Date().toISOString();
    return now >= result.next_claim_at;
  },

  getStats: () => {
    const totalClaims = db.prepare('SELECT COUNT(*) as count FROM claims').get();
    const activeUsers = db.prepare('SELECT COUNT(DISTINCT wallet_account) as count FROM claims').get();
    const recentClaim = db.prepare('SELECT * FROM claims ORDER BY claimed_at DESC LIMIT 1').get();
    const last24h = db.prepare(`
      SELECT COUNT(*) as count FROM claims
      WHERE claimed_at >= datetime('now', '-24 hours')
    `).get();

    return {
      totalClaims: totalClaims.count,
      activeUsers: activeUsers.count,
      claimsLast24h: last24h.count,
      lastClaim: recentClaim
    };
  }
};

// Admin methods
const admin = {
  isAdmin: (wallet_account) => {
    const result = db.prepare('SELECT * FROM admin_accounts WHERE wallet_account = ?').get(wallet_account);
    return !!result;
  },

  add: (wallet_account) => {
    return db.prepare('INSERT OR IGNORE INTO admin_accounts (wallet_account) VALUES (?)').run(wallet_account);
  },

  remove: (wallet_account) => {
    return db.prepare('DELETE FROM admin_accounts WHERE wallet_account = ?').run(wallet_account);
  },

  getAll: () => {
    return db.prepare('SELECT * FROM admin_accounts ORDER BY created_at DESC').all();
  }
};

// Templates methods
const templates = {
  getAll: () => {
    return db.prepare('SELECT * FROM templates ORDER BY template_id ASC').all();
  },

  getEnabled: () => {
    return db.prepare('SELECT * FROM templates WHERE enabled = 1 ORDER BY template_id ASC').all();
  },

  getById: (template_id) => {
    return db.prepare('SELECT * FROM templates WHERE template_id = ?').get(template_id);
  },

  add: (template_id, name, reward_template_id, cooldown_hours) => {
    const stmt = db.prepare(`
      INSERT INTO templates (template_id, name, reward_template_id, cooldown_hours, enabled)
      VALUES (?, ?, ?, ?, 1)
    `);
    return stmt.run(template_id, name, reward_template_id, cooldown_hours);
  },

  update: (template_id, data) => {
    const stmt = db.prepare(`
      UPDATE templates
      SET name = ?,
          reward_template_id = ?,
          cooldown_hours = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE template_id = ?
    `);
    return stmt.run(data.name, data.reward_template_id, data.cooldown_hours, data.enabled, template_id);
  },

  delete: (template_id) => {
    return db.prepare('DELETE FROM templates WHERE template_id = ?').run(template_id);
  },

  enable: (template_id) => {
    return db.prepare('UPDATE templates SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE template_id = ?').run(template_id);
  },

  disable: (template_id) => {
    return db.prepare('UPDATE templates SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE template_id = ?').run(template_id);
  }
};

module.exports = {
  db,
  config,
  claims,
  admin,
  templates
};
