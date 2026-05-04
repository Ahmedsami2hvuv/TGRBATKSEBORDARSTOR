"use server";

import {
  MAX_ORDER_IMAGE_BYTES,
  saveCustomerProfilePhotoUploaded,
} from "@/lib/order-image";
import { deleteFromR2 } from "@/lib/upload-storage";
import { uploadToR2 } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
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
  const re =
    /^\s*معلومات\s+الزبون\s*$(?:\n[\s\S]*?)(?=\n\s*-{3,}|\n\s*معلومات\s+الطلب\b|$)/im;
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

/** لمسح مسافات/شرطات بين أرقام الهاتف قبل مطابقة 07xxxxxxxx */
function compactForPhoneScan(s: string): string {
  return s.replace(/[\s\u00a0\-_.]/g, "");
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
  const scoped = stripInvisibleMarks(
    sliceLegacyOrderCustomerSection(rawText).replace(/\u00a0/g, " "),
  );
  const scopedNorm = normalizeDigitsToLatin(scoped);
  const scopedPhoneScan = compactForPhoneScan(scopedNorm);
  const lines = scopedNorm.split(/\r?\n/);
  let regionName = "";
  let locationUrl = "";
  let landmark = "";
  let phone = "";
  let alternatePhone = "";
  let notes = "";

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const tPhones = compactForPhoneScan(t);

    if (/^المنطق[ةه]?\s*:/i.test(t) || /^منطقة\s*:/i.test(t)) {
      regionName = t.split(/المنطق[ةه]?\s*:\s*|منطقة\s*:\s*/i)[1]?.trim() ?? "";
      continue;
    }
    if (/^لكيشن الزبون\s*:/i.test(t) || /^اللوكيشن\s*:/i.test(t) || /^الموقع\s*:/i.test(t) || /^لكيشن\s*:/i.test(t)) {
      const match = t.match(/https?:\/\/[^"]+/i);
      if (match) locationUrl = match[0].trim();
      continue;
    }
    if (/^اقرب نقطة دال[ةه]?\s*:/i.test(t) || /^نقطة دال[ةه]?\s*:/i.test(t) || /^دال[ةه]?\s*:/i.test(t)) {
      landmark = t.split(/اقرب نقطة دال[ةه]?\s*:\s*|نقطة دال[ةه]?\s*:\s*|دال[ةه]?\s*:\s*/i)[1]?.trim() ?? "";
      continue;
    }
    if (/^رقم الهاتف الأ[خ]ر\s*:/i.test(t) || /^رقم الهاتف الثاني\s*:/i.test(t) || /^رقم هاتف ثان\s*:/i.test(t) || /^رقم هاتف اخر\s*:/i.test(t) || /^رقم اخر\s*:/i.test(t) || /^رقم هاتف ثانٍ\s*:/i.test(t)) {
      const match = tPhones.match(/07\d{9}/g);
      if (match) alternatePhone = match[0];
      continue;
    }
    const colon = "[:：]";
    if (
      new RegExp(`^رقم\\s*الهاتف\\s*${colon}`, "i").test(t) ||
      new RegExp(`^الهاتف\\s*${colon}`, "i").test(t) ||
      new RegExp(`^الرقم\\s*${colon}`, "i").test(t) ||
      new RegExp(`^رقم\\s*العميل\\s*${colon}`, "i").test(t)
    ) {
      const match = tPhones.match(/07\d{9}/g);
      if (match) phone = match[0];
      continue;
    }
    if (/رقم\s*الهاتف\s*[:：]/i.test(t) && !/أخر|ثان|اخر|ثانٍ/i.test(t)) {
      const match = tPhones.match(/07\d{9}/g);
      if (match && !phone) phone = match[0];
      continue;
    }
    if (/^ملاحظات\s*:/i.test(t) || /^ملاحظه\s*:/i.test(t)) {
      notes = t.split(/ملاحظات\s*:\s*|ملاحظه\s*:\s*/i)[1]?.trim() ?? "";
      continue;
    }
  }

  const allPhones = scopedPhoneScan.match(/07\d{9}/g) || [];
  if (!phone && allPhones[0]) phone = allPhones[0];
  if (!alternatePhone && allPhones[1] && allPhones[1] !== phone) alternatePhone = allPhones[1];

  if (!phone) {
    phone = extractFirstIraqMobileLocal11FromFreeText(scoped);
  }

  if (!locationUrl) {
    const match = scopedNorm.match(/https?:\/\/[^"]+/i);
    if (match) locationUrl = match[0].trim();
  }

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

export async function upsertCustomerPhoneProfile(
  _prev: CustomerProfileFormState,
  formData: FormData,
): Promise<CustomerProfileFormState> {
  const rawText = String(formData.get("rawText") ?? "").trim();
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

  const uploaded = await photoFromForm(formData, "photo");
  if (!uploaded.ok) {
    return { error: uploaded.error };
  }

  const remoteImageUrl = String(formData.get("remoteImageUrl") ?? "").trim();
  let photoUrl = existingInRegion?.photoUrl ?? "";
  if (uploaded.photoUrl) {
    if (existingInRegion?.photoUrl) {
      await deleteFromR2(existingInRegion.photoUrl);
    }
    photoUrl = uploaded.photoUrl;
  } else if (remoteImageUrl) {
    const remote = await profilePhotoFromRemoteUrl(remoteImageUrl);
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
