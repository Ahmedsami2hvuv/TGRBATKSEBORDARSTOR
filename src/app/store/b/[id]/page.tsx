import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ProductCard } from "../../product-card";
import { CustomProductRequest } from "@/components/custom-product-request";

export const dynamic = "force-dynamic";

// دالة تطهير عميقة لضمان عدم حدوث خطأ "Digest" (Serialization Error)
function safeJson(data: any) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || typeof value.toNumber === 'function')) {
        return Number(value.toString());
    }
    return value;
  }));
}

export default async function BranchPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const branchId = params?.id;

  if (!branchId) return <div className="p-10 text-center font-bold">معرف الفرع مفقود</div>;

  try {
    const branchRaw = await prisma.storeBranch.findUnique({
      where: { id: branchId },
      include: {
        category: true,
        products: {
          where: { active: true },
          orderBy: { sequence: "asc" },
          include: {
            variants: {
                where: { active: true },
                orderBy: { sequence: "asc" }
            }
          }
        },
        children: {
          where: { active: true },
          orderBy: { sequence: "asc" }
        }
      }
    });

    if (!branchRaw) {
      return (
        <div className="text-center py-20" dir="rtl">
          <h2 className="text-xl font-bold">الفرع المطلوب غير موجود</h2>
          <Link href="/store" className="text-violet-600 underline mt-4 block">العودة للمتجر</Link>
        </div>
      );
    }

    // تطهير البيانات
    const branch = safeJson(branchRaw);
    const products = branch.products || [];
    const children = branch.children || [];

    return (
      <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700" dir="rtl">
        {/* Breadcrumb & Navigation */}
        <header className="space-y-4">
          <nav className="flex items-center gap-2 text-sm font-bold text-slate-400">
            <Link href="/store" className="hover:text-violet-600 transition">🏠 المتجر</Link>
            <span>/</span>
            {branch.category && (
              <>
                <Link href={`/store/c/${branch.category.id}`} className="hover:text-violet-600 transition">
                  {branch.category.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-slate-900 dark:text-white line-clamp-1">{branch.name}</span>
          </nav>

          <section className="p-6 md:p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
             <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
               <div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 border border-slate-100 dark:border-slate-700">
                 {branch.photoUrl ? (
                   <img src={branch.photoUrl} alt={branch.name} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-3xl">🛍️</div>
                 )}
               </div>
               <div className="text-center md:text-right flex-1">
                 <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white">{branch.name}</h1>
                 <p className="text-sm text-slate-500 font-bold mt-1 line-clamp-2">{branch.description || "استمتع بالتسوق من تشكيلتنا المميزة"}</p>
               </div>
             </div>
          </section>
        </header>

        <CustomProductRequest />

        {/* Sub-Branches (if any) */}
        {children.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
              <span className="w-2 h-8 bg-violet-600 rounded-full"></span>
              الأقسام المتوفرة
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {children.map((child: any) => (
                <Link
                  key={child.id}
                  href={`/store/b/${child.id}`}
                  className="bg-white dark:bg-slate-900 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all text-center group"
                >
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                     {child.photoUrl ? <img src={child.photoUrl} className="w-full h-full object-cover rounded-xl" /> : "📂"}
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-violet-600 transition-colors">{child.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Products Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
              <span className="w-2 h-8 bg-violet-600 rounded-full"></span>
              المنتجات
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-500">
               {products.length} منتج
            </span>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700">
              لا توجد منتجات متاحة حالياً في هذا الفرع.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  } catch (error) {
    console.error("[BranchPage Render Error]:", error);
    return (
      <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-rose-100" dir="rtl">
        <h2 className="text-xl font-black text-rose-600">عذراً، حدث خطأ في تحميل المنتجات</h2>
        <p className="text-sm text-slate-500 mt-2">يرجى المحاولة مرة أخرى لاحقاً</p>
        <Link href="/store" className="mt-6 inline-block px-8 py-3 bg-slate-900 text-white rounded-2xl font-black">العودة للرئيسية</Link>
      </div>
    );
  }
}
