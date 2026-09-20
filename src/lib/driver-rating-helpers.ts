import { getPublicAppUrl } from "./app-url";

/**
 * إنشاء رابط تقييم المندوب لطلب محدد
 */
export function buildDriverRatingUrl(orderIdOrNumber: string | number): string {
  if (!orderIdOrNumber) return "";
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/rate-driver?order=${encodeURIComponent(orderIdOrNumber)}`;
}
