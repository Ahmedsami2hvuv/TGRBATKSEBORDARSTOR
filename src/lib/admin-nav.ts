/** روابط لوحة الإدارة — المربعات والشريط الجانبي */

export type AdminTile = {
  slug: string;
  label: string;
  emoji: string;
  /** إن وُجد يُستخدم مباشرة بدل /admin/module/[slug] */
  href?: string;
};

export const ADMIN_TILES: AdminTile[] = [
  { slug: "new-orders", label: "الطلبات الجديدة", emoji: "📥", href: "/admin/orders/pending" },
  { slug: "order-tracking", label: "تتبع الطلبات", emoji: "📍", href: "/admin/orders/tracking" },
  { slug: "admin-create-order", label: "إضافة طلب من الإدارة", emoji: "➕", href: "/admin/orders/new" },
  { slug: "archived-orders", label: "الطلبات المؤرشفة", emoji: "📦", href: "/admin/orders/archived" },
  { slug: "rejected-orders", label: "المرفوضة", emoji: "❌", href: "/admin/orders/tracking?status=cancelled" },
  { slug: "reports", label: "التقارير", emoji: "📊", href: "/admin/reports" },
  { slug: "prep-notices", label: "إشعارات تجهيز المجهزين", emoji: "📣", href: "/admin/prep-notices" },
  { slug: "new-customer-profile", label: "إضافة زبون مرجعي", emoji: "👤➕", href: "/admin/customers/profiles/new" },
  { slug: "customers", label: "بيانات الزبائن", emoji: "👥", href: "/admin/customers" },
  { slug: "couriers", label: "المندوبين", emoji: "🏍️", href: "/admin/couriers" },
  { slug: "courier-map", label: "خريطة المندوبين", emoji: "🗺️", href: "/admin/couriers/map" },
  { slug: "preparers", label: "المجهزين", emoji: "👨‍🍳", href: "/admin/preparers" },
  { slug: "suppliers", label: "الموردين", emoji: "🍎", href: "/admin/suppliers" },
  { slug: "employees", label: "الموظفين", emoji: "🧑‍💼", href: "/admin/employees" },
  { slug: "shops", label: "المحلات", emoji: "🏪", href: "/admin/shops" },
  { slug: "regions", label: "المناطق", emoji: "🗺️", href: "/admin/regions" },
  { slug: "wa-buttons", label: "أزرار واتساب للمندوب", emoji: "💬", href: "/admin/wa-buttons" },
  { slug: "super-search", label: "البحث الخارق", emoji: "🔎", href: "/admin/search" },
  {
    slug: "store",
    label: "المتجر",
    emoji: "🛒",
    href: "/admin/store",
  },
  { slug: "ai-settings", label: "مساعد أبو الأكبر (AI)", emoji: "🤖", href: "/admin/settings/ai" },
  { slug: "settings", label: "الإعدادات", emoji: "⚙️", href: "/admin/settings" },
  { slug: "notification-settings", label: "إشعارات المتصفح", emoji: "🔔", href: "/admin/settings#notifications" },
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