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
        page_title TEXT DEFAULT 'NFT Holder Rewards',
        page_subtitle TEXT DEFAULT 'Connect your wallet to claim rewards!',
        logo_url TEXT,
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

    // Create template_rewards table for multiple rewards per template
    db.exec(`
      CREATE TABLE IF NOT EXISTS template_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        reward_template_id INTEGER NOT NULL,
        reward_name TEXT,
        cooldown_hours INTEGER NOT NULL DEFAULT 24,
        max_claims INTEGER,
        match_quantity INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
      );
    `);

    // Create index for template_rewards
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_template_rewards_template
      ON template_rewards(template_id);
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

  // Migration: Add branding columns if they don't exist
  try {
    const configRow = db.prepare('SELECT * FROM config WHERE id = 1').get();
    if (configRow && !configRow.hasOwnProperty('page_title')) {
      console.log('🔄 Migrating database: Adding branding columns...');
      db.exec(`ALTER TABLE config ADD COLUMN page_title TEXT DEFAULT 'NFT Holder Rewards'`);
      db.exec(`ALTER TABLE config ADD COLUMN page_subtitle TEXT DEFAULT 'Connect your wallet to claim rewards!'`);
      db.exec(`ALTER TABLE config ADD COLUMN logo_url TEXT`);
      console.log('✅ Branding columns added');
    }
    // Migration: Add favicon_url if it doesn't exist
    if (configRow && !configRow.hasOwnProperty('favicon_url')) {
      console.log('🔄 Migrating database: Adding favicon_url column...');
      db.exec(`ALTER TABLE config ADD COLUMN favicon_url TEXT`);
      console.log('✅ favicon_url column added');
    }
  } catch (error) {
    // Columns might already exist, ignore error
  }

  // Migration: Create template_rewards table if it doesn't exist
  try {
    const templateRewardsExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='template_rewards'
    `).get();

    if (!templateRewardsExists) {
      console.log('🔄 Migrating database: Creating template_rewards table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS template_rewards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          reward_template_id INTEGER NOT NULL,
          reward_name TEXT,
          cooldown_hours INTEGER NOT NULL DEFAULT 24,
          max_claims INTEGER,
          match_quantity INTEGER NOT NULL DEFAULT 0,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_template_rewards_template
        ON template_rewards(template_id);
      `);

      console.log('✅ template_rewards table created');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Add reward_id column to claims table if it doesn't exist
  try {
    const claimsTableInfo = db.prepare('PRAGMA table_info(claims)').all();
    const hasRewardId = claimsTableInfo.some(col => col.name === 'reward_id');

    if (!hasRewardId) {
      console.log('🔄 Migrating database: Adding reward_id to claims table...');
      db.exec(`ALTER TABLE claims ADD COLUMN reward_id INTEGER`);
      console.log('✅ reward_id column added to claims table');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Migrate existing templates to template_rewards if needed
  try {
    const existingTemplates = db.prepare('SELECT * FROM templates').all();
    const existingRewards = db.prepare('SELECT COUNT(*) as count FROM template_rewards').get();

    if (existingTemplates.length > 0 && existingRewards.count === 0) {
      console.log('🔄 Migrating existing templates to template_rewards system...');

      for (const template of existingTemplates) {
        // Check if this template already has rewards
        const hasReward = db.prepare(
          'SELECT id FROM template_rewards WHERE template_id = ? AND reward_template_id = ?'
        ).get(template.template_id, template.reward_template_id);

        if (!hasReward) {
          db.prepare(`
            INSERT INTO template_rewards (template_id, reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity, enabled)
            VALUES (?, ?, ?, ?, 1, 0, ?)
          `).run(
            template.template_id,
            template.reward_template_id,
            null, // reward_name
            template.cooldown_hours,
            template.enabled
          );
          console.log(`   Migrated template ${template.template_id} -> reward ${template.reward_template_id}`);
        }
      }

      console.log('✅ Template migration complete');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Create workflow tables if they don't exist
  try {
    const workflowStepsExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_steps'
    `).get();

    if (!workflowStepsExists) {
      console.log('🔄 Creating workflow system tables...');

      // Create workflow_steps table
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

      // Create workflow_actions table
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

      // Create index for workflow_actions
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_workflow_actions_step
        ON workflow_actions(step_id, action_order);
      `);

      // Create workflow_conditions table
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

      // Create index for workflow_conditions
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_workflow_conditions_action
        ON workflow_conditions(action_id);
      `);

      // Create user_workflow_progress table
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

      // Create indexes for user_workflow_progress
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_progress_wallet
        ON user_workflow_progress(wallet_account);
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_progress_action
        ON user_workflow_progress(wallet_account, action_id);
      `);

      console.log('✅ Workflow system tables created');
    }
  } catch (error) {
    console.warn('⚠️ Workflow migration warning:', error.message);
  }

  // Migration: Create blend_cache table if it doesn't exist
  try {
    const blendCacheExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='blend_cache'
    `).get();

    if (!blendCacheExists) {
      console.log('🔄 Creating blend_cache table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS blend_cache (
          blend_id INTEGER PRIMARY KEY,
          blend_data TEXT NOT NULL,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('✅ blend_cache table created');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Create blend_recipes table if it doesn't exist
  try {
    const blendRecipesExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='blend_recipes'
    `).get();

    if (!blendRecipesExists) {
      console.log('🔄 Creating blend_recipes table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS blend_recipes (
          blend_id INTEGER PRIMARY KEY,
          collection_name TEXT NOT NULL,
          contract_name TEXT DEFAULT 'blend.nefty',
          ingredients TEXT NOT NULL,
          display_data TEXT,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('✅ blend_recipes table created');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Create craft_recipes table if it doesn't exist
  try {
    const craftRecipesExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='craft_recipes'
    `).get();

    if (!craftRecipesExists) {
      console.log('🔄 Creating craft_recipes table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS craft_recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'Uncategorized',
          transfer_to_wallet TEXT DEFAULT 'futuresrelic',
          ingredients TEXT NOT NULL,
          results TEXT NOT NULL,
          max_batch_multiplier INTEGER DEFAULT 1,
          cooldown_hours INTEGER,
          cooldown_enabled INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          pool_mode_enabled INTEGER DEFAULT 0,
          pool_wallet TEXT,
          pool_ingredients TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('✅ craft_recipes table created');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Add category column to craft_recipes if it doesn't exist
  try {
    const hasCategory = db.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('craft_recipes') WHERE name='category'
    `).get();

    if (hasCategory.count === 0) {
      console.log('🔄 Adding category column to craft_recipes...');
      db.exec(`ALTER TABLE craft_recipes ADD COLUMN category TEXT DEFAULT 'Uncategorized'`);
      console.log('✅ category column added');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Add transfer_to_wallet column to craft_recipes if it doesn't exist
  try {
    const hasTransferWallet = db.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('craft_recipes') WHERE name='transfer_to_wallet'
    `).get();

    if (hasTransferWallet.count === 0) {
      console.log('🔄 Adding transfer_to_wallet column to craft_recipes...');
      db.exec(`ALTER TABLE craft_recipes ADD COLUMN transfer_to_wallet TEXT DEFAULT 'futuresrelic'`);
      console.log('✅ transfer_to_wallet column added');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Add pool mode columns to craft_recipes if they don't exist
  try {
    const hasPoolMode = db.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('craft_recipes') WHERE name='pool_mode_enabled'
    `).get();

    if (hasPoolMode.count === 0) {
      console.log('🔄 Adding pool mode columns to craft_recipes...');
      db.exec(`
        ALTER TABLE craft_recipes ADD COLUMN pool_mode_enabled INTEGER DEFAULT 0;
        ALTER TABLE craft_recipes ADD COLUMN pool_wallet TEXT;
        ALTER TABLE craft_recipes ADD COLUMN pool_ingredients TEXT;
      `);
      console.log('✅ Pool mode columns added');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Create craft_history table if it doesn't exist
  try {
    const craftHistoryExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='craft_history'
    `).get();

    if (!craftHistoryExists) {
      console.log('🔄 Creating craft_history table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS craft_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recipe_id INTEGER NOT NULL,
          user_wallet TEXT NOT NULL,
          batch_count INTEGER DEFAULT 1,
          transfer_transaction_id TEXT NOT NULL UNIQUE,
          mint_transaction_id TEXT,
          ingredient_asset_ids TEXT NOT NULL,
          result_info TEXT,
          status TEXT DEFAULT 'pending_mint',
          crafted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT,
          FOREIGN KEY (recipe_id) REFERENCES craft_recipes(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_craft_history_user ON craft_history(user_wallet);
        CREATE INDEX IF NOT EXISTS idx_craft_history_recipe ON craft_history(recipe_id);
        CREATE INDEX IF NOT EXISTS idx_craft_history_transfer_tx ON craft_history(transfer_transaction_id);
      `);

      console.log('✅ craft_history table created');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Create scheduled_actions table
  try {
    const scheduledActionsExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_actions'
    `).get();

    if (!scheduledActionsExists) {
      console.log('🔄 Creating scheduled_actions table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          action_type TEXT NOT NULL,
          action_params TEXT NOT NULL,
          execution_time TIMESTAMP NOT NULL,
          status TEXT DEFAULT 'pending',
          is_recurring INTEGER DEFAULT 0,
          recurrence_interval_minutes INTEGER,
          last_executed_at TIMESTAMP,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          executed_at TIMESTAMP,
          error_message TEXT,
          CONSTRAINT check_action_type CHECK (action_type IN ('mint', 'transfer', 'drop', 'burn'))
        );

        CREATE INDEX IF NOT EXISTS idx_scheduled_actions_status ON scheduled_actions(status);
        CREATE INDEX IF NOT EXISTS idx_scheduled_actions_execution_time ON scheduled_actions(execution_time);
        CREATE INDEX IF NOT EXISTS idx_scheduled_actions_type ON scheduled_actions(action_type);
      `);

      console.log('✅ scheduled_actions table created');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Migration: Add recurring columns to scheduled_actions if they don't exist
  try {
    const hasRecurring = db.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('scheduled_actions') WHERE name='is_recurring'
    `).get();

    if (hasRecurring.count === 0) {
      console.log('🔄 Adding recurring columns to scheduled_actions...');
      db.exec(`
        ALTER TABLE scheduled_actions ADD COLUMN is_recurring INTEGER DEFAULT 0;
        ALTER TABLE scheduled_actions ADD COLUMN recurrence_interval_minutes INTEGER;
        ALTER TABLE scheduled_actions ADD COLUMN last_executed_at TIMESTAMP;
      `);
      console.log('✅ Recurring columns added');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
  }

  // Create action_executions table (history log)
  try {
    const actionExecutionsExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='action_executions'
    `).get();

    if (!actionExecutionsExists) {
      console.log('🔄 Creating action_executions table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS action_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          transaction_id TEXT,
          result_data TEXT,
          error_message TEXT,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (action_id) REFERENCES scheduled_actions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_action_executions_action ON action_executions(action_id);
        CREATE INDEX IF NOT EXISTS idx_action_executions_status ON action_executions(status);
      `);

      console.log('✅ action_executions table created');
    }
  } catch (error) {
    console.warn('⚠️ Migration warning:', error.message);
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
  },

  updateBranding: (data) => {
    const fields = [];
    const values = [];

    if (data.page_title !== undefined) {
      fields.push('page_title = ?');
      values.push(data.page_title);
    }
    if (data.page_subtitle !== undefined) {
      fields.push('page_subtitle = ?');
      values.push(data.page_subtitle);
    }
    if (data.logo_url !== undefined) {
      fields.push('logo_url = ?');
      values.push(data.logo_url);
    }
    if (data.favicon_url !== undefined) {
      fields.push('favicon_url = ?');
      values.push(data.favicon_url);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE config SET ${fields.join(', ')} WHERE id = 1`;
    return db.prepare(sql).run(...values);
  },

  getNavConfig: () => {
    const cfg = db.prepare('SELECT nav_config FROM config WHERE id = 1').get();
    if (!cfg || !cfg.nav_config) {
      return { show_claims: true, show_unpack: true, show_story: true };
    }
    try {
      return JSON.parse(cfg.nav_config);
    } catch {
      return { show_claims: true, show_unpack: true, show_story: true };
    }
  },

  updateNavConfig: (navConfig) => {
    const stmt = db.prepare(`
      UPDATE config
      SET nav_config = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);
    return stmt.run(JSON.stringify(navConfig));
  }
};

// Claims methods
const claims = {
  add: (wallet_account, template_id, reward_template, transaction_id, cooldown_hours, reward_id = null) => {
    const stmt = db.prepare(`
      INSERT INTO claims (wallet_account, template_id, reward_template, transaction_id, next_claim_at, reward_id)
      VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' hours'), ?)
    `);
    return stmt.run(wallet_account, template_id, reward_template, transaction_id, cooldown_hours, reward_id);
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
        reward_id,
        MAX(next_claim_at) as next_claim_at,
        MAX(claimed_at) as last_claimed_at
      FROM claims
      WHERE wallet_account = ?
      GROUP BY template_id, reward_id
    `).all(wallet_account);
  },

  canClaim: (wallet_account, template_id, reward_id = null) => {
    let query, params;

    if (reward_id) {
      query = `
        SELECT next_claim_at
        FROM claims
        WHERE wallet_account = ? AND template_id = ? AND reward_id = ?
        ORDER BY next_claim_at DESC
        LIMIT 1
      `;
      params = [wallet_account, template_id, reward_id];
    } else {
      // Legacy support: check without reward_id
      query = `
        SELECT next_claim_at
        FROM claims
        WHERE wallet_account = ? AND template_id = ? AND (reward_id IS NULL OR reward_id = ?)
        ORDER BY next_claim_at DESC
        LIMIT 1
      `;
      params = [wallet_account, template_id, reward_id];
    }

    const result = db.prepare(query).get(...params);

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

// Template Rewards methods (multiple rewards per template)
const templateRewards = {
  getAll: () => {
    return db.prepare('SELECT * FROM template_rewards ORDER BY template_id, id ASC').all();
  },

  getByTemplateId: (template_id) => {
    return db.prepare('SELECT * FROM template_rewards WHERE template_id = ? ORDER BY id ASC').all(template_id);
  },

  getEnabledByTemplateId: (template_id) => {
    return db.prepare('SELECT * FROM template_rewards WHERE template_id = ? AND enabled = 1 ORDER BY id ASC').all(template_id);
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM template_rewards WHERE id = ?').get(id);
  },

  add: (template_id, reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity) => {
    const stmt = db.prepare(`
      INSERT INTO template_rewards (template_id, reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity, enabled)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    return stmt.run(template_id, reward_template_id, reward_name, cooldown_hours, max_claims, match_quantity ? 1 : 0);
  },

  update: (id, data) => {
    const stmt = db.prepare(`
      UPDATE template_rewards
      SET reward_template_id = ?,
          reward_name = ?,
          cooldown_hours = ?,
          max_claims = ?,
          match_quantity = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      data.reward_template_id,
      data.reward_name,
      data.cooldown_hours,
      data.max_claims,
      data.match_quantity ? 1 : 0,
      data.enabled,
      id
    );
  },

  delete: (id) => {
    return db.prepare('DELETE FROM template_rewards WHERE id = ?').run(id);
  },

  enable: (id) => {
    return db.prepare('UPDATE template_rewards SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  disable: (id) => {
    return db.prepare('UPDATE template_rewards SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  // Get all rewards across all enabled templates (for eligibility checking)
  getAllEnabled: () => {
    return db.prepare(`
      SELECT tr.*, t.name as template_name
      FROM template_rewards tr
      JOIN templates t ON tr.template_id = t.template_id
      WHERE tr.enabled = 1 AND t.enabled = 1
      ORDER BY tr.template_id, tr.id ASC
    `).all();
  }
};

// Workflow Steps methods
const workflowSteps = {
  getAll: () => {
    return db.prepare('SELECT * FROM workflow_steps ORDER BY step_order ASC').all();
  },

  getEnabled: () => {
    return db.prepare('SELECT * FROM workflow_steps WHERE enabled = 1 ORDER BY step_order ASC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM workflow_steps WHERE id = ?').get(id);
  },

  add: (step_order, name, description) => {
    const stmt = db.prepare(`
      INSERT INTO workflow_steps (step_order, name, description, enabled)
      VALUES (?, ?, ?, 1)
    `);
    return stmt.run(step_order, name, description);
  },

  update: (id, data) => {
    const stmt = db.prepare(`
      UPDATE workflow_steps
      SET step_order = ?,
          name = ?,
          description = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(data.step_order, data.name, data.description, data.enabled, id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM workflow_steps WHERE id = ?').run(id);
  },

  enable: (id) => {
    return db.prepare('UPDATE workflow_steps SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  disable: (id) => {
    return db.prepare('UPDATE workflow_steps SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }
};

// Workflow Actions methods
const workflowActions = {
  getAll: () => {
    return db.prepare('SELECT * FROM workflow_actions ORDER BY step_id, action_order ASC').all();
  },

  getByStepId: (step_id) => {
    return db.prepare('SELECT * FROM workflow_actions WHERE step_id = ? ORDER BY action_order ASC').all(step_id);
  },

  getEnabledByStepId: (step_id) => {
    return db.prepare('SELECT * FROM workflow_actions WHERE step_id = ? AND enabled = 1 ORDER BY action_order ASC').all(step_id);
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM workflow_actions WHERE id = ?').get(id);
  },

  add: (step_id, action_order, action_type, name, description, config) => {
    const stmt = db.prepare(`
      INSERT INTO workflow_actions (step_id, action_order, action_type, name, description, config, enabled)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    return stmt.run(step_id, action_order, action_type, name, description, config);
  },

  update: (id, data) => {
    const stmt = db.prepare(`
      UPDATE workflow_actions
      SET step_id = ?,
          action_order = ?,
          action_type = ?,
          name = ?,
          description = ?,
          config = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      data.step_id,
      data.action_order,
      data.action_type,
      data.name,
      data.description,
      data.config,
      data.enabled,
      id
    );
  },

  delete: (id) => {
    return db.prepare('DELETE FROM workflow_actions WHERE id = ?').run(id);
  }
};

// Workflow Conditions methods
const workflowConditions = {
  getByActionId: (action_id) => {
    return db.prepare('SELECT * FROM workflow_conditions WHERE action_id = ?').all(action_id);
  },

  add: (action_id, condition_type, condition_data) => {
    const stmt = db.prepare(`
      INSERT INTO workflow_conditions (action_id, condition_type, condition_data)
      VALUES (?, ?, ?)
    `);
    return stmt.run(action_id, condition_type, condition_data);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM workflow_conditions WHERE id = ?').run(id);
  },

  deleteByActionId: (action_id) => {
    return db.prepare('DELETE FROM workflow_conditions WHERE action_id = ?').run(action_id);
  }
};

// User Workflow Progress methods
const userWorkflowProgress = {
  getByAccount: (wallet_account) => {
    return db.prepare('SELECT * FROM user_workflow_progress WHERE wallet_account = ? ORDER BY completed_at DESC').all(wallet_account);
  },

  getCompletedActions: (wallet_account) => {
    return db.prepare('SELECT DISTINCT action_id FROM user_workflow_progress WHERE wallet_account = ?').all(wallet_account);
  },

  hasCompletedAction: (wallet_account, action_id) => {
    const result = db.prepare('SELECT COUNT(*) as count FROM user_workflow_progress WHERE wallet_account = ? AND action_id = ?').get(wallet_account, action_id);
    return result.count > 0;
  },

  add: (wallet_account, action_id, transaction_id, result_data) => {
    const stmt = db.prepare(`
      INSERT INTO user_workflow_progress (wallet_account, action_id, transaction_id, result_data)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(wallet_account, action_id, transaction_id, result_data);
  },

  // Get user's current progress with full workflow context
  getProgressWithContext: (wallet_account) => {
    return db.prepare(`
      SELECT
        ws.id as step_id,
        ws.step_order,
        ws.name as step_name,
        ws.description as step_description,
        wa.id as action_id,
        wa.action_order,
        wa.action_type,
        wa.name as action_name,
        wa.description as action_description,
        wa.config as action_config,
        uwp.id as progress_id,
        uwp.completed_at,
        uwp.transaction_id,
        uwp.result_data
      FROM workflow_steps ws
      JOIN workflow_actions wa ON ws.id = wa.step_id
      LEFT JOIN user_workflow_progress uwp ON wa.id = uwp.action_id AND uwp.wallet_account = ?
      WHERE ws.enabled = 1 AND wa.enabled = 1
      ORDER BY ws.step_order ASC, wa.action_order ASC
    `).all(wallet_account);
  }
};

// Blend cache methods
const blendCache = {
  // Get cached blend data
  get: (blend_id) => {
    const row = db.prepare('SELECT * FROM blend_cache WHERE blend_id = ?').get(blend_id);
    if (row) {
      return {
        blend_id: row.blend_id,
        blend_data: JSON.parse(row.blend_data),
        fetched_at: row.fetched_at
      };
    }
    return null;
  },

  // Get multiple cached blends
  getMultiple: (blend_ids) => {
    if (!Array.isArray(blend_ids) || blend_ids.length === 0) return [];

    const placeholders = blend_ids.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM blend_cache WHERE blend_id IN (${placeholders})`);
    const rows = stmt.all(...blend_ids);

    return rows.map(row => ({
      blend_id: row.blend_id,
      blend_data: JSON.parse(row.blend_data),
      fetched_at: row.fetched_at
    }));
  },

  // Set (upsert) blend data
  set: (blend_id, blend_data) => {
    const stmt = db.prepare(`
      INSERT INTO blend_cache (blend_id, blend_data, fetched_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(blend_id) DO UPDATE SET
        blend_data = excluded.blend_data,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(blend_id, JSON.stringify(blend_data));
  },

  // Set multiple blends at once
  setMultiple: (blends) => {
    const stmt = db.prepare(`
      INSERT INTO blend_cache (blend_id, blend_data, fetched_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(blend_id) DO UPDATE SET
        blend_data = excluded.blend_data,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction((blendsToCache) => {
      for (const blend of blendsToCache) {
        stmt.run(blend.blend_id, JSON.stringify(blend));
      }
    });

    transaction(blends);
  },

  // Clear specific blend from cache
  clear: (blend_id) => {
    return db.prepare('DELETE FROM blend_cache WHERE blend_id = ?').run(blend_id);
  },

  // Clear all cached blends
  clearAll: () => {
    return db.prepare('DELETE FROM blend_cache').run();
  }
};

const storyTabs = {
  getAll: () => {
    return db.prepare('SELECT * FROM story_tabs ORDER BY tab_order ASC').all();
  },

  getEnabled: () => {
    return db.prepare('SELECT * FROM story_tabs WHERE enabled = 1 ORDER BY tab_order ASC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM story_tabs WHERE id = ?').get(id);
  },

  add: (tab_order, tab_name, tab_icon) => {
    const stmt = db.prepare(`
      INSERT INTO story_tabs (tab_order, tab_name, tab_icon, enabled)
      VALUES (?, ?, ?, 1)
    `);
    return stmt.run(tab_order, tab_name, tab_icon);
  },

  update: (id, data) => {
    const stmt = db.prepare(`
      UPDATE story_tabs
      SET tab_order = ?,
          tab_name = ?,
          tab_icon = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(data.tab_order, data.tab_name, data.tab_icon, data.enabled, id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM story_tabs WHERE id = ?').run(id);
  },

  enable: (id) => {
    return db.prepare('UPDATE story_tabs SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  disable: (id) => {
    return db.prepare('UPDATE story_tabs SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }
};

// Blend recipes management (cached blend configurations)
const blendRecipes = {
  // Get a single blend recipe by ID
  get: (blend_id) => {
    const row = db.prepare('SELECT * FROM blend_recipes WHERE blend_id = ?').get(blend_id);
    if (row) {
      return {
        blend_id: row.blend_id,
        collection_name: row.collection_name,
        contract_name: row.contract_name,
        ingredients: JSON.parse(row.ingredients),
        display_data: row.display_data ? JSON.parse(row.display_data) : null,
        fetched_at: row.fetched_at
      };
    }
    return null;
  },

  // Get multiple blend recipes by IDs
  getMultiple: (blend_ids) => {
    if (!Array.isArray(blend_ids) || blend_ids.length === 0) return [];
    const placeholders = blend_ids.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM blend_recipes WHERE blend_id IN (${placeholders})`);
    const rows = stmt.all(...blend_ids);
    return rows.map(row => ({
      blend_id: row.blend_id,
      collection_name: row.collection_name,
      contract_name: row.contract_name,
      ingredients: JSON.parse(row.ingredients),
      display_data: row.display_data ? JSON.parse(row.display_data) : null,
      fetched_at: row.fetched_at
    }));
  },

  // Get all blend recipes for a collection
  getByCollection: (collection_name) => {
    const rows = db.prepare('SELECT * FROM blend_recipes WHERE collection_name = ?').all(collection_name);
    return rows.map(row => ({
      blend_id: row.blend_id,
      collection_name: row.collection_name,
      contract_name: row.contract_name,
      ingredients: JSON.parse(row.ingredients),
      display_data: row.display_data ? JSON.parse(row.display_data) : null,
      fetched_at: row.fetched_at
    }));
  },

  // Save or update blend recipes
  setMultiple: (recipes) => {
    const stmt = db.prepare(`
      INSERT INTO blend_recipes (blend_id, collection_name, contract_name, ingredients, display_data, fetched_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(blend_id) DO UPDATE SET
        collection_name = excluded.collection_name,
        contract_name = excluded.contract_name,
        ingredients = excluded.ingredients,
        display_data = excluded.display_data,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction((recipesToCache) => {
      for (const recipe of recipesToCache) {
        stmt.run(
          recipe.blend_id,
          recipe.collection_name || 'futuresrelic',
          recipe.contract_name || 'blend.nefty',
          JSON.stringify(recipe.ingredients),
          recipe.display_data ? JSON.stringify(recipe.display_data) : null
        );
      }
    });

    transaction(recipes);
  },

  // Clear specific blend recipe
  clear: (blend_id) => {
    return db.prepare('DELETE FROM blend_recipes WHERE blend_id = ?').run(blend_id);
  },

  // Clear all blend recipes for a collection
  clearCollection: (collection_name) => {
    return db.prepare('DELETE FROM blend_recipes WHERE collection_name = ?').run(collection_name);
  },

  // Clear all blend recipes
  clearAll: () => {
    return db.prepare('DELETE FROM blend_recipes').run();
  }
};

// Craft recipes management
const craftRecipes = {
  // Get all recipes
  getAll: () => {
    return db.prepare(`
      SELECT * FROM craft_recipes ORDER BY id ASC
    `).all();
  },

  // Get single recipe by ID
  getById: (id) => {
    const recipe = db.prepare('SELECT * FROM craft_recipes WHERE id = ?').get(id);
    if (recipe) {
      recipe.ingredients = JSON.parse(recipe.ingredients);
      recipe.results = JSON.parse(recipe.results);
      recipe.pool_ingredients = recipe.pool_ingredients ? JSON.parse(recipe.pool_ingredients) : null;
    }
    return recipe;
  },

  // Get enabled recipes only
  getEnabled: () => {
    const recipes = db.prepare('SELECT * FROM craft_recipes WHERE enabled = 1 ORDER BY id ASC').all();
    return recipes.map(recipe => ({
      ...recipe,
      ingredients: JSON.parse(recipe.ingredients),
      results: JSON.parse(recipe.results),
      pool_ingredients: recipe.pool_ingredients ? JSON.parse(recipe.pool_ingredients) : null
    }));
  },

  // Create new recipe
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO craft_recipes
      (name, description, category, transfer_to_wallet, ingredients, results, max_batch_multiplier, cooldown_hours, cooldown_enabled, enabled, pool_mode_enabled, pool_wallet, pool_ingredients)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.description || null,
      data.category || 'Uncategorized',
      data.transfer_to_wallet || 'futuresrelic',
      JSON.stringify(data.ingredients),
      JSON.stringify(data.results),
      data.max_batch_multiplier || 1,
      data.cooldown_hours || null,
      data.cooldown_enabled ? 1 : 0,
      data.enabled ? 1 : 0,
      data.pool_mode_enabled ? 1 : 0,
      data.pool_wallet || null,
      data.pool_ingredients ? JSON.stringify(data.pool_ingredients) : null
    );

    return result.lastInsertRowid;
  },

  // Update recipe
  update: (id, data) => {
    const stmt = db.prepare(`
      UPDATE craft_recipes
      SET name = ?,
          description = ?,
          category = ?,
          transfer_to_wallet = ?,
          ingredients = ?,
          results = ?,
          max_batch_multiplier = ?,
          cooldown_hours = ?,
          cooldown_enabled = ?,
          enabled = ?,
          pool_mode_enabled = ?,
          pool_wallet = ?,
          pool_ingredients = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(
      data.name,
      data.description || null,
      data.category || 'Uncategorized',
      data.transfer_to_wallet || 'futuresrelic',
      JSON.stringify(data.ingredients),
      JSON.stringify(data.results),
      data.max_batch_multiplier || 1,
      data.cooldown_hours || null,
      data.cooldown_enabled ? 1 : 0,
      data.enabled ? 1 : 0,
      data.pool_mode_enabled ? 1 : 0,
      data.pool_wallet || null,
      data.pool_ingredients ? JSON.stringify(data.pool_ingredients) : null,
      id
    );
  },

  // Delete recipe
  delete: (id) => {
    return db.prepare('DELETE FROM craft_recipes WHERE id = ?').run(id);
  },

  // Get recipe stats (total crafts)
  getStats: (id) => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_crafts,
        SUM(batch_count) as total_items_crafted,
        COUNT(DISTINCT user_wallet) as unique_crafters
      FROM craft_history
      WHERE recipe_id = ? AND status = 'completed'
    `).get(id);

    return stats;
  }
};

// Craft history management
const craftHistory = {
  // Get all history
  getAll: (limit = 100) => {
    return db.prepare(`
      SELECT
        ch.*,
        cr.name as recipe_name
      FROM craft_history ch
      LEFT JOIN craft_recipes cr ON ch.recipe_id = cr.id
      ORDER BY ch.crafted_at DESC
      LIMIT ?
    `).all(limit);
  },

  // Get history for specific user
  getByUser: (wallet, limit = 50) => {
    const history = db.prepare(`
      SELECT
        ch.*,
        cr.name as recipe_name,
        cr.description as recipe_description
      FROM craft_history ch
      LEFT JOIN craft_recipes cr ON ch.recipe_id = cr.id
      WHERE ch.user_wallet = ?
      ORDER BY ch.crafted_at DESC
      LIMIT ?
    `).all(wallet, limit);

    return history.map(record => ({
      ...record,
      ingredient_asset_ids: JSON.parse(record.ingredient_asset_ids),
      result_info: record.result_info ? JSON.parse(record.result_info) : null
    }));
  },

  // Get by transaction ID
  getByTransactionId: (transfer_tx_id) => {
    const record = db.prepare(`
      SELECT * FROM craft_history WHERE transfer_transaction_id = ?
    `).get(transfer_tx_id);

    if (record) {
      record.ingredient_asset_ids = JSON.parse(record.ingredient_asset_ids);
      record.result_info = record.result_info ? JSON.parse(record.result_info) : null;
    }

    return record;
  },

  // Get last craft for user + recipe (for cooldown check)
  getLastCraft: (wallet, recipe_id) => {
    return db.prepare(`
      SELECT * FROM craft_history
      WHERE user_wallet = ? AND recipe_id = ? AND status = 'completed'
      ORDER BY crafted_at DESC
      LIMIT 1
    `).get(wallet, recipe_id);
  },

  // Create craft record
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO craft_history
      (recipe_id, user_wallet, batch_count, transfer_transaction_id, ingredient_asset_ids, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.recipe_id,
      data.user_wallet,
      data.batch_count || 1,
      data.transfer_transaction_id,
      JSON.stringify(data.ingredient_asset_ids),
      data.status || 'pending_mint'
    );

    return result.lastInsertRowid;
  },

  // Update craft record
  update: (id, data) => {
    const updates = [];
    const values = [];

    if (data.mint_transaction_id !== undefined) {
      updates.push('mint_transaction_id = ?');
      values.push(data.mint_transaction_id);
    }

    if (data.result_info !== undefined) {
      updates.push('result_info = ?');
      values.push(JSON.stringify(data.result_info));
    }

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (data.error_message !== undefined) {
      updates.push('error_message = ?');
      values.push(data.error_message);
    }

    if (updates.length === 0) return null;

    values.push(id);
    const stmt = db.prepare(`
      UPDATE craft_history SET ${updates.join(', ')} WHERE id = ?
    `);

    return stmt.run(...values);
  },

  // Get failed crafts (for admin refund management)
  getFailed: (limit = 50) => {
    const failed = db.prepare(`
      SELECT
        ch.*,
        cr.name as recipe_name
      FROM craft_history ch
      LEFT JOIN craft_recipes cr ON ch.recipe_id = cr.id
      WHERE ch.status = 'failed'
      ORDER BY ch.crafted_at DESC
      LIMIT ?
    `).all(limit);

    return failed.map(record => ({
      ...record,
      ingredient_asset_ids: JSON.parse(record.ingredient_asset_ids),
      result_info: record.result_info ? JSON.parse(record.result_info) : null
    }));
  },

  // Delete craft record
  delete: (id) => {
    return db.prepare('DELETE FROM craft_history WHERE id = ?').run(id);
  }
};

// ========================================
// Scheduled Actions
// ========================================

const scheduledActions = {
  // Get all scheduled actions
  getAll: (limit = 100) => {
    const actions = db.prepare(`
      SELECT * FROM scheduled_actions
      ORDER BY execution_time ASC
      LIMIT ?
    `).all(limit);

    return actions.map(action => ({
      ...action,
      action_params: JSON.parse(action.action_params)
    }));
  },

  // Get pending actions (ready to execute)
  getPending: () => {
    const now = new Date().toISOString();
    const actions = db.prepare(`
      SELECT * FROM scheduled_actions
      WHERE status = 'pending' AND execution_time <= ?
      ORDER BY execution_time ASC
    `).all(now);

    return actions.map(action => ({
      ...action,
      action_params: JSON.parse(action.action_params)
    }));
  },

  // Get by ID
  getById: (id) => {
    const action = db.prepare('SELECT * FROM scheduled_actions WHERE id = ?').get(id);
    if (action) {
      action.action_params = JSON.parse(action.action_params);
    }
    return action;
  },

  // Get by status
  getByStatus: (status, limit = 50) => {
    const actions = db.prepare(`
      SELECT * FROM scheduled_actions
      WHERE status = ?
      ORDER BY execution_time DESC
      LIMIT ?
    `).all(status, limit);

    return actions.map(action => ({
      ...action,
      action_params: JSON.parse(action.action_params)
    }));
  },

  // Create scheduled action
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO scheduled_actions
      (name, action_type, action_params, execution_time, created_by, status, is_recurring, recurrence_interval_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.action_type,
      JSON.stringify(data.action_params),
      data.execution_time,
      data.created_by || null,
      data.status || 'pending',
      data.is_recurring ? 1 : 0,
      data.recurrence_interval_minutes || null
    );

    return result.lastInsertRowid;
  },

  // Update action
  update: (id, data) => {
    const updates = [];
    const values = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (data.executed_at !== undefined) {
      updates.push('executed_at = ?');
      values.push(data.executed_at);
    }

    if (data.execution_time !== undefined) {
      updates.push('execution_time = ?');
      values.push(data.execution_time);
    }

    if (data.last_executed_at !== undefined) {
      updates.push('last_executed_at = ?');
      values.push(data.last_executed_at);
    }

    if (data.error_message !== undefined) {
      updates.push('error_message = ?');
      values.push(data.error_message);
    }

    if (updates.length === 0) return null;

    values.push(id);
    const stmt = db.prepare(`
      UPDATE scheduled_actions SET ${updates.join(', ')} WHERE id = ?
    `);

    return stmt.run(...values);
  },

  // Cancel action
  cancel: (id) => {
    return db.prepare(`
      UPDATE scheduled_actions SET status = 'cancelled' WHERE id = ? AND status = 'pending'
    `).run(id);
  },

  // Delete action
  delete: (id) => {
    return db.prepare('DELETE FROM scheduled_actions WHERE id = ?').run(id);
  }
};

// ========================================
// Action Executions (History Log)
// ========================================

const actionExecutions = {
  // Get execution history for action
  getByAction: (action_id) => {
    const executions = db.prepare(`
      SELECT * FROM action_executions
      WHERE action_id = ?
      ORDER BY executed_at DESC
    `).all(action_id);

    return executions.map(exec => ({
      ...exec,
      result_data: exec.result_data ? JSON.parse(exec.result_data) : null
    }));
  },

  // Get all executions
  getAll: (limit = 100) => {
    const executions = db.prepare(`
      SELECT
        ae.*,
        sa.name as action_name,
        sa.action_type
      FROM action_executions ae
      LEFT JOIN scheduled_actions sa ON ae.action_id = sa.id
      ORDER BY ae.executed_at DESC
      LIMIT ?
    `).all(limit);

    return executions.map(exec => ({
      ...exec,
      result_data: exec.result_data ? JSON.parse(exec.result_data) : null
    }));
  },

  // Create execution log
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO action_executions
      (action_id, status, transaction_id, result_data, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.action_id,
      data.status,
      data.transaction_id || null,
      data.result_data ? JSON.stringify(data.result_data) : null,
      data.error_message || null
    );

    return result.lastInsertRowid;
  },

  // Delete execution log
  delete: (id) => {
    return db.prepare('DELETE FROM action_executions WHERE id = ?').run(id);
  }
};

module.exports = {
  db,
  config,
  claims,
  admin,
  templates,
  templateRewards,
  workflowSteps,
  workflowActions,
  workflowConditions,
  userWorkflowProgress,
  blendCache,
  blendRecipes,
  storyTabs,
  craftRecipes,
  craftHistory,
  scheduledActions,
  actionExecutions
};
