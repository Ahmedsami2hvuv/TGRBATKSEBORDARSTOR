/** أرقام وأسماء الإدارة لصفحة «إضافة طلب من الإدارة» */

export const ADMIN_OFFICE_LABEL = "الإدارة";
export const ADMIN_SHOP_LEGACY_NAMES = ["طلبات الإدارة العامة"];
export const ADMIN_SHOP_NAMES = [ADMIN_OFFICE_LABEL, ...ADMIN_SHOP_LEGACY_NAMES];

export function normalizeAdminShopName(shopName?: string | null): string {
  const trimmed = shopName?.trim() ?? "";
  return ADMIN_SHOP_NAMES.includes(trimmed) ? ADMIN_OFFICE_LABEL : shopName?.trim() ?? "";
}

export function isAdminShopName(shopName?: string | null): boolean {
  return ADMIN_SHOP_NAMES.includes(shopName?.trim() ?? "");
}

/** عند «رفع من محل» واختيار الإدارة بدل عميل من المحل */
export const ADMIN_PHONE_FROM_SHOP_LOCAL = "0773921468";

/** عند «وجهة واحدة» (طلب إداري: استلام فلوس/منتج بدون توصيل للمحل) — بدل صاحب المحل */
export const ADMIN_PHONE_ONE_FACE_LOCAL = "07733921468";

/** تذييل «وجهتان» — للإبلاغ عن الأخطاء أو المشاكل */
export const ADMIN_PHONE_SUPPORT_FOOTER_LOCAL = "0773921468";
