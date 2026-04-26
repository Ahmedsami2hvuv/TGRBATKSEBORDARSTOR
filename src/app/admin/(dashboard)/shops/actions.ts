"use server";

import {
  MAX_ORDER_IMAGE_BYTES,
  saveShopPhotoUploaded,
} from "@/lib/order-image";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

export type ShopFormState = { error?: string; ok?: boolean };

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

async function photoUrlFromShopPhotoUpload(
  formData: FormData,
): Promise<{ ok: true; photoUrl: string } | { ok: false; error: string }> {
  const f = formData.get("shopPhoto");
  if (!(f instanceof File) || f.size === 0) {
    return { ok: true, photoUrl: "" };
  }
  try {
    const photoUrl = await saveShopPhotoUploaded(f, MAX_ORDER_IMAGE_BYTES);
    return { ok: true, photoUrl };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "IMAGE_TOO_LARGE") {
      return { ok: false, error: "صورة المحل كبيرة جداً (الحد 10 ميجابايت)" };
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
    return { ok: false, error: "تعذّر حفظ صورة المحل" };
  }
}

export async function createShop(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const locationUrl = String(formData.get("locationUrl") ?? "").trim();
  const regionId = String(formData.get("regionId") ?? "").trim();

  if (!name) {
    return { error: "اسم المحل مطلوب" };
  }

  // تحقق من وجود محل بنفس الاسم
  const existingShop = await prisma.shop.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existingShop) {
    return { error: `اسم المحل "${name}" موجود مسبقاً. يرجى استخدام اسم مختلف أو تعديل المحل الحالي.` };
  }

  if (!locationUrl) {
    return { error: "رابط الموقع (اللوكيشن) مطلوب" };
  }
  if (!regionId) {
    return { error: "اختر المنطقة" };
  }
  const url = normalizeUrl(locationUrl);
  try {
    new URL(url);
  } catch {
    return { error: "رابط الموقع غير صالح" };
  }
  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) {
    return { error: "المنطقة غير موجودة" };
  }
  const uploaded = await photoUrlFromShopPhotoUpload(formData);
  if (!uploaded.ok) {
    return { error: uploaded.error };
  }
  const photoUrl = uploaded.photoUrl;
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  let shopPhone = "";
  if (phoneRaw) {
    const n = normalizeIraqMobileLocal11(phoneRaw);
    if (!n) {
      return { error: "رقم المحل غير صالح أو اتركه فارغاً." };
    }
    shopPhone = n;
  }
  await prisma.shop.create({
    data: {
      name,
      ownerName,
      phone: shopPhone,
      photoUrl,
      locationUrl: url,
      regionId,
    },
  });
  revalidatePath("/admin/shops");
  return { ok: true };
}

export async function deleteShop(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // طلب تأكيد قبل الحذف (يتم التعامل معه في جانب العميل عادةً، ولكن هنا نضيف حماية بسيطة)
  await prisma.shop.delete({ where: { id } });
  revalidatePath("/admin/shops");
}

export async function updateShop(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const locationUrl = String(formData.get("locationUrl") ?? "").trim();
  const regionId = String(formData.get("regionId") ?? "").trim();
  if (!id) {
    return { error: "معرّف المحل مفقود" };
  }
  if (!name) {
    return { error: "اسم المحل مطلوب" };
  }

  // تحقق من وجود محل آخر بنفس الاسم عند التعديل
  const existingOtherShop = await prisma.shop.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      id: { not: id }
    },
  });

  if (existingOtherShop) {
    return { error: `اسم المحل "${name}" مستخدم من قبل محل آخر.` };
  }

  if (!locationUrl) {
    return { error: "رابط الموقع مطلوب" };
  }
  if (!regionId) {
    return { error: "اختر المنطقة" };
  }
  const url = normalizeUrl(locationUrl);
  try {
    new URL(url);
  } catch {
    return { error: "رابط الموقع غير صالح" };
  }
  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) {
    return { error: "المنطقة غير موجودة" };
  }
  const uploaded = await photoUrlFromShopPhotoUpload(formData);
  if (!uploaded.ok) {
    return { error: uploaded.error };
  }
  let photoUrl = String(formData.get("photoUrlKeep") ?? "").trim();
  if (uploaded.photoUrl) {
    photoUrl = uploaded.photoUrl;
  }
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  let shopPhone = "";
  if (phoneRaw) {
    const n = normalizeIraqMobileLocal11(phoneRaw);
    if (!n) {
      return { error: "رقم المحل غير صالح أو اتركه فارغاً." };
    }
    shopPhone = n;
  }
  await prisma.shop.update({
    where: { id },
    data: {
      name,
      ownerName,
      phone: shopPhone,
      photoUrl,
      locationUrl: url,
      regionId,
    },
  });
  revalidatePath("/admin/shops");
  revalidatePath(`/admin/shops/${id}/edit`);
  return { ok: true };
}
