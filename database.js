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

    // Insert default configuration
    const whitelistTemplates = process.env.WHITELIST_TEMPLATES || '217679,217680,217682';
    const rewardTemplate = process.env.REWARD_TEMPLATE || '251276';
    const cooldownHours = process.env.COOLDOWN_HOURS || '24';
    const collectionName = process.env.COLLECTION_NAME || 'futuresrelic';

    db.prepare(`
      INSERT INTO config (id, whitelist_templates, reward_template, cooldown_hours, collection_name)
      VALUES (1, ?, ?, ?, ?)
    `).run(whitelistTemplates, rewardTemplate, cooldownHours, collectionName);

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

module.exports = {
  db,
  config,
  claims,
  admin
};
