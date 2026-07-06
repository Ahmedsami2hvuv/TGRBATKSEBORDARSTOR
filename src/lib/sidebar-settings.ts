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
