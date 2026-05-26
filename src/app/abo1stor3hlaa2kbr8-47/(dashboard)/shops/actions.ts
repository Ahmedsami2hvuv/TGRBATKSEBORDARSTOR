"use server";

import {
  MAX_ORDER_IMAGE_BYTES,
  saveShopPhotoUploaded,
} from "@/lib/order-image";
import { deleteFromR2 } from "@/lib/upload-storage";
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

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function createShop(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const locationUrl = String(formData.get("locationUrl") ?? "").trim();
  const regionId = String(formData.get("regionId") ?? "").trim();

  // بيانات العميل الأول
  const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();

  if (!name) return { error: "اسم المحل مطلوب" };
  if (!locationUrl) return { error: "رابط الموقع (اللوكيشن) مطلوب" };
  if (!regionId) return { error: "اختر المنطقة" };
  if (!customerPhoneRaw) return { error: "رقم العميل الأول مطلوب" };

  const customerPhone = normalizeIraqMobileLocal11(customerPhoneRaw);
  if (!customerPhone) return { error: "رقم العميل غير صالح" };

  // تحقق من وجود محل بنفس الاسم
  const existingShop = await prisma.shop.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existingShop) {
    return { error: `اسم المحل "${name}" موجود مسبقاً.` };
  }

  const url = normalizeUrl(locationUrl);
  try {
    new URL(url);
  } catch {
    return { error: "رابط الموقع غير صالح" };
  }

  const uploaded = await photoUrlFromShopPhotoUpload(formData);
  if (!uploaded.ok) return { error: uploaded.error };

  try {
    await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name,
          ownerName: "", // تم إلغاؤه كما طلب المستخدم
          phone: "",     // تم إلغاؤه كما طلب المستخدم
          photoUrl: uploaded.photoUrl,
          locationUrl: url,
          regionId,
        },
      });

      // إنشاء العميل الأول للمحل تلقائياً
      await tx.customer.create({
        data: {
          shopId: shop.id,
          phone: customerPhone,
          name: customerName || "العميل الأول",
          customerRegionId: regionId, // افتراضياً نفس منطقة المحل
          customerLocationUrl: url,
        },
      });
    });

    revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
    return { ok: true };
  } catch (e) {
    console.error("Create shop error:", e);
    return { error: "فشل في إنشاء المحل والعميل" };
  }
}

export async function deleteShop(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const existing = await prisma.shop.findUnique({
    where: { id },
    select: { photoUrl: true }
  }) as any;

  if (existing) {
    if (existing.photoUrl) await deleteFromR2(existing.photoUrl);
  }

  await prisma.shop.delete({ where: { id } });
  revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
}

export async function updateShop(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const locationUrl = String(formData.get("locationUrl") ?? "").trim();
  const regionId = String(formData.get("regionId") ?? "").trim();

  if (!id) return { error: "معرّف المحل مفقود" };
  if (!name) return { error: "اسم المحل مطلوب" };

  const existingOtherShop = await prisma.shop.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      id: { not: id }
    },
  });
  if (existingOtherShop) return { error: `اسم المحل "${name}" مستخدم مسبقاً.` };

  const url = normalizeUrl(locationUrl);
  const uploaded = await photoUrlFromShopPhotoUpload(formData);
  if (!uploaded.ok) return { error: uploaded.error };

  const existing = await prisma.shop.findUnique({ where: { id } });
  let photoUrl = existing?.photoUrl || "";
  if (uploaded.photoUrl) {
    if (existing?.photoUrl) await deleteFromR2(existing.photoUrl);
    photoUrl = uploaded.photoUrl;
  }

  await prisma.shop.update({
    where: { id },
    data: {
      name,
      photoUrl,
      locationUrl: url,
      regionId,
    },
  });

  revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
  revalidatePath(`${SECRET_ADMIN_PATH}/shops/${id}/edit`);
  return { ok: true };
}
