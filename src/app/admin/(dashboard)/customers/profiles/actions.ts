"use server";

import {
  MAX_ORDER_IMAGE_BYTES,
  saveCustomerProfilePhotoUploaded,
} from "@/lib/order-image";
import { deleteFromR2 } from "@/lib/upload-storage";
import { uploadToR2 } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";
import { digitsOnly, normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import {
  extractCustomerReferenceRawTextFromLegacyOrderHtml,
  extractDoorImageUrlFromLegacyOrderHtml,
  parseAndValidateLegacyOrderPageUrl,
} from "@/lib/legacy-kse-order-door-extract";

export type CustomerProfileFormState = { error?: string; ok?: boolean; timestamp?: number };

/** تلميحات مباشرة من الخادم لحالة الرقم والمنطقة (نفس منطق النموذج). */
export type CustomerProfileFormHint = {
  canCheck: boolean;
  regionResolved: boolean;
  /** اسم المنطقة كما كُتب في النص ولم يُعثر له تطابق */
  regionNotFound?: string;
  currentRegionName: string | null;
  inCurrentRegion: boolean;
  currentRegionMissingPhoto: boolean;
  /** أسماء مناطق أخرى يظهر فيها الرقم حالياً */
  otherRegionNames: string[];
};

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

async function photoFromForm(
  formData: FormData,
  fieldName: string,
): Promise<
  { ok: true; photoUrl: string | null } | { ok: false; error: string }
> {
  const f = formData.get(fieldName);
  if (!(f instanceof File) || f.size === 0) {
    return { ok: true, photoUrl: null };
  }
  try {
    const photoUrl = await saveCustomerProfilePhotoUploaded(
      f,
      MAX_ORDER_IMAGE_BYTES,
    );
    return { ok: true, photoUrl };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "IMAGE_TOO_LARGE") {
      return { ok: false, error: "الصورة كبيرة جداً (الحد 10 ميجابايت)" };
    }
    if (code === "IMAGE_BAD_TYPE") {
      return { ok: false, error: "نوع الصورة غير مدعوم (JPG أو PNG أو Webp)" };
    }
    if (code === "IMAGE_STORAGE_FAILED") {
      return {
        ok: false,
        error:
          "تعذّر حفظ الصورة على الخادم. جرّب صورة أصغر أو أعد المحاولة لاحقاً.",
      };
    }
    return { ok: false, error: "تعذّر حفظ الصورة" };
  }
}

function parseLocationUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, url: "" };
  const url = normalizeUrl(t);
  try {
    new URL(url);
  } catch {
    return { ok: false, error: "رابط اللوكيشن غير صالح" };
  }
  return { ok: true, url };
}

function inferExtFromImage(contentType: string, url: string): string {
  const t = contentType.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "png";
    if (pathname.endsWith(".webp")) return "webp";
    if (pathname.endsWith(".jpeg") || pathname.endsWith(".jpg")) return "jpg";
  } catch {
    // ignore invalid URL here; validated by caller
  }
  return "jpg";
}

/** من صفحة طلب الموقع القديم: إن وُجد «معلومات الزبون» نقتطعه فقط قبل التحليل. */
function sliceLegacyOrderCustomerSection(rawText: string): string {
  const t = rawText.replace(/\r\n/g, "\n");
  /** لا تستخدم -{3,} — أي «---» في النص (فواصل، Markdown…) يقطع قبل «رقم الهاتف». فاصل حقيقي: سطر شرطات طويل بين أسطر. */
  const re =
    /^\s*معلومات\s+الزبون\s*$(?:\n[\s\S]*?)(?=\n[\t \u00a0]*-{5,}[\t \u00a0]*\r?\n|\n\s*معلومات\s+الطلب\s*$|\n\s*معلومات\s+الطلب\s*\n|$)/im;
  const m = re.exec(t);
  if (m) return m[0].trim();
  return rawText;
}

/** تحويل الأرقام العربية/الفارسية إلى لاتينية ليطابق 07xxxxxxxx بعد الاستيراد من HTML. */
function normalizeDigitsToLatin(s: string): string {
  const ar = "٠١٢٣٤٥٦٧٨٩";
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xff10 && cp <= 0xff19) {
      out += String(cp - 0xff10);
      continue;
    }
    const i = ar.indexOf(ch);
    if (i >= 0) {
      out += String(i);
      continue;
    }
    const j = fa.indexOf(ch);
    if (j >= 0) {
      out += String(j);
      continue;
    }
    out += ch;
  }
  return out;
}

function stripInvisibleMarks(s: string): string {
  return s.replace(/[\u200c\u200d\u200e\u200f\ufeff\u202a\u202b\u202c\u2066\u2067\u2068\u2069]/g, "");
}

/** لمسح مسافات/شرطات ورموز عرض بين أرقام الهاتف قبل مطابقة 07xxxxxxxx */
function compactForPhoneScan(s: string): string {
  return s.replace(/[\s\u00a0\-_.\u200c\u200d\u200e\u200f\ufeff]/g, "");
}

