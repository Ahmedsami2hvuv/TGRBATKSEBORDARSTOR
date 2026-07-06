import { prisma } from "@/lib/prisma";
import { getCurrentSessionName } from "@/lib/admin-session";
import { ADMIN_TILES, AdminTile } from "@/lib/admin-nav";

export type CustomTile = {
  slug: string;
  label: string;
  href: string;
  iconKey: string;
};

export type SidebarConfig = {
  orderedSlugs: string[];
  layoutColumns: 1 | 2 | 3;
  buttonShape: "square" | "rectangle";
  customTiles: CustomTile[];
};

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  orderedSlugs: ADMIN_TILES.map(tile => tile.slug),
  layoutColumns: 1,
  buttonShape: "rectangle",
  customTiles: [],
};

const SECTION = "sidebar-config";

export async function getSidebarConfig(): Promise<SidebarConfig> {
  try {
    const adminName = await getCurrentSessionName();
    const target = `admin:${adminName}`;

    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target, section: SECTION }
      }
    });

    if (!setting) {
      return DEFAULT_SIDEBAR_CONFIG;
    }

    const config = setting.config as any;

    return {
      orderedSlugs: Array.isArray(config?.orderedSlugs) ? config.orderedSlugs : DEFAULT_SIDEBAR_CONFIG.orderedSlugs,
      layoutColumns: [1, 2, 3].includes(config?.layoutColumns) ? config.layoutColumns : DEFAULT_SIDEBAR_CONFIG.layoutColumns,
      buttonShape: ["square", "rectangle"].includes(config?.buttonShape) ? config.buttonShape : DEFAULT_SIDEBAR_CONFIG.buttonShape,
      customTiles: Array.isArray(config?.customTiles) ? config.customTiles : DEFAULT_SIDEBAR_CONFIG.customTiles,
    };
  } catch (e) {
    console.error("Failed to load sidebar configuration:", e);
    return DEFAULT_SIDEBAR_CONFIG;
  }
}

export async function saveSidebarConfig(config: SidebarConfig) {
  try {
    const adminName = await getCurrentSessionName();
    const target = `admin:${adminName}`;

    return await prisma.uISystemSetting.upsert({
      where: {
        target_section: { target, section: SECTION }
      },
      update: { config: config as any },
      create: { target, section: SECTION, config: config as any }
    });
  } catch (e) {
    console.error("Failed to save sidebar configuration:", e);
    throw new Error("حدث خطأ أثناء حفظ إعدادات القائمة الجانبية.");
  }
}

/** دمج الأزرار الثابتة مع الأزرار المخصصة وبترتيب مخصص */
export function getMergedSidebarTiles(config: SidebarConfig): AdminTile[] {
  // 1. تجميع كل الأزرار المتاحة
  const allTilesMap = new Map<string, AdminTile>();
  
  // الأزرار الثابتة من النظام
  ADMIN_TILES.forEach(tile => {
    allTilesMap.set(tile.slug, tile);
  });

  // الأزرار المخصصة التي أضافها المستخدم
  config.customTiles.forEach(tile => {
    allTilesMap.set(tile.slug, {
      slug: tile.slug,
      label: tile.label,
      href: tile.href,
      iconKey: tile.iconKey || "ui_link", // أيقونة افتراضية للأزرار المخصصة
    });
  });

  // 2. الترتيب بناءً على مصفوفة الترتيب المخصصة
  const orderedTiles: AdminTile[] = [];
  const processedSlugs = new Set<string>();

  // إضافة الأزرار المرتبة
  config.orderedSlugs.forEach(slug => {
    const tile = allTilesMap.get(slug);
    if (tile) {
      orderedTiles.push(tile);
      processedSlugs.add(slug);
    }
  });

  // إضافة أي أزرار جديدة غير موجودة في مصفوفة الترتيب
  allTilesMap.forEach((tile, slug) => {
    if (!processedSlugs.has(slug)) {
      orderedTiles.push(tile);
    }
  });

  return orderedTiles;
}
