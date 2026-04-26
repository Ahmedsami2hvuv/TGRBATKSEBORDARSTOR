import type { Prisma } from "@prisma/client";

/** مجهزون يظهرون في قوائم «من يمكن إسناد العمل له» (إن وُجدت). */
export const preparerAssignableWhere: Prisma.CompanyPreparerWhereInput = {
  active: true,
  availableForAssignment: true,
};