function extractAllUrlsFromText(s: string): string[] {
  return Array.from(s.matchAll(/https?:\/\/[^\s"'<>]+/gi)).map((m) => m[0]!);
}

function isLikelyLocationUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(u)) return false;
  if (u.includes("/assets/img/door/")) return false;
  if (u.includes("maps.app.goo.gl")) return true;
  if (u.includes("google.com/maps")) return true;
  if (u.includes("goo.gl/maps")) return true;
  if (u.includes("maps.google")) return true;
  if (u.includes("location")) return true;
  if (u.includes("map")) return true;
  return false;
}

/** أول رقم جوال عراقي يظهر في النص بأي شكل شائع (بدون اشتراط سطر «رقم الهاتف:»). */
function extractFirstIraqMobileLocal11FromFreeText(scoped: string): string {
  const d = digitsOnly(normalizeDigitsToLatin(stripInvisibleMarks(scoped)));
  if (d.length < 10) return "";

  const m07 = d.match(/07\d{9}/);
  if (m07) return m07[0];

  const m964 = d.match(/9647\d{9}/);
  if (m964) {
    const n = normalizeIraqMobileLocal11(m964[0]);
    if (n) return n;
  }

  for (let i = 0; i + 10 <= d.length; i++) {
    if (d[i] !== "7") continue;
    if (i > 0 && d[i - 1] === "0") continue;
    const sub = d.slice(i, i + 10);
    const n = normalizeIraqMobileLocal11(sub);
    if (n) return n;
  }
  return "";
}

function parseCustomerReferenceText(rawText: string) {
  const tNorm = rawText.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const fullStripped = normalizeDigitsToLatin(stripInvisibleMarks(tNorm));

  // نأخذ فقط بلوك "معلومات الزبون" حتى لا نخلط مع "معلومات العميل".
  const startCandidates = Array.from(fullStripped.matchAll(/معلومات\s*الزبون\s*[:：]?/gi))
    .map((m) => m.index ?? -1)
    .filter((n) => n >= 0);
  let scoped = sliceLegacyOrderCustomerSection(fullStripped);
  if (startCandidates.length > 0) {
    const start = startCandidates[0]!;
    const tail = fullStripped.slice(start);
    const endM = /(?:\n\s*معلومات\s*الطلب\b|\n[\t \u00a0]*-{5,}[\t \u00a0]*\n)/i.exec(tail);
    scoped = (endM ? tail.slice(0, endM.index) : tail).trim();
  }

  const lines = scoped.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const getLabeledValue = (re: RegExp): string => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const m = re.exec(line);
      if (!m) continue;
      const v = (m[1] ?? "").trim();
      if (v) return v;
      const next = lines[i + 1]?.trim() ?? "";
      if (next && !/^(المنطق[ةه]?|منطقة|لكيشن|لوكيشن|اقرب|نقط[ةه]|رقم)/i.test(next)) return next;
      return "";
    }
    return "";
  };

  const regionName =
    getLabeledValue(/^(?:المنطق[ةه]?|منطقة)\s*[:：]?\s*(.*)$/i);

  let locationUrl = getLabeledValue(
    /^(?:لكيشن\s*(?:الزبون|العميل)?|لوكيشن\s*(?:الزبون|العميل)?|اللوكيشن|الموقع)\s*[:：]?\s*(.*)$/i,
  );
  {
    const m = locationUrl.match(/https?:\/\/[^\s"'<>]+/i);
    locationUrl = m ? m[0].trim() : "";
  }
  if (!locationUrl) {
    const map = extractAllUrlsFromText(scoped).find((u) => isLikelyLocationUrl(u));
    if (map) locationUrl = map.trim();
  }

  const landmark = getLabeledValue(
    /^(?:ا?قرب\s*نقط[ةه](?:\s*دال[ةه]?)?|نقط[ةه]\s*دال[ةه]?|دال[ةه]?|علامة)\s*[:：]?\s*(.*)$/i,
  );

  const phoneLine =
    getLabeledValue(/^(?:رقم\s*الهاتف|الهاتف|الرقم|رقم\s*العميل)\s*[:：]?\s*(.*)$/i);
  const altPhoneLine =
    getLabeledValue(
      /^(?:رقم\s*الهاتف\s*(?:ال(?:آخر|اخر|أخر)|الثاني)|رقم\s*هاتف\s*(?:ثان(?:ٍ)?|اخر|آخر)|رقم\s*(?:اخر|آخر|ثان(?:ٍ)?))\s*[:：]?\s*(.*)$/i,
    );

  let phone = "";
  let alternatePhone = "";
  const phoneFromLabel = compactForPhoneScan(phoneLine).match(/07\d{9}/);
  if (phoneFromLabel?.[0]) phone = phoneFromLabel[0];
  const altFromLabel = compactForPhoneScan(altPhoneLine).match(/07\d{9}/);
  if (altFromLabel?.[0]) alternatePhone = altFromLabel[0];

  if (!phone) {
    phone = extractFirstIraqMobileLocal11FromFreeText(scoped);
  }
  if (!phone) {
    phone = extractFirstIraqMobileLocal11FromFreeText(fullStripped);
  }
  if (!alternatePhone) {
    const allPhones = compactForPhoneScan(scoped).match(/07\d{9}/g) || [];
    if (allPhones[1] && allPhones[1] !== phone) alternatePhone = allPhones[1];
  }

  const notes = getLabeledValue(/^(?:ملاحظات|ملاحظه)\s*[:：]?\s*(.*)$/i);
  return { regionName, locationUrl, landmark, phone, alternatePhone, notes };
}

const emptyHint: CustomerProfileFormHint = {
  canCheck: false,
  regionResolved: false,
  currentRegionName: null,
  inCurrentRegion: false,
  currentRegionMissingPhoto: false,
  otherRegionNames: [],
};

/** يحدد إن كان الرقم مسجّلاً في منطقة أخرى أو في نفس المنطقة وبدون صورة، إلخ. */
export async function getCustomerProfileFormHint(
  rawText: string,
): Promise<CustomerProfileFormHint> {
  const parsed = parseCustomerReferenceText(String(rawText ?? ""));
  const n = normalizeIraqMobileLocal11(parsed.phone);
  if (!n) {
    return { ...emptyHint };
  }

  if (!parsed.regionName.trim()) {
    return {
      ...emptyHint,
      canCheck: true,
      regionResolved: false,
    };
  }

  const region = await prisma.region.findFirst({
    where: { name: { contains: parsed.regionName, mode: "insensitive" } },
  });

  if (!region) {
    return {
      ...emptyHint,
      canCheck: true,
      regionResolved: false,
      regionNotFound: parsed.regionName.trim(),
    };
  }

  const profiles = await prisma.customerPhoneProfile.findMany({
    where: { phone: n },
    include: { region: { select: { name: true } } },
  });

  const inCurrent = profiles.find((p) => p.regionId === region.id);
  const otherNames = [
    ...new Set(
      profiles
        .filter((p) => p.regionId !== region.id)
        .map((p) => p.region.name),
    ),
  ];

  return {
    canCheck: true,
    regionResolved: true,
    currentRegionName: region.name,
    inCurrentRegion: !!inCurrent,
    currentRegionMissingPhoto: !!(inCurrent && !inCurrent.photoUrl?.trim()),
    otherRegionNames: otherNames,
  };
}

async function profilePhotoFromRemoteUrl(
  rawUrl: string,
): Promise<{ ok: true; photoUrl: string } | { ok: false; error: string }> {
  const imageUrl = String(rawUrl || "").trim();
  if (!imageUrl) {
    return { ok: false, error: "أدخل رابط الصورة." };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return { ok: false, error: "رابط الصورة غير صالح." };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { ok: false, error: "الرابط يجب أن يبدأ بـ http أو https." };
  }

  try {
    const res = await fetch(parsedUrl.toString(), {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) {
      return { ok: false, error: "تعذر جلب الصورة من الرابط." };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      return { ok: false, error: "الرابط لا يحتوي على صورة." };
    }

    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    if (!buf.length) {
      return { ok: false, error: "الصورة فارغة أو تالفة." };
    }
    if (buf.length > MAX_ORDER_IMAGE_BYTES) {
      return { ok: false, error: "الصورة كبيرة جداً (الحد 20 ميجابايت)." };
    }

    const ext = inferExtFromImage(contentType, parsedUrl.toString());
    const key = `profiles/url-import-${Date.now()}-${randomUUID()}.${ext}`;
    const uploadedKey = await uploadToR2(buf, key, contentType || "image/jpeg");
    if (!uploadedKey) {
      return { ok: false, error: "تعذر رفع الصورة إلى التخزين." };
    }

    return { ok: true, photoUrl: `/uploads/${uploadedKey}` };
  } catch {
    return { ok: false, error: "حدث خطأ أثناء تنزيل/رفع الصورة." };
  }
}

export type LegacyOrderImportResult =
  | { ok: true; rawText: string; doorImageUrl: string | null }
  | { ok: false; error: string };

const MAX_LEGACY_COOKIE_HEADER_CHARS = 14_000;

async function fetchLegacyOrderPageHtml(
  href: string,
  legacyCookieFromClient?: string | null,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const fromClient = legacyCookieFromClient?.trim() ?? "";
  const fromEnv = process.env.LEGACY_KSE_ORDER_PAGE_COOKIE?.trim() ?? "";
  const cookie = fromClient || fromEnv;
  if (!cookie) {
    return {
      ok: false,
      error:
        "لم يُجد Cookie للموقع القديم.\n\n" +
        "الأسرع: في نفس المتصفح بعد تسجيل الدخول على d.ksebstor.site — F12 → Network → طلب للموقع → Headers → انسخ قيمة «Cookie» (بدون كلمة Cookie:) والصقها في مربع «Cookie الموقع القديم» بصفحة إضافة الزبون واحفظها بالجلسة.\n\n" +
        "أو ضبط المتغير LEGACY_KSE_ORDER_PAGE_COOKIE على الخادم (Railway / .env) لمرة واحدة لكل الخادم.",
    };
  }
  if (fromClient.length > MAX_LEGACY_COOKIE_HEADER_CHARS) {
    return { ok: false, error: "نص Cookie طويل جداً. انسخ حقل Cookie فقط من أدوات المطوّر." };
  }

  let res: Response;
  try {
    res = await fetch(href, {
      redirect: "follow",
      headers: {
        Cookie: cookie,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return {
      ok: false,
      error: "تعذّر الاتصال بالموقع القديم. تحقق من الرابط أو حاول لاحقاً.",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `الموقع ردّ برمز ${res.status}. قد انتهت الجلسة — حدّث Cookie من المربع في الصفحة أو من المتغير على الخادم.`,
    };
  }

  const html = await res.text();
  return { ok: true, html };
}

/**
 * يجلب صفحة تفاصيل طلب من الموقع القديم d.ksebstor ويستخرج نص «معلومات الزبون» + رابط صورة الباب إن وُجد.
 * `legacyCookieFromClient`: اختياري — يُمرَّر من المتصفح (مثلاً من sessionStorage) ليتجاوز إعداد الخادم ويُسرّع العمل.
 */
export async function importLegacyOrderDetailsFromUrl(
  orderPageUrl: string,
  legacyCookieFromClient?: string | null,
): Promise<LegacyOrderImportResult> {
  const parsedUrl = parseAndValidateLegacyOrderPageUrl(orderPageUrl);
  if (!parsedUrl.ok) {
    return { ok: false, error: parsedUrl.error };
  }

  const page = await fetchLegacyOrderPageHtml(parsedUrl.href, legacyCookieFromClient);
  if (!page.ok) {
    return { ok: false, error: page.error };
  }

  const rawText = extractCustomerReferenceRawTextFromLegacyOrderHtml(page.html);
  if (!rawText) {
    return {
      ok: false,
      error:
        "لم يُعثر على قسم «معلومات الزبون» في الصفحة. تحقق من أن الرابط يفتح تفاصيل الطلب وأن الجلسة صحيحة.",
    };
  }

  const doorImageUrl = extractDoorImageUrlFromLegacyOrderHtml(
    page.html,
    parsedUrl.href,
  );
  return { ok: true, rawText, doorImageUrl };
}

/** منطق حفظ بروفايل الزبون المشترك (نموذج يدوي + استيراد دفعي من صفحات الطلب القديمة). */
async function performUpsertCustomerPhoneProfile(input: {
  rawText: string;
  uploadedPhotoUrl: string | null;
  remoteImageUrl: string | null;
}): Promise<CustomerProfileFormState> {
  const rawText = input.rawText.trim();
  if (!rawText) {
    return { error: "أدخل بيانات الزبون في المربع أعلاه ثم اضغط حفظ." };
  }

  const parsed = parseCustomerReferenceText(rawText);

  if (!parsed.phone) {
    return {
      error:
        "لم يُعثر على رقم جوال عراقي في النص. اكتب الرقم بصيغة 07XXXXXXXXX أو 7XXXXXXXXX أو 9647XXXXXXXXX، أو سطر «رقم الهاتف: …».",
    };
  }

  const n = normalizeIraqMobileLocal11(parsed.phone);
  if (!n) {
    return {
      error:
        "رقم الهاتف غير صالح (أدخل رقماً عراقياً محلياً مثل 07xxxxxxxx)",
    };
  }

  if (!parsed.regionName) {
    return { error: "أدخل اسم المنطقة في النص باستخدام 'المنطقة:' أو 'منطقة:'." };
  }

  const region = await prisma.region.findFirst({
    where: { name: { contains: parsed.regionName, mode: "insensitive" } },
  });

  if (!region) {
    return {
      error: `المنطقة '${parsed.regionName}' غير موجودة. تأكد من كتابتها.`,
    };
  }

  const existingInRegion = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone: n, regionId: region.id } },
  });

  const locParsed = parseLocationUrl(parsed.locationUrl);
  if (!locParsed.ok) {
    return { error: locParsed.error };
  }

  const altRaw = parsed.alternatePhone.trim();
  let alternatePhone: string | null = null;
  if (altRaw) {
    const alt = normalizeIraqMobileLocal11(altRaw);
    if (!alt) {
      return { error: "الرقم الثاني غير صالح أو اتركه فارغاً." };
    }
    if (alt === n) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    alternatePhone = alt;
  }

  const remoteTrim = input.remoteImageUrl?.trim() ?? "";
  let photoUrl = existingInRegion?.photoUrl ?? "";
  if (input.uploadedPhotoUrl) {
    if (existingInRegion?.photoUrl) {
      await deleteFromR2(existingInRegion.photoUrl);
    }
    photoUrl = input.uploadedPhotoUrl;
  } else if (remoteTrim) {
    const remote = await profilePhotoFromRemoteUrl(remoteTrim);
    if (!remote.ok) {
      return { error: remote.error };
    }
    if (existingInRegion?.photoUrl) {
      await deleteFromR2(existingInRegion.photoUrl);
    }
    photoUrl = remote.photoUrl;
  }

  if (existingInRegion) {
    await prisma.customerPhoneProfile.update({
      where: { id: existingInRegion.id },
      data: {
        locationUrl: locParsed.url,
        landmark: parsed.landmark.trim(),
        notes: parsed.notes.trim(),
        alternatePhone,
        photoUrl,
      },
    });
  } else {
    await prisma.customerPhoneProfile.create({
      data: {
        phone: n,
        regionId: region.id,
        locationUrl: locParsed.url,
        landmark: parsed.landmark.trim(),
        photoUrl,
        alternatePhone,
        notes: parsed.notes.trim(),
      },
    });
  }

  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/profiles");
  return { ok: true, timestamp: Date.now() };
}

export async function upsertCustomerPhoneProfile(
  _prev: CustomerProfileFormState,
  formData: FormData,
): Promise<CustomerProfileFormState> {
  const rawText = String(formData.get("rawText") ?? "").trim();
  const uploaded = await photoFromForm(formData, "photo");
  if (!uploaded.ok) {
    return { error: uploaded.error };
  }
  const remoteImageUrl = String(formData.get("remoteImageUrl") ?? "").trim() || null;
  return performUpsertCustomerPhoneProfile({
    rawText,
    uploadedPhotoUrl: uploaded.photoUrl,
    remoteImageUrl,
  });
}

export type LegacyKseBatchImportRow = {
  orderId: number;
  status: "imported" | "skipped" | "error" | "cached" | "already_in_db" | "photo_updated";
  detail?: string;
};

/** نتائج مسجّلة في DB — لا نعيد جلب الصفحة بعد النجاح الدائم. */
const LEGACY_KSE_LOG = {
  IMPORTED_NEW: "imported_new",
  /** بروفايل كان موجوداً بلا صورة باب — حُدّث من رابط صورة الباب في صفحة الطلب. */
  PROFILE_PHOTO_FILLED: "profile_photo_filled",
  SKIP_ALREADY_IN_DB: "skip_already_in_db",
  SKIP_NO_CUSTOMER: "skip_no_customer_html",
  ERROR_FETCH: "error_fetch",
  ERROR_SAVE: "error_save",
} as const;

const LEGACY_KSE_NO_REFETCH = new Set<string>([
  LEGACY_KSE_LOG.IMPORTED_NEW,
  LEGACY_KSE_LOG.PROFILE_PHOTO_FILLED,
  LEGACY_KSE_LOG.SKIP_ALREADY_IN_DB,
  LEGACY_KSE_LOG.SKIP_NO_CUSTOMER,
]);

function classifyLegacyFetchFailure(message: string): string {
  if (message.includes("لم يُعثر على قسم") || message.includes("معلومات الزبون")) {
    return LEGACY_KSE_LOG.SKIP_NO_CUSTOMER;
  }
  return LEGACY_KSE_LOG.ERROR_FETCH;
}

async function persistLegacyKseImportLog(
  orderId: number,
  outcome: string,
  fields: {
    phone?: string | null;
    regionId?: string | null;
    profileId?: string | null;
    message?: string | null;
  },
): Promise<void> {
  const msg = fields.message ? fields.message.slice(0, 500) : null;
  await prisma.legacyKseOrderImportLog.upsert({
    where: { orderId },
    create: {
      orderId,
      outcome,
      phone: fields.phone ?? null,
      regionId: fields.regionId ?? null,
      profileId: fields.profileId ?? null,
      message: msg,
    },
    update: {
      outcome,
      phone: fields.phone ?? null,
      regionId: fields.regionId ?? null,
      profileId: fields.profileId ?? null,
      message: msg,
    },
  });
}

/** تحقق من صلاحية النص قبل الحفظ — وهل البروفايل موجود مسبقاً (ريلوي / سحب سابق). */
async function resolveLegacyImportEligibility(rawText: string): Promise<
  | { ok: true; n: string; regionId: string; existingProfileId: string | null }
  | { ok: false; error: string }
> {
  const rawTextTrim = rawText.trim();
  if (!rawTextTrim) {
    return { ok: false, error: "نص فارغ." };
  }

  const parsed = parseCustomerReferenceText(rawTextTrim);
  if (!parsed.phone) {
    return { ok: false, error: "لا رقم جوال في النص." };
  }

  const n = normalizeIraqMobileLocal11(parsed.phone);
  if (!n) {
    return { ok: false, error: "رقم الجوال غير صالح." };
  }

  if (!parsed.regionName.trim()) {
    return { ok: false, error: "لا منطقة في النص." };
  }

  const region = await prisma.region.findFirst({
    where: { name: { contains: parsed.regionName, mode: "insensitive" } },
  });
  if (!region) {
    return { ok: false, error: `المنطقة '${parsed.regionName}' غير موجودة.` };
  }

  const locParsed = parseLocationUrl(parsed.locationUrl);
  if (!locParsed.ok) {
    return { ok: false, error: locParsed.error };
  }

  const altRaw = parsed.alternatePhone.trim();
  if (altRaw) {
    const alt = normalizeIraqMobileLocal11(altRaw);
    if (!alt) {
      return { ok: false, error: "الرقم الثاني غير صالح." };
    }
    if (alt === n) {
      return { ok: false, error: "الرقم الثاني متماثل مع الأساسي." };
    }
  }

  const existing = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone: n, regionId: region.id } },
  });

  return {
    ok: true,
    n,
    regionId: region.id,
    existingProfileId: existing?.id ?? null,
  };
}

