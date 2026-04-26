import type { Prisma } from "@prisma/client";

/**
 * مندوبون يظهرون في قوائم اختيار المندوب (إسناد، تعديل طلب، تتبع جماعي…).
 * «إخفاء من التقرير» = إخفاء من الإسناد فقط، وليس من تقارير الإدارة.
 */
export const courierAssignableWhere: Prisma.CourierWhereInput = {
  blocked: false,
  hiddenFromReports: false,
  availableForAssignment: true,
};

/**
 * قوائم إسناد المجهز (جدول الطلبات + صفحة الطلبية) — يظهر أي مندوب غير محظور ومُدرَج للإسناد، حتى لو عطّل «متاح للإسناد» في تطبيق المندوب.
 */
export const preparerCourierAssignWhere: Prisma.CourierWhereInput = {
  blocked: false,
  hiddenFromReports: false,
};
