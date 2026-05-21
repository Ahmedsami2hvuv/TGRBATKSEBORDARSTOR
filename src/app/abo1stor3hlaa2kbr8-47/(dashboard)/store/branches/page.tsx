import { prisma } from "@/lib/prisma";
import { BranchListClient } from "./branch-list-client";
import Link from "next/link";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export default async function BranchesPage(props: {
  searchParams: Promise<{ categoryId?: string }>
}) {
  const resolvedSearchParams = await props.searchParams;
  const categoryId = resolvedSearchParams?.categoryId;

  // جلب الوعود (Promises) بدون await لتسريع ظهور واجهة الصفحة
  const categoriesPromise = prisma.storeCategory.findMany({
    select: { id: true, name: true, sequence: true },
    orderBy: { sequence: "desc" },
  });

  const preparersPromise = prisma.companyPreparer.findMany({
    where: {
        active: true,
        notes: { not: { contains: "[SUPPLIER]" } }
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const branchesPromise = prisma.storeBranch.findMany({
    where: categoryId ? { categoryId: categoryId } : {},
    select: {
      id: true,
      name: true,
      sequence: true,
      categoryId: true,
      active: true,
      photoUrl: true,
      parentBranchId: true,
      authorizedPreparerId: true,
      profitMargin: true,
      category: { select: { name: true } },
      parentBranch: { select: { name: true } },
      _count: { select: { products: true } }
    },
    orderBy: [
      { categoryId: 'asc' },
      { sequence: 'desc' }
    ],
    take: 500
  });

  const [categories, preparers, rawBranches] = await Promise.all([
    categoriesPromise,
    preparersPromise,
    branchesPromise
  ]);

  // تحويل البيانات لتكون قابلة للنقل للمتصفح (Serialization)
  const branches = rawBranches.map(b => ({
    ...b,
    profitMargin: b.profitMargin ? Number(b.profitMargin) : 0,
    _count: b._count
  }));

  const icons = await getGlobalIcons();

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* هذا الجزء سيظهر فوراً */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
             إدارة أفرع المتجر
          </h1>
          <p className="text-sm text-slate-500 font-bold mt-1">
            إدارة الأفرع والترتيب لكل قسم
          </p>
        </div>
        {categoryId && (
          <Link
            href="/abo1stor3hlaa2kbr8-47/store/branches"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
          >
            عرض كل الأقسام
          </Link>
        )}
      </div>

      <BranchListClient
        initialBranches={branches}
        categories={categories}
        preparers={preparers}
        defaultCategoryId={categoryId}
        icons={icons}
      />
    </div>
  );
}
