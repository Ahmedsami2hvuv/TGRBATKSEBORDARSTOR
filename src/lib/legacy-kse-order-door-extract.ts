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

/** نصوص شائعة في الموقع القديم عندما لا توجد صورة باب — لا نأخذ أول &lt;img&gt; (غالباً أيقونة واتساب). */
const NO_DOOR_PHOTO_IN_HTML =
  /لا\s*توجد\s*صور[ةه]|لا\s*يوجد\s*صور[ةه]|بدون\s*صور[ةه]|لا\s*صور[ةه]\s*متاحة|لا\s*توجد\s*صورة\s*باب/i;

function isExcludedDoorImageUrl(href: string): boolean {
  const u = href.toLowerCase();
  if (u.includes("whatsapp")) return true;
  if (u.includes("wa.me")) return true;
  if (u.includes("web.whatsapp")) return true;
  if (u.includes("whatsapp-logo")) return true;
  if (u.includes("wame.")) return true;
  if (/\/icons?\/.*what/i.test(u)) return true;
  if (u.includes("static/whatsapp")) return true;
  if (u.endsWith(".svg") && (u.includes("what") || u.includes("phone") || u.includes("call"))) return true;
  return false;
}

/** صور صغيرة جداً أو صنف icon — نتجاهلها كصورة باب. */
function isLikelyUiIconImgTag(imgTag: string): boolean {
  const t = imgTag.toLowerCase();
  if (/\bclass\s*=\s*["'][^"']*\bicon\b/i.test(t)) return true;
  if (/\balt\s*=\s*["'][^"']*واتس/i.test(t)) return true;
  if (/\balt\s*=\s*["'][^"']*whatsapp/i.test(t)) return true;
  const w = imgTag.match(/\bwidth\s*=\s*["']?(\d+)/i);
  const h = imgTag.match(/\bheight\s*=\s*["']?(\d+)/i);
  if (w && h) {
    const wi = parseInt(w[1]!, 10);
    const he = parseInt(h[1]!, 10);
    if (Number.isFinite(wi) && Number.isFinite(he) && wi > 0 && he > 0 && wi <= 64 && he <= 64) {
      return true;
    }
  }
  return false;
}

/**
 * يستخرج رابط صورة الباب بعد «صورة الباب:» إن وُجدت صورة حقيقية.
 * إن كان النص يقول «لا توجد صورة» قبل أي صورة باب، يُرجع null.
 * يتجاهل أيقونات واتساب والروابط الشبيهة.
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
    const plainHead = window
      .slice(0, 2500)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    if (NO_DOOR_PHOTO_IN_HTML.test(plainHead)) {
      return null;
    }

    const imgRe = /<img\b[^>]+>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(window)) !== null) {
      const tag = m[0];
      if (isLikelyUiIconImgTag(tag)) continue;
      const srcM = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag);
      if (!srcM) continue;
      const href = toAbs(srcM[1]!);
      if (!href || isExcludedDoorImageUrl(href)) continue;
      return href;
    }
    const bg = window.match(/url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/i);
    if (bg?.[1]) {
      const href = toAbs(bg[1]);
      if (href && !isExcludedDoorImageUrl(href)) return href;
    }
    /** وُجد عنوان «صورة الباب» ولم نعثر على صورة صالحة — لا نرجع لصور أخرى في الصفحة (مثل أيقونات). */
    return null;
  }

  for (const m of html.matchAll(/<img\b[^>]+>/gi)) {
    const tag = m[0];
    if (isLikelyUiIconImgTag(tag)) continue;
    const srcM = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!srcM) continue;
    const raw = srcM[1]!.toLowerCase();
    if (!(raw.includes("door") || raw.includes("%d8%a8%d8%a7%d8%a8"))) continue;
    const href = toAbs(srcM[1]!);
    if (href && !isExcludedDoorImageUrl(href)) return href;
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

/** يحقن href المهمة (tel/sms + روابط خرائط) داخل النص قبل إزالة الوسوم. */
function injectImportantHrefsAsText(html: string): string {
  return html.replace(
    /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (_m, hrefRaw: string) => {
      const href = decodeBasicHtmlEntities(hrefRaw.replace(/^\/\//, "")).trim();
      if (!href) return " ";

      if (/^(tel|sms)\s*:/i.test(href)) {
        let raw = href.replace(/^tel\s*:/i, "").replace(/^sms\s*:/i, "").trim();
        raw = raw.split(/[?;&]/)[0]?.trim() ?? "";
        return raw ? ` ${raw} ` : " ";
      }

      if (/^https?:\/\//i.test(href)) {
        const u = href.toLowerCase();
        const isMap =
          u.includes("maps.app.goo.gl") ||
          u.includes("google.com/maps") ||
          u.includes("goo.gl/maps") ||
          u.includes("maps.google") ||
          u.includes("map?q=");
        if (isMap) return ` ${href} `;
      }

      return " ";
    },
  );
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

function extractMapUrlsFromHtmlChunk(chunk: string): string[] {
  const mapUrls: string[] = [];
  const seen = new Set<string>();
  const re =
    /https?:\/\/(?:maps\.app\.goo\.gl|(?:www\.)?google\.com\/maps|goo\.gl\/maps|maps\.google\.[^\/\s"'<>]+\/maps)[^"'\s<>]*/gi;
  for (const m of chunk.matchAll(re)) {
    const u = decodeBasicHtmlEntities(m[0] ?? "").trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    mapUrls.push(u);
  }
  return mapUrls;
}

/**
 * يحوّل قسم «معلومات الزبون» من HTML صفحة الطلب إلى نص يشبه اللصق اليدوي
 * (يُمرّر لاحقاً لـ parseCustomerReferenceText / sliceLegacyOrderCustomerSection).
 */
export function extractCustomerReferenceRawTextFromLegacyOrderHtml(
  html: string,
): string | null {
  const starts = Array.from(html.matchAll(/معلومات\s*الزبون/gi)).map((m) => m.index ?? -1).filter((n) => n >= 0);
  if (starts.length === 0) return null;

  // بعض الصفحات تحتوي «معلومات الزبون» في القائمة الجانبية أيضاً.
  // نختار الظهور الذي يحتوي غالباً حقول الزبون الحقيقية (رقم/منطقة/لكيشن) قربه.
  let startIdx = starts[0]!;
  let bestScore = -1;
  for (const idx of starts) {
    const w = html.slice(idx, idx + 60_000);
    let score = 0;
    if (/رقم\s*(?:الهاتف|العميل)\s*[:：]/i.test(w)) score += 5;
    if (/المنطق[ةه]?\s*[:：]/i.test(w)) score += 3;
    if (/لكيشن\s*(?:الزبون|العميل)\s*[:：]/i.test(w)) score += 3;
    if (/اقرب\s*نقط[ةه]\s*دال[ةه]?\s*[:：]/i.test(w)) score += 2;
    if (/https?:\/\/(?:maps\.app\.goo\.gl|(?:www\.)?google\.com\/maps|goo\.gl\/maps)/i.test(w)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      startIdx = idx;
    }
  }

  const fromStart = html.slice(startIdx);
  /** بدون \b لأن حدود الكلمات في RegExp لا تنطبق على العربية كما يُفترض. */
  const endOrderInfo = fromStart.search(/معلومات\s*الطلب/i);
  /** لا تقطع عند أي ----- في الصفحة (JSON/CSS…)، فقط سطر شرطات كفاصل أقسام. */
  const endDashM = /\n[\t \u00a0]*-{5,}[\t \u00a0]*\r?\n/m.exec(fromStart);
  const endDash = endDashM && endDashM.index > 0 ? endDashM.index : -1;
  let end = fromStart.length;
  if (endOrderInfo >= 0) end = Math.min(end, endOrderInfo);
  if (endDash >= 0) end = Math.min(end, endDash);
  // نرفع السقف لتجنب قصّ مبكر في الصفحات الطويلة.
  const capped = Math.min(end, 90_000);
  const slice = injectImportantHrefsAsText(fromStart.slice(0, capped));
  let plain = legacyHtmlChunkToPlainText(slice);
  // احتياط: أحياناً رابط اللوكيشن يكون داخل attributes/onclick ولا يظهر كنص بعد التنظيف.
  // بما أن slice يبدأ من «معلومات الزبون»، فأي رابط خرائط فيه يعود لهذا القسم غالباً.
  const mapUrls = extractMapUrlsFromHtmlChunk(slice);
  if (mapUrls.length > 0) {
    const existing = new Set(
      Array.from(plain.matchAll(/https?:\/\/[^\s"'<>]+/gi)).map((m) => m[0]),
    );
    const missing = mapUrls.filter((u) => !existing.has(u));
    if (missing.length > 0) {
      plain = `${plain}\n${missing.join("\n")}`.trim();
    }
  }
  if (plain.length < 12) return null;
  return plain;
}
