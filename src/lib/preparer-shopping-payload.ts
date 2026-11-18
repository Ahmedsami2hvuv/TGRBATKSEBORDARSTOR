/** بيانات تجهيز التسوق المرسلة من العميل (مطابقة منطق بوت Telegram) */

export type PreparerShoppingProductPayload = {
  line: string;
  buyAlf: number;
  sellAlf: number;
  /** سعر الشراء الفعلي بعد الخصم للمحفظة (إذا حصل المجهز على خصم من المحل) */
  actualBuyAlf?: number | null;
  /** هل قامت الإدارة بتجهيز هذا المنتج بنفسها؟ (يُستثنى من حسابات المجهز) */
  isAdminPrepared?: boolean;
  /** المجهز المسند إليه هذا المنتج */
  assignedPreparerId?: string;
  assignedPreparerName?: string;
  /** المجهز الذي قام بتسعير هذا المنتج فعلياً */
  pricedById?: string;
  pricedByName?: string;
};

export type PreparerShoppingPayloadV1 = {
  version: 1;
  titleLine: string;
  products: PreparerShoppingProductPayload[];
  placesCount: number;
  /** نص القائمة الأصلي (واتساب) للمراجعة */
  rawListText?: string;
};

/** الشرط المشترك لتمييز طلبات تجهيز التسوق في قوائم الإدارة وتفاصيل الطلب. */
export function hasValidPreparerShoppingList(raw: unknown): boolean {
  if (raw == null) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.products)) return obj.products.length > 0;
    if (Array.isArray(obj.items)) return obj.items.length > 0;
    return Object.keys(obj).length > 0;
  }
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text || text === "{}" || text === "[]" || text === "null" || text.length <= 2) return false;
    try {
      const value = JSON.parse(text) as unknown;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        if (Array.isArray(obj.products)) return obj.products.length > 0;
        if (Array.isArray(obj.items)) return obj.items.length > 0;
        return Object.keys(obj).length > 0;
      }
    } catch {
      return false;
    }
  }
  return false;
}
