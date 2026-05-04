/** روابط لوحة الإدارة — المربعات والشريط الجانبي */

export type AdminTile = {
  slug: string;
  label: string;
  iconKey: string;
  /** إن وُجد يُستخدم مباشرة بدل /admin/module/[slug] */
  href?: string;
};

export const ADMIN_TILES: AdminTile[] = [
  { slug: "new-orders", label: "الطلبات الجديدة", iconKey: "ui_inbox", href: "/admin/orders/pending" },
  { slug: "order-tracking", label: "تتبع الطلبات", iconKey: "ui_location", href: "/admin/orders/tracking" },
  { slug: "admin-create-order", label: "إضافة طلب من الإدارة", iconKey: "ui_add", href: "/admin/orders/new" },
  { slug: "archived-orders", label: "الطلبات المؤرشفة", iconKey: "ui_package", href: "/admin/orders/archived" },
  { slug: "rejected-orders", label: "المرفوضة", iconKey: "ui_error", href: "/admin/orders/tracking?status=cancelled" },
  { slug: "reports", label: "التقارير", iconKey: "ui_chart", href: "/admin/reports" },
  { slug: "prep-notices", label: "إشعارات تجهيز المجهزين", iconKey: "ui_announcement", href: "/admin/prep-notices" },
  { slug: "new-customer-profile", label: "إضافة زبون مرجعي", iconKey: "ui_user_add", href: "/admin/customers/profiles/new" },
  {
    slug: "legacy-kse-profiles-batch",
    label: "استيراد زبائن KSE (دفعات)",
    iconKey: "ui_package",
    href: "/admin/customers/profiles/import-legacy-kse",
  },
  { slug: "customers", label: "بيانات الزبائن", iconKey: "ui_users", href: "/admin/customers" },
  { slug: "couriers", label: "المندوبين", iconKey: "ui_courier", href: "/admin/couriers" },
  { slug: "courier-map", label: "خريطة المندوبين", iconKey: "ui_map", href: "/admin/couriers/map" },
  { slug: "preparers", label: "المجهزين", iconKey: "ui_preparer", href: "/admin/preparers" },
  { slug: "suppliers", label: "الموردين", iconKey: "ui_supplier", href: "/admin/suppliers" },
  { slug: "employees", label: "الموظفين", iconKey: "ui_employee", href: "/admin/employees" },
  { slug: "shops", label: "المحلات", iconKey: "ui_shops", href: "/admin/shops" },
  { slug: "regions", label: "المناطق", iconKey: "ui_map", href: "/admin/regions" },
  { slug: "wa-buttons", label: "أزرار واتساب للمندوب", iconKey: "ui_whatsapp", href: "/admin/wa-buttons" },
  { slug: "super-search", label: "البحث الخارق", iconKey: "ui_search", href: "/admin/search" },
  {
    slug: "store",
    label: "المتجر",
    iconKey: "ui_shops",
    href: "/admin/store",
  },
  { slug: "ai-settings", label: "مساعد أبو الأكبر (AI)", iconKey: "ui_ai", href: "/admin/settings/ai" },
  { slug: "settings", label: "الإعدادات", iconKey: "ui_settings", href: "/admin/settings" },
  { slug: "notification-settings", label: "إشعارات المتصفح", iconKey: "ui_notification", href: "/admin/settings#notifications" },
];

export function tileHref(tile: AdminTile): string {
  return tile.href ?? `/admin/module/${tile.slug}`;
}

function isVisibleTile(tile: AdminTile): boolean {
  return true;
}

const SIDEBAR_ORDER_FIRST: readonly string[] = [
  "new-orders",
  "order-tracking",
  "admin-create-order",
];

export function adminSidebarTiles(): AdminTile[] {
  const first = SIDEBAR_ORDER_FIRST.map((slug) => {
    const t = ADMIN_TILES.find((x) => x.slug === slug);
    if (!t) throw new Error(`Missing admin tile: ${slug}`);
    return t;
  }).filter(isVisibleTile);
  const rest = ADMIN_TILES.filter(
    (t) => !SIDEBAR_ORDER_FIRST.includes(t.slug) && isVisibleTile(t),
  );
  return [...first, ...rest];
}

export function isTileEnabled(slug: string): boolean {
  const t = ADMIN_TILES.find((x) => x.slug === slug);
  if (!t) return false;
  return isVisibleTile(t);
}