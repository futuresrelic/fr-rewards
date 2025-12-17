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

// Seed default templates if they don't exist
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

// Display current configuration
const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
console.log('\n📋 Current Configuration:');
console.log(`   Collection: ${config.collection_name}`);
console.log(`   Whitelist Templates: ${config.whitelist_templates}`);
console.log(`   Reward Template: ${config.reward_template}`);
console.log(`   Cooldown: ${config.cooldown_hours} hours`);

// Display templates
const templates = db.prepare('SELECT * FROM templates WHERE enabled = 1 ORDER BY template_id ASC').all();
console.log('\n📦 Active Templates:');
templates.forEach(t => {
  console.log(`   ${t.template_id}: ${t.name || 'Unnamed'} → Reward ${t.reward_template_id} (${t.cooldown_hours}h cooldown)`);
});

console.log('\n✅ Database initialized successfully!');
console.log(`   Location: ${path.resolve(dbPath)}`);

db.close();
