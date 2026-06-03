import { ALF_PER_DINAR, formatDinarAsAlf } from "@/lib/money-alf";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";

export type InvoiceProductLine = {
  line: string;
  buyAlf: number;
  sellAlf: number;
};

function fmtAlf(n: number): string {
  // استخدام التنسيق المطلوب (أرقام فقط أو مع كسر بسيط بدون كلمة  إذا كان ممكناً، لكن المعتمد حالياً هو formatDinarAsAlf)
  // لتلبية طلب المستخدم "مثروم نص ك 9" سنقوم بإرجاع الرقم فقط إذا كان صحيحاً
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

/** فاتورة الزبون (بيع + تراكمي) + تجهيز + توصيل — بصيغة قريبة من بوت Telegram */
export function buildCustomerInvoiceText(params: {
  brandLabel: string;
  orderNumberLabel: string;
  regionTitle: string;
  phone: string;
  lines: InvoiceProductLine[];
  placesCount: number;
  deliveryAlf: number;
}): string {
  const { brandLabel, orderNumberLabel, regionTitle, phone, lines, placesCount, deliveryAlf } = params;
  const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);

  const parts: string[] = [];
  parts.push(`📋 ${brandLabel} 🚀`);
  parts.push("-----------------------------------");
  parts.push(`🔢: ${orderNumberLabel}`);
  parts.push(`🏠: ${regionTitle}`);
  parts.push(`📞: ${phone}`);
  parts.push("");
  parts.push("🛍 المنتجات:");
  parts.push("");

  let run = 0;
  for (const row of lines) {
    const s = row.sellAlf;
    parts.push(`– ${row.line} بـ ${s}`);
    run += s;
    parts.push(`• ${run} 💵`);
  }

  parts.push(`– 📦 التجهيز: من ${placesCount} محلات بـ ${extraAlf}`);
  run += extraAlf;
  parts.push(`• ${run} 💵`);

  const withoutDelivery = run;

  parts.push(`– 🚚: بـ ${deliveryAlf}`);
  run += deliveryAlf;
  parts.push(`• ${run} 💵`);

  parts.push("-----------------------------------");
  parts.push("✨ المجموع الكلي: ✨");
  parts.push(`بدون التوصيل = ${withoutDelivery} 💵`);
  parts.push(`مــــع التوصيل = ${run} 💵`);
  parts.push("شكراً لاختياركم أبو الأكبر للتوصيل! ❤️");

  return parts.join("\n");
}

/** سطر لكل منتج في خانة ملاحظات الطلب: الاسم والسعر فقط. */
export function buildShoppingOrderProductNotesLines(lines: InvoiceProductLine[]): string {
  return lines.map((r) => `${r.line.trim()}  ${r.sellAlf}`).join("\n");
}

/** ملخص شراء للمجهز (للحقول الداخلية) - تم التعديل لإخفاء سعر الشراء عن المندوب في الملخص العام */
export function buildPreparerPurchaseSummaryText(lines: InvoiceProductLine[]): string {
  return lines.map((r) => `• ${r.line.trim()}  ${r.sellAlf}`).join("\n");
}

export function resolveDynamicOrderType(products: { line: string }[], defaultType: string = "تجهيز تسوق"): string {
  if (!products || products.length === 0) return defaultType;
  if (products.length === 1) {
    return products[0].line.trim();
  }
  if (products.length === 2) {
    const firstWord1 = products[0].line.trim().split(/\s+/)[0] || "";
    const firstWord2 = products[1].line.trim().split(/\s+/)[0] || "";
    if (firstWord1 && firstWord2) {
      return `${firstWord1} و ${firstWord2}`;
    }
  }
  return defaultType;
}