const LEGACY_KSE_ORDER_DETAILS_BASE =
  "https://d.ksebstor.site/dashboard/orders_status/details/";
const LEGACY_KSE_BATCH_MAX = 25;
const LEGACY_KSE_BATCH_DELAY_MS_DEFAULT = 400;

function legacyKseOrderDetailsUrl(orderId: number): string {
  return `${LEGACY_KSE_ORDER_DETAILS_BASE}${orderId}`;
}

function formatCompletedFieldsLabel(input: {
  hasPhoto: boolean;
  hasLocation: boolean;
  hasLandmark: boolean;
  hasAlternatePhone: boolean;
}): string {
  const fields: string[] = ["رقم الهاتف", "المنطقة"];
  if (input.hasPhoto) fields.push("صورة الباب");
  if (input.hasLocation) fields.push("اللوكيشن");
  if (input.hasLandmark) fields.push("أقرب نقطة دالة");
  if (input.hasAlternatePhone) fields.push("رقم ثاني");
  return fields.join("، ");
}

function formatPatchedFieldsLabel(patchData: {
  photoUrl?: string;
  locationUrl?: string;
  landmark?: string;
  notes?: string;
  alternatePhone?: string | null;
}): string {
  const fields: string[] = [];
  if (patchData.photoUrl) fields.push("صورة الباب");
  if (patchData.locationUrl) fields.push("اللوكيشن");
  if (patchData.landmark) fields.push("أقرب نقطة دالة");
  if (patchData.alternatePhone) fields.push("الرقم الثاني");
  if (patchData.notes) fields.push("الملاحظات");
  return fields.join("، ");
}

