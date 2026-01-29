#!/usr/bin/env node

/**
 * Generate PWA icons from favicon.ico or database logo/favicon
 * This script can be run standalone or called via the API
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generatePWAIcons() {
  try {
    const iconsDir = path.join(__dirname, 'public', 'icons');

    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
      console.log('✅ Created icons directory');
    }

    // Try to find source image
    let sourceBuffer;
    let sourceName = 'unknown';

    // Option 1: Check for uploaded logo first
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const imageFiles = files.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
      if (imageFiles.length > 0) {
        const logoPath = path.join(uploadsDir, imageFiles[0]);
        sourceBuffer = fs.readFileSync(logoPath);
        sourceName = imageFiles[0];
        console.log(`📸 Using uploaded logo: ${sourceName}`);
      }
    }

    // Option 2: Try favicon.ico (convert from ICO format)
    if (!sourceBuffer) {
      const faviconPath = path.join(__dirname, 'favicon.ico');
      if (fs.existsSync(faviconPath)) {
        try {
          // Sharp can handle ICO files but we need to specify the format
          const icoBuffer = fs.readFileSync(faviconPath);
          // Convert to PNG first to ensure compatibility
          const pngBuffer = await sharp(icoBuffer).png().toBuffer();
          sourceBuffer = pngBuffer;
          sourceName = 'favicon.ico (converted to PNG)';
          console.log('📸 Using favicon.ico as source');
        } catch (error) {
          console.warn(`⚠️  Could not process favicon.ico: ${error.message}`);
        }
      }
    }

    // Option 3: Create a simple default icon
    if (!sourceBuffer) {
      console.log('📸 Creating default icon...');
      // Create a simple 512x512 gradient icon as default
      sourceBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 16, g: 185, b: 129, alpha: 1 }
        }
      })
      .png()
      .toBuffer();
      sourceName = 'default gradient (generated)';
    }

    if (!sourceBuffer) {
      console.error('❌ Failed to create source image!');
      process.exit(1);
    }

    // PWA icon sizes
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

    console.log(`🎨 Generating ${sizes.length} PWA icons from ${sourceName}...\n`);

    for (const size of sizes) {
      const filename = `icon-${size}x${size}.png`;
      const outputPath = path.join(iconsDir, filename);

      await sharp(sourceBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`   ✅ Generated ${filename} (${size}x${size}px)`);
    }

    console.log(`\n🎉 Successfully generated ${sizes.length} PWA icons in /public/icons/`);
    console.log('📱 Your app is now ready to be installed as a PWA!\n');

  } catch (error) {
    console.error('❌ Error generating PWA icons:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  generatePWAIcons();
}

module.exports = { generatePWAIcons };
