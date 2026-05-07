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

function normalizeIncomingKey(originalKey: string): string {
  let key = (originalKey || "").trim().replace(/^\/+/, "");
  if (!key) return "";

  try {
    key = decodeURIComponent(key);
  } catch {
    // ignore invalid encoding and continue with original value
  }

  const lowered = key.toLowerCase();

  // إذا جاء الرابط بصيغة /uploads/customers/xxx سنبقي فقط customers/xxx
  const uploadsAt = lowered.indexOf("/uploads/");
  if (uploadsAt >= 0) {
    key = key.slice(uploadsAt + "/uploads/".length);
  } else if (lowered.startsWith("uploads/")) {
    key = key.slice("uploads/".length);
  }

  // إذا جاء الرابط بصيغة /customers/xxx (بدون uploads) سنعتبره هو الـ Key
  // وهذا سيحل مشكلة الروابط المخزنة خطأ في الداتابيز

  return key.replace(/^\/+/, "");
}

function buildCandidateKeys(originalKey: string): string[] {
  const key = normalizeIncomingKey(originalKey);
  if (!key) return [];

  const out = new Set<string>([key]);
  const lower = key.toLowerCase();

  const extMap: Record<string, string[]> = {
    ".jpeg": [".jpg", ".png", ".webp"],
    ".jpg": [".jpeg", ".png", ".webp"],
    ".png": [".jpg", ".jpeg", ".webp"],
    ".webp": [".jpg", ".jpeg", ".png"],
  };

  const matchedExt = Object.keys(extMap).find((ext) => lower.endsWith(ext));
  if (matchedExt) {
    const base = key.slice(0, key.length - matchedExt.length);
    for (const alt of extMap[matchedExt]) {
      out.add(`${base}${alt}`);
    }
  }

  // fallback قوي: إذا الرابط يشير لمجلد غلط، جرّب نفس اسم الملف داخل مجلدات الصور الأساسية
  const slash = key.lastIndexOf("/");
  const fileName = slash >= 0 ? key.slice(slash + 1) : key;
  if (fileName) {
    const folders = ["customers", "profiles", "orders", "shops", "branches"];
    for (const folder of folders) {
      out.add(`${folder}/${fileName}`);
    }
  }

  const more = [...out];
  for (const c of more) {
    const cLower = c.toLowerCase();
    const m = Object.keys(extMap).find((ext) => cLower.endsWith(ext));
    if (!m) continue;
    const base = c.slice(0, c.length - m.length);
    for (const alt of extMap[m]) {
      out.add(`${base}${alt}`);
    }
  }

  return [...out];
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
