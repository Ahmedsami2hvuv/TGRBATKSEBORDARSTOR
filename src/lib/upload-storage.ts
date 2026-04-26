import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

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
