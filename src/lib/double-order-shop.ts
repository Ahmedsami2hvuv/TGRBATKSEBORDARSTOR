import { prisma } from "@/lib/prisma";

/**
 * الاسم الثابت والمميز لمحل النظام الخاص بطلبات "ذو الوجهتين".
 * هذا المحل لا يمثل محلاً حقيقياً إطلاقاً - هو فقط قيمة وسيطة لإرضاء
 * القيد الإلزامي (shopId) بجدول الطلبات، لأن طلب الوجهتين هو أساساً
 * طلب بين زبون وزبون بدون أي محل فعلي بالموضوع.
 * لا تُغيّر هذا الاسم لاحقاً بدون تحديث الكود هنا معه (البحث دقيق وليس "يحتوي").
 */
const SYSTEM_DOUBLE_ORDER_SHOP_NAME = "نظام - طلبات الوجهتين (لا تحذف)";

let cachedShopId: string | null = null;

/**
 * يرجع معرف (id) محل النظام المخصص لطلبات الوجهتين.
 * إذا لم يكن موجوداً بعد، ينشئه تلقائياً أول مرة يُستخدم فيها.
 */
export async function getSystemDoubleOrderShopId(): Promise<string> {
  if (cachedShopId) return cachedShopId;

  const existing = await prisma.shop.findFirst({
    where: { name: SYSTEM_DOUBLE_ORDER_SHOP_NAME },
    select: { id: true }
  });

  if (existing) {
    cachedShopId = existing.id;
    return existing.id;
  }

  // نحتاج أي منطقة صالحة لإنشاء المحل (الحقل إلزامي بالسكيما)،
  // لكن منطقة هذا المحل بالذات لا تدخل أبداً بحساب سعر توصيل
  // طلبات الوجهتين (مستثناة صراحة بملف order-delivery-compute.ts).
  const anyRegion = await prisma.region.findFirst({ select: { id: true } });
  if (!anyRegion) {
    throw new Error("لا توجد أي منطقة (Region) بالنظام لإنشاء محل الوجهتين الافتراضي");
  }

  const created = await prisma.shop.create({
    data: {
      name: SYSTEM_DOUBLE_ORDER_SHOP_NAME,
      locationUrl: "",
      regionId: anyRegion.id,
      ownerName: "نظام",
      ordersPaused: false,
      hideDebts: true,
      hideFromCreditBook: true
    },
    select: { id: true }
  });

  cachedShopId = created.id;
  return created.id;
}

/**
 * تحديث أو إنشاء سجل الزبون برقم الهاتف وربطه بالمحل والمنطقة
 */
export async function upsertCustomerByPhone(opts: {
  shopId: string;
  phone: string;
  regionId: string | null;
  locationUrl?: string;
  landmark?: string;
  doorPhotoUrl?: string | null;
  alternatePhone?: string | null;
}): Promise<{ id: string }> {
  const { shopId, phone, regionId, locationUrl, landmark, doorPhotoUrl, alternatePhone } = opts;

  const existing = await prisma.customer.findFirst({
    where: { shopId, phone },
  });

  const data = {
    customerRegion: regionId ? { connect: { id: regionId } } : { disconnect: true },
    customerLocationUrl: locationUrl ?? "",
    customerLandmark: landmark ?? "",
    customerDoorPhotoUrl: doorPhotoUrl ?? null,
    alternatePhone: alternatePhone || null,
  };

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
  }

  return prisma.customer.create({
    data: {
      shop: { connect: { id: shopId } },
      phone,
      name: "",
      ...data,
    },
    select: { id: true },
  });
}