function isMissingFieldValue(v: string | null | undefined): boolean {
  const t = String(v ?? "").trim().toLowerCase();
  if (!t) return true;
  // قيم شكلية قديمة كانت تُستخدم بدل الفراغ
  if (t === "-" || t === "—" || t === "--") return true;
  if (t === "not_found" || t === "null" || t === "undefined") return true;
  if (t === "n/a" || t === "na" || t === "none") return true;
  if (t.includes("لا يوجد") || t.includes("لايوجد") || t.includes("بدون")) return true;
  if (t.includes("غير متوفر") || t.includes("غير موجود")) return true;
  return false;
}

function joinFieldLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join("، ")} و${labels[labels.length - 1]}`;
}

export type LegacyKseRangeStats = {
  rangeStart: number;
  rangeEnd: number;
  totalOrdersInRange: number;
  ordersLogged: number;
  neverAttempted: number;
  /** عدد أزواج (جوال + منطقة) المختلفة كما ظهرت في الطلبات التي خُزّن لها هاتف ومنطقة في السجل. */
  uniqueCustomersFromLoggedOrders: number;
  importedNew: number;
  /** بروفايل موجود سابقاً بلا صورة — أُضيفت صورة الباب من KSE. */
  profilesPhotoFilled: number;
  skipAlreadyInDb: number;
  skipNoCustomer: number;
  errorsRetryable: number;
};

/** إحصائيات نطاق أرقام الطلبات مقابل سجل السحب من KSE (للمقارنة والاستئناف بعد تجديد الكوكي). */
export async function getLegacyKseImportRangeStats(args: {
  rangeStart: number;
  rangeEnd: number;
}): Promise<{ ok: true; stats: LegacyKseRangeStats } | { ok: false; error: string }> {
  if (!(await isAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const start = Math.min(args.rangeStart, args.rangeEnd);
  const end = Math.max(args.rangeStart, args.rangeEnd);
  const totalOrdersInRange = end - start + 1;

  const logs = await prisma.legacyKseOrderImportLog.findMany({
    where: { orderId: { gte: start, lte: end } },
    select: { outcome: true },
  });

  const ordersLogged = logs.length;
  const neverAttempted = Math.max(0, totalOrdersInRange - ordersLogged);

  let importedNew = 0;
  let profilesPhotoFilled = 0;
  let skipAlreadyInDb = 0;
  let skipNoCustomer = 0;
  let errorsRetryable = 0;

  for (const r of logs) {
    switch (r.outcome) {
      case LEGACY_KSE_LOG.IMPORTED_NEW:
        importedNew++;
        break;
      case LEGACY_KSE_LOG.PROFILE_PHOTO_FILLED:
        profilesPhotoFilled++;
        break;
      case LEGACY_KSE_LOG.SKIP_ALREADY_IN_DB:
        skipAlreadyInDb++;
        break;
      case LEGACY_KSE_LOG.SKIP_NO_CUSTOMER:
        skipNoCustomer++;
        break;
      case LEGACY_KSE_LOG.ERROR_FETCH:
      case LEGACY_KSE_LOG.ERROR_SAVE:
        errorsRetryable++;
        break;
      default:
        break;
    }
  }

  const distinctRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT DISTINCT phone, "regionId"
      FROM "LegacyKseOrderImportLog"
      WHERE "orderId" >= ${start}
        AND "orderId" <= ${end}
        AND phone IS NOT NULL
        AND TRIM(phone) <> ''
        AND "regionId" IS NOT NULL
        AND TRIM("regionId") <> ''
    ) AS t
  `;
  const uniqueCustomersFromLoggedOrders = Number(
    distinctRows[0]?.count ?? 0,
  );

  return {
    ok: true,
    stats: {
      rangeStart: start,
      rangeEnd: end,
      totalOrdersInRange,
      ordersLogged,
      neverAttempted,
      uniqueCustomersFromLoggedOrders,
      importedNew,
      profilesPhotoFilled,
      skipAlreadyInDb,
      skipNoCustomer,
      errorsRetryable,
    },
  };
}

