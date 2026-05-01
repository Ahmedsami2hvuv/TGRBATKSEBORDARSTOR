import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function CategoriesGrid() {
  const categories = await prisma.storeCategory.findMany({
    where: { active: true },
    orderBy: { sequence: "desc" },
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/store/c/${cat.id}`}
          prefetch={false}
          className="group block bg-white dark:bg-slate-900 rounded-[2.5rem] p-4 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-violet-200/50 dark:hover:border-violet-800 transition-all duration-500 hover:-translate-y-2"
        >
          <div className="relative aspect-square mb-6 overflow-hidden rounded-[2rem] bg-slate-100 dark:bg-slate-800/50">
            {cat.photoUrl ? (
              <img
                src={cat.photoUrl}
                alt={cat.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
                <span className="text-5xl">📦</span>
              </div>
            )}
          </div>
          <div className="text-center pb-2">
            <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white group-hover:text-violet-600 transition-colors">
              {cat.name}
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              استكشف المنتجات
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function StoreHomePage() {
  const storeSettings = await prisma.uISystemSetting.findUnique({
    where: { target_section: { target: "customer", section: "store_general" } }
  });

  const config = (storeSettings?.config as any) || {};

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 text-center overflow-hidden rounded-[3rem] bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="relative z-10 px-4">
          <span className="inline-block px-4 py-1.5 mb-6 text-xs font-black tracking-widest text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400 rounded-full uppercase">
            مرحباً بك في عالمنا
          </span>
          <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
            خصيب ستور <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
              تسوق بذكاء وأمان
            </span>
          </h1>
          <p className="text-base md:text-xl text-slate-600 dark:text-slate-400 font-bold max-w-2xl mx-auto mb-10 leading-relaxed">
            نقدم لك تجربة تسوق فريدة مع أسرع خدمة توصيل في المنطقة.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {config.how_to_shop_url && (
              <Link
                href={config.how_to_shop_url}
                target="_blank"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black rounded-2xl hover:border-violet-500 transition-all shadow-sm active:scale-95"
              >
                <span>📺</span>
                طريقة التسوق
              </Link>
            )}
            <Link
               href="#categories"
               className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 transition-all shadow-xl shadow-violet-200 dark:shadow-none active:scale-95"
            >
              ابدأ التسوق الآن
            </Link>
          </div>
        </div>

        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-violet-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full" />
      </section>

      {/* Categories Grid */}
      <div id="categories" className="space-y-8 pt-10">
        <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-violet-600 rounded-full" />
                تصفح الأقسام الرئيسية
            </h2>
        </div>

        <Suspense fallback={
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 animate-pulse" />
            ))}
          </div>
        }>
          <CategoriesGrid />
        </Suspense>
      </div>
    </div>
  );
}
