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

/** يقرأ الطلب بعد التحديث ويحدّث مرجع (رقم + منطقة الزبون)، ويرفد الطلب بالتلقائيات إن كانت فارغة. */
export async function syncPhoneProfileFromOrder(
  orderId: string,
  options?: { forceClearLocation?: boolean; forceClearLandmark?: boolean },
): Promise<void> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!o) return;
  const phone = normalizeIraqMobileLocal11(o.customerPhone) ?? "";
  if (!phone || !o.customerRegionId) return;

  const existingProfile = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone, regionId: o.customerRegionId } },
  });

  // تعبئة الطلب تلقائياً إن كانت حقوله فارغة والبروفايل يحتوي عليها
  if (existingProfile) {
    const patch: any = {};
    if (!o.customerDoorPhotoUrl?.trim() && existingProfile.photoUrl?.trim()) {
      patch.customerDoorPhotoUrl = existingProfile.photoUrl.trim();
    }
    if (!o.customerLocationUrl?.trim() && existingProfile.locationUrl?.trim() && !options?.forceClearLocation) {
      patch.customerLocationUrl = existingProfile.locationUrl.trim();
    }
    if (!o.customerLandmark?.trim() && existingProfile.landmark?.trim() && !options?.forceClearLandmark) {
      patch.customerLandmark = existingProfile.landmark.trim();
    }
    if (!o.alternatePhone?.trim() && existingProfile.alternatePhone?.trim()) {
      patch.alternatePhone = existingProfile.alternatePhone.trim();
    }

    if (Object.keys(patch).length > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: patch,
      });
      // تحديث الكائن المحلي
      if (patch.customerDoorPhotoUrl) (o as any).customerDoorPhotoUrl = patch.customerDoorPhotoUrl;
      if (patch.customerLocationUrl) (o as any).customerLocationUrl = patch.customerLocationUrl;
      if (patch.customerLandmark) (o as any).customerLandmark = patch.customerLandmark;
      if (patch.alternatePhone) (o as any).alternatePhone = patch.alternatePhone;
    }
  }

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
    forceClearLandmark: options?.forceClearLandmark,
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
export async function syncSecondPhoneProfileFromOrder(
  orderId: string,
  options?: { forceClearLocation?: boolean; forceClearLandmark?: boolean },
): Promise<void> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!o?.secondCustomerPhone?.trim() || !o.secondCustomerRegionId) return;
  const phone = normalizeIraqMobileLocal11(o.secondCustomerPhone) ?? "";
  if (!phone) return;

  const existingProfile = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone, regionId: o.secondCustomerRegionId } },
  });

  if (existingProfile) {
    const patch: any = {};
    if (!o.secondCustomerDoorPhotoUrl?.trim() && existingProfile.photoUrl?.trim()) {
      patch.secondCustomerDoorPhotoUrl = existingProfile.photoUrl.trim();
    }
    if (!o.secondCustomerLocationUrl?.trim() && existingProfile.locationUrl?.trim() && !options?.forceClearLocation) {
      patch.secondCustomerLocationUrl = existingProfile.locationUrl.trim();
    }
    if (!o.secondCustomerLandmark?.trim() && existingProfile.landmark?.trim() && !options?.forceClearLandmark) {
      patch.secondCustomerLandmark = existingProfile.landmark.trim();
    }
    if (!o.secondCustomerAlternatePhone?.trim() && existingProfile.alternatePhone?.trim()) {
      patch.secondCustomerAlternatePhone = existingProfile.alternatePhone.trim();
    }

    if (Object.keys(patch).length > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: patch,
      });
      if (patch.secondCustomerDoorPhotoUrl) (o as any).secondCustomerDoorPhotoUrl = patch.secondCustomerDoorPhotoUrl;
      if (patch.secondCustomerLocationUrl) (o as any).secondCustomerLocationUrl = patch.secondCustomerLocationUrl;
      if (patch.secondCustomerLandmark) (o as any).secondCustomerLandmark = patch.secondCustomerLandmark;
      if (patch.secondCustomerAlternatePhone) (o as any).secondCustomerAlternatePhone = patch.secondCustomerAlternatePhone;
    }
  }

  await upsertCustomerPhoneProfileFromOrderSnapshot({
    phone,
    regionId: o.secondCustomerRegionId,
    locationUrl: o.secondCustomerLocationUrl?.trim() ?? "",
    landmark: o.secondCustomerLandmark?.trim() ?? "",
    doorPhotoUrl: o.secondCustomerDoorPhotoUrl?.trim() ?? "",
    alternatePhone: null,
    forceClearLocation: options?.forceClearLocation,
    forceClearLandmark: options?.forceClearLandmark,
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
  forceClearLandmark?: boolean;
}): Promise<void> {
  const phone = normalizeIraqMobileLocal11(input.phone.trim()) ?? "";
  const regionId = input.regionId?.trim();
  if (!phone || !regionId) return;

  const existing = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone, regionId } },
  });

  const nextDoor = input.doorPhotoUrl.trim() || existing?.photoUrl?.trim() || "";
  const nextLoc = input.forceClearLocation
    ? ""
    : input.locationUrl.trim() || existing?.locationUrl?.trim() || "";
  const nextLandmark = input.forceClearLandmark
    ? ""
    : input.landmark.trim() || existing?.landmark?.trim() || "";
  const nextAlt = input.alternatePhone ?? existing?.alternatePhone ?? null;

  await prisma.customerPhoneProfile.upsert({
    where: { phone_regionId: { phone, regionId } },
    create: {
      phone,
      regionId,
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
