import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomProductRequest } from "@/components/custom-product-request";
import { Suspense } from "react";
import { StoreSlider } from "../../_components/store-slider";

export const dynamic = "force-dynamic";

// دالة التطهير العميقة لضمان التوافق مع Next.js 15 ومنع أخطاء الـ Serialization
function deepSanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(o => deepSanitize(o));
  if (typeof obj === "object") {
    if (obj.constructor && (obj.constructor.name === "Decimal" || obj.constructor.name === "n")) {
      return Number(obj.toString());
    }
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = deepSanitize(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

async function getCachedBranches(categoryId: string) {
    const branches = await prisma.storeBranch.findMany({
        where: { categoryId, active: true, parentBranchId: null },
        include: {
            _count: {
                select: { products: true }
            }
        },
        orderBy: { sequence: "desc" },
    });
    return deepSanitize(branches);
}

async function BranchesList({ categoryId }: { categoryId: string }) {
    try {
        const branches = await getCachedBranches(categoryId);

        if (!branches || branches.length === 0) return (
            <div className="text-center py-10 text-slate-400 font-bold">
                لا توجد أفرع متاحة حالياً لـ {categoryId}
            </div>
        );

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-700">
              {branches.map((branch: any) => (
                <Link
                  key={branch.id}
                  href={`/store/b/${branch.id}`}
                  className="group block bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-4 border border-slate-100 dark:border-slate-800 shadow-md hover:shadow-violet-200/40 hover:border-violet-100 dark:hover:border-violet-800 transition-all duration-300"
                >
                  <div className="relative aspect-video mb-3 md:mb-4 overflow-hidden rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800">
                    {branch.photoUrl ? (
                      <img
                        src={branch.photoUrl}
                        alt={branch.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          if (target.src.includes('?')) {
                            target.src = target.src.split('?')[0];
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] md:text-xs font-black px-2 py-1 rounded-lg">
                        {branch._count?.products || 0} منتج
                    </div>
                  </div>
                  <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white text-center group-hover:text-violet-600 transition-colors line-clamp-1">{branch.name}</h2>
                </Link>
              ))}
            </div>
        );
    } catch (error) {
        console.error("BranchesList error:", error);
        return <div className="text-center py-10 text-rose-500 font-bold">فشل تحميل الأفرع</div>;
    }
}

async function getCachedCategory(id: string) {
    const category = await prisma.storeCategory.findUnique({
        where: { id },
        select: { id: true, name: true, photoUrl: true }
    });
    return deepSanitize(category);
}

async function CategoryHeader({ id }: { id: string }) {
  const category = await getCachedCategory(id);

  if (!category) return (
    <div className="text-center py-10 text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800" dir="rtl">
      القسم المطلوب غير موجود أو تم إيقافه مؤقتاً.
    </div>
  );

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
            <img
              src={category.photoUrl}
              alt={category.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                if (target.src.includes('?')) {
                  target.src = target.src.split('?')[0];
                }
              }}
            />
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
  try {
    const params = await props?.params;
    const id = params?.id;

    if (!id) {
      return (
        <div className="text-center py-20 text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800" dir="rtl">
          معرف القسم غير صالح أو مفقود.
        </div>
      );
    }

    const slidesRaw = await prisma.storeSlide.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" }
    });

    const slides = deepSanitize(slidesRaw);

    return (
      <div className="space-y-4 md:space-y-8" dir="rtl">
        {slides && slides.length > 0 && (
          <section className="mb-6 md:mb-10">
            <StoreSlider slides={slides.map((s: any) => ({
              id: s.id,
              imageUrl: s.imageUrl,
              linkUrl: s.linkUrl || "",
              title: s.title || ""
            }))} />
          </section>
        )}

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
  } catch (error) {
    console.error("Category page render error:", error);
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-rose-100 dark:border-rose-950 p-8 shadow-xl" dir="rtl">
        <span className="text-5xl block mb-4">⚠️</span>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">عذراً، حدث خطأ غير متوقع أثناء تحميل القسم</h2>
        <p className="text-sm text-slate-500 font-bold">يرجى المحاولة مرة أخرى لاحقاً أو إبلاغ الإدارة بالمشكلة.</p>
      </div>
    );
  }
}
