const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.DATABASE_FILE || './database.sqlite';
const db = new Database(dbPath);

console.log('🔄 Migrating database for workflow system...');

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

console.log('✅ Created workflow_steps table');

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

console.log('✅ Created workflow_actions table');

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

console.log('✅ Created workflow_conditions table');

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

console.log('✅ Created user_workflow_progress table');

// Create indexes for user_workflow_progress
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_progress_wallet
  ON user_workflow_progress(wallet_account);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_progress_action
  ON user_workflow_progress(wallet_account, action_id);
`);

console.log('\n📋 Workflow System Database Schema:');
console.log('   - workflow_steps: Story progression steps');
console.log('   - workflow_actions: Actions within steps (CLAIM, UNPACK, BLEND, DROP, MARKET_SCOUT)');
console.log('   - workflow_conditions: IF-style conditions for actions');
console.log('   - user_workflow_progress: User completion tracking');

console.log('\n✅ Workflow system migration complete!');

db.close();
