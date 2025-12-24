const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_FILE || './database.sqlite';
const db = new Database(dbPath);

console.log('🔄 Migrating database: Adding story tabs system...');

// Create story_tabs table
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

console.log('✅ story_tabs table created');

// Check if tab_id column exists in workflow_actions
const workflowActionsInfo = db.prepare('PRAGMA table_info(workflow_actions)').all();
const hasTabId = workflowActionsInfo.some(col => col.name === 'tab_id');

if (!hasTabId) {
  console.log('🔄 Adding tab_id column to workflow_actions...');
  db.exec(`ALTER TABLE workflow_actions ADD COLUMN tab_id INTEGER REFERENCES story_tabs(id) ON DELETE SET NULL`);
  console.log('✅ tab_id column added to workflow_actions');
} else {
  console.log('   tab_id column already exists in workflow_actions');
}

// Add navigation config to config table if it doesn't exist
const configTableInfo = db.prepare('PRAGMA table_info(config)').all();
const hasNavConfig = configTableInfo.some(col => col.name === 'nav_config');

if (!hasNavConfig) {
  console.log('🔄 Adding nav_config column to config table...');
  db.exec(`ALTER TABLE config ADD COLUMN nav_config TEXT DEFAULT '{"show_claims":true,"show_unpack":true,"show_story":true}'`);
  console.log('✅ nav_config column added to config table');
} else {
  console.log('   nav_config column already exists in config table');
}

// Create a default "All" tab if no tabs exist
const tabCount = db.prepare('SELECT COUNT(*) as count FROM story_tabs').get();

if (tabCount.count === 0) {
  console.log('🌱 Creating default story tab...');
  db.prepare(`
    INSERT INTO story_tabs (tab_order, tab_name, tab_icon, enabled)
    VALUES (1, 'All Actions', '📖', 1)
  `).run();
  console.log('✅ Default "All Actions" tab created');
}

// Display current tabs
const tabs = db.prepare('SELECT * FROM story_tabs WHERE enabled = 1 ORDER BY tab_order ASC').all();
console.log('\n📑 Active Story Tabs:');
tabs.forEach(t => {
  console.log(`   ${t.tab_order}. ${t.tab_icon} ${t.tab_name}`);
});

console.log('\n✅ Story tabs migration complete!');

db.close();
