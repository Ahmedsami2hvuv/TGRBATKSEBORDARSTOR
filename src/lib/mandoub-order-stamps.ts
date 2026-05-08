/** توقيع ثابت لطوابع الطلبات — يُستخدم في الصفحة وفي API للمقارنة. */
export function mandoubOrdersStampSig(
  rows: { id: string; updatedAt: Date }[],
): string {
  const stamps: Record<string, string> = {};
  for (const r of rows) {
    stamps[r.id] = r.updatedAt.toISOString();
  }
  return Object.keys(stamps)
    .sort()
    .map((id) => `${id}:${stamps[id]}`)
    .join("|");
}
