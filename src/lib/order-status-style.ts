/**
 * ألوان الطلب حسب الحالة (إدارة + مندوب):
 * أحمر — انتظار المندوب (قيد الانتظار / مسند ولم يُستلم بعد)
 * برتقالي/أصفر — عند المندوب قيد التوصيل
 * أخضر — تم التسليم
 */

/** صفوف جداول (تتبع، تقارير، طلبات زبون) */
export function orderStatusRowClassInteractive(status: string): string {
  switch (status) {
    case "pending":
    case "assigned":
      return "bg-red-50/90 hover:bg-red-100/90 active:bg-red-100/70";
    case "delivering":
      return "bg-amber-50/90 hover:bg-amber-100/90 active:bg-amber-100/70";
    case "delivered":
      return "bg-emerald-50/90 hover:bg-emerald-100/90 active:bg-emerald-100/70";
    case "cancelled":
      return "bg-slate-100/90 hover:bg-slate-200/60";
    case "archived":
      return "bg-violet-50/90 hover:bg-violet-100/80";
    default:
      return "hover:bg-sky-50/60";
  }
}

/** خلفية صف قائمة المندوب — الـ tr يضيف hover:bg-sky-50/90 */
export function orderStatusMandoubRowTint(status: string): string {
  switch (status) {
    case "pending":
    case "assigned":
      return "bg-red-50";
    case "delivering":
      return "bg-amber-50";
    case "delivered":
      return "bg-emerald-50";
    case "cancelled":
      return "bg-slate-100";
    case "archived":
      return "bg-violet-50";
    default:
      return "bg-white";
  }
}

export function orderStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
    case "assigned":
      return "bg-red-600 text-white";
    case "delivering":
      return "bg-amber-500 text-amber-950";
    case "delivered":
      return "bg-emerald-600 text-white";
    case "cancelled":
      return "bg-slate-600 text-white";
    case "archived":
      return "bg-violet-600 text-white";
    default:
      return "bg-slate-200 text-slate-800";
  }
}

/** بطاقة طلبات «جديدة» (كلها pending) */
export function orderStatusPendingCardBorderBg(): string {
  return "border-red-200/90 bg-red-50/30";
}

/** خلفية سطح تفاصيل المندوب عند عدم تنبيه لوكيشن */
export function orderStatusDetailSurfaceClass(status: string): string {
  switch (status) {
    case "pending":
    case "assigned":
      return "bg-red-50/15";
    case "delivering":
      return "bg-amber-50/20";
    case "delivered":
      return "bg-emerald-50/15";
    case "cancelled":
      return "bg-slate-50/40";
    case "archived":
      return "bg-violet-50/30";
    default:
      return "";
  }
}

/**
 * صف المندوب — لون الخارج يتبع حالة الطلب فقط.
 * «كل شي واصل» يُميَّز داخل الصف (ظل داخلي / شارة) وليس بخلفية صف مختلفة.
 */
export function orderStatusMandoubRowTintPrepaid(status: string, prepaidAll: boolean): string {
  void prepaidAll;
  return orderStatusMandoubRowTint(status);
}

/** شارة الحالة في قائمة المندوب — تمييز إضافي عند «كل شي واصل» */
export function orderStatusBadgeClassPrepaid(status: string, prepaidAll: boolean): string {
  if (!prepaidAll) return orderStatusBadgeClass(status);
  switch (status) {
    case "assigned":
      return "bg-red-700 text-white ring-2 ring-red-300/80";
    case "delivering":
      return "bg-rose-700 text-white ring-2 ring-rose-300/80";
    case "delivered":
      return "bg-red-800 text-white ring-2 ring-red-400/70";
    default:
      return orderStatusBadgeClass(status);
  }
}

/**
 * اسم المحل في قائمة المندوب — ألوان صارخـة حسب الأولوية:
 * أحمر (لم يُستلم)، برتقالي/أصفر (مستلم — جاري التوصيل)، أخضر (مُسلَّم).
 */
export function mandoubShopNameVividClass(status: string, prepaidAll: boolean): string {
  void prepaidAll;
  switch (status) {
    case "assigned":
      return "rounded-md border-2 border-red-700 bg-red-600 px-2 py-1 text-sm font-black text-white shadow-md ring-2 ring-red-400/90 sm:text-base";
    case "delivering":
      return "rounded-md border-2 border-orange-600 bg-amber-400 px-2 py-1 text-sm font-black text-amber-950 shadow-md ring-2 ring-amber-500 sm:text-base";
    case "delivered":
      return "rounded-md border-2 border-green-800 bg-lime-400 px-2 py-1 text-sm font-black text-green-950 shadow-md ring-2 ring-lime-500 sm:text-base";
    case "archived":
      return "rounded-md border-2 border-violet-800 bg-violet-200 px-2 py-1 text-sm font-black text-violet-950 shadow-md ring-2 ring-violet-400 sm:text-base";
    default:
      return "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-900 sm:text-base";
  }
}

/** شريط جانبي (بداية السطر في RTL) يميّز الحالة */
export function orderStatusStartStripeClass(status: string): string {
  switch (status) {
    case "pending":
    case "assigned":
      return "border-s-4 border-s-red-500";
    case "delivering":
      return "border-s-4 border-s-amber-500";
    case "delivered":
      return "border-s-4 border-s-emerald-500";
    case "cancelled":
      return "border-s-4 border-s-slate-400";
    case "archived":
      return "border-s-4 border-s-violet-500";
    default:
      return "border-s-4 border-s-slate-300";
  }
}
