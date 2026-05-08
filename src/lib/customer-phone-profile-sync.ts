import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

/**
 * ينسخ صورة باب الزبون مباشرة لكل الطلبات المطابقة (نفس الرقم + نفس المنطقة).
 * يُستخدم بعد رفع صورة الباب من المندوب أو الإدارة.
 * يطابق أرقام الهاتف بعد التطبيع حتى لو تخزين الطلب اختلف قليلاً (07… مقابل 7…).
 */
export async function syncDoorPhotoToOrdersByPhoneRegion(input: {
  phone: string;
  regionId: string | null | undefined;
  doorPhotoUrl: string;
  uploadedByName?: string | null;
}): Promise<void> {
  const targetPhone = normalizeIraqMobileLocal11(input.phone.trim()) ?? "";
  const regionId = input.regionId;
  const door = input.doorPhotoUrl.trim();
  if (!targetPhone || !regionId || !door) return;

  const candidates = await prisma.order.findMany({
    where: { customerRegionId: regionId },
    select: { id: true, customerPhone: true },
  });
  const ids = candidates
    .filter((row) => normalizeIraqMobileLocal11(row.customerPhone) === targetPhone)
    .map((row) => row.id);
  if (ids.length === 0) return;

  await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: {
      customerDoorPhotoUrl: door,
      ...(input.uploadedByName !== undefined
        ? { customerDoorPhotoUploadedByName: input.uploadedByName }
        : {}),
    },
  });
}

/** نسخ صورة باب المستلم (الوجهة الثانية) لكل الطلبات بنفس الرقم والمنطقة الثانية. */
export async function syncSecondDoorPhotoToOrdersByPhoneRegion(input: {
  phone: string;
  regionId: string | null | undefined;
  doorPhotoUrl: string;
  uploadedByName?: string | null;
}): Promise<void> {
  const targetPhone = normalizeIraqMobileLocal11(input.phone.trim()) ?? "";
  const regionId = input.regionId;
  const door = input.doorPhotoUrl.trim();
  if (!targetPhone || !regionId || !door) return;

  const candidates = await prisma.order.findMany({
    where: { secondCustomerRegionId: regionId },
    select: { id: true, secondCustomerPhone: true },
  });
  const ids = candidates
    .filter(
      (row) => normalizeIraqMobileLocal11(row.secondCustomerPhone ?? "") === targetPhone,
    )
    .map((row) => row.id);
  if (ids.length === 0) return;

  await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: {
      secondCustomerDoorPhotoUrl: door,
      ...(input.uploadedByName !== undefined
        ? { secondCustomerDoorPhotoUploadedByName: input.uploadedByName }
        : {}),
    },
  });
}

/** يقرأ الطلب بعد التحديث ويحدّث مرجع (رقم + منطقة الزبون). */
export async function syncPhoneProfileFromOrder(orderId: string, options?: { forceClearLocation?: boolean }): Promise<void> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!o) return;
  const phone = normalizeIraqMobileLocal11(o.customerPhone) ?? "";
  if (!phone || !o.customerRegionId) return;

  /** مصدر الحقول هو الطلب + منطقته فقط — لا ننسخ من `Customer` لتفادي خلط مناطق مختلفة لنفس الرقم. */
  const door = o.customerDoorPhotoUrl?.trim() || "";
  const loc = o.customerLocationUrl?.trim() || "";
  const lm = o.customerLandmark?.trim() || "";
  const alt = o.alternatePhone ?? null;

  await upsertCustomerPhoneProfileFromOrderSnapshot({
    phone,
    regionId: o.customerRegionId,
    locationUrl: loc,
    landmark: lm,
    doorPhotoUrl: door,
    alternatePhone: alt,
    forceClearLocation: options?.forceClearLocation,
  });

  if (door) {
    await syncDoorPhotoToOrdersByPhoneRegion({
      phone,
      regionId: o.customerRegionId,
      doorPhotoUrl: door,
      uploadedByName: o.customerDoorPhotoUploadedByName ?? null,
    });
  }
}

/** وجهة ثانية في طلب double — نفس المنطق بمرجع (رقم الوجهة الثانية + منطقتها). */
export async function syncSecondPhoneProfileFromOrder(orderId: string): Promise<void> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!o?.secondCustomerPhone?.trim() || !o.secondCustomerRegionId) return;
  const phone = normalizeIraqMobileLocal11(o.secondCustomerPhone) ?? "";
  if (!phone) return;

  await upsertCustomerPhoneProfileFromOrderSnapshot({
    phone,
    regionId: o.secondCustomerRegionId,
    locationUrl: o.secondCustomerLocationUrl?.trim() ?? "",
    landmark: o.secondCustomerLandmark?.trim() ?? "",
    doorPhotoUrl: o.secondCustomerDoorPhotoUrl?.trim() ?? "",
    alternatePhone: null,
  });

  const door = o.secondCustomerDoorPhotoUrl?.trim() || "";
  if (door) {
    await syncSecondDoorPhotoToOrdersByPhoneRegion({
      phone: o.secondCustomerPhone,
      regionId: o.secondCustomerRegionId,
      doorPhotoUrl: door,
      uploadedByName: o.secondCustomerDoorPhotoUploadedByName ?? null,
    });
  }
}

/**
 * يحدّث مرجع (رقم + منطقة) من بيانات الطلب بعد المندوب أو الإدارة.
 * لا يمسح حقل `notes` (ملاحظات الإدارة).
 */
export async function upsertCustomerPhoneProfileFromOrderSnapshot(input: {
  phone: string;
  regionId: string | null | undefined;
  locationUrl: string;
  landmark: string;
  doorPhotoUrl: string;
  alternatePhone: string | null;
  forceClearLocation?: boolean;
}): Promise<void> {
  const phone = normalizeIraqMobileLocal11(input.phone.trim()) ?? "";
  if (!phone || !input.regionId) return;

  const existing = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone, regionId: input.regionId } },
  });

  const nextDoor = input.doorPhotoUrl.trim() || existing?.photoUrl?.trim() || "";
  const nextLoc = input.forceClearLocation
    ? ""
    : input.locationUrl.trim() || existing?.locationUrl?.trim() || "";
  const nextLandmark = input.landmark.trim() || existing?.landmark?.trim() || "";
  const nextAlt = input.alternatePhone ?? existing?.alternatePhone ?? null;

  await prisma.customerPhoneProfile.upsert({
    where: { phone_regionId: { phone, regionId: input.regionId } },
    create: {
      phone,
      regionId: input.regionId,
      locationUrl: nextLoc,
      landmark: nextLandmark,
      photoUrl: nextDoor,
      alternatePhone: nextAlt,
      notes: "",
    },
    update: {
      locationUrl: nextLoc,
      landmark: nextLandmark,
      ...(nextDoor ? { photoUrl: nextDoor } : {}),
      alternatePhone: nextAlt,
    },
  });
}
