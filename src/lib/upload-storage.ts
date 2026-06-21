// نستخدم الاستيرادات الديناميكية لتجنب مشاكل الـ Build مع Turbopack
export const BUCKET_NAME = process.env.R2_BUCKET_NAME || "";

export async function getS3Client() {
  if (typeof window !== 'undefined') return null;

  const { S3Client } = await import("@aws-sdk/client-s3");

  if (process.env.R2_ACCESS_KEY_ID && process.env.R2_ENDPOINT) {
    return new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return null;
}

export async function uploadToR2(buffer: Buffer, key: string, contentType: string, skipCompress = false) {
  if (!BUCKET_NAME) {
    console.error("R2_BUCKET_NAME is not defined");
    return null;
  }
  const r2Client = await getS3Client();
  if (!r2Client) return null;

  let finalBuffer = buffer;
  let finalContentType = contentType;

  // التحقق مما إذا كان الملف صورة وحجمه أكبر من 150 كيلوبايت ومطلوب ضغطه
  const isImage = (contentType && contentType.startsWith("image/")) || 
                  /\.(jpg|jpeg|png|webp)$/i.test(key);

  if (!skipCompress && isImage && buffer.length > 150 * 1024) {
    try {
      const sharp = (await import("sharp")).default;
      // تعطيل كاش sharp لتجنب تراكم استهلاك الذاكرة في بيئة Serverless
      sharp.cache(false);
      
      const pipeline = sharp(buffer)
        .rotate() // الحفاظ على اتجاه الصورة الصحيح
        .resize({
          width: 1200,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true,
        });

      if (key.toLowerCase().endsWith(".png") || contentType === "image/png") {
        finalBuffer = await pipeline.png({ palette: true, compressionLevel: 6 }).toBuffer();
        finalContentType = "image/png";
      } else if (key.toLowerCase().endsWith(".webp") || contentType === "image/webp") {
        finalBuffer = await pipeline.webp({ quality: 75 }).toBuffer();
        finalContentType = "image/webp";
      } else {
        finalBuffer = await pipeline.jpeg({ quality: 75 }).toBuffer();
        finalContentType = "image/jpeg";
      }
      console.log(`[R2 Auto-Compress] Compressed ${key} from ${(buffer.length / 1024).toFixed(1)}KB to ${(finalBuffer.length / 1024).toFixed(1)}KB (Saved ${((1 - finalBuffer.length / buffer.length) * 100).toFixed(1)}%)`);
    } catch (sharpError) {
      console.error("Failed to auto-compress image in uploadToR2:", sharpError);
    }
  }

  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await r2Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: finalBuffer,
      ContentType: finalContentType,
    }));
    return key;
  } catch (error) {
    console.error("Error uploading to R2:", error);
    return null;
  }
}

export async function deleteFromR2(key: string | null | undefined) {
  if (!BUCKET_NAME || !key) return;
  const r2Client = await getS3Client();
  if (!r2Client) return;

  let actualKey = key;
  if (key.includes("http")) {
    try {
      const url = new URL(key);
      actualKey = decodeURIComponent(url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname);
    } catch (e) { return; }
  }

  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await r2Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: actualKey,
    }));
  } catch (error) {
    console.error("Failed to delete from R2:", error);
  }
}

export async function r2ObjectExistsByUrl(urlOrKey: string | null | undefined): Promise<boolean> {
  if (!BUCKET_NAME || !urlOrKey) return false;
  const r2Client = await getS3Client();
  if (!r2Client) return false;

  const raw = String(urlOrKey).trim();
  let key = raw;
  if (raw.startsWith("/uploads/")) key = raw.slice(9);

  try {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    await r2Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function getR2ObjectMetadata(urlOrKey: string | null | undefined): Promise<{ size: number; contentType: string } | null> {
  if (!BUCKET_NAME || !urlOrKey) return null;
  const r2Client = await getS3Client();
  if (!r2Client) return null;

  const raw = String(urlOrKey).trim();
  let key = raw;
  if (raw.startsWith("/uploads/")) key = raw.slice(9);

  try {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await r2Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return {
      size: res.ContentLength ?? 0,
      contentType: res.ContentType ?? "image/jpeg",
    };
  } catch {
    return null;
  }
}

export async function getR2ObjectBuffer(urlOrKey: string): Promise<Buffer | null> {
  if (!BUCKET_NAME || !urlOrKey) return null;
  const r2Client = await getS3Client();
  if (!r2Client) return null;

  let key = urlOrKey;
  if (urlOrKey.startsWith("/uploads/")) key = urlOrKey.slice(9);

  // محاولة الجلب السريع عبر CDN الخاص بـ R2 أولاً لتسريع العملية بشكل هائل
  try {
    const r2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_BUCKET_DOMAIN || "https://pub-2f7b4947937d4575971a8f949826a575.r2.dev";
    const cleanDomain = r2Domain.replace(/\/$/, "");
    const fileUrl = `${cleanDomain}/${key}`;
    
    console.log(`[R2 Fetch Quick] Attempting to fetch from CDN: ${fileUrl}`);
    const res = await fetch(fileUrl, {
      next: { revalidate: 3600 }
    });
    
    if (res.ok) {
      const bytes = await res.arrayBuffer();
      const buf = Buffer.from(bytes);
      if (buf.length > 0) {
        console.log(`[R2 Fetch Quick] Success! Fetched ${(buf.length / 1024).toFixed(1)}KB from CDN`);
        return buf;
      }
    }
    console.warn(`[R2 Fetch Quick] CDN returned status ${res.status}, falling back to S3 GetObjectCommand`);
  } catch (fetchErr) {
    console.error(`[R2 Fetch Quick] Failed fetching from CDN, falling back to S3 GetObjectCommand:`, fetchErr);
  }

  // الاحتياط الآمن عبر S3 Client الأصلي
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await r2Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    console.error("Error getting object from R2 via S3 client:", error);
    return null;
  }
}

// دالة محسنة لضمان إرجاع مسار صالح دوماً
export function getUploadsRoot(): string {
  const root = process.env.UPLOADS_ROOT_DIR || (typeof process.cwd === 'function' ? process.cwd() : '.') || ".";
  return String(root || ".");
}

// دالة محسنة لضمان عدم تمرير قيم undefined لـ path.join
export function uploadsAbsoluteDir(subDir: string = ""): string {
  const root = getUploadsRoot();
  // استخدام import ديناميكي لتجنب مشاكل الـ Build
  const path = require('path');
  const safeSubDir = String(subDir || "");
  return path.join(String(root), "public", "uploads", safeSubDir);
}
