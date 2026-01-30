#!/usr/bin/env node

/**
 * Migration: Custom Indexes System
 *
 * Creates tables for managing multiple custom indexes (like Story, Quests, Events)
 * where each index can have multiple phase pages with configurable content.
 *
 * Tables:
 * - custom_indexes: Top-level indexes (Story, Quests, etc.)
 * - custom_phases: Phase pages within each index
 * - custom_phase_content: Content blocks (modules) within each phase
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'fr-rewards.db');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

console.log('🚀 Starting Custom Indexes System migration...');

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  // 1. Create custom_indexes table
  console.log('📋 Creating custom_indexes table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_indexes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '📖',
      display_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_system INTEGER NOT NULL DEFAULT 0,
      nav_visible INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Create custom_phases table
  console.log('📄 Creating custom_phases table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      index_id INTEGER NOT NULL,
      phase_order INTEGER NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      preview_text TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (index_id) REFERENCES custom_indexes(id) ON DELETE CASCADE,
      UNIQUE(index_id, slug),
      UNIQUE(index_id, phase_order)
    )
  `);

  // 3. Create custom_phase_content table
  console.log('🎨 Creating custom_phase_content table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_phase_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_id INTEGER NOT NULL,
      content_order INTEGER NOT NULL,
      module_type TEXT NOT NULL,
      module_config TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phase_id) REFERENCES custom_phases(id) ON DELETE CASCADE,
      UNIQUE(phase_id, content_order)
    )
  `);

  // 4. Create indexes for better query performance
  console.log('⚡ Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_custom_indexes_enabled
      ON custom_indexes(enabled, display_order);

    CREATE INDEX IF NOT EXISTS idx_custom_indexes_slug
      ON custom_indexes(slug);

    CREATE INDEX IF NOT EXISTS idx_custom_phases_index
      ON custom_phases(index_id, phase_order);

    CREATE INDEX IF NOT EXISTS idx_custom_phases_slug
      ON custom_phases(index_id, slug);

    CREATE INDEX IF NOT EXISTS idx_custom_phase_content_phase
      ON custom_phase_content(phase_id, content_order);
  `);

  // 5. Insert default "Story" index (migrating existing story system)
  console.log('📚 Creating default Story index...');
  const existingStory = db.prepare('SELECT COUNT(*) as count FROM custom_indexes WHERE slug = ?').get('story');

  if (existingStory.count === 0) {
    db.prepare(`
      INSERT INTO custom_indexes (name, slug, title, description, icon, display_order, enabled, is_system, nav_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'story',
      'story',
      'Story Progression',
      'Follow the narrative and complete story phases',
      '📖',
      1,
      1,
      1, // is_system = true (cannot be deleted)
      1  // visible in navigation
    );

    const storyId = db.prepare('SELECT id FROM custom_indexes WHERE slug = ?').get('story').id;

    console.log('📝 Creating default story phases (example structure)...');
    // Create placeholder phases - admin can customize these
    const phases = [
      {
        order: 1,
        slug: 'phase-1',
        title: 'Phase 1: The Beginning',
        subtitle: 'Start your journey',
        preview: 'Begin your adventure in Future Relics.'
      },
      {
        order: 2,
        slug: 'phase-2',
        title: 'Phase 2: The Challenge',
        subtitle: 'Face new obstacles',
        preview: 'Continue your quest with new challenges.'
      }
    ];

    const insertPhase = db.prepare(`
      INSERT INTO custom_phases (index_id, phase_order, slug, title, subtitle, preview_text, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    phases.forEach(phase => {
      insertPhase.run(
        storyId,
        phase.order,
        phase.slug,
        phase.title,
        phase.subtitle,
        phase.preview,
        1
      );
    });

    console.log('✅ Default Story index created with sample phases');
    console.log('   Admin can now customize phases and add content in Site Builder');
  } else {
    console.log('ℹ️  Story index already exists, skipping default creation');
  }

  // Commit transaction
  db.exec('COMMIT');

  console.log('✅ Custom Indexes System migration completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log('   - custom_indexes: Manage multiple indexes (Story, Quests, etc.)');
  console.log('   - custom_phases: Define phase pages for each index');
  console.log('   - custom_phase_content: Add modules and content to each phase');
  console.log('');
  console.log('🎯 Next steps:');
  console.log('   1. Use Site Builder to manage indexes and phases');
  console.log('   2. Add custom indexes for Quests, Events, or any category');
  console.log('   3. Configure phase content with modules (NFT drops, crafting, etc.)');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Migration failed:', error.message);
  throw error;
} finally {
  db.close();
}
