export const WA_BUTTON_VARIABLE_CHIPS: Array<{ key: string; label: string }> = [
  { key: "clientshop", label: "اسم المحل" },
  { key: "city", label: "منطقة الزبون" },
  { key: "total_price", label: "السعر الكلي" },
  { key: "delivery", label: "اسم المندوب" },
  { key: "location_url", label: "لوكيشن الزبون" },
  { key: "landmark", label: "أقرب نقطة" },
  { key: "order_number", label: "رقم الطلب" },
  { key: "customer_phone", label: "هاتف الزبون" },
  { key: "customer_phone2", label: "هاتف الزبون 2" },
  { key: "shop_phone", label: "هاتف المحل" },
];

export const ICON_CHOICES = ["💬", "📍", "🗺️", "🚚", "💰", "⚡", "🧾", "⭐", "📝"];

export type CustomerLocationRule = "any" | "exists" | "missing" | "courier_gps";
export type VisibilityScope = "all" | "admin" | "employee" | "preparer" | "mandoub";

export const VISIBILITY_OPTIONS: Array<{
  value: VisibilityScope;
  label: string;
}> = [
  { value: "all", label: "الكل" },
  { value: "admin", label: "الإدارة" },
  { value: "employee", label: "الموظفين" },
  { value: "preparer", label: "المجهزين" },
  { value: "mandoub", label: "المندوبين" },
];

export const ORDER_STATUS_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "pending", label: "طلب جديد (pending)" },
  { value: "assigned", label: "بانتظار المندوب (assigned)" },
  { value: "delivering", label: "عند المندوب (delivering)" },
  { value: "delivered", label: "تم التسليم (delivered)" },
  { value: "cancelled", label: "ملغى/مرفوض (cancelled)" },
  { value: "archived", label: "مؤرشف (archived)" },
];

export function parseStatusesCsv(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseLocationRulesCsv(csv: string): CustomerLocationRule[] {
  const parts = (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = parts.filter((p) =>
    ["any", "exists", "missing", "courier_gps"].includes(p),
  ) as CustomerLocationRule[];
  return allowed.length ? (allowed.includes("any") ? ["any"] : allowed) : ["any"];
}

export function parseVisibilityScopesCsv(
  raw: string | null | undefined,
): VisibilityScope[] {
  const parts = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = parts.filter((p) =>
    ["all", "admin", "employee", "preparer", "mandoub"].includes(p),
  ) as VisibilityScope[];
  return allowed.length ? (allowed.includes("all") ? ["all"] : allowed) : ["all"];
}
