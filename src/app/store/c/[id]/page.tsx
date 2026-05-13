import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomProductRequest } from "@/components/custom-product-request";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

// تحسين جلب الفروع باستخدام التخزين المؤقت لمدة 10 ثوانٍ لتقليل الضغط
const getCachedBranches = unstable_cache(
    async (categoryId: string) => {
        return prisma.storeBranch.findMany({
            where: { categoryId, active: true, parentBranchId: null },
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { sequence: "desc" },
        });
    },
    ["store-branches-list"],
    { revalidate: 10, tags: ["store-branches"] }
);

async function BranchesList({ categoryId }: { categoryId: string }) {
    const branches = await getCachedBranches(categoryId);

    if (branches.length === 0) return (
        <div className="text-center py-10 text-slate-400 font-bold">
            لا توجد أفرع متاحة حالياً
        </div>
    );

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-700">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/store/b/${branch.id}`}
              className="group block bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-4 border border-slate-100 dark:border-slate-800 shadow-md hover:shadow-violet-200/40 hover:border-violet-100 dark:hover:border-violet-800 transition-all duration-300"
            >
              <div className="relative aspect-video mb-3 md:mb-4 overflow-hidden rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800">
                {branch.photoUrl ? (
                  <img src={branch.photoUrl} alt={branch.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                )}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] md:text-xs font-black px-2 py-1 rounded-lg">
                    {branch._count.products} منتج
                </div>
              </div>
              <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white text-center group-hover:text-violet-600 transition-colors line-clamp-1">{branch.name}</h2>
            </Link>
          ))}
        </div>
    );
}

const getCachedCategory = unstable_cache(
    async (id: string) => {
        return prisma.storeCategory.findUnique({
            where: { id },
            select: { id: true, name: true, photoUrl: true }
        });
    },
    ["store-category-header"],
    { revalidate: 60 }
);

async function CategoryHeader({ id }: { id: string }) {
  const category = await getCachedCategory(id);

  if (!category) return notFound();

  return (
    <>
      <nav className="flex items-center gap-2 text-sm font-bold text-slate-400">
        <Link href="/store" className="hover:text-violet-600 transition">المتجر</Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white">{category.name}</span>
      </nav>

      <section className="flex flex-col md:flex-row items-center gap-2 md:gap-8 p-4 md:p-8 bg-white dark:bg-slate-900 rounded-[2rem] md:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="w-16 h-16 md:w-32 md:h-32 rounded-2xl md:rounded-[2rem] overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0">
          {category.photoUrl ? (
            <img src={category.photoUrl} alt={category.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl md:text-4xl">📁</div>
          )}
        </div>
        <div className="text-center md:text-right">
          <h1 className="text-xl md:text-4xl font-black text-slate-900 dark:text-white mb-1 md:mb-2">{category.name}</h1>
          <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold">تصفح أقسام {category.name} واختر ما يناسبك</p>
        </div>
      </section>

    </>
  );
}

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id;

  return (
    <div className="space-y-4 md:space-y-8" dir="rtl">
      <Suspense fallback={
        <div className="h-32 md:h-48 bg-white dark:bg-slate-900 rounded-[2rem] md:rounded-[3rem] animate-pulse" />
      }>
        <CategoryHeader id={id} />
      </Suspense>

      <CustomProductRequest />

      <Suspense fallback={
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-video bg-slate-50 dark:bg-slate-900 rounded-[2rem] animate-pulse border border-slate-100 dark:border-slate-800" />
              ))}
          </div>
      }>
          <BranchesList categoryId={id} />
      </Suspense>
    </div>
  );
}
