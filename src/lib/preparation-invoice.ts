import { ALF_PER_DINAR, formatDinarAsAlf } from "@/lib/money-alf";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";

export type InvoiceProductLine = {
  line: string;
  buyAlf: number;
  sellAlf: number;
};

/** تنسيق المبلغ المالي الصادر للزبون والفاتورة المخزنة في خانة الملاحظات التلقائية */
export function formatAlfForCustomer(val: number): string {
  if (val == null || isNaN(val)) return "0";
  if (val < 1) {
    return String(Math.round(val * 1000));
  }
  return val.toFixed(3);
}

function fmtAlf(n: number): string {
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
    parts.push(`– ${row.line} بـ ${formatAlfForCustomer(s)}`);
    run += s;
    parts.push(`• ${formatAlfForCustomer(run)} 💵`);
  }

  parts.push(`– 📦 كلفة تجهيز من ${placesCount} محلات بـ ${formatAlfForCustomer(extraAlf)}`);
  run += extraAlf;
  parts.push(`• ${formatAlfForCustomer(run)} 💵`);

  const withoutDelivery = run;

  parts.push(`– 🚚 كلفة توصيل بـ ${formatAlfForCustomer(deliveryAlf)}`);
  run += deliveryAlf;
  parts.push(`• ${formatAlfForCustomer(run)} 💵`);

  parts.push("-----------------------------------");
  parts.push("✨ المجموع الكلي: ✨");
  parts.push(`بدون التوصيل = ${formatAlfForCustomer(withoutDelivery)} 💵`);
  parts.push(`مــــع التوصيل = ${formatAlfForCustomer(run)} 💵`);
  parts.push("شكراً لاختياركم أبو الأكبر للتوصيل! ❤️");

  return parts.join("\n");
}

/** سطر لكل منتج في خانة ملاحظات الطلب: الاسم والسعر فقط. */
export function buildShoppingOrderProductNotesLines(lines: InvoiceProductLine[]): string {
  return lines.map((r) => `${r.line.trim()}  ${formatAlfForCustomer(r.sellAlf)}`).join("\n");
}

/** ملخص شراء للمجهز (للحقول الداخلية وخانة الملاحظات التلقائية) */
export function buildPreparerPurchaseSummaryText(lines: InvoiceProductLine[]): string {
  return lines.map((r) => `• ${r.line.trim()}  ${formatAlfForCustomer(r.sellAlf)}`).join("\n");
}

/** بناء نص الفاتورة المجمعة (الملاحظات التلقائية) مع كلفة التجهيز وكلفة التوصيل والمجموع الكلي */
export function buildCombinedOrderSummaryText(params: {
  preparerInvoices: { preparerName: string; invoiceText: string }[];
  placesCount: number;
  extraAlf: number;
  deliveryAlf: number;
  sumSellAlf?: number; // Optional for backward compatibility, but we will provide it
}): string {
  const { preparerInvoices, placesCount, extraAlf, deliveryAlf, sumSellAlf = 0 } = params;
  const CUSTOMER_NOTE_BORDER = "═══════════════";

  const summaryParts = preparerInvoices.map((inv) => {
    return `[ تجهيز: ${inv.preparerName} ]\n${inv.invoiceText}`;
  });

  const prepText = `كلفة تجهيز من ${placesCount} محلات بـ ${formatAlfForCustomer(extraAlf)}`;
  const deliveryText = `كلفة توصيل بـ ${formatAlfForCustomer(deliveryAlf)}`;

  let totalText = "";
  if (sumSellAlf > 0 || extraAlf > 0 || deliveryAlf > 0) {
    const totalWithoutDelivery = sumSellAlf + extraAlf;
    const finalTotal = totalWithoutDelivery + deliveryAlf;
    totalText = `المجموع الكلي: ${formatAlfForCustomer(finalTotal)} 💵`;
  }

  const lines = [
    CUSTOMER_NOTE_BORDER,
    "المنتجات المجهزة (حسب المجهز)",
    CUSTOMER_NOTE_BORDER,
    summaryParts.join("\n\n═══════════════\n\n"),
    CUSTOMER_NOTE_BORDER,
    prepText,
    deliveryText,
  ];

  if (totalText) {
    lines.push(totalText);
  }

  lines.push(CUSTOMER_NOTE_BORDER);

  return lines.join("\n");
}

/** معالجة وتنسيق أي نص ملخص مجهزين قديم أو جديد لتظهر الأسعار بالشكل الدقيق المفهوم للزبون، مع حساب المجموع الكلي للطلبات القديمة */
export function normalizeOrderSummaryText(rawText: string | null | undefined): string {
  if (!rawText) return "";

  let hasTotal = false;
  let sum = 0;

  const processedLines = rawText
    .split("\n")
    .map((line) => {
      if (line.includes("المجموع الكلي")) {
        hasTotal = true;
      }

      // البحث عن الأسطر التي تبدأ بنقطة المجهز • ومتبوعة باسم المنتج والسعر في نهاية السطر
      const match = line.match(/^(\s*•\s*)(.+?)\s+([\d.]+)\s*$/);
      if (match) {
        const prefix = match[1];
        const productName = match[2].trim();
        const priceNum = parseFloat(match[3]);
        if (!isNaN(priceNum)) {
          sum += priceNum;
          return `${prefix}${productName}  ${formatAlfForCustomer(priceNum)}`;
        }
      }

      // استخراج كلفة التجهيز
      const extraMatch = line.match(/كلفة تجهيز.*?بـ\s*([\d.]+)/);
      if (extraMatch) {
        const extraNum = parseFloat(extraMatch[1]);
        if (!isNaN(extraNum)) sum += extraNum;
      }

      // استخراج كلفة التوصيل
      const deliveryMatch = line.match(/كلفة توصيل.*?بـ\s*([\d.]+)/);
      if (deliveryMatch) {
        const delNum = parseFloat(deliveryMatch[1]);
        if (!isNaN(delNum)) sum += delNum;
      }

      return line;
    });

  // إذا لم يكن المجموع موجوداً في الفاتورة القديمة، نقوم بإضافته برمجياً قبل الخط الفاصل الأخير
  if (!hasTotal && sum > 0) {
    let inserted = false;
    for (let i = processedLines.length - 1; i >= 0; i--) {
      if (processedLines[i].includes("═══════════════")) {
        processedLines.splice(i, 0, `المجموع الكلي: ${formatAlfForCustomer(sum)} 💵`);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      processedLines.push(`المجموع الكلي: ${formatAlfForCustomer(sum)} 💵`);
    }
  }

  return processedLines.join("\n");
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

