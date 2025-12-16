const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_FILE || './database.sqlite';
const db = new Database(dbPath);

console.log('Initializing database...');

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

// Create index for faster queries
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
const configExists = db.prepare('SELECT COUNT(*) as count FROM config').get();

if (configExists.count === 0) {
  const whitelistTemplates = process.env.WHITELIST_TEMPLATES || '217679,217680,217682';
  const rewardTemplate = process.env.REWARD_TEMPLATE || '251276';
  const cooldownHours = process.env.COOLDOWN_HOURS || '24';
  const collectionName = process.env.COLLECTION_NAME || 'futuresrelic';

  db.prepare(`
    INSERT INTO config (id, whitelist_templates, reward_template, cooldown_hours, collection_name)
    VALUES (1, ?, ?, ?, ?)
  `).run(whitelistTemplates, rewardTemplate, cooldownHours, collectionName);

  console.log('✅ Default configuration inserted');
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

console.log(`✅ Admin accounts configured: ${adminAccounts.join(', ')}`);

// Display current configuration
const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
console.log('\n📋 Current Configuration:');
console.log(`   Collection: ${config.collection_name}`);
console.log(`   Whitelist Templates: ${config.whitelist_templates}`);
console.log(`   Reward Template: ${config.reward_template}`);
console.log(`   Cooldown: ${config.cooldown_hours} hours`);

console.log('\n✅ Database initialized successfully!');
console.log(`   Location: ${path.resolve(dbPath)}`);

db.close();
