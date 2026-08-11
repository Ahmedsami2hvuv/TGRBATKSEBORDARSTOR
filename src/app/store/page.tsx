import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { StoreSlider } from "./_components/store-slider";
import { ProductCard } from "./product-card";

export const revalidate = 30; // تفعيل الكاش لـ 30 ثانية لتسريع التصفح

async function CategoriesRow() {
  try {
    const categories = await prisma.storeCategory.findMany({
      where: { active: true },
      orderBy: { sequence: "desc" },
      select: { id: true, name: true, photoUrl: true },
    });

    if (categories.length === 0) return null;

    return (
      <div className="flex items-start gap-4 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/store/c/${cat.id}`}
            prefetch={false}
            className="flex flex-col items-center gap-2 min-w-[72px] max-w-[80px] snap-start shrink-0"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden flex items-center justify-center p-1">
              {cat.photoUrl ? (
                <img
                  src={cat.photoUrl}
                  alt={cat.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <span className="text-2xl">📦</span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-800 text-center leading-tight">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    );
  } catch (error) {
    return <div className="text-center p-4 text-slate-500 text-sm">جاري تحميل الأقسام...</div>;
  }
}

// أضفنا قسم للأكثر مبيعاً ليعرض بعض المنتجات بشكل أفقي
async function BestSellersRow() {
  try {
    const productsRaw = await prisma.storeProduct.findMany({
      where: { active: true },
      take: 6, // أخذ عينة
      orderBy: { sequence: "desc" }
    });
    const products = deepSanitize(productsRaw);

    if (products.length === 0) return null;

    return (
      <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {products.map((prod: any) => (
          <div key={prod.id} className="w-[160px] md:w-[200px] shrink-0 snap-start">
            <ProductCard product={prod} />
          </div>
        ))}
      </div>
    );
  } catch (error) {
    return null;
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
      <div className="space-y-6">
        {/* البانر الترويجي */}
        <section className="mb-6">
          {slides && slides.length > 0 ? (
            <div className="rounded-[2rem] overflow-hidden shadow-sm">
              <StoreSlider slides={slides.map((s: any) => ({
                id: s.id,
                imageUrl: s.imageUrl,
                linkUrl: s.linkUrl || "",
                title: s.title || ""
              }))} />
            </div>
          ) : (
            <div className="relative w-full h-40 md:h-56 rounded-[2rem] bg-gradient-to-l from-green-500 to-green-600 overflow-hidden shadow-sm flex items-center justify-center p-6 text-white">
               <div className="text-center z-10">
                 <h2 className="text-2xl font-black mb-2">عروض مميزة</h2>
                 <p className="text-sm">تسوق أفضل المنتجات الآن</p>
               </div>
               {/* تأثيرات خلفية */}
               <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
               <div className="absolute -left-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            </div>
          )}
          {/* مؤشرات البانر الوهمية */}
          <div className="flex justify-center gap-1.5 mt-3">
            <span className="w-4 h-1.5 bg-green-500 rounded-full"></span>
            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
          </div>
        </section>

        {/* قسم الفئات */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-800">الفئات</h2>
            <Link href="/store/categories" className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl">
              عرض الكل
            </Link>
          </div>
          <Suspense fallback={<div className="flex gap-4 overflow-hidden"><div className="w-16 h-16 bg-slate-200 rounded-2xl animate-pulse" /></div>}>
            <CategoriesRow />
          </Suspense>
        </section>

        {/* قسم الأكثر مبيعاً */}
        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-xl font-black text-slate-800">الأكثر مبيعاً</h2>
            <Link href="/store/best-sellers" className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl">
              عرض الكل
            </Link>
          </div>
          <Suspense fallback={<div className="flex gap-4 overflow-hidden"><div className="w-[160px] h-[240px] bg-slate-200 rounded-3xl animate-pulse" /></div>}>
            <BestSellersRow />
          </Suspense>
        </section>
        
        {/* قسم جاهز للأكل */}
        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-xl font-black text-slate-800">جاهز للأكل</h2>
            <Link href="/store/ready-to-eat" className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl">
              عرض الكل
            </Link>
          </div>
          <Suspense fallback={<div className="flex gap-4 overflow-hidden"><div className="w-[160px] h-[240px] bg-slate-200 rounded-3xl animate-pulse" /></div>}>
            <BestSellersRow /> {/* سنستخدم نفس الدالة حالياً كمثال */}
          </Suspense>
        </section>
      </div>
    );
  } catch (error) {
    console.error("Store page error:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <h1 className="text-xl font-black mb-2 text-slate-800">عذراً، حدث خطأ تقني</h1>
        <p className="text-sm text-slate-500 mb-6">نعمل على إصلاح المشكلة الآن، يرجى تحديث الصفحة بعد قليل.</p>
        <a href="" className="px-6 py-2 bg-green-500 text-white rounded-xl font-bold">تحديث الصفحة</a>
      </div>
    );
  }
}

