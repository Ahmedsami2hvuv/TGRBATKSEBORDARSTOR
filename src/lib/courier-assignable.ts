import type { Prisma } from "@prisma/client";

/**
 * مندوبون يظهرون في قوائم اختيار المندوب للإدارة والمجهزين (إسناد، تعديل طلب، تتبع جماعي…).
 * يظهر أي مندوب غير محظور وغير مخفي من التقارير.
 */
export const courierAssignableWhere: Prisma.CourierWhereInput = {
  blocked: false,
  hiddenFromReports: false,
};

/**
 * قوائم إسناد المجهز (جدول الطلبات + صفحة الطلبية) — يظهر أي مندوب غير محظور ومُدرَج للإسناد.
 */
export const preparerCourierAssignWhere: Prisma.CourierWhereInput = {
  blocked: false,
  hiddenFromReports: false,
};

