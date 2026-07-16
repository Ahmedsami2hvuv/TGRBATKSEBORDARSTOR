/** روابط لوحة الإدارة — المربعات والشريط الجانبي */

export type AdminTile = {
  slug: string;
  label: string;
  iconKey: string;
  /** إن وُجد يُستخدم مباشرة بدل /abo1stor3hlaa2kbr8-47/module/[slug] */
  href?: string;
};

export const ADMIN_TILES: AdminTile[] = [
  { slug: "store", label: "المتجر", iconKey: "ui_shops", href: "/abo1stor3hlaa2kbr8-47/store" },
  { slug: "admin-create-order", label: "إضافة طلب من الإدارة", iconKey: "ui_add", href: "/abo1stor3hlaa2kbr8-47/orders/new" },
  { slug: "new-orders", label: "الطلبات الجديدة", iconKey: "ui_inbox", href: "/abo1stor3hlaa2kbr8-47/orders/pending" },
  { slug: "order-tracking", label: "تتبع الطلبات", iconKey: "ui_location", href: "/abo1stor3hlaa2kbr8-47/orders/tracking" },
  { slug: "shops", label: "المحلات", iconKey: "ui_shops", href: "/abo1stor3hlaa2kbr8-47/shops" },
  { slug: "couriers", label: "المندوبين", iconKey: "ui_courier", href: "/abo1stor3hlaa2kbr8-47/couriers" },
  { slug: "preparers", label: "المجهزين", iconKey: "ui_preparer", href: "/abo1stor3hlaa2kbr8-47/preparers" },
  { slug: "employees", label: "الموظفين", iconKey: "ui_staff_member", href: "/abo1stor3hlaa2kbr8-47/employees" },
  { slug: "suppliers", label: "الموردين", iconKey: "ui_supplier", href: "/abo1stor3hlaa2kbr8-47/suppliers" },
  { slug: "reports", label: "التقارير", iconKey: "ui_chart", href: "/abo1stor3hlaa2kbr8-47/reports" },
  { slug: "credit-book", label: "دفتر الديون العام", iconKey: "ui_payment_ledger", href: "/abo1stor3hlaa2kbr8-47/credit-book" },
  { slug: "customers", label: "بيانات الزبائن", iconKey: "ui_users", href: "/abo1stor3hlaa2kbr8-47/customers" },
  { slug: "archived-orders", label: "الطلبات المؤرشفة", iconKey: "ui_package", href: "/abo1stor3hlaa2kbr8-47/orders/archived" },
  { slug: "rejected-orders", label: "المرفوضة", iconKey: "ui_error", href: "/abo1stor3hlaa2kbr8-47/orders/tracking?status=cancelled" },
  { slug: "legacy-kse-profiles-batch", label: "استيراد زبائن KSE (دفعات)", iconKey: "ui_package", href: "/abo1stor3hlaa2kbr8-47/customers/profiles/import-legacy-kse" },
  { slug: "new-customer-profile", label: "إضافة زبون مرجعي", iconKey: "ui_user_add", href: "/abo1stor3hlaa2kbr8-47/customers/profiles/new" },
  { slug: "wa-buttons", label: "أزرار واتساب للمندوب", iconKey: "ui_whatsapp", href: "/abo1stor3hlaa2kbr8-47/wa-buttons" },
  { slug: "courier-map", label: "خريطة المندوبين", iconKey: "ui_map", href: "/abo1stor3hlaa2kbr8-47/couriers/map" },
  { slug: "regions", label: "المناطق", iconKey: "ui_map", href: "/abo1stor3hlaa2kbr8-47/regions" },
  { slug: "smart-hints", label: "الاستدلال الذكي", iconKey: "ui_ai", href: "/abo1stor3hlaa2kbr8-47/smart-hints" },
  { slug: "super-search", label: "البحث الخارق", iconKey: "ui_search", href: "/abo1stor3hlaa2kbr8-47/search" },
  { slug: "prep-notices", label: "إشعارات تجهيز المجهزين", iconKey: "ui_announcement", href: "/abo1stor3hlaa2kbr8-47/prep-notices" },
  { slug: "ai-settings", label: "مساعد أبو الأكبر (AI)", iconKey: "ui_ai", href: "/abo1stor3hlaa2kbr8-47/settings/ai" },
  { slug: "notification-settings", label: "إشعارات المتصفح", iconKey: "ui_notification", href: "/abo1stor3hlaa2kbr8-47/settings#notifications" },
  { slug: "strong-alert", label: "التنبيه القوي 🚨", iconKey: "ui_notification", href: "/abo1stor3hlaa2kbr8-47/strong-alert" },
  { slug: "settings", label: "الإعدادات", iconKey: "ui_settings", href: "/abo1stor3hlaa2kbr8-47/settings" },
];

export function tileHref(tile: AdminTile): string {
  return tile.href ?? `/abo1stor3hlaa2kbr8-47/module/${tile.slug}`;
}

function isVisibleTile(tile: AdminTile): boolean {
  return true;
}

export function adminSidebarTiles(): AdminTile[] {
  return ADMIN_TILES.filter(isVisibleTile);
}

export function isTileEnabled(slug: string): boolean {
  const t = ADMIN_TILES.find((x) => x.slug === slug);
  if (!t) return false;
  return isVisibleTile(t);
}
