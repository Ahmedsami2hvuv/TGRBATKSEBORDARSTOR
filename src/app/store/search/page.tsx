import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AddToCartButton } from "../add-to-cart-button";

export const dynamic = "force-dynamic";

export default async function StoreSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  const products = q
    ? await prisma.storeProduct.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ]
        },
        include: {
          branch: {
            include: {
              category: true
            }
          }
        },
        orderBy: { name: "asc" }
      })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-black text-slate-900">البحث في المتجر</h1>
        <form className="relative w-full">
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="ما الذي تبحث عنه اليوم؟"
            className="w-full pl-12 pr-6 py-4 rounded-3xl border-2 border-slate-100 bg-white focus:border-violet-500 outline-none transition-all font-bold text-lg shadow-sm"
          />
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
        </form>
      </div>

      {q && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-700">
              نتائج البحث عن "{q}"
              <span className="mr-2 text-sm text-slate-400 font-bold">({products.length} منتج)</span>
            </h2>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-slate-100 shadow-lg shadow-slate-200/50 flex flex-col group">
                   <div className="relative aspect-square bg-slate-50 overflow-hidden">
                    {product.photoUrls && (product.photoUrls as string[]).length > 0 ? (
                      <img
                        src={(product.photoUrls as string[])[0]}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200">
                        <span className="text-3xl md:text-5xl">📦</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-white/90 backdrop-blur-sm px-2 py-0.5 md:px-3 md:py-1 rounded-full shadow-sm">
                        <span className="text-[10px] md:text-xs font-black text-slate-500">
                            {product.branch.category.name}
                        </span>
                    </div>
                  </div>

                  <div className="p-3 md:p-6 flex-1 flex flex-col">
                    <h3 className="text-sm md:text-lg font-black text-slate-900 mb-1 line-clamp-1">{product.name}</h3>
                    <p className="text-slate-500 text-[10px] md:text-xs font-bold mb-2 md:mb-4 line-clamp-1 md:line-clamp-2">{product.description || "لا يوجد وصف"}</p>

                    <div className="mt-auto pt-2 md:pt-4 border-t border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <span className="text-sm md:text-2xl font-black text-violet-600">
                          {Number(product.salePrice).toLocaleString()}
                        </span>
                        <span className="text-[8px] md:text-[10px] font-black text-slate-400 mr-1 uppercase"></span>
                      </div>
                      <AddToCartButton product={{
                        id: product.id,
                        name: product.name,
                        price: Number(product.salePrice),
                        image: (product.photoUrls as string[])?.[0] || ""
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
              <div className="text-6xl mb-4">🏜️</div>
              <h3 className="text-xl font-black text-slate-900">لم نجد أي منتجات تطابق بحثك</h3>
              <p className="text-slate-500 font-bold mt-2">جرب البحث بكلمات أخرى أو تصفح الأقسام الرئيسية</p>
              <Link href="/store" className="mt-6 inline-flex px-8 py-3 bg-violet-600 text-white rounded-2xl font-black hover:bg-violet-700 transition shadow-lg shadow-violet-200">
                العودة للرئيسية
              </Link>
            </div>
          )}
        </div>
      )}

      {!q && (
        <div className="text-center py-20">
             <div className="text-6xl mb-4 opacity-20 text-violet-600">🔎</div>
             <p className="text-slate-400 font-black">أدخل اسم المنتج الذي تبحث عنه في الخانة أعلاه</p>
        </div>
      )}
    </div>
  );
}
