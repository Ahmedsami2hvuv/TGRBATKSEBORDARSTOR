"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * دالة لاستخراج خطوط الطول والعرض من النص المنسوخ
 */
function parseLatLng(input: string): { latitude: number; longitude: number } | null {
  const clean = input.replace(/[()]/g, "").trim();
  const parts = clean.split(/[,\s]+/);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

export async function addSmartHintAction(name: string, locationStr: string) {
  if (!name.trim()) {
    throw new Error("اسم المدخل مطلوب");
  }

  const coords = parseLatLng(locationStr);
  if (!coords) {
    throw new Error("تنسيق الإحداثيات غير صحيح. يرجى إدخال قيمتين مفصولتين بفاصلة أو مسافة (مثال: 30.4410, 48.0137)");
  }

  // 1. البحث عن منطقة "استدلالات عامة" أو إنشاؤها
  let generalRegion = await prisma.region.findFirst({
    where: { name: "استدلالات عامة" },
  });

  if (!generalRegion) {
    generalRegion = await prisma.region.create({
      data: {
        name: "استدلالات عامة",
        deliveryPrice: 0,
      },
    });
  }

  // 2. إيجاد أكبر sortOrder لإضافة النقطة في نهاية القائمة
  const maxSort = await prisma.regionWaypoint.findFirst({
    where: { regionId: generalRegion.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextSort = (maxSort?.sortOrder ?? 0) + 1;

  // 3. إضافة النقطة الدالة
  await prisma.regionWaypoint.create({
    data: {
      regionId: generalRegion.id,
      name: name.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      sortOrder: nextSort,
    },
  });

  revalidatePath("/abo1stor3hlaa2kbr8-47/smart-hints");
  return { success: true };
}

export async function deleteSmartHintAction(waypointId: string) {
  if (!waypointId) {
    throw new Error("معرّف النقطة مطلوب");
  }

  await prisma.regionWaypoint.delete({
    where: { id: waypointId },
  });

  revalidatePath("/abo1stor3hlaa2kbr8-47/smart-hints");
  return { success: true };
}
