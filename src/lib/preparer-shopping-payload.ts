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

/**
 * الشرط المشترك لتمييز طلبات تجهيز التسوق في قوائم الإدارة وتفاصيل الطلب.
 * يُعتبر الطلب طلب تجهيز فقط إذا كان فيه قائمة منتجات حقيقية:
 *  - كائن فيه products مصفوفة غير فارغة (الصيغة الفعلية للتجهيز).
 *  - أو مصفوفة فيها عنصر واحد على الأقل له line أو productId.
 * المصفوفات القديمة الشكل [{ name, price, priced }] هي ملاحظات/تنبيهات (قابل للكسر، طلب مستعجل...)
 * تُخزّنها طلبات المحلات ولا تُعتبر طلب تجهيز.
 */
export function hasValidPreparerShoppingList(raw: unknown): boolean {
  if (raw == null) return false;
  if (Array.isArray(raw)) {
    return raw.some((entry) => {
      if (entry == null || typeof entry !== "object") return false;
      const e = entry as Record<string, unknown>;
      const line = typeof e.line === "string" ? e.line.trim() : "";
      const productId = typeof e.productId === "string" ? e.productId.trim() : "";
      return line.length > 0 || productId.length > 0;
    });
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return Array.isArray(obj.products) && obj.products.length > 0;
  }
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text || text === "{}" || text === "[]" || text === "null" || text.length <= 2) return false;
    try {
      const value = JSON.parse(text) as unknown;
      if (typeof value === "object" && value !== null) {
        return hasValidPreparerShoppingList(value);
      }
    } catch {
      return false;
    }
  }
  return false;
}
