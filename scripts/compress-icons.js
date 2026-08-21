const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Compress PWA icons
const icons = [
  { input: 'public/icons/badge-72.png', output: 'public/icons/badge-72.png', size: 72 },
];

async function compressIcons() {
  for (const icon of icons) {
    if (!fs.existsSync(icon.input)) {
      console.log(`Skipping ${icon.input} - file not found`);
      continue;
    }

    const originalSize = fs.statSync(icon.input).size;
    
    await sharp(icon.input)
      .resize(icon.size, icon.size)
      .png({ 
        quality: 80,
        compressionLevel: 9,
        palette: true,
        effort: 10
      })
      .toFile(icon.output);

    const newSize = fs.statSync(icon.output).size;
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    
    console.log(`${icon.output}: ${(originalSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB (${reduction}% reduction)`);
  }
}

compressIcons().catch(console.error);
