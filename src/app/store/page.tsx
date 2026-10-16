import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { Metadata } from "next";
import { StoreSlider } from "./_components/store-slider";
import { ProductCard } from "./product-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getDefaultStoreMetadata, getStoreProductMetadata } from "@/lib/store-meta";

// تخزين مؤقت ذكي لمدة 60 ثانية لجعل الصفحة تفتح في أجزاء من الثانية وتخفيف الضغط كلياً عن قاعدة البيانات
export const revalidate = 60;

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

async function ActiveShopsRow() {
  try {
    const shopsRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        s.id, 
        s.name, 
        s."photoUrl", 
        COALESCE(s."storeToken", '') as "storeToken",
        r.name as "regionName",
        COUNT(p.id)::int as "productsCount"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
      INNER JOIN "ShopStoreProduct" p ON p."shopId" = s.id AND p.active = true
      WHERE s."storeEnabled" = true
      GROUP BY s.id, s.name, s."photoUrl", s."storeToken", r.name
      HAVING COUNT(p.id) > 0
      ORDER BY s."updatedAt" DESC
      LIMIT 12;
    `);

    if (!shopsRaw || shopsRaw.length === 0) return null;

    return (
      <section className="relative isolate mt-7 overflow-hidden rounded-[30px] border border-[#e8d5ff] bg-gradient-to-br from-[#f0e5ff] via-[#fbf7ff] to-[#fffaff] p-4 shadow-[0_12px_36px_rgba(126,58,242,0.12)] sm:p-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#d8b4fe]/45 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 left-2 h-36 w-36 rounded-full bg-[#ead7ff]/70 blur-3xl" />

        <div className="relative mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border-4 border-white bg-gradient-to-br from-[#b57af7] to-[#7c3aed] text-white shadow-[0_8px_20px_rgba(124,58,237,0.24)]">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden="true">
                <path d="M3.5 10.2 12 3.8l8.5 6.4v9.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-9.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M8.5 20.5v-6.8h7v6.8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <span className="mb-2 inline-flex rounded-full bg-gradient-to-r from-[#c084fc] to-[#9b5cf6] px-3 py-1.5 text-xs font-black text-white shadow-md shadow-purple-200">
                اكتشف الجديد
              </span>
              <h2 className="text-[27px] font-black leading-[1.35] tracking-tight text-[#4c1d95] sm:text-3xl">
                متاجر قضاء أبي الخصيب
              </h2>
            </div>
          </div>
        </div>

        <div className="relative -mx-1 flex items-stretch gap-3 overflow-x-auto px-1 pb-2 pt-1 hide-scrollbar" style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
          {shopsRaw.map((s: any) => (
            <Link
              key={s.id}
              href={`/shop/${s.storeToken || s.id}`}
              className="group relative flex w-[min(78vw,330px)] shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/90 bg-white p-2.5 shadow-[0_10px_26px_rgba(91,33,182,0.14)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(91,33,182,0.2)] active:scale-[0.98] sm:w-[300px]"
            >
              <div className="absolute inset-x-5 top-0 z-10 h-1.5 rounded-b-full bg-gradient-to-l from-[#d8b4fe] via-[#a855f7] to-[#7c3aed]" />
              <div className="relative h-[150px] overflow-hidden rounded-[22px] bg-gradient-to-br from-[#e9d5ff] via-[#f5edff] to-[#ede9fe] sm:h-[170px]">
                {s.storeLogoUrl || s.photoUrl ? (
                  <img src={s.storeLogoUrl || s.photoUrl} alt={s.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" className="h-16 w-16 text-[#8b5cf6]" aria-hidden="true">
                      <path d="M4 10h16l-1.2-5H5.2L4 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
                      <path d="M5 10v9h14v-9M9 19v-5h6v5M3.5 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <span className="absolute bottom-2 right-2 rounded-full border border-white/80 bg-white/95 px-3 py-1.5 text-xs font-black text-[#7c3aed] shadow-sm">متجر وصلي</span>
              </div>

              <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-3">
                <h3 className="truncate text-lg font-black text-slate-900">{s.name}</h3>
                <p className="mt-1 truncate text-sm font-bold text-slate-500">{s.regionName || "أبي الخصيب"}</p>
                <div className="mt-3 flex items-center justify-between border-t border-[#f0e7ff] pt-3">
                  <span className="text-sm font-bold text-slate-500">{s.productsCount ?? 0} منتج</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#a855f7] to-[#7c3aed] px-4 py-2 text-sm font-black text-white shadow-md shadow-purple-200 transition group-hover:shadow-lg">
                    تسوّق
                    <span className="text-[#f3e8ff] transition-transform group-hover:-translate-x-1" aria-hidden="true">←</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
          <div className="flex w-[88px] shrink-0 flex-col items-center justify-center rounded-[26px] border-2 border-dashed border-[#c084fc] bg-white/55 px-2.5 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#ead7ff] text-3xl font-black text-[#6d28d9]">←</span>
            <span className="text-sm font-black leading-5 text-[#6d28d9]">اسحب واكتشف</span>
          </div>
        </div>
      </section>
    );
  } catch (error) {
    return null;
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
    let slides: any[] = [];
    try {
      const slidesRaw = await prisma.storeSlide.findMany({
        where: { active: true },
        orderBy: { sequence: "asc" }
      });
      slides = deepSanitize(slidesRaw) || [];
    } catch (slideError) {
      console.warn("[StoreHomePage] Could not load slides, proceeding with fallback banner:", slideError);
      slides = [];
    }

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

        {/* قسم متاجر المحلات النشطة */}
        <ScrollReveal>
          <Suspense fallback={null}>
            <ActiveShopsRow />
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

        {/* فوتر منصة وصلي مع رابط الواتساب */}
        <footer className="mt-14 pt-8 pb-16 border-t border-slate-200 text-center space-y-2.5">
          <p className="text-xs font-black text-slate-700">
            صنع بواسطة وصلي
          </p>
          <a
            href="https://wa.me/9647733921468"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition active:scale-95"
          >
            <span>راسلنا واتس اب: 07733921468</span>
          </a>
        </footer>
      </div>
    );
  } catch (error) {
    console.error("Store page error:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <h1 className="text-xl font-black mb-2 text-slate-800">عذراً، حدث خطأ تقني</h1>
        <p className="text-sm text-slate-500 mb-6">نعمل على إصلاح المشكلة الآن، يرجى تحديث الصفحة بعد قليل.</p>
        <a href="/store" className="px-6 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl font-bold shadow-md transition-all">تحديث الصفحة</a>
      </div>
    );
  }
}

