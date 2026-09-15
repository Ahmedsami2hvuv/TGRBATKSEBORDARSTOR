import { prisma } from "./prisma";

// كاش في الذاكرة لتفادي استنزاف اتصالات Supabase Pooler
type CacheItem<T> = {
  data: T;
  cachedAt: number;
};

const TTL_MS = 60 * 1000; // دقيقة واحدة

let cachedPreparers: CacheItem<any[]> | null = null;
let cachedWaSettings: CacheItem<any[]> | null = null;
let cachedCouriers: CacheItem<any[]> | null = null;
let cachedStoreProducts: CacheItem<any[]> | null = null;

export async function getCachedCompanyPreparers(): Promise<any[]> {
  const now = Date.now();
  if (cachedPreparers && now - cachedPreparers.cachedAt < TTL_MS) {
    return cachedPreparers.data;
  }
  try {
    const list = await prisma.companyPreparer.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    });
    cachedPreparers = { data: list, cachedAt: now };
    return list;
  } catch (err) {
    console.error("[Cache] Failed to fetch company preparers:", err);
    return cachedPreparers ? cachedPreparers.data : [];
  }
}

export async function getCachedMandoubWaButtonSettings(): Promise<any[]> {
  const now = Date.now();
  if (cachedWaSettings && now - cachedWaSettings.cachedAt < TTL_MS) {
    return cachedWaSettings.data;
  }
  try {
    const list = await prisma.mandoubWaButtonSetting.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    cachedWaSettings = { data: list, cachedAt: now };
    return list;
  } catch (err) {
    console.error("[Cache] Failed to fetch mandoub WA settings:", err);
    return cachedWaSettings ? cachedWaSettings.data : [];
  }
}

export async function getCachedActiveCouriers(): Promise<any[]> {
  const now = Date.now();
  if (cachedCouriers && now - cachedCouriers.cachedAt < TTL_MS) {
    return cachedCouriers.data;
  }
  try {
    const list = await prisma.courier.findMany({
      where: { blocked: false, hiddenFromReports: false },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    });
    cachedCouriers = { data: list, cachedAt: now };
    return list;
  } catch (err) {
    console.error("[Cache] Failed to fetch couriers:", err);
    return cachedCouriers ? cachedCouriers.data : [];
  }
}

export async function getCachedStoreProducts(): Promise<any[]> {
  const now = Date.now();
  if (cachedStoreProducts && now - cachedStoreProducts.cachedAt < TTL_MS) {
    return cachedStoreProducts.data;
  }
  try {
    const list = await prisma.storeProduct.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        salePrice: true,
        hasVariants: true,
        variants: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            salePrice: true,
          },
        },
      },
    });
    cachedStoreProducts = { data: list, cachedAt: now };
    return list;
  } catch (err) {
    console.error("[Cache] Failed to fetch store products:", err);
    return cachedStoreProducts ? cachedStoreProducts.data : [];
  }
}
