const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/icons/IMG-20260415-WA0007.jpg');
const resDir = path.join(__dirname, '../android/app/src/main/res');
const publicIconsDir = path.join(__dirname, '../public/icons');

const BG_COLOR = '#020C54';
const BG_RGB = { r: 2, g: 12, b: 84, alpha: 1 };

async function generateAllPaddedIcons() {
  console.log('Generating perfected icons with exact branding color...');

  // Trim black borders from the original photo
  const trimmed = await sharp(inputFile)
    .trim({ background: '#000000', threshold: 35 })
    .toBuffer();

  // 1. Update ic_launcher_background.xml
  const bgXmlPath = path.join(resDir, 'values/ic_launcher_background.xml');
  const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG_COLOR}</color>
</resources>
`;
  fs.writeFileSync(bgXmlPath, bgXmlContent, 'utf8');
  console.log(`✅ Updated ic_launcher_background.xml to ${BG_COLOR}`);

  // 2. Generate PWA Web Icons
  const pwaSizes = [72, 96, 128, 144, 192, 256, 384, 512];
  for (const s of pwaSizes) {
    const innerSize = Math.round(s * 0.90);
    const resized = await sharp(trimmed)
      .resize(innerSize, innerSize, { fit: 'contain', background: BG_RGB })
      .toBuffer();

    await sharp({
      create: { width: s, height: s, channels: 4, background: BG_RGB }
    })
      .composite([{ input: resized, gravity: 'center' }])
      .png()
      .toFile(path.join(publicIconsDir, `icon-${s}x${s}.png`));
  }
  await sharp(trimmed).resize(72, 72, { fit: 'contain', background: BG_RGB }).png().toFile(path.join(publicIconsDir, 'badge-72.png'));
  console.log('✅ Updated PWA icons');

  // 3. Generate Android Native Mipmap Icons
  // Safe zone for Android Adaptive icons: foreground layer must have at least 25% padding so circular masks never crop the graphics/text!
  const mipmaps = [
    { folder: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { folder: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { folder: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { folder: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
  ];

  for (const m of mipmaps) {
    const targetFolder = path.join(resDir, m.folder);
    if (!fs.existsSync(targetFolder)) continue;

    // Legacy standard icon (ic_launcher.png & ic_launcher_round.png)
    const legacyInner = Math.round(m.size * 0.85);
    const legacyResized = await sharp(trimmed)
      .resize(legacyInner, legacyInner, { fit: 'contain', background: BG_RGB })
      .toBuffer();
    
    await sharp({
      create: { width: m.size, height: m.size, channels: 4, background: BG_RGB }
    })
      .composite([{ input: legacyResized, gravity: 'center' }])
      .png()
      .toFile(path.join(targetFolder, 'ic_launcher.png'));

    await sharp({
      create: { width: m.size, height: m.size, channels: 4, background: BG_RGB }
    })
      .composite([{ input: legacyResized, gravity: 'center' }])
      .png()
      .toFile(path.join(targetFolder, 'ic_launcher_round.png'));

    // Adaptive Foreground icon (ic_launcher_foreground.png)
    // The central safe zone diameter is 66% of fgSize. We make inner logo 54% of fgSize so it fits with great breathing room!
    const fgInner = Math.round(m.fgSize * 0.54);
    const fgResized = await sharp(trimmed)
      .resize(fgInner, fgInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: { width: m.fgSize, height: m.fgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: fgResized, gravity: 'center' }])
      .png()
      .toFile(path.join(targetFolder, 'ic_launcher_foreground.png'));

    console.log(`✅ Updated ${m.folder}`);
  }

  // 4. Generate Splash Screen Images
  const drawableFolders = [
    { folder: 'drawable', w: 480, h: 800 },
    { folder: 'drawable-port-hdpi', w: 480, h: 800 },
    { folder: 'drawable-port-mdpi', w: 320, h: 480 },
    { folder: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { folder: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  for (const d of drawableFolders) {
    const dFolder = path.join(resDir, d.folder);
    if (!fs.existsSync(dFolder)) continue;

    const logoW = Math.min(Math.round(d.w * 0.60), 450);
    const splashLogo = await sharp(trimmed)
      .resize(logoW, logoW, { fit: 'contain', background: BG_RGB })
      .toBuffer();

    await sharp({
      create: { width: d.w, height: d.h, channels: 4, background: BG_RGB }
    })
      .composite([{ input: splashLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(dFolder, 'splash.png'));
  }

  console.log('\n🎉 All icons and splash screens generated without zoom or cropping!');
}

generateAllPaddedIcons().catch(console.error);
