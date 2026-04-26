import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2Client = process.env.R2_ACCESS_KEY_ID ? new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
}) : null;

export async function uploadToR2(buffer: Buffer, key: string, contentType: string) {
  if (!r2Client) return null;

  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return key;
}

/**
 * دالة لحذف الملفات من R2 لضمان عدم تراكم الصور القديمة
 */
export async function deleteFromR2(key: string | null | undefined) {
  if (!r2Client || !key) return;

  // إذا كان الرابط كاملاً، نستخرج الـ Key منه
  let actualKey = key;
  if (key.includes("http")) {
    try {
      const url = new URL(key);
      actualKey = decodeURIComponent(url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname);
    } catch (e) {
      console.error("Invalid URL provided to deleteFromR2:", key);
      return;
    }
  }

  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: actualKey,
    }));
    console.log(`Successfully deleted from R2: ${actualKey}`);
  } catch (error) {
    console.error("Failed to delete from R2:", error);
  }
}

export function getUploadsRoot(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  const isRailway = !!process.env.RAILWAY_PROJECT_ID || !!process.env.RAILWAY_ENVIRONMENT;
  if (isRailway) {
    return path.resolve("/data/uploads");
  }
  return path.join(process.cwd(), "public", "uploads");
}

export function uploadsAbsoluteDir(...segments: string[]): string {
  return path.join(getUploadsRoot(), ...segments);
}
