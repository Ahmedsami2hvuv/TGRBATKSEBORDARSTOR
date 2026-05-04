/**
 * الموقع القديم لإدارة الطلبات (لوحة dashboard على d.ksebstor.site).
 * ليس النظام الجديد (مثلاً طلبات Railway) — الجلب يعتمد على HTML صفحة تفاصيل الطلب هناك.
 */

const LEGACY_KSE_HOSTS = new Set([
  "d.ksebstor.site",
  "ksebstor.site",
  "www.ksebstor.site",
  "www.d.ksebstor.site",
]);

export function isLegacyKseHostname(host: string): boolean {
  return LEGACY_KSE_HOSTS.has(host.toLowerCase());
}

/** مسار صفحة تفاصيل الطلبية، مثل /dashboard/orders_status/details/13923 */
export function isLegacyOrderDetailsPath(pathname: string): boolean {
  return /\/orders_status\/details\/\d+/i.test(pathname);
}

export function parseAndValidateLegacyOrderPageUrl(raw: string):
  | { ok: true; href: string }
  | { ok: false; error: string } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "أدخل رابط صفحة تفاصيل الطلب من الموقع القديم.",
    };
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, error: "رابط غير صالح." };
  }
  if (!isLegacyKseHostname(u.hostname)) {
    return {
      ok: false,
      error: "النطاق يجب أن يكون من موقع الطلبات القديم (d.ksebstor.site).",
    };
  }
  if (!isLegacyOrderDetailsPath(u.pathname)) {
    return {
      ok: false,
      error:
        "الرابط يجب أن يكون لصفحة «تفاصيل الطلبية» على الموقع القديم فقط، مثل: https://d.ksebstor.site/dashboard/orders_status/details/13923 — وليس /dashboard/home ولا أي رابط من النظام الجديد.",
    };
  }
  return { ok: true, href: u.href };
}

/** للتحقق السريع (نفس قواعد parseAndValidateLegacyOrderPageUrl). */
export function isAllowedLegacyKseOrderPageUrl(raw: string): boolean {
  return parseAndValidateLegacyOrderPageUrl(raw).ok;
}

/**
 * يستخرج أول رابط صورة بعد تسمية «صورة الباب» في HTML صفحة الطلب القديمة.
 */
export function extractDoorImageUrlFromLegacyOrderHtml(
  html: string,
  pageHref: string,
): string | null {
  let base: URL;
  try {
    base = new URL(pageHref);
  } catch {
    return null;
  }

  const toAbs = (src: string): string | null => {
    const s = src.replace(/&amp;/g, "&").trim();
    if (!s || s.startsWith("data:")) return null;
    try {
      return new URL(s, base).href;
    } catch {
      return null;
    }
  };

  const labelRe = /صورة\s*الباب\s*:/i;
  const labelMatch = labelRe.exec(html);
  if (labelMatch) {
    const from = labelMatch.index + labelMatch[0].length;
    const window = html.slice(from, from + 8000);
    const imgRe = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(window)) !== null) {
      const href = toAbs(m[1]);
      if (href) return href;
    }
    const bg = window.match(/url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/i);
    if (bg?.[1]) {
      const href = toAbs(bg[1]);
      if (href) return href;
    }
  }

  for (const m of html.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const raw = m[1].toLowerCase();
    if (raw.includes("door") || raw.includes("%d8%a8%d8%a7%d8%a8")) {
      const href = toAbs(m[1]);
      if (href) return href;
    }
  }

  return null;
}

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const c = Number(n);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCharCode(c) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      const c = parseInt(h, 16);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCharCode(c) : "";
    });
}

function legacyHtmlChunkToPlainText(chunk: string): string {
  let s = chunk
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(div|p|tr|h[1-6]|li|section|table)>/gi, "\n");
  s = s.replace(/<\/td>/gi, "\t");
  s = s.replace(/<\/th>/gi, "\t");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeBasicHtmlEntities(s);
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

/**
 * يحوّل قسم «معلومات الزبون» من HTML صفحة الطلب إلى نص يشبه اللصق اليدوي
 * (يُمرّر لاحقاً لـ parseCustomerReferenceText / sliceLegacyOrderCustomerSection).
 */
export function extractCustomerReferenceRawTextFromLegacyOrderHtml(
  html: string,
): string | null {
  const startIdx = html.search(/معلومات\s*الزبون/i);
  if (startIdx < 0) return null;

  const fromStart = html.slice(startIdx);
  const endOrderInfo = fromStart.search(/\bمعلومات\s*الطلب\b/i);
  const endDash = fromStart.search(/-{5,}/);
  let end = fromStart.length;
  if (endOrderInfo > 0) end = Math.min(end, endOrderInfo);
  if (endDash > 0) end = Math.min(end, endDash);
  const capped = Math.min(end, 18_000);
  const slice = fromStart.slice(0, capped);
  const plain = legacyHtmlChunkToPlainText(slice);
  if (plain.length < 12) return null;
  return plain;
}
