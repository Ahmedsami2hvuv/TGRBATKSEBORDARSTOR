import { prisma } from "@/lib/prisma";
import { BranchListClient } from "./branch-list-client";
import Link from "next/link";
import { getGlobalIcons } from "@/lib/icon-settings";
import { QuickProfitEdit } from "../_components/quick-profit-edit";

export const dynamic = "force-dynamic";

export default async function BranchesPage(props: {
  searchParams: Promise<{ categoryId?: string }>
}) {
  const resolvedSearchParams = await props.searchParams;
  const categoryId = resolvedSearchParams?.categoryId;

  let parentCategory: any = null;
  if (categoryId) {
    const rawCat = await prisma.storeCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, profitMargin: true }
    });
    if (rawCat) {
      parentCategory = {
        id: rawCat.id,
        name: rawCat.name,
        profitMargin: rawCat.profitMargin ? Number(rawCat.profitMargin) : 0
      };
    }
  }

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
      hidePrices: true,
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

  const [categoriesRaw, preparersRaw, rawBranches] = await Promise.all([
    categoriesPromise,
    preparersPromise,
    branchesPromise
  ]);

  // تحويل كافة البيانات إلى تنسيق JSON بسيط لضمان استقرار الإنتاج ومنع أخطاء الـ Serialization
  const categories = JSON.parse(JSON.stringify(categoriesRaw));
  const preparers = JSON.parse(JSON.stringify(preparersRaw));
  const branches = JSON.parse(JSON.stringify(rawBranches.map(b => ({
    ...b,
    profitMargin: b.profitMargin ? Number(b.profitMargin) : 0,
  }))));

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

      {parentCategory && (
        <div className="bg-violet-50 p-6 rounded-[2rem] border border-violet-100 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in duration-300">
          <div>
            <h3 className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-1">القسم الحالي المفتوح</h3>
            <h2 className="text-xl font-black text-slate-900">{parentCategory.name}</h2>
          </div>
          <div className="bg-white px-5 py-3 rounded-2xl border border-violet-100 flex items-center gap-3 shadow-sm shrink-0">
            <span className="text-xs font-black text-slate-500">💰 هامش ربح القسم:</span>
            <QuickProfitEdit
              id={parentCategory.id}
              initialMargin={parentCategory.profitMargin}
              type="category"
              name={parentCategory.name}
            />
          </div>
        </div>
      )}

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