/**
 * استيراد دفعي: يجلب صفحات تفاصيل الطلب من الموقع القديم (كل طلب ↔ زبون واحد على الأغلب)
 * ويحفظ في CustomerPhoneProfile. يختلف عن استيراد Railway (قاعدة بيانات زبائن مباشرة).
 * يُسجّل كل طلب في LegacyKseOrderImportLog — عند تجديد الكوكي يُستأنف دون إعادة جلب الطلبات المكتملة.
 */
export async function runLegacyKseOrderDetailsBatchImport(args: {
  orderIds: number[];
  legacyCookie: string | null | undefined;
  delayMs?: number;
}): Promise<
  | { ok: true; rows: LegacyKseBatchImportRow[] }
  | { ok: false; error: string }
> {
  if (!(await isAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const delayMs = Math.min(
    3000,
    Math.max(0, Number(args.delayMs ?? LEGACY_KSE_BATCH_DELAY_MS_DEFAULT) || 0),
  );

  const ids = [...new Set(args.orderIds)]
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, LEGACY_KSE_BATCH_MAX);

  if (ids.length === 0) {
    return { ok: false, error: "أدخل أرقام طلبات صحيحة." };
  }

  const cookie = args.legacyCookie?.trim() || null;
  const rows: LegacyKseBatchImportRow[] = [];

  for (let i = 0; i < ids.length; i++) {
    const orderId = ids[i]!;
    if (i > 0 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const cached = await prisma.legacyKseOrderImportLog.findUnique({
      where: { orderId },
      select: { outcome: true, phone: true, regionId: true },
    });
    if (cached && LEGACY_KSE_NO_REFETCH.has(cached.outcome)) {
      let bypassCacheForMissingPhoto = false;
      let bypassCacheForMissingLocationOrLandmark = false;
      let bypassCacheForRecheckNoCustomer = false;
      let cachedDetail = `سبق المسح (${cached.outcome}) — لن يُعاد الطلب من الموقع بعد تجديد الكوكي.`;
      if (cached.phone && cached.regionId) {
        const prof = await prisma.customerPhoneProfile.findUnique({
          where: {
            phone_regionId: { phone: cached.phone, regionId: cached.regionId },
          },
          select: {
            photoUrl: true,
            locationUrl: true,
            landmark: true,
            alternatePhone: true,
          },
        });
        const noDoorPhoto = !!(prof && isMissingFieldValue(prof.photoUrl));
        const noLocation = !!(prof && isMissingFieldValue(prof.locationUrl));
        const noLandmark = !!(prof && isMissingFieldValue(prof.landmark));
        if (
          noDoorPhoto &&
          (cached.outcome === LEGACY_KSE_LOG.SKIP_ALREADY_IN_DB ||
            cached.outcome === LEGACY_KSE_LOG.IMPORTED_NEW)
        ) {
          bypassCacheForMissingPhoto = true;
        }
        if (
          (noLocation || noLandmark) &&
          (cached.outcome === LEGACY_KSE_LOG.SKIP_ALREADY_IN_DB ||
            cached.outcome === LEGACY_KSE_LOG.IMPORTED_NEW)
        ) {
          bypassCacheForMissingLocationOrLandmark = true;
        }
        if (prof && !bypassCacheForMissingPhoto && !bypassCacheForMissingLocationOrLandmark) {
          const completed = formatCompletedFieldsLabel({
            hasPhoto: !isMissingFieldValue(prof.photoUrl),
            hasLocation: !isMissingFieldValue(prof.locationUrl),
            hasLandmark: !isMissingFieldValue(prof.landmark),
            hasAlternatePhone: !isMissingFieldValue(prof.alternatePhone),
          });
          cachedDetail = `الزبون مسحوب سابقاً وموجود حالياً. البيانات المتوفرة: ${completed}.`;
        }
      } else if (cached.outcome === LEGACY_KSE_LOG.SKIP_NO_CUSTOMER) {
        // بعد تحسين parser قد تنجح الطلبات التي كانت سابقاً تُصنّف skip_no_customer_html.
        // لذلك نسمح بإعادة فحصها عند المرور عليها مجدداً.
        bypassCacheForRecheckNoCustomer = true;
        cachedDetail =
          "هذا الطلب كان مصنفاً سابقاً بلا قسم «معلومات الزبون»، وسيُعاد فحصه الآن بعد تحديث الاستخراج.";
      }
      if (
        !bypassCacheForMissingPhoto &&
        !bypassCacheForMissingLocationOrLandmark &&
        !bypassCacheForRecheckNoCustomer
      ) {
        rows.push({
          orderId,
          status: "cached",
          detail: cachedDetail,
        });
        continue;
      }
    }

    const href = legacyKseOrderDetailsUrl(orderId);
    const imp = await importLegacyOrderDetailsFromUrl(href, cookie);
    if (!imp.ok) {
      const outcome = classifyLegacyFetchFailure(imp.error);
      await persistLegacyKseImportLog(orderId, outcome, { message: imp.error });
      rows.push({
        orderId,
        status: outcome === LEGACY_KSE_LOG.ERROR_FETCH ? "error" : "skipped",
        detail: imp.error,
      });
      continue;
    }

    const elig = await resolveLegacyImportEligibility(imp.rawText);
    if (!elig.ok) {
      await persistLegacyKseImportLog(orderId, LEGACY_KSE_LOG.ERROR_SAVE, {
        message: elig.error,
      });
      rows.push({ orderId, status: "error", detail: elig.error });
      continue;
    }

    if (elig.existingProfileId) {
      const existingProf = await prisma.customerPhoneProfile.findUnique({
        where: { id: elig.existingProfileId },
        select: {
          photoUrl: true,
          locationUrl: true,
          landmark: true,
          notes: true,
          alternatePhone: true,
        },
      });
      const hasPhoto = !isMissingFieldValue(existingProf?.photoUrl);
      const doorUrl = (imp.doorImageUrl ?? "").trim();
      const missingBefore = {
        photo: !hasPhoto,
        location: isMissingFieldValue(existingProf?.locationUrl),
        landmark: isMissingFieldValue(existingProf?.landmark),
        altPhone: isMissingFieldValue(existingProf?.alternatePhone),
      };
      const parsedLegacy = parseCustomerReferenceText(imp.rawText);
      const patchData: {
        photoUrl?: string;
        locationUrl?: string;
        landmark?: string;
        notes?: string;
        alternatePhone?: string | null;
      } = {};

      let photoUpdated = false;
      if (!hasPhoto && doorUrl) {
        const remote = await profilePhotoFromRemoteUrl(doorUrl);
        if (!remote.ok) {
          await persistLegacyKseImportLog(orderId, LEGACY_KSE_LOG.ERROR_SAVE, {
            message: remote.error,
            phone: elig.n,
            regionId: elig.regionId,
          });
          rows.push({ orderId, status: "error", detail: remote.error });
          continue;
        }
        patchData.photoUrl = remote.photoUrl;
        photoUpdated = true;
      }

      if (isMissingFieldValue(existingProf?.locationUrl) && parsedLegacy.locationUrl.trim()) {
        const locParsed = parseLocationUrl(parsedLegacy.locationUrl.trim());
        if (locParsed.ok) {
          patchData.locationUrl = locParsed.url;
        }
      }
      if (isMissingFieldValue(existingProf?.landmark) && parsedLegacy.landmark.trim()) {
        patchData.landmark = parsedLegacy.landmark.trim();
      }
      if (isMissingFieldValue(existingProf?.notes) && parsedLegacy.notes.trim()) {
        patchData.notes = parsedLegacy.notes.trim();
      }
      if (isMissingFieldValue(existingProf?.alternatePhone) && parsedLegacy.alternatePhone.trim()) {
        const alt = normalizeIraqMobileLocal11(parsedLegacy.alternatePhone.trim());
        if (alt && alt !== elig.n) {
          patchData.alternatePhone = alt;
        }
      }

      if (Object.keys(patchData).length > 0) {
        const patchedFields = formatPatchedFieldsLabel(patchData);
        await prisma.customerPhoneProfile.update({
          where: { id: elig.existingProfileId },
          data: patchData,
        });
      }
      if (photoUpdated) {
        await persistLegacyKseImportLog(orderId, LEGACY_KSE_LOG.PROFILE_PHOTO_FILLED, {
          phone: elig.n,
          regionId: elig.regionId,
          profileId: elig.existingProfileId,
        });
        rows.push({
          orderId,
          status: "photo_updated",
          detail: `الزبون موجود مسبقاً وكان ناقص صورة الباب — تمت إضافة صورة الباب${patchedFields && patchedFields !== "صورة الباب" ? `، وتم أيضاً تحديث: ${patchedFields.replace("صورة الباب", "").replace(/^،\s*/, "")}` : ""}.`,
        });
        continue;
      }
      if (Object.keys(patchData).length > 0) {
        const patchedFields = formatPatchedFieldsLabel(patchData);
        await persistLegacyKseImportLog(orderId, LEGACY_KSE_LOG.SKIP_ALREADY_IN_DB, {
          phone: elig.n,
          regionId: elig.regionId,
          profileId: elig.existingProfileId,
          message: `تم تحديث النواقص: ${patchedFields || "حقول إضافية"} من صفحة الطلب.`,
        });
        rows.push({
          orderId,
          status: "already_in_db",
          detail: `الزبون كان موجوداً — تم إكمال النقص: ${patchedFields || "حقول إضافية"}.`,
        });
        continue;
      }

      const stillMissing: string[] = [];
      if (missingBefore.location) stillMissing.push("اللوكيشن");
      if (missingBefore.landmark) stillMissing.push("أقرب نقطة دالة");
      if (missingBefore.photo) stillMissing.push("صورة الباب");
      if (missingBefore.altPhone) stillMissing.push("الرقم الثاني");
      const missingText = joinFieldLabels(stillMissing);

      await persistLegacyKseImportLog(orderId, LEGACY_KSE_LOG.SKIP_ALREADY_IN_DB, {
        phone: elig.n,
        regionId: elig.regionId,
        profileId: elig.existingProfileId,
      });
      rows.push({
        orderId,
        status: "already_in_db",
        detail: hasPhoto
          ? "الزبون موجود مسبقاً وكل التفاصيل الأساسية مكتملة — لا يوجد نقص للتحديث."
          : missingText
            ? `الزبون موجود مسبقاً لكن ما زال ناقص: ${missingText}. لم نجد قيماً صالحة لها داخل صفحة هذا الطلب.`
            : "الزبون موجود مسبقاً لكن لا توجد صورة باب صالحة في صفحة هذا الطلب (أو مكتوب «لا توجد صورة»).",
      });
      continue;
    }

    const save = await performUpsertCustomerPhoneProfile({
      rawText: imp.rawText,
      uploadedPhotoUrl: null,
      remoteImageUrl: imp.doorImageUrl,
    });

    if (save.error) {
      await persistLegacyKseImportLog(orderId, LEGACY_KSE_LOG.ERROR_SAVE, {
        message: save.error,
        phone: elig.n,
        regionId: elig.regionId,
      });
      rows.push({ orderId, status: "error", detail: save.error });
      continue;
    }

    const created = await prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone: elig.n, regionId: elig.regionId } },
    });
    const parsedNew = parseCustomerReferenceText(imp.rawText);
    const importedFields = formatCompletedFieldsLabel({
      hasPhoto: !!(imp.doorImageUrl ?? "").trim(),
      hasLocation: !!parsedNew.locationUrl.trim(),
      hasLandmark: !!parsedNew.landmark.trim(),
      hasAlternatePhone: !!parsedNew.alternatePhone.trim(),
    });
    await persistLegacyKseImportLog(orderId, LEGACY_KSE_LOG.IMPORTED_NEW, {
      phone: elig.n,
      regionId: elig.regionId,
      profileId: created?.id ?? null,
    });
    rows.push({
      orderId,
      status: "imported",
      detail: `الزبون كان غير موجود — تمت إضافته بنجاح. البيانات المسحوبة: ${importedFields}.`,
    });
  }

  return { ok: true, rows };
}

