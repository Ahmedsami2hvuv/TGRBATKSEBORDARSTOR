const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

async function processImage() {
  const inputPath = "C:\\Users\\lenovo\\.gemini\\antigravity\\brain\\d647b812-b6b5-4a5a-8a00-36b3b2615b38\\update_order_btn_1789910414497.jpg";
  const outDir1 = path.join(__dirname, "../public/images/order-luxury");
  const outDir2 = path.join(__dirname, "../public/images");

  if (!fs.existsSync(outDir1)) fs.mkdirSync(outDir1, { recursive: true });
  if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });

  const outFile1 = path.join(outDir1, "ak-update-order-btn.webp");
  const outFile2 = path.join(outDir2, "ak-update-order-btn.webp");

  const size = 512;
  const radius = size / 2;

  // إنشاء قناع دائري ناعم لتفريغ الخلفية البيضاء تماماً
  const circleSvg = Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${radius}" cy="${radius}" r="${radius - 2}" fill="white" />
    </svg>
  `);

  console.log("Processing and converting image to WebP...");

  const processedBuffer = await sharp(inputPath)
    .resize(size, size, { fit: "cover" })
    .composite([
      {
        input: circleSvg,
        blend: "dest-in",
      },
    ])
    .webp({ quality: 90, effort: 6 })
    .toBuffer();

  fs.writeFileSync(outFile1, processedBuffer);
  fs.writeFileSync(outFile2, processedBuffer);

  const stats = fs.statSync(outFile1);
  console.log(`Success! File size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`Saved to: ${outFile1}`);
}

processImage().catch(console.error);
