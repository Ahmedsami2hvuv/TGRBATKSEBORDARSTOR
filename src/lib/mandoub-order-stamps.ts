/**
 * توقيع هوية قائمة الطلبات للمندوب (وجود الطلبات نفسها فقط).
 * مهم: لا نعتمد على updatedAt حتى لا تعاد تحميل القائمة كاملة عند
 * تعديلات المندوب داخل الطلب (صورة/لوكيشن/تحديث بيانات...).
 */
export function mandoubOrdersStampSig(
  rows: { id: string; updatedAt: Date }[],
): string {
  return rows
    .map((r) => r.id)
    .sort()
    .join("|");
}
