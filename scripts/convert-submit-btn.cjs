const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processBtn() {
  const inputPath = 'C:\\Users\\lenovo\\Downloads\\زر رزفع الطلب.png';
  if (!fs.existsSync(inputPath)) {
    console.error('File not found:', inputPath);
    return;
  }

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  console.log('Image dimensions:', metadata.width, 'x', metadata.height);

  const width = metadata.width;
  const height = metadata.height;
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const r = size * 0.485;

  const circleSvg = Buffer.from(
    `<svg width="${width}" height="${height}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" />
    </svg>`
  );

  const out1 = path.join(process.cwd(), 'public', 'images', 'order-luxury', 'ak-gold-submit-btn.webp');
  const out2 = path.join(process.cwd(), 'public', 'images', 'ak-gold-submit-btn.webp');

  await sharp(inputPath)
    .composite([{ input: circleSvg, blend: 'dest-in' }])
    .webp({ quality: 95, alphaQuality: 100 })
    .toFile(out1);

  fs.copyFileSync(out1, out2);
  console.log('Saved successfully to:', out1, 'and', out2);
}

processBtn().catch(err => console.error(err));
