import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AddToCartButton } from "../add-to-cart-button";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  cat?: string;
  branch?: string;
  min?: string;
  max?: string;
  sort?: string;
}

export default async function StoreSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, cat, branch, min, max, sort } = await searchParams;

  // Fetch categories and branches for filters
  const [categories, branches] = await Promise.all([
    prisma.storeCategory.findMany({ where: { active: true }, orderBy: { sequence: "asc" } }),
    prisma.storeBranch.findMany({ where: { active: true }, orderBy: { sequence: "asc" } }),
  ]);

  // Build the product query
  const products = q || cat || branch || min || max
    ? await prisma.storeProduct.findMany({
        where: {
          active: true,
          AND: [
            q ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { branch: { name: { contains: q, mode: "insensitive" } } },
                { branch: { category: { name: { contains: q, mode: "insensitive" } } } },
              ]
            } : {},
            cat ? { branch: { categoryId: cat } } : {},
            branch ? { branchId: branch } : {},
            min ? { salePrice: { gte: parseFloat(min) } } : {},
            max ? { salePrice: { lte: parseFloat(max) } } : {},
          ]
        },
        include: {
          branch: {
            include: {
              category: true
            }
          }
        },
        orderBy: sort === "price_asc" ? { salePrice: "asc" } :
                 sort === "price_desc" ? { salePrice: "desc" } :
                 { name: "asc" }
      })
    : [];

  // Search for matching categories and branches to show as "Quick Links" if q is present
  const matchedCategories = q ? categories.filter(c => c.name.includes(q)) : [];
  const matchedBranches = q ? branches.filter(b => b.name.includes(q)) : [];

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Search Bar */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">البحث الذكي</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold">ابحث عن منتجات، أقسام، أو أسعار محددة</p>
        </div>

        <form className="relative w-full group">
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="ما الذي تبحث عنه اليوم؟ (مثلاً: لحوم، كولا، 5000...)"
            className="w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-violet-500 dark:focus:border-violet-400 outline-none transition-all font-bold text-xl shadow-xl shadow-slate-200/50 dark:shadow-none dark:text-white"
          />
          <button type="submit" className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform">
            🔍
          </button>

          {/* Hidden inputs to preserve filters during search */}
          {cat && <input type="hidden" name="cat" value={cat} />}
          {branch && <input type="hidden" name="branch" value={branch} />}
          {min && <input type="hidden" name="min" value={min} />}
          {max && <input type="hidden" name="max" value={max} />}
        </form>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <aside className="md:col-span-1 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
            <h3 className="font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🎯</span> الفلاتر
            </h3>

            <div className="space-y-4">
              {/* Category Filter */}
              <div>
                <label className="text-xs font-black text-slate-400 mb-2 block">القسم</label>
                <select
                  className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm dark:text-white"
                  onChange={(e) => {
                    const params = new URLSearchParams(window.location.search);
                    if (e.target.value) params.set('cat', e.target.value);
                    else params.delete('cat');
                    window.location.search = params.toString();
                  }}
                  value={cat || ""}
                >
                  <option value="">كل الأقسام</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="text-xs font-black text-slate-400 mb-2 block">الفرع</label>
                <select
                  className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm dark:text-white"
                  onChange={(e) => {
                    const params = new URLSearchParams(window.location.search);
                    if (e.target.value) params.set('branch', e.target.value);
                    else params.delete('branch');
                    window.location.search = params.toString();
                  }}
                  value={branch || ""}
                >
                  <option value="">كل الفروع</option>
                  {branches.filter(b => !cat || b.categoryId === cat).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Price Filter */}
              <div>
                <label className="text-xs font-black text-slate-400 mb-2 block">السعر</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="من"
                    className="w-1/2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white"
                    onBlur={(e) => {
                      const params = new URLSearchParams(window.location.search);
                      if (e.target.value) params.set('min', e.target.value);
                      else params.delete('min');
                      window.location.search = params.toString();
                    }}
                    defaultValue={min}
                  />
                  <input
                    type="number"
                    placeholder="إلى"
                    className="w-1/2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white"
                    onBlur={(e) => {
                      const params = new URLSearchParams(window.location.search);
                      if (e.target.value) params.set('max', e.target.value);
                      else params.delete('max');
                      window.location.search = params.toString();
                    }}
                    defaultValue={max}
                  />
                </div>
              </div>

              {/* Sort Filter */}
              <div>
                <label className="text-xs font-black text-slate-400 mb-2 block">ترتيب حسب</label>
                <select
                  className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm dark:text-white"
                  onChange={(e) => {
                    const params = new URLSearchParams(window.location.search);
                    if (e.target.value) params.set('sort', e.target.value);
                    else params.delete('sort');
                    window.location.search = params.toString();
                  }}
                  value={sort || ""}
                >
                  <option value="">الافتراضي</option>
                  <option value="price_asc">السعر: من الأقل</option>
                  <option value="price_desc">السعر: من الأعلى</option>
                </select>
              </div>

              <Link
                href="/store/search"
                className="block text-center py-3 text-xs font-black text-rose-500 hover:text-rose-600 transition"
              >
                إعادة ضبط الكل
              </Link>
            </div>
          </div>
        </aside>

        {/* Results Area */}
        <div className="md:col-span-3 space-y-6">
          {/* Quick Category/Branch Results */}
          {q && (matchedCategories.length > 0 || matchedBranches.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {matchedCategories.map(c => (
                <Link key={c.id} href={`/store/c/${c.id}`} className="px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-xs font-black border border-violet-200 dark:border-violet-800">
                  قسم: {c.name}
                </Link>
              ))}
              {matchedBranches.map(b => (
                <Link key={b.id} href={`/store/b/${b.id}`} className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-black border border-indigo-200 dark:border-indigo-800">
                  فرع: {b.name}
                </Link>
              ))}
            </div>
          )}

          {products.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none flex flex-col group">
                   <div className="relative aspect-square bg-slate-50 dark:bg-slate-800 overflow-hidden">
                    {product.photoUrls && (product.photoUrls as string[]).length > 0 ? (
                      <img
                        src={(product.photoUrls as string[])[0]}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200 dark:text-slate-700">
                        <span className="text-3xl md:text-5xl">📦</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 md:px-3 md:py-1 rounded-full shadow-sm">
                        <span className="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400">
                            {product.branch.category.name} » {product.branch.name}
                        </span>
                    </div>
                  </div>

                  <div className="p-3 md:p-6 flex-1 flex flex-col">
                    <h3 className="text-sm md:text-lg font-black text-slate-900 dark:text-white mb-1 line-clamp-1">{product.name}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-xs font-bold mb-2 md:mb-4 line-clamp-1 md:line-clamp-2">{product.description || "لا يوجد وصف"}</p>

                    <div className="mt-auto pt-2 md:pt-4 border-t border-slate-50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <span className="text-sm md:text-2xl font-black text-violet-600 dark:text-violet-400">
                          {Number(product.salePrice).toLocaleString()}
                        </span>
                        <span className="text-[8px] md:text-[10px] font-black text-slate-400 mr-1 uppercase">د.ع</span>
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
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
              <div className="text-6xl mb-4">🏜️</div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">لا توجد نتائج تطابق بحثك</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold mt-2">جرب تغيير الفلاتر أو البحث بكلمات مختلفة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
