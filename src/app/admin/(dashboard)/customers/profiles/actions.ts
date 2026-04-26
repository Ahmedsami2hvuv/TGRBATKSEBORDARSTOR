"use server";

import {
  MAX_ORDER_IMAGE_BYTES,
  saveCustomerProfilePhotoUploaded,
} from "@/lib/order-image";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CustomerProfileFormState = { error?: string; ok?: boolean; timestamp?: number };

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

function parseCustomerReferenceText(rawText: string) {
  const lines = rawText.split(/\r?\n/);
  let regionName = "";
  let locationUrl = "";
  let landmark = "";
  let phone = "";
  let alternatePhone = "";
  let notes = "";

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

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
      const match = t.match(/07\d{9}/g);
      if (match) alternatePhone = match[0];
      continue;
    }
    if (/^رقم الهاتف\s*:/i.test(t) || /^الهاتف\s*:/i.test(t) || /^الرقم\s*:/i.test(t)) {
      const match = t.match(/07\d{9}/g);
      if (match) phone = match[0];
      continue;
    }
    if (/^ملاحظات\s*:/i.test(t) || /^ملاحظه\s*:/i.test(t)) {
      notes = t.split(/ملاحظات\s*:\s*|ملاحظه\s*:\s*/i)[1]?.trim() ?? "";
      continue;
    }
  }

  const allPhones = rawText.match(/07\d{9}/g) || [];
  if (!phone && allPhones[0]) phone = allPhones[0];
  if (!alternatePhone && allPhones[1] && allPhones[1] !== phone) alternatePhone = allPhones[1];

  if (!locationUrl) {
    const match = rawText.match(/https?:\/\/[^"]+/i);
    if (match) locationUrl = match[0].trim();
  }

  return { regionName, locationUrl, landmark, phone, alternatePhone, notes };
}

export async function checkCustomerExistsByPhone(phone: string): Promise<boolean> {
  const n = normalizeIraqMobileLocal11(phone);
  if (!n) return false;
  const existing = await prisma.customerPhoneProfile.findFirst({
    where: { phone: n },
  });
  return !!existing;
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
    return { error: "أدخل رقم الهاتف في النص باستخدام 'رقم الهاتف:'." };
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

  const existing = await prisma.customerPhoneProfile.findFirst({
    where: { phone: n },
  });

  if (existing) {
    return { error: "هذا الزبون موجود مسبقاً في النظام." };
  }

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

  let photoUrl = "";
  if (uploaded.photoUrl) {
    photoUrl = uploaded.photoUrl;
  }

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

  // لا نستدعي revalidatePath هنا لأن النموذج يعيد تعيين نفسه
  // والمستخدم لا ينتظر إعادة تحميل الصفحة
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
    photoUrl = "";
  } else if (uploaded.photoUrl) {
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
  await prisma.customerPhoneProfile.delete({ where: { id } });
  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/profiles");
  redirect("/admin/customers/profiles");
}
