import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { Metadata } from "next";
import { StoreSlider } from "./_components/store-slider";
import { ProductCard } from "./product-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getDefaultStoreMetadata, getStoreProductMetadata } from "@/lib/store-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  searchParams: Promise<{ product?: string }>;
}): Promise<Metadata> {
  const searchParams = await props.searchParams;
  if (searchParams?.product) {
    return getStoreProductMetadata(searchParams.product);
  }
  return getDefaultStoreMetadata();
}

async function CategoriesRow() {
  try {
    const categories = await prisma.storeCategory.findMany({
      where: { active: true },
      orderBy: { sequence: "desc" },
      select: { id: true, name: true, photoUrl: true },
    });

    if (categories.length === 0) return null;

    return (
      <div className="flex items-start gap-4 overflow-x-auto pb-4 pt-2 px-2 hide-scrollbar accelerate-gpu" style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
        {/* زر المفضلة الثابت */}
        <Link
          href="/store/favorites"
          className="flex flex-col items-center gap-2 min-w-[72px] max-w-[80px] shrink-0"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border border-rose-100 shadow-sm overflow-hidden flex items-center justify-center p-1 text-rose-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <span className="text-xs font-bold text-slate-800 text-center leading-tight">
            المفضلة
          </span>
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/store/c/${cat.id}`}
            className="flex flex-col items-center gap-2 min-w-[72px] max-w-[80px] shrink-0 transition-transform active:scale-95"
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
      orderBy: { sequence: "desc" },
      include: {
        branch: {
          include: { category: true }
        }
      }
    });
    const products = deepSanitize(productsRaw);

    if (products.length === 0) return null;

    return (
      <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-2 px-2 hide-scrollbar accelerate-gpu" style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
        {products.map((prod: any) => (
          <div key={prod.id} className="w-[160px] md:w-[200px] shrink-0">
            <ProductCard product={prod} />
          </div>
        ))}
      </div>
    );
  } catch (error) {
    return null;
  }
}

async function NewProductsRow() {
  try {
    const productsRaw = await prisma.storeProduct.findMany({
      where: { active: true },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        branch: {
          include: { category: true }
        }
      }
    });
    const products = deepSanitize(productsRaw);

    if (products.length === 0) return null;

    return (
      <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-2 px-2 hide-scrollbar accelerate-gpu" style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
        {products.map((prod: any) => (
          <div key={prod.id} className="w-[160px] md:w-[200px] shrink-0">
            <ProductCard product={prod} />
          </div>
        ))}
      </div>
    );
  } catch (error) {
    return null;
  }
}

async function CategoryShowcase({ slides }: { slides: any[] }) {
  try {
    const categoriesRaw = await prisma.storeCategory.findMany({
      where: { active: true },
      // تم إزالة take: 4 لعرض جميع الأقسام
      orderBy: { sequence: "desc" },
    });
    
    if (categoriesRaw.length === 0) return null;

    return (
      <div className="space-y-8">
        {categoriesRaw.map((cat, index) => {
          // السلايدر يظهر بعد كل 3 أقسام
          const shouldShowSlider = (index + 1) % 3 === 0 && index < categoriesRaw.length - 1;

          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-slate-800">{cat.name}</h2>
                <Link href={`/store/c/${cat.id}`} className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl">
                  عرض الكل
                </Link>
              </div>
              <Suspense fallback={<div className="h-40 bg-slate-100 rounded-3xl animate-pulse"></div>}>
                <CategoryProducts categoryId={cat.id} />
              </Suspense>

              {shouldShowSlider && slides && slides.length > 0 && (
                <div className="mt-8 mb-4 w-full">
                  <StoreSlider slides={slides.map((s: any) => ({
                    id: s.id,
                    imageUrl: s.imageUrl,
                    linkUrl: s.linkUrl || "",
                    title: s.title || ""
                  }))} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  } catch (error) {
    return null;
  }
}

async function CategoryProducts({ categoryId }: { categoryId: string }) {
  try {
    const productsRaw = await prisma.storeProduct.findMany({
      where: { active: true, branch: { categoryId } },
      take: 6,
      orderBy: { sequence: "desc" },
      include: {
        branch: {
          include: { category: true }
        }
      }
    });
    const products = deepSanitize(productsRaw);
    
    if (products.length === 0) return <div className="text-sm text-slate-400 p-4 text-center">لا توجد منتجات حالياً</div>;

    return (
      <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-2 px-2 hide-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: "touch" }}>
        {products.map((prod: any) => (
          <div key={prod.id} className="w-[160px] md:w-[200px] shrink-0">
            <ProductCard product={prod} />
          </div>
        ))}
      </div>
    );
  } catch(e) {
    return null;
  }
}


// دالة التطهير العميقة لضمان التوافق مع Next.js 15 ومنع أخطاء الـ Serialization في بيئة الإنتاج
function deepSanitize(obj: any): any {
  try {
    return JSON.parse(JSON.stringify(obj, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    ));
  } catch (error) {
    console.error("Sanitize Error:", error);
    return [];
  }
}

export default async function StoreHomePage() {
  try {
    const { ensureHidePricesColumns } = await import("@/lib/db-self-heal-hide-prices");
    await ensureHidePricesColumns();

    const slidesRaw = await prisma.storeSlide.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" }
    });

    const slides = deepSanitize(slidesRaw);

    return (
      <div className="space-y-6">
        {/* البانر الترويجي */}
        <ScrollReveal className="mb-6">
          {slides && slides.length > 0 ? (
            <div className="w-full">
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
        </ScrollReveal>

        {/* قسم الفئات */}
        <ScrollReveal>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-800">الأقسام</h2>
            <Link href="/store/categories" className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl">
              عرض الكل
            </Link>
          </div>
          <Suspense fallback={<div className="flex gap-4 overflow-hidden"><div className="w-16 h-16 bg-slate-200 rounded-2xl animate-pulse" /></div>}>
            <CategoriesRow />
          </Suspense>
        </ScrollReveal>

        {/* قسم الأكثر مبيعاً */}
        <ScrollReveal>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-xl font-black text-slate-800">الأكثر مبيعاً</h2>
            <Link href="/store/best-sellers" className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl">
              عرض الكل
            </Link>
          </div>
          <Suspense fallback={<div className="flex gap-4 overflow-hidden"><div className="w-[160px] h-[240px] bg-slate-200 rounded-3xl animate-pulse" /></div>}>
            <BestSellersRow />
          </Suspense>
        </ScrollReveal>
        
        {/* قسم الجديد */}
        <ScrollReveal>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-xl font-black text-slate-800">وصل حديثاً</h2>
            <Link href="/store/new" className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl">
              عرض الكل
            </Link>
          </div>
          <Suspense fallback={<div className="flex gap-4 overflow-hidden"><div className="w-[160px] h-[240px] bg-slate-200 rounded-3xl animate-pulse" /></div>}>
            <NewProductsRow />
          </Suspense>
        </ScrollReveal>

        {/* مقتطفات الأقسام */}
        <ScrollReveal className="mt-8">
          <Suspense fallback={<div className="h-40 bg-slate-100 rounded-3xl animate-pulse"></div>}>
            <CategoryShowcase slides={slides} />
          </Suspense>
        </ScrollReveal>
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

