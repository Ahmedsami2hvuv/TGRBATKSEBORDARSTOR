import path from "path";

/**
 * جذر مجلد الرفعات (يحتوي المجلدات الفرعية: order-images، voice-notes، …).
 *
 * - **محلياً (افتراضي):** `public/uploads` داخل المشروع.
 * - **إنتاج (Railway وغيره):** اضبط `UPLOAD_DIR` ووجّه وحدة تخزين دائمة إلى نفس المسار
 *   حتى لا تُفقد الصور والصوت بعد إعادة النشر.
 *
 * عناوين URL في قاعدة البيانات تبقى `/uploads/...` وتُخدم عبر `app/uploads/[[...path]]/route.ts`.
 */
export function getUploadsRoot(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  // على Railway نستخدم مسار الـ Volume القياسي دائماً.
  // ملاحظة: إن لم يكن Volume مربوطاً، سيظل المسار على قرص مؤقت وقد تُفقد الملفات/لا تتزامن عبر النسخ.
  const isRailway =
    !!process.env.RAILWAY_PROJECT_ID || !!process.env.RAILWAY_ENVIRONMENT;
  if (isRailway) {
    return path.resolve("/data/uploads");
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");
}

export function uploadsAbsoluteDir(...segments: string[]): string {
  return path.join(getUploadsRoot(), ...segments);
}
