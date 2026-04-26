/** مفتاح تخزين مواضع أزرار المندوب العائمة (واتساب/اتصال/قوالب) — يطابق `MandoubFloatingBar` */
export const MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY = "mandoubFabLayout_v4";

/** تغيّر معامل التكبير — `detail: { storageKey: string; scale: number }` */
export const MANDOUB_FAB_EVT_SCALE = "mandoub-fab-scale-updated";

/** إعادة أماكن الأزرار — `detail: { storageKey: string }` */
export const MANDOUB_FAB_EVT_RESET_LAYOUT = "mandoub-fab-reset-layout-positions";

/** فتح لوحة شريط التكبير — `detail: { storageKey: string }` */
export const MANDOUB_FAB_EVT_OPEN_SCALE_PANEL = "mandoub-open-fab-scale-panel";
