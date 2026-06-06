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

export async function uploadToR2(buffer: Buffer, key: string, contentType: string) {
  if (!BUCKET_NAME) {
    console.error("R2_BUCKET_NAME is not defined");
    return null;
  }
  const r2Client = await getS3Client();
  if (!r2Client) return null;

  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await r2Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
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
    console.error("Error getting object from R2:", error);
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
