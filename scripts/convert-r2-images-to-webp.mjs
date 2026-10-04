import "dotenv/config";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// تعطيل كاش sharp لتفادي استهلاك الذاكرة
sharp.cache(false);

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "kseb-storage";
const PROGRESS_FILE = path.join(process.cwd(), "scripts", "conversion-progress.json");

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    }
  } catch (e) {
    // ignore
  }
  return { completedKeys: {}, continuationToken: null, convertedCount: 0, savedBytes: 0 };
}

function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save progress:", e);
  }
}

async function convertImage(key) {
  const isJpg = /\.(jpg|jpeg)$/i.test(key);
  const isPng = /\.png$/i.test(key);
  if (!isJpg && !isPng) return null;

  const baseKey = key.replace(/\.(jpg|jpeg|png)$/i, "");
  const newKey = `${baseKey}.webp`;

  try {
    // 1. جلب الصورة القديمة
    const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    const chunks = [];
    for await (const chunk of getRes.Body) {
      chunks.push(chunk);
    }
    const origBuffer = Buffer.concat(chunks);
    const origSize = origBuffer.length;

    // 2. ضغط وتحويل إلى WebP
    let pipeline = sharp(origBuffer)
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      });

    if (isPng) {
      pipeline = pipeline.webp({ quality: 80, effort: 4, alphaQuality: 85 });
    } else {
      pipeline = pipeline.webp({ quality: 78, effort: 4 });
    }

    const webpBuffer = await pipeline.toBuffer();
    const newSize = webpBuffer.length;

    // 3. رفع النسخة الجديدة WebP
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: newKey,
      Body: webpBuffer,
      ContentType: "image/webp",
    }));

    // 4. حذف النسخة القديمة إذا كان المفتاح مختلفاً لتوفير المساحة
    if (key !== newKey) {
      await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }));
    }

    const saved = Math.max(0, origSize - newSize);
    return { origSize, newSize, saved, newKey };
  } catch (err) {
    console.error(`Error converting ${key}:`, err?.message || err);
    return null;
  }
}

async function startBatchConversion(batchLimit = 100) {
  console.log(`بدء تحويل دفعة من الصور إلى WebP (حد الدفعة: ${batchLimit})...`);
  const progress = loadProgress();

  let continuationToken = progress.continuationToken || undefined;
  let processedInThisRun = 0;
  let hasMore = true;

  while (hasMore && processedInThisRun < batchLimit) {
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
      MaxKeys: 200,
    }));

    const contents = listRes.Contents || [];
    for (const item of contents) {
      const key = item.Key;
      if (!key) continue;

      if (progress.completedKeys[key]) continue;

      if (/\.(jpg|jpeg|png)$/i.test(key)) {
        console.log(`[${processedInThisRun + 1}/${batchLimit}] جاري تحويل: ${key}`);
        const result = await convertImage(key);
        if (result) {
          progress.completedKeys[key] = true;
          progress.convertedCount = (progress.convertedCount || 0) + 1;
          progress.savedBytes = (progress.savedBytes || 0) + result.saved;
          console.log(` -> تم بنجاح! الحجم القديم: ${(result.origSize / 1024).toFixed(1)}KB | الجديد: ${(result.newSize / 1024).toFixed(1)}KB | وفرنا: ${(result.saved / 1024).toFixed(1)}KB`);
        }
        processedInThisRun++;
        if (processedInThisRun >= batchLimit) break;
      } else {
        progress.completedKeys[key] = true;
      }
    }

    continuationToken = listRes.NextContinuationToken;
    progress.continuationToken = continuationToken || null;
    saveProgress(progress);

    if (!continuationToken) {
      hasMore = false;
      console.log("اكتمل فحص جميع ملفات التخزين بالكامل!");
      break;
    }
  }

  console.log(`\nانتهت هذه الدفعة! إجمالي الصور المحولة حتى الآن: ${progress.convertedCount}`);
  console.log(`إجمالي المساحة الموفرة: ${(progress.savedBytes / (1024 * 1024)).toFixed(2)} MB`);
}

// تشغيل دفعة
const countArg = parseInt(process.argv[2] || "50", 10);
startBatchConversion(countArg).catch(console.error);
