const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const toCrc = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  chunk.writeUInt32BE(crc32(toCrc), 8 + len);
  return chunk;
}

function generateIconPNG(size) {
  // Create RGBA scanlines
  const rowBytes = 1 + size * 4; // 1 filter byte + RGBA pixels
  const rawData = Buffer.alloc(rowBytes * size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    rawData[rowStart] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background rounded squircle / circle
      // Violet gradient: #6366f1 (99, 102, 241) to #4338ca (67, 56, 202)
      const gradRatio = (x + y) / (size * 2);
      let r = Math.round(99 * (1 - gradRatio) + 67 * gradRatio);
      let g = Math.round(102 * (1 - gradRatio) + 56 * gradRatio);
      let b = Math.round(241 * (1 - gradRatio) + 202 * gradRatio);
      let a = 255;

      // Squircle corner smoothing
      const cornerR = size * 0.22;
      const inBoxX = Math.abs(dx) <= (cx - cornerR);
      const inBoxY = Math.abs(dy) <= (cy - cornerR);
      let inside = false;

      if (inBoxX || inBoxY) {
        inside = Math.abs(dx) <= (cx - 4) && Math.abs(dy) <= (cy - 4);
      } else {
        const cornerDist = Math.hypot(Math.abs(dx) - (cx - cornerR), Math.abs(dy) - (cy - cornerR));
        inside = cornerDist <= cornerR;
      }

      if (!inside) {
        // Outside the squircle
        r = 0; g = 0; b = 0; a = 0;
      } else {
        // Draw School Hat / Badge Icon in the center (White #ffffff)
        // Diamond/Cap top:
        const nx = (x - cx) / (size * 0.35);
        const ny = (y - cy + size * 0.05) / (size * 0.35);

        const inDiamond = (Math.abs(nx) + Math.abs(ny * 2.0)) <= 1.0 && ny <= 0.2 && ny >= -0.6;
        const inCapBase = Math.abs(nx) <= 0.55 && ny >= 0.15 && ny <= 0.55 && (nx * nx * 2 + (ny - 0.2) * (ny - 0.2) * 3) <= 0.7;
        const inTassel = nx >= 0.8 && nx <= 0.95 && ny >= -0.1 && ny <= 0.7;

        if (inDiamond || inCapBase || inTassel) {
          r = 255; g = 255; b = 255; a = 255;
        }
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  // Compress
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 192, 256, 384, 512];

sizes.forEach(size => {
  const pngBuf = generateIconPNG(size);
  const filename = `icon-${size}x${size}.png`;
  fs.writeFileSync(path.join(iconsDir, filename), pngBuf);
  console.log(`Generated: ${filename} (${pngBuf.length} bytes)`);
});

// Also overwrite legacy badge-72.png with valid png
fs.writeFileSync(path.join(iconsDir, 'badge-72.png'), generateIconPNG(72));
console.log('Successfully generated all PWA icons!');
