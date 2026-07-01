import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { StoreSlider } from "./_components/store-slider";

export const revalidate = 30; // تفعيل الكاش لـ 30 ثانية لتسريع التصفح

async function CategoriesGrid() {
  try {
    const categories = await prisma.storeCategory.findMany({
      where: { active: true },
      orderBy: { sequence: "desc" },
      select: { id: true, name: true, photoUrl: true },
    });

    if (categories.length === 0) return null;

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
            </div>
          </Link>
        ))}
      </div>
    );
  } catch (error) {
    return <div className="text-center p-10 text-slate-500">جاري تحميل الأقسام...</div>;
  }
}

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

export default async function StoreHomePage() {
  try {
    const slidesRaw = await prisma.storeSlide.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" }
    });

    const slides = deepSanitize(slidesRaw);

    return (
      <div className="space-y-4">
        {/* Slider Section */}
        <section>
          {slides && slides.length > 0 ? (
            <StoreSlider slides={slides.map((s: any) => ({
              id: s.id,
              imageUrl: s.imageUrl,
              linkUrl: s.linkUrl || "",
              title: s.title || ""
            }))} />
          ) : (
            <div className="relative py-16 text-center rounded-[3rem] bg-slate-50 dark:bg-slate-900">
              <h1 className="text-4xl font-black text-slate-900 dark:text-white">خصيب ستور</h1>
            </div>
          )}
        </section>

        {/* Categories Section */}
        <div id="categories" className="space-y-8 mt-10">
          <div className="flex items-center gap-3 px-2">
              <span className="w-2 h-8 bg-violet-600 rounded-full" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">الأقسام الرئيسية</h2>
          </div>

          <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse"><div className="aspect-square bg-slate-100 rounded-[2rem]" /></div>}>
            <CategoriesGrid />
          </Suspense>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Store page error:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <h1 className="text-2xl font-black mb-2">عذراً، حدث خطأ تقني</h1>
        <p className="text-slate-500">نعمل على إصلاح المشكلة الآن، يرجى تحديث الصفحة بعد قليل.</p>
        <a href="" className="mt-4 px-6 py-2 bg-violet-600 text-white rounded-full inline-block">تحديث</a>
      </div>
    );
  }
}
