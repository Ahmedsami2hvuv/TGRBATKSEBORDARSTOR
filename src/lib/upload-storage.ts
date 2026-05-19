// نستخدم الاستيرادات الديناميكية لتجنب مشاكل الـ Build مع Turbopack
export const BUCKET_NAME = process.env.R2_BUCKET_NAME;

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
  const r2Client = await getS3Client();
  if (!r2Client || !key) return;

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
  const r2Client = await getS3Client();
  if (!r2Client || !urlOrKey) return false;

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

export function getUploadsRoot() { return ""; }
export function uploadsAbsoluteDir() { return ""; }
