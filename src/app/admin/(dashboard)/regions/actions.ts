"use server";

import { parseAlfInputToDinarNumber } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type RegionWaypointInput = {
  name?: string;
  latitude: number;
  longitude: number;
};

function parseWaypointsFromForm(formData: FormData): RegionWaypointInput[] {
  const raw = String(formData.get("waypointsJson") ?? "").trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("تعذّر قراءة مواقع المنطقة.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("صيغة مواقع المنطقة غير صالحة.");
  }
  const out: RegionWaypointInput[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      continue;
    }
    out.push({
      name: String(row.name ?? "").trim(),
      latitude,
      longitude,
    });
  }
  return out;
}

export type RegionFormState = {
  error?: string;
  ok?: boolean;
};

// الدالة المستخدمة في إضافة منطقة جديدة
export async function createRegion(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const deliveryPriceStr = formData.get("deliveryPrice") as string;
  const deliveryPrice = parseAlfInputToDinarNumber(deliveryPriceStr);

  if (!name || deliveryPrice === null) {
    return { error: "يرجى ملء كافة الحقول بشكل صحيح" };
  }

  try {
    await prisma.region.create({
      data: { name, deliveryPrice }
    });
    revalidatePath("/admin/regions");
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// الدالة المستخدم في التعديل
export async function updateRegion(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const deliveryPriceStr = formData.get("deliveryPrice") as string;
  const deliveryPrice = parseAlfInputToDinarNumber(deliveryPriceStr);
  const skipWaypoints = String(formData.get("skipWaypoints") ?? "") === "1";
  let waypoints: RegionWaypointInput[] = [];

  if (!id || !name || deliveryPrice === null) {
    return { error: "يرجى ملء كافة الحقول بشكل صحيح" };
  }
  if (!skipWaypoints) {
    try {
      waypoints = parseWaypointsFromForm(formData);
    } catch (e: any) {
      return { error: e?.message || "بيانات المواقع غير صالحة" };
    }
  }

  try {
    if (skipWaypoints) {
      await prisma.region.update({
        where: { id },
        data: { name, deliveryPrice },
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.region.update({
          where: { id },
          data: { name, deliveryPrice },
        });
        await tx.regionWaypoint.deleteMany({ where: { regionId: id } });
        if (waypoints.length > 0) {
          await tx.regionWaypoint.createMany({
            data: waypoints.map((w, idx) => ({
              regionId: id,
              name: w.name || `مدخل ${idx + 1}`,
              latitude: w.latitude,
              longitude: w.longitude,
              sortOrder: idx,
            })),
          });
        }
      });
    }
    revalidatePath("/admin/regions");
    revalidatePath(`/admin/regions/${id}/edit`);
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// الدالة المستخدمة في القائمة السريعة
export async function updateRegionAction(id: string, name: string, price: number) {
  try {
    // نعتبر السعر القادم من الواجهة دائماً بـ "الألف" ونحوله للدينار
    const dinarPrice = price * 1000;

    await prisma.region.update({
      where: { id },
      data: {
        name,
        deliveryPrice: dinarPrice
      }
    });
    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
