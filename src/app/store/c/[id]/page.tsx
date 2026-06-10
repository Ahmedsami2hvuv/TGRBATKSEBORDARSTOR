import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CustomProductRequest } from "@/components/custom-product-request";
import { StoreSlider } from "../../_components/store-slider";

export const revalidate = 30; // تفعيل الكاش لـ 30 ثانية لتسريع التصفح

// دالة تطهير بيانات فائقة الأمان لـ Next.js 15 لضمان تحويل كافة الكائنات المعقدة إلى بسيطة
function safeJson(data: any) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || typeof value.toNumber === 'function')) {
        return Number(value.toString());
    }
    return value;
  }));
}

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
  // انتظر الـ params أولاً (مطلوب في Next.js 15)
  const params = await props.params;
  const categoryId = params?.id;

  if (!categoryId) return <div className="p-10 text-center font-bold">معرف القسم مفقود</div>;

  try {
    // جلب البيانات الأساسية
    const categoryRaw = await prisma.storeCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, photoUrl: true }
    });

    if (!categoryRaw) {
        return (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100" dir="rtl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">القسم المطلوب غير موجود</h2>
            <Link href="/store" className="text-violet-600 underline mt-4 block font-bold">العودة للمتجر الرئيسي</Link>
          </div>
        );
    }

    const [branchesRaw, slidesRaw] = await Promise.all([
      prisma.storeBranch.findMany({
        where: { categoryId, active: true, parentBranchId: null },
        include: { _count: { select: { products: true } } },
        orderBy: { sequence: "desc" },
      }),
      prisma.storeSlide.findMany({
        where: { active: true },
        orderBy: { sequence: "asc" }
      })
    ]);

    // تطهير البيانات بالكامل قبل استخدامها
    const category = safeJson(categoryRaw);
    const branches = safeJson(branchesRaw);
    const slides = safeJson(slidesRaw);

    return (
      <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700" dir="rtl">
        {/* Slider Section */}
        {slides && slides.length > 0 && (
          <section>
            <StoreSlider slides={slides.map((s: any) => ({
              id: s.id,
              imageUrl: s.imageUrl,
              linkUrl: s.linkUrl || "",
              title: s.title || ""
            }))} />
          </section>
        )}

        {/* Header Section */}
        <header className="space-y-4">
          <nav className="flex items-center gap-2 text-sm font-bold text-slate-400">
            <Link href="/store" className="hover:text-violet-600 transition">🏠 المتجر</Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-white">{category.name}</span>
          </nav>

          <section className="flex flex-col md:flex-row items-center gap-4 md:gap-8 p-6 md:p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="w-20 h-20 md:w-32 md:h-32 rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 border border-slate-100 dark:border-slate-700">
              {category.photoUrl ? (
                <img src={category.photoUrl} alt={category.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">📁</div>
              )}
            </div>
            <div className="text-center md:text-right">
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white">{category.name}</h1>
              <p className="text-sm text-slate-500 font-bold mt-1">تصفح أقسام {category.name} واختر ما يناسبك</p>
            </div>
          </section>
        </header>

        <CustomProductRequest />

        {/* Branches Grid */}
        <section className="space-y-6">
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
            <span className="w-2 h-8 bg-violet-600 rounded-full"></span>
            الأقسام الفرعية
          </h2>

          {branches.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700">
                لا توجد أفرع متاحة حالياً لهذا القسم.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {branches.map((branch: any) => (
                <Link
                  key={branch.id}
                  href={`/store/b/${branch.id}`}
                  className="group block bg-white dark:bg-slate-900 rounded-[2rem] p-4 border border-slate-100 dark:border-slate-800 shadow-md hover:shadow-violet-200/40 hover:-translate-y-2 transition-all duration-300"
                >
                  <div className="relative aspect-video mb-4 overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800">
                    {branch.photoUrl ? (
                      <img src={branch.photoUrl} alt={branch.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg">
                        {branch._count?.products || 0} منتج
                    </div>
                  </div>
                  <h3 className="text-sm md:text-lg font-black text-center group-hover:text-violet-600 transition-colors line-clamp-1 text-slate-900 dark:text-white">{branch.name}</h3>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  } catch (error) {
    console.error("[CategoryPage Render Error]:", error);
    return (
      <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-rose-100 dark:border-rose-900/30 shadow-xl" dir="rtl">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">عذراً، حدث خطأ أثناء تحميل القسم</h2>
        <p className="text-sm text-slate-500 mt-2">نعمل على معالجة المشكلة الآن، يرجى تحديث الصفحة بعد قليل.</p>
        <a href="" className="mt-6 px-8 py-3 bg-violet-600 text-white rounded-2xl font-black shadow-lg hover:bg-violet-700 transition-all inline-block">إعادة المحاولة</a>
      </div>
    );
  }
}
