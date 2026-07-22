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
    throw new Error("ØªØ¹Ø°Ù‘Ø± Ù‚Ø±Ø§Ø¡Ø© Ù…ÙˆØ§Ù‚Ø¹ Ø§Ù„Ù…Ù†Ø·Ù‚Ø©.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("ØµÙŠØºØ© Ù…ÙˆØ§Ù‚Ø¹ Ø§Ù„Ù…Ù†Ø·Ù‚Ø© ØºÙŠØ± ØµØ§Ù„Ø­Ø©.");
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

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function getRegionsWithWaypoints() {
  try {
    const list = await prisma.region.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        waypoints: {
          orderBy: { sortOrder: "asc" },
          select: {
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    return { ok: true, regions: list };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// الدالة المستخدمة في إضافة منطقة جديدة
export async function createRegion(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const deliveryPriceStr = formData.get("deliveryPrice") as string;
  const deliveryPrice = parseAlfInputToDinarNumber(deliveryPriceStr);

  if (!name || deliveryPrice === null) {
    return { error: "ÙŠØ±Ø¬Ù‰ Ù…Ù„Ø¡ ÙƒØ§ÙØ© Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø¨Ø´ÙƒÙ„ ØµØ­ÙŠØ­" };
  }

  try {
    await prisma.region.create({
      data: { name, deliveryPrice }
    });
    revalidatePath(`${SECRET_ADMIN_PATH}/regions`);
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Ø§Ù„Ø¯Ø§Ù„Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙÙŠ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„
export async function updateRegion(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const deliveryPriceStr = formData.get("deliveryPrice") as string;
  const deliveryPrice = parseAlfInputToDinarNumber(deliveryPriceStr);
  const skipWaypoints = String(formData.get("skipWaypoints") ?? "") === "1";
  let waypoints: RegionWaypointInput[] = [];

  if (!id || !name || deliveryPrice === null) {
    return { error: "ÙŠØ±Ø¬Ù‰ Ù…Ù„Ø¡ ÙƒØ§ÙØ© Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø¨Ø´ÙƒÙ„ ØµØ­ÙŠØ­" };
  }
  if (!skipWaypoints) {
    try {
      waypoints = parseWaypointsFromForm(formData);
    } catch (e: any) {
      return { error: e?.message || "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ§Ù‚Ø¹ ØºÙŠØ± ØµØ§Ù„Ø­Ø©" };
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
              name: w.name || `Ù…Ø¯Ø®Ù„ ${idx + 1}`,
              latitude: w.latitude,
              longitude: w.longitude,
              sortOrder: idx,
            })),
          });
        }
      });
    }
    revalidatePath(`${SECRET_ADMIN_PATH}/regions`);
    revalidatePath(`${SECRET_ADMIN_PATH}/regions/${id}/edit`);
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Ø§Ù„Ø¯Ø§Ù„Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…Ø© ÙÙŠ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø³Ø±ÙŠØ¹Ø©
export async function updateRegionAction(id: string, name: string, price: number) {
  try {
    // السعر القادم من الواجهة هو السعر النهائي (3 تعني 3 آلاف)
    const dinarPrice = price;

    await prisma.region.update({
      where: { id },
      data: {
        name,
        deliveryPrice: dinarPrice
      }
    });
    revalidatePath(`${SECRET_ADMIN_PATH}/regions`);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

