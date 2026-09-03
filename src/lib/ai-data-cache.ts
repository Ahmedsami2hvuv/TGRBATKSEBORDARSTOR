import { prisma } from "./prisma";

// كاش في الذاكرة لمدة 30 ثانية لتخفيف الضغط بنسبة 95% على سوبابيس ومنع التشنج
let shopsCache: { data: Array<{ id: string; name: string }>; expires: number } | null = null;
let regionsCache: { data: Array<{ id: string; name: string; deliveryPrice: any }>; expires: number } | null = null;
let couriersCache: { data: Array<{ id: string; name: string; phone: string }>; expires: number } | null = null;

export async function getCachedShops(): Promise<Array<{ id: string; name: string }>> {
  const now = Date.now();
  if (shopsCache && shopsCache.expires > now && shopsCache.data.length > 0) {
    return shopsCache.data;
  }
  try {
    const data = await prisma.shop.findMany({ select: { id: true, name: true } });
    shopsCache = { data, expires: now + 30000 };
    return data;
  } catch (e) {
    return shopsCache?.data || [];
  }
}

export async function getCachedRegions(): Promise<Array<{ id: string; name: string; deliveryPrice: any }>> {
  const now = Date.now();
  if (regionsCache && regionsCache.expires > now && regionsCache.data.length > 0) {
    return regionsCache.data;
  }
  try {
    const data = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    regionsCache = { data, expires: now + 30000 };
    return data;
  } catch (e) {
    return regionsCache?.data || [];
  }
}

export async function getCachedCouriers(): Promise<Array<{ id: string; name: string; phone: string }>> {
  const now = Date.now();
  if (couriersCache && couriersCache.expires > now && couriersCache.data.length > 0) {
    return couriersCache.data;
  }
  try {
    const data = await prisma.courier.findMany({ select: { id: true, name: true, phone: true } });
    const wasel = data.find(c => c.name === "واصل");
    if (wasel) {
      await prisma.courier.update({ where: { id: wasel.id }, data: { name: "نجم" } }).catch(() => {});
      wasel.name = "نجم";
    }
    couriersCache = { data, expires: now + 30000 };
    return data;
  } catch (e) {
    return couriersCache?.data || [];
  }
}

export function invalidateAiDataCache() {
  shopsCache = null;
  regionsCache = null;
  couriersCache = null;
}
