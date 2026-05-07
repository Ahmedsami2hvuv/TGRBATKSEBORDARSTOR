/**
 * منطق مطابق لـ talabat-bot (logic_site_order.py): تحليل رسائل طلب الموقع
 * التي تبدأ بـ «اسم الزبون» واستخراج المنتجات والعنوان والهاتف.
 */

import { normalizeDigits, normalizeNumerals } from "@/lib/money-alf";

const STRIP_START = "\uFEFF\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u200B\u200C\u200D\u2060";

export type SiteOrderItem = { name: string; qty: number; price: number };

export type SiteOrderParsed = {
  customerName: string;
  address: string;
  landmark: string;
  items: SiteOrderItem[];
  totalPrice: number | null;
};

function normalizeForSiteCheck(text: string): string {
  let t = (text || "").trim();
  while (t && STRIP_START.includes(t[0]!)) {
    t = t.slice(1).trim();
  }
  return t;
}

/** هل النص يبدو طلب موقع (كما في البوت) */
export function isSiteOrderMessage(text: string): boolean {
  const t = normalizeForSiteCheck(text);
  if (!t) return false;
  if (t.startsWith("اسم الزبون")) return true;
  const firstLine = t.split("\n")[0]?.trim() ?? "";
  return firstLine.startsWith("اسم الزبون");
}

const RE_PRODUCT_LINE = /^الاسم\s*[:\：]\s*(.+)$/i;
const RE_QUANTITY_LINE = /^الكمية\s*[:\：]\s*([\d٠-٩۰-۹]+)/i;
const RE_PRICE_LINE = /^السعر\s*[:\：]\s*([\d٠-٩۰-۹]+)/i;

export function parseSiteOrderMessage(text: string): SiteOrderParsed | null {
  const raw = normalizeForSiteCheck(text);
  if (!raw) return null;
  const lines = raw.split("\n").map((l) => l.trim());
  let customerName = "";
  let address = "";
  let landmark = "";
  const items: SiteOrderItem[] = [];
  let totalPrice: number | null = null;

  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i]!;
    if (/^اسم\s*الزبون\s*[:\：]/.test(line)) {
      const m = line.match(/[:\：]\s*(.+)$/);
      if (m) customerName = m[1]!.trim();
      i += 1;
      continue;
    }
    if (/^العنوان\s*[:\：]/.test(line)) {
      const m = line.match(/[:\：]\s*(.+)$/);
      if (m) address = m[1]!.trim();
      i += 1;
      continue;
    }
    if (/^اقرب\s*نقطة\s*دالة\s*[:\：]/.test(line)) {
      const m = line.match(/[:\：]\s*(.+)$/);
      if (m) landmark = m[1]!.trim();
      i += 1;
      continue;
    }
    if (
      /^ملاحظات\s*[:\：]?/.test(line) ||
      line === "**" ||
      line === "***" ||
      line === "******" ||
      line === "معلومات الطلب" ||
      line === "" ||
      /^-+$/.test(line)
    ) {
      i += 1;
      continue;
    }
    if (line.includes("السعر الكلي")) {
      try {
        const rest = line.replace("السعر الكلي", "").replace(/\*/g, "").trim();
        if (/^[\d٠-٩۰-۹]+$/.test(rest)) {
          totalPrice = parseInt(normalizeNumerals(rest), 10);
        } else if (i + 1 < n && /^[\d٠-٩۰-۹]+$/.test(lines[i + 1]!.replace(/\*/g, "").trim())) {
          totalPrice = parseInt(normalizeNumerals(lines[i + 1]!.replace(/\*/g, "").trim()), 10);
        } else if (i + 2 < n && /^[\d٠-٩۰-۹]+$/.test(lines[i + 2]!.replace(/\*/g, "").trim())) {
          totalPrice = parseInt(normalizeNumerals(lines[i + 2]!.replace(/\*/g, "").trim()), 10);
        }
      } catch {
        /* ignore */
      }
      i += 1;
      continue;
    }
    const mName = line.match(RE_PRODUCT_LINE);
    if (mName) {
      let rawName = mName[1]!.trim();
      if (/^اسم\s*المحل\s*[:\：]\s*/.test(rawName)) {
        rawName = rawName.replace(/^اسم\s*المحل\s*[:\：]\s*/, "").trim();
      } else if (/^اسم\s*المحل\s+/.test(rawName)) {
        rawName = rawName.replace(/^اسم\s*المحل\s+/, "").trim();
      }
      const name = rawName;
      let qty = 1;
      let price = 0;
      if (i + 1 < n) {
        const mq = lines[i + 1]!.match(RE_QUANTITY_LINE);
        if (mq) {
          const q = parseInt(normalizeNumerals(mq[1]!), 10);
          if (!Number.isNaN(q)) qty = q;
        }
      }
      if (i + 2 < n) {
        const mp = lines[i + 2]!.match(RE_PRICE_LINE);
        if (mp) {
          const p = parseInt(normalizeNumerals(mp[1]!), 10);
          if (!Number.isNaN(p)) price = p;
        }
      }
      if (name && name !== "اسم المحل") {
        items.push({ name, qty, price });
      }
      i += 1;
      if (i < n && RE_QUANTITY_LINE.test(lines[i]!)) i += 1;
      if (i < n && RE_PRICE_LINE.test(lines[i]!)) i += 1;
      continue;
    }
    if (RE_QUANTITY_LINE.test(line) || RE_PRICE_LINE.test(line)) {
      i += 1;
      continue;
    }
    i += 1;
  }

  return {
    customerName,
    address,
    landmark,
    items,
    totalPrice,
  };
}

