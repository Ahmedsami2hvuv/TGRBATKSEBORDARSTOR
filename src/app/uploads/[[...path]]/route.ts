import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// إنشاء العميل مرة واحدة خارج الدالة لتحسين الأداء
const r2Client = process.env.R2_ACCESS_KEY_ID ? new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
}) : null;

export const runtime = "nodejs";

function buildCandidateKeys(originalKey: string): string[] {
  const key = (originalKey || "").trim().replace(/^\/+/, "");
  if (!key) return [];

  const lower = key.toLowerCase();
  const candidates = [key];

  const extMap: Record<string, string[]> = {
    ".jpeg": [".jpg", ".png", ".webp"],
    ".jpg": [".jpeg", ".png", ".webp"],
    ".png": [".jpg", ".jpeg", ".webp"],
    ".webp": [".jpg", ".jpeg", ".png"],
  };

  const matchedExt = Object.keys(extMap).find((ext) => lower.endsWith(ext));
  if (!matchedExt) return candidates;

  const base = key.slice(0, key.length - matchedExt.length);
  for (const alt of extMap[matchedExt]) {
    candidates.push(`${base}${alt}`);
  }

  return candidates;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path: segments } = await context.params;

    if (!segments?.length || !r2Client) {
      console.error("R2 Config Missing or Path Empty");
      return new NextResponse("Not found", { status: 404 });
    }

    // نجرب المسار الأصلي ثم بدائل الامتداد للروابط القديمة (jpeg/jpg/png/webp)
    const key = segments.join("/");
    const candidateKeys = buildCandidateKeys(key);

    let response: { Body?: { transformToByteArray: () => Promise<Uint8Array> }; ContentType?: string } | null = null;
    for (const candidate of candidateKeys) {
      try {
        response = await r2Client.send(
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: candidate,
          }),
        );
        if (response?.Body) break;
      } catch {
        response = null;
      }
    }

    if (!response?.Body) {
      return new NextResponse("File Empty", { status: 404 });
    }

    // تحويل البيانات إلى Buffer لضمان التوافق مع المتصفحات
    const byteArray = await response.Body.transformToByteArray();

    return new NextResponse(byteArray, {
      headers: {
        "Content-Type": response.ContentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*", // للسماح بعرض الصور في أي مكان
      },
    });
  } catch (error) {
    console.error("Error fetching from R2:", error);
    return new NextResponse("Image Not Found", { status: 404 });
  }
}
