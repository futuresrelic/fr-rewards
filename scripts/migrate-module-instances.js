#!/usr/bin/env node

/**
 * Database Migration: Add module_instances Table
 *
 * Purpose: Create table to store module configurations in database
 * instead of HTML data-config attributes
 *
 * Run: node scripts/migrate-module-instances.js
 */

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Database path
const dbPath = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'database.sqlite');

console.log('📂 Database:', dbPath);
console.log('🔄 Running module_instances migration...\n');

try {
  // Open database connection
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Check if table already exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='module_instances'
  `).get();

  if (tableExists) {
    console.log('⚠️  Table module_instances already exists');
    console.log('   Skipping creation...\n');
  } else {
    console.log('Step 1: Creating module_instances table...');

    // Create module_instances table
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

    console.log('✅ Table created\n');

    console.log('Step 2: Creating indexes...');

    // Create indexes for better query performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_module_instances_type
      ON module_instances(module_type);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_module_instances_page
      ON module_instances(page_path);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_module_instances_created
      ON module_instances(created_at DESC);
    `);

    console.log('✅ Indexes created\n');
  }

  // Display table info
  console.log('📊 Table Information:');
  const tableInfo = db.prepare(`PRAGMA table_info(module_instances)`).all();

  console.log('\nColumns:');
  tableInfo.forEach(col => {
    console.log(`   - ${col.name.padEnd(15)} ${col.type.padEnd(10)} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? '(PRIMARY KEY)' : ''}`);
  });

  // Display indexes
  console.log('\nIndexes:');
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND tbl_name='module_instances'
  `).all();

  indexes.forEach(idx => {
    console.log(`   - ${idx.name}`);
  });

  // Check current row count
  const count = db.prepare(`SELECT COUNT(*) as count FROM module_instances`).get();
  console.log(`\n📈 Current rows: ${count.count}`);

  // Insert sample data for testing (optional)
  if (count.count === 0 && process.argv.includes('--with-samples')) {
    console.log('\n🧪 Inserting sample data...');

    const insert = db.prepare(`
      INSERT INTO module_instances (id, module_type, config, page_path, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();

    // Sample Claim Rewards module
    insert.run(
      'mod_claim_sample1',
      'claim-rewards',
      JSON.stringify({
        collection: 'futuresrelic',
        auto_connect: true,
        title: 'Sample Rewards',
        verification_templates: [247050, 247051, 247052],
        rewards: [
          {
            reward_id: 1,
            template_id: 246504,
            name: 'Wax Seal',
            cooldown_hours: 48,
            quantity: 1,
            enabled: true
          }
        ]
      }),
      '/story/sample.html',
      'admin',
      now,
      now
    );

    // Sample Paid Claim module
    insert.run(
      'mod_paid_sample1',
      'paid-claim',
      JSON.stringify({
        template_id: '123456',
        template_name: 'Epic Sword',
        price_wax: '10.00000000',
        payment_wallet: 'futuresrelic',
        collection_name: 'futuresrelic',
        auto_connect: true
      }),
      '/story/sample.html',
      'admin',
      now,
      now
    );

    const newCount = db.prepare(`SELECT COUNT(*) as count FROM module_instances`).get();
    console.log(`✅ Inserted ${newCount.count} sample records`);
  }

  console.log('\n🎉 Migration completed successfully!\n');

  // Close database connection
  db.close();

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