export async function updateCustomerPhoneProfile(
  _prev: CustomerProfileFormState,
  formData: FormData,
): Promise<CustomerProfileFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const existing = await prisma.customerPhoneProfile.findUnique({
    where: { id },
  });
  if (!existing) {
    return { error: "السجل غير موجود" };
  }

  const regionId = String(formData.get("regionId") ?? "").trim();
  if (!regionId) {
    return { error: "اختر المنطقة" };
  }
  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) {
    return { error: "المنطقة غير موجودة" };
  }
  const locParsed = parseLocationUrl(String(formData.get("locationUrl") ?? ""));
  if (!locParsed.ok) {
    return { error: locParsed.error };
  }
  const landmark = String(formData.get("landmark") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const altRaw = String(formData.get("alternatePhone") ?? "").trim();
  let alternatePhone: string | null = null;
  if (altRaw) {
    const alt = normalizeIraqMobileLocal11(altRaw);
    if (!alt) {
      return { error: "الرقم الثاني غير صالح أو اتركه فارغاً." };
    }
    if (alt === existing.phone) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    alternatePhone = alt;
  }
  const removePhoto = formData.get("removePhoto") === "on";

  const uploaded = await photoFromForm(formData, "photo");
  if (!uploaded.ok) {
    return { error: uploaded.error };
  }

  let photoUrl = existing.photoUrl;
  if (removePhoto) {
    if (existing.photoUrl) {
      await deleteFromR2(existing.photoUrl);
    }
    photoUrl = "";
  } else if (uploaded.photoUrl) {
    // إذا رفعنا صورة جديدة وكان هناك صورة قديمة، نمسح القديمة
    if (existing.photoUrl) {
      await deleteFromR2(existing.photoUrl);
    }
    photoUrl = uploaded.photoUrl;
  }

  await prisma.customerPhoneProfile.update({
    where: { id },
    data: {
      regionId,
      locationUrl: locParsed.url,
      landmark,
      notes,
      alternatePhone,
      photoUrl,
    },
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/profiles");
  revalidatePath(`/admin/customers/profiles/${id}/edit`);
  return { ok: true };
}

export async function deleteCustomerPhoneProfile(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/admin/customers/profiles");
  }

  const existing = await prisma.customerPhoneProfile.findUnique({
    where: { id },
    select: { photoUrl: true }
  });

  if (existing?.photoUrl) {
    await deleteFromR2(existing.photoUrl);
  }

  await prisma.customerPhoneProfile.delete({ where: { id } });
  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/profiles");
  redirect("/admin/customers/profiles");
}
