import { normalizeDigits } from "@/lib/money-alf";
import { routeModeOrFromQuery } from "@/lib/admin-super-search";
import { generateDateSearchTokens } from "@/lib/order-date-search";

/** نفس منطق البحث الخارق للطلبات — بدون فلاتر إضافية — للتصفية على جهاز العميل. */
function parseOrderNumberCandidate(q: string): number | null {
  const t = normalizeDigits(q.trim());
  if (!/^[0-9]+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n < 0 || n > 2147483647) return null;
  return n;
}

/** حقول نصّية للمطابقة (نفس مجالات admin super search للطلبات). */
export type MandoubOrderSearchFields = {
  id: string;
  orderNumber: number;
  orderType: string;
  customerPhone: string;
  alternatePhone: string | null;
  secondCustomerPhone: string | null;
  secondCustomerAlternatePhone?: string | null;
  customerName?: string | null;
  summary: string;
  customerLandmark: string;
  secondCustomerLandmark: string;
  orderNoteTime: string;
  shopName: string;
  regionName: string;
  secondRegionName: string;
  routeMode: string;
  courierName: string;
  adminOrderCode: string;
  submissionSource: string;
  customerLocationUrl: string;
  customerLocationUploadedByName: string;
  secondCustomerLocationUrl: string;
  secondCustomerDoorPhotoUploadedByName: string;
  customerDoorPhotoUploadedByName: string;
  orderImageUploadedByName: string;
  shopDoorPhotoUploadedByName: string;
  /** نص JSON تجهيز التسوق للمطابقة داخل الطلب */
  preparerShoppingText: string;
  submittedByEmployeeName: string;
  submittedByPreparerName: string;
  /** ISO لتاريخ إنشاء الطلب — مطلوب لدعم البحث بالتاريخ/الوقت. */
  createdAtIso?: string;
};

function digitsOnly(s: string): string {
  return normalizeDigits(s);
}

/** يعيد true إذا كان النص يطابق الطلب (بحث فوري متعدد الكلمات). */
export function mandoubOrderMatchesSmartQuery(
  qRaw: string,
  f: MandoubOrderSearchFields,
): boolean {
  const q = qRaw.trim();
  if (!q) return true;

  // إذا تطابق الإدخال بالكامل مع رقم الطلب
  const n = parseOrderNumberCandidate(q);
  if (n != null && f.orderNumber === n) return true;

  for (const r of routeModeOrFromQuery(q)) {
    if (f.routeMode === r.routeMode) return true;
  }

  // تقسيم نص البحث إلى كلمات مفتاحية منفصلة
  const searchTokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (searchTokens.length === 0) return true;

  const dateTokens = generateDateSearchTokens(f.createdAtIso, f.orderNoteTime);
  const hayElements = [
    f.id,
    String(f.orderNumber),
    f.orderType,
    f.adminOrderCode,
    f.submissionSource,
    f.customerPhone,
    f.alternatePhone ?? "",
    f.secondCustomerPhone ?? "",
    f.secondCustomerAlternatePhone ?? "",
    f.customerName ?? "",
    f.summary,
    f.customerLandmark,
    f.secondCustomerLandmark,
    f.customerLocationUrl,
    f.customerLocationUploadedByName,
    f.secondCustomerLocationUrl,
    f.secondCustomerDoorPhotoUploadedByName,
    f.customerDoorPhotoUploadedByName,
    f.orderImageUploadedByName,
    f.shopDoorPhotoUploadedByName,
    f.preparerShoppingText,
    f.submittedByEmployeeName,
    f.submittedByPreparerName,
    f.orderNoteTime,
    f.shopName,
    f.regionName,
    f.secondRegionName,
    f.courierName,
    dateTokens,
  ];

  const hay = hayElements.join(" ").toLowerCase();
  const hayNormalized = normalizeDigits(hay).toLowerCase();

  // يجب أن تتطابق كل كلمة مفتاحية مع جزء من بيانات الطلب
  for (const token of searchTokens) {
    const tokenNormalized = normalizeDigits(token).toLowerCase();
    
    // التحقق من مطابقة الكلمة المفتاحية (سواء بالنص الأصلي أو الموحد الأرقام)
    let matched = hay.includes(token) || hayNormalized.includes(tokenNormalized);

    // إذا لم تتطابق، وكان التوكن عبارة عن أرقام فقط (مثال: جزء من رقم هاتف)، نقارن الأرقام فقط
    if (!matched) {
      const qDigits = digitsOnly(token);
      if (qDigits.length >= 4) {
        const phones = [
          f.customerPhone,
          f.alternatePhone,
          f.secondCustomerPhone,
          f.secondCustomerAlternatePhone
        ]
          .filter(Boolean)
          .join(" ");
        if (digitsOnly(phones).includes(qDigits)) {
          matched = true;
        }
      }
    }

    // إذا لم تتطابق أي كلمة من الكلمات، يعتبر الطلب غير مطابق للبحث
    if (!matched) {
      return false;
    }
  }

  return true;
}
