/**
 * أدوات إدارة سجل النسخ والتعديلات السابقة لأقرب نقطة دالة
 */

export interface LandmarkHistoryEntry {
  id: string;
  landmark: string;
  changedByName: string;
  changedAt: string; // ISO date string
}

/**
 * تحليل آمن لسجل النسخ السابقة من قاعدة البيانات (Json أو String أو Array)
 */
export function parseLandmarkHistory(raw: unknown): LandmarkHistoryEntry[] {
  if (!raw) return [];
  try {
    let parsed = raw;
    if (typeof raw === "string") {
      parsed = JSON.parse(raw);
    }
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object" && typeof item.landmark === "string")
      .map((item: any) => ({
        id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        landmark: String(item.landmark).trim(),
        changedByName: String(item.changedByName || "مندوب سابق").trim(),
        changedAt: item.changedAt ? String(item.changedAt) : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

/**
 * إضافة نسخة سابقة إلى السجل عند قيام مندوب أو مستخدم بتعديل أقرب نقطة دالة
 */
export function buildUpdatedLandmarkHistory(
  existingHistoryRaw: unknown,
  oldLandmark: string | null | undefined,
  oldUploadedByName: string | null | undefined,
  oldTimestamp?: Date | string | null
): LandmarkHistoryEntry[] {
  const currentHistory = parseLandmarkHistory(existingHistoryRaw);
  const trimmedOld = (oldLandmark || "").trim();

  // إذا لم تكن هناك قيمة قديمة تستحق الحفظ، نعيد السجل كما هو
  if (!trimmedOld) {
    return currentHistory;
  }

  // التحقق من عدم التكرار إذا كانت آخر نسخة مطابقة تماماً لنفس النص
  if (currentHistory.length > 0 && currentHistory[0]?.landmark?.trim() === trimmedOld) {
    return currentHistory;
  }

  const previousEntry: LandmarkHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    landmark: trimmedOld,
    changedByName: oldUploadedByName?.trim() || "النسخة الأصلية",
    changedAt: oldTimestamp ? new Date(oldTimestamp).toISOString() : new Date().toISOString(),
  };

  // وضع النسخة الأحدث في بداية القائمة والاحتفاظ بآخر 30 نسخة
  return [previousEntry, ...currentHistory].slice(0, 30);
}
