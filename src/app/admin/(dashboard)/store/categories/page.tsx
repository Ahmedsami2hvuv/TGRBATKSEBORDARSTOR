import { prisma } from "@/lib/prisma";
import { CategoryListClient } from "./category-list-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  // جلب الوعد (Promise) الخاص بالأقسام
  const categoriesPromise = prisma.storeCategory.findMany({
    select: {
      id: true,
      name: true,
      sequence: true,
      photoUrl: true,
      active: true,
    },
    orderBy: { sequence: "desc" },
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">أقسام المتجر</h1>
      </div>
      <CategoryListClient categoriesPromise={categoriesPromise} />
    </div>
  );
}
