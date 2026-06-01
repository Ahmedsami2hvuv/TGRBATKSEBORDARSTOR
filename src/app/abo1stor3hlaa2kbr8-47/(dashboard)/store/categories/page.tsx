import { prisma } from "@/lib/prisma";
import { CategoryListClient } from "./category-list-client";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  // جلب البيانات مباشرة في السيرفر لضمان الاستقرار في الإنتاج
  const rawCategories = await prisma.storeCategory.findMany({
    select: {
      id: true,
      name: true,
      sequence: true,
      photoUrl: true,
      active: true,
      profitMargin: true,
    },
    orderBy: { sequence: "desc" },
  });

  // تحويل البيانات لنصوص بسيطة (JSON) لمنع أخطاء الـ Serialization
  const categories = JSON.parse(JSON.stringify(rawCategories.map(cat => ({
    ...cat,
    profitMargin: cat.profitMargin ? Number(cat.profitMargin) : 0,
  }))));

  const icons = await getGlobalIcons();

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">أقسام المتجر</h1>
      </div>
      <CategoryListClient initialCategories={categories} icons={icons} />
    </div>
  );
}
