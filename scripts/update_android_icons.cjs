const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/icons/IMG-20260415-WA0007.jpg');
const resDir = path.join(__dirname, '../android/app/src/main/res');

const mipmaps = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 }
];

async function updateAndroidIcons() {
  if (!fs.existsSync(resDir)) return;

  const trimmed = await sharp(inputFile)
    .trim({ background: '#000000', threshold: 30 })
    .toBuffer();

  for (const m of mipmaps) {
    const targetDir = path.join(resDir, m.folder);
    if (fs.existsSync(targetDir)) {
      await sharp(trimmed).resize(m.size, m.size).png().toFile(path.join(targetDir, 'ic_launcher.png'));
      await sharp(trimmed).resize(m.size, m.size).png().toFile(path.join(targetDir, 'ic_launcher_round.png'));
      await sharp(trimmed).resize(m.size, m.size).png().toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
      console.log(`✅ Updated ${m.folder} (${m.size}x${m.size})`);
    }
  }

  console.log('🎉 Android Native Icons Updated Successfully!');
}

updateAndroidIcons().catch(console.error);