/** تحويل رقم صحيح من الرسالة إلى «» كما في حقل رفع الطلب */
export function parsedMoneyToAlf(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return n / 1000;
  return n;
}

export function sumItemsSubtotalAlf(items: SiteOrderItem[]): number {
  let s = 0;
  for (const it of items) {
    s += it.qty * parsedMoneyToAlf(it.price);
  }
  return Math.round(s * 1000) / 1000;
}

export function effectiveSubtotalAlf(parsed: SiteOrderParsed): number {
  const fromItems = sumItemsSubtotalAlf(parsed.items);
  if (parsed.totalPrice != null && parsed.totalPrice > 0) {
    const t = parsedMoneyToAlf(parsed.totalPrice);
    if (t > 0) return t;
  }
  return fromItems;
}

/**
 * بناء ملخص داخلي مطابق لفكرة build_rst_order_text_from_site في البوت
 * (عنوان/منطقة، هاتف، ثم أسطر المنتجات).
 */
export function buildInternalOrderLinesFromSite(
  parsed: SiteOrderParsed,
  phoneDisplay: string,
): string {
  const address = (parsed.address || "").trim();
  const landmark = (parsed.landmark || "").trim();
  const titleLine = address || landmark || "طلب من الموقع";
  const productLines: string[] = [];
  for (const item of parsed.items) {
    const name = item.name.trim();
    if (!name) continue;
    productLines.push(`${name} ${item.qty}`);
  }
  const lines = [titleLine, phoneDisplay, ...productLines];
  return lines.join("\n");
}

/** استخراج رقم عراقي من النص الكامل (كما في البوت) */
export function extractPhoneNumberFromText(text: string): string | null {
  if (!text?.trim()) return null;
  const cleaned = normalizeDigits(text);
  if (cleaned.startsWith("964") && cleaned.length > 3) {
    return `0${cleaned.slice(3)}`;
  }
  const m = cleaned.match(/07\d{8,10}/);
  if (m) return normalizePhoneLocal(m[0]!);
  if (/^7\d{9}$/.test(cleaned)) return `0${cleaned}`;
  return null;
}

function normalizePhoneLocal(phoneStr: string): string | null {
  if (!phoneStr?.trim()) return null;
  const s = normalizeDigits(phoneStr.trim().replace(/\s/g, "").replace(/\u00a0/g, "").replace(/\+/g, ""));
  if (!s) return null;
  if (s.startsWith("964") && s.length > 3) return `0${s.slice(3)}`;
  if (s.startsWith("07") && s.length >= 10) return s.slice(0, 12);
  if (/^7\d{9}$/.test(s)) return `0${s}`;
  return null;
}
