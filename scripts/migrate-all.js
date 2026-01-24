#!/usr/bin/env node
/**
 * Complete migration script - runs all migrations in order
 * Use this to set up a fresh database or migrate an existing one
 */
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.DATABASE_FILE || './database.sqlite';
console.log(`📂 Database: ${dbPath}\n`);

const db = new Database(dbPath);

// Helper to check if column exists
function hasColumn(tableName, columnName) {
  const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return info.some(col => col.name === columnName);
}

try {
  console.log('🔄 Running complete database migration...\n');

  // 1. Create base tables (from init-db.js)
  console.log('Step 1: Creating base tables...');

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

  db.exec(`CREATE INDEX IF NOT EXISTS idx_claims_wallet ON claims(wallet_account);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_claims_next_claim ON claims(wallet_account, template_id, next_claim_at);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      wallet_account TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

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

  console.log('✅ Base tables created\n');

  // 2. Create workflow tables (from migrate-workflow.js)
  console.log('Step 2: Creating workflow tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(step_order)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step_id INTEGER NOT NULL,
      action_order INTEGER NOT NULL DEFAULT 0,
      action_type TEXT NOT NULL CHECK(action_type IN ('CLAIM', 'UNPACK', 'BLEND', 'DROP', 'MARKET_SCOUT')),
      name TEXT NOT NULL,
      description TEXT,
      config TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_workflow_actions_step ON workflow_actions(step_id, action_order);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_id INTEGER NOT NULL,
      condition_type TEXT NOT NULL CHECK(condition_type IN ('OWNS_TEMPLATES', 'OWNS_ASSET_COUNT', 'HAS_COMPLETED_ACTION', 'HAS_COMPLETED_STEP', 'CUSTOM')),
      condition_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (action_id) REFERENCES workflow_actions(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_workflow_conditions_action ON workflow_conditions(action_id);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_workflow_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_account TEXT NOT NULL,
      action_id INTEGER NOT NULL,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      transaction_id TEXT,
      result_data TEXT,
      FOREIGN KEY (action_id) REFERENCES workflow_actions(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_progress_wallet ON user_workflow_progress(wallet_account);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_progress_action ON user_workflow_progress(wallet_account, action_id);`);

  console.log('✅ Workflow tables created\n');

  // 3. Add story tabs (from migrate-story-tabs.js)
  console.log('Step 3: Adding story tabs system...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS story_tabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tab_order INTEGER NOT NULL,
      tab_name TEXT NOT NULL,
      tab_icon TEXT DEFAULT '📖',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tab_order)
    );
  `);

  // Add tab_id to workflow_actions if it doesn't exist
  if (!hasColumn('workflow_actions', 'tab_id')) {
    db.exec(`ALTER TABLE workflow_actions ADD COLUMN tab_id INTEGER REFERENCES story_tabs(id) ON DELETE SET NULL`);
    console.log('✅ Added tab_id column to workflow_actions');
  } else {
    console.log('   tab_id column already exists in workflow_actions');
  }

  // Add nav_config to config if it doesn't exist
  if (!hasColumn('config', 'nav_config')) {
    db.exec(`ALTER TABLE config ADD COLUMN nav_config TEXT DEFAULT '{"show_claims":true,"show_unpack":true,"show_story":true}'`);
    console.log('✅ Added nav_config column to config');
  } else {
    console.log('   nav_config column already exists in config');
  }

  console.log('✅ Story tabs system added\n');

  // 4. Add module_instances table (Option A - Database-backed modules)
  console.log('Step 4: Adding module instances system...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS module_instances (
      id TEXT PRIMARY KEY,
      module_type TEXT NOT NULL,
      config TEXT NOT NULL,
      page_path TEXT,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_module_instances_type ON module_instances(module_type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_module_instances_page ON module_instances(page_path);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_module_instances_created ON module_instances(created_at DESC);`);

  const moduleInstanceCount = db.prepare('SELECT COUNT(*) as count FROM module_instances').get();
  console.log(`✅ Module instances table ready (${moduleInstanceCount.count} instances)\n`);

  console.log('🎉 All migrations completed successfully!\n');

  // Display summary
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('📊 Database tables:');
  tables.forEach(t => console.log(`   - ${t.name}`));

  db.close();

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}
