import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

const r2Client = (typeof process !== 'undefined' && process.env.R2_ACCESS_KEY_ID) ? new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
}) : null;

export async function uploadToR2(buffer: Buffer, key: string, contentType: string) {
  if (!r2Client) return null;
  try {
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
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
  if (!r2Client || !key) return;
  let actualKey = key;
  if (key.includes("http")) {
    try {
      const url = new URL(key);
      actualKey = decodeURIComponent(url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname);
    } catch (e) { return; }
  }
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: actualKey,
    }));
  } catch (error) {
    console.error("Failed to delete from R2:", error);
  }
}

// إعادة الدوال اللازمة للنظام القديم والطلبات لضمان عمل الـ Build
export function getUploadsRoot(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(process.cwd(), "public", "uploads");
}

export function uploadsAbsoluteDir(...segments: string[]): string {
  return path.join(getUploadsRoot(), ...segments);
}
