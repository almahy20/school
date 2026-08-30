const sharp = require('sharp');
const path = require('path');

const inputFile = path.join(__dirname, '../public/icons/IMG-20260415-WA0007.jpg');
const outputDir = path.join(__dirname, '../public/icons');

const sizes = [72, 96, 128, 144, 192, 256, 384, 512];

async function generateIcons() {
  console.log('Reading source logo and trimming black borders...');

  // Use sharp trim to remove black borders (threshold 30 to catch near-black pixels)
  const trimmedBuffer = await sharp(inputFile)
    .trim({ background: '#000000', threshold: 30 })
    .toBuffer();

  console.log('✅ Black borders removed');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    await sharp(trimmedBuffer)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(outputPath);
    console.log(`✅ icon-${size}x${size}.png`);
  }

  // badge-72
  await sharp(trimmedBuffer)
    .resize(72, 72, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(path.join(outputDir, 'badge-72.png'));
  console.log(`✅ badge-72.png`);

  console.log('\n🎉 All icons generated without black borders!');
}

generateIcons().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
