import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { uploadToR2 } from "@/lib/upload-storage";

// الحد الأقصى للملف هو 25 ميجابايت للخلفيات (خاصة للفيديو)
const MAX_BG_BYTES = 25 * 1024 * 1024;

function getExtension(file: File): string {
  const type = file.type.toLowerCase();
  if (type === "image/gif") return "gif";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  if (type === "application/json") return "json";

  const fileName = file.name.toLowerCase();
  const parts = fileName.split(".");
  if (parts.length > 1) {
    const ext = parts.pop()!;
    if (["gif", "png", "webp", "jpg", "jpeg", "mp4", "webm", "json"].includes(ext)) {
      return ext;
    }
  }
  return "bin";
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const bgKeyRaw = formData.get("bgKey");
    const bgKey = typeof bgKeyRaw === "string" ? bgKeyRaw.trim() : "background";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "لم يتم رفع أي ملف" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "ملف فارغ" }, { status: 400 });
    }
    if (file.size > MAX_BG_BYTES) {
      return NextResponse.json({ error: "حجم الملف كبير جداً (أقصى حد 25 ميجابايت)" }, { status: 400 });
    }

    const allowedTypes = [
      "image/gif", "image/png", "image/webp", "image/jpeg", "image/jpg",
      "video/mp4", "video/webm", "application/json", "text/plain"
    ];
    
    // التحقق من توافق النوع أو امتداد الملف
    const fileType = file.type || "";
    const ext = getExtension(file);
    
    if (!allowedTypes.includes(fileType) && !["mp4", "webm", "json", "gif", "webp"].includes(ext)) {
      return NextResponse.json({ error: "نوع الملف غير مدعوم. يرجى رفع صورة أو فيديو أو ملف لوتي." }, { status: 400 });
    }

    const safeKey = bgKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "bg";
    const key = `ui-backgrounds/${safeKey}/${Date.now()}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const uploadedKey = await uploadToR2(buffer, key, file.type || "application/octet-stream");

    if (!uploadedKey) {
      return NextResponse.json({ error: "فشل رفع الملف إلى R2" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url: `/uploads/${uploadedKey}`,
      key: uploadedKey,
      contentType: file.type,
    });
  } catch (error) {
    console.error("خطأ في رفع الملف:", error);
    return NextResponse.json({ error: "حدث خطأ غير متوقع أثناء الرفع" }, { status: 500 });
  }
}
