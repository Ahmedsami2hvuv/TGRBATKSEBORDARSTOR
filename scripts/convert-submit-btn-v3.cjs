const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processNewBtn() {
  const inputPath = 'C:\\Users\\lenovo\\Downloads\\زر رفع الطلب الجديد.png';
  if (!fs.existsSync(inputPath)) {
    console.error('Input file not found:', inputPath);
    return;
  }

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  console.log('Original dimensions:', metadata.width, 'x', metadata.height);

  const { width, height } = metadata;
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const r = size * 0.485;

  const circleSvg = Buffer.from(
    `<svg width="${width}" height="${height}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" />
    </svg>`
  );

  const targetSize = 512;

  const out1 = path.join(process.cwd(), 'public', 'images', 'order-luxury', 'ak-submit-btn-v3.webp');
  const out2 = path.join(process.cwd(), 'public', 'images', 'ak-submit-btn-v3.webp');

  // خطوة 1: تطبيق القناع الدائري الناعم
  const maskedBuffer = await sharp(inputPath)
    .composite([{ input: circleSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // خطوة 2: تغيير الحجم إلى 512x512 والتحويل إلى WebP مضغوط عالي الجودة
  await sharp(maskedBuffer)
    .resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, effort: 6 })
    .toFile(out1);

  fs.copyFileSync(out1, out2);

  const stats = fs.statSync(out1);
  console.log(`Saved successfully! File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

processNewBtn().catch(err => console.error(err));
