import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StoreAiSettings } from "./_components/store-ai-settings";

export default async function StoreAdminHub({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  let results: any = null;
  if (q) {
    const [categories, branches, products] = await Promise.all([
      prisma.storeCategory.findMany({ where: { name: { contains: q, mode: "insensitive" } } }),
      prisma.storeBranch.findMany({ where: { name: { contains: q, mode: "insensitive" } }, include: { category: true } }),
      prisma.storeProduct.findMany({ where: { name: { contains: q, mode: "insensitive" } }, include: { branch: { include: { category: true } } } }),
    ]);
    results = { categories, branches, products };
  }

  const menus = [
    {
      title: "أقسام المتجر",
      desc: "إدارة الأقسام الرئيسية للمتجر الإلكتروني",
      href: "/admin/store/categories",
      emoji: "📁",
      color: "bg-blue-500",
    },
    {
      title: "أفرع المتجر",
      desc: "إدارة الأفرع التابعة لكل قسم",
      href: "/admin/store/branches",
      emoji: "🌿",
      color: "bg-emerald-500",
    },
    {
      title: "المنتجات",
      desc: "إدارة قائمة المنتجات والأسعار والصور",
      href: "/admin/store/products",
      emoji: "📦",
      color: "bg-violet-500",
    },
    {
      title: "سجل الطلبات",
      desc: "عرض طلبات المتجر الإلكتروني مع البحث والفلترة",
      href: "/admin/store/orders-history",
      emoji: "🧾",
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">إدارة المتجر</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 font-bold">تحكم في محتوى المتجر الإلكتروني من هنا</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-black border border-violet-100">
              رابط المتجر للزبائن: <span className="select-all">/store</span>
            </div>
            <Link
              href="/store"
              target="_blank"
              className="px-3 py-1 bg-violet-600 text-white rounded-full text-xs font-black hover:bg-violet-700 transition shadow-sm"
            >
              زيارة المتجر ↗
            </Link>
          </div>
        </div>

        <form action="/admin/store" className="relative w-full md:w-96">
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث عن قسم، فرع، أو منتج..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-violet-500 transition-all font-bold"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </form>
      </div>

      <StoreAiSettings />

      {q && results && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-violet-200 shadow-xl shadow-violet-100/50 space-y-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">نتائج البحث عن: {q}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Categories */}
            <div className="space-y-3">
              <h3 className="font-black text-sm text-slate-400 border-b pb-2">الأقسام ({results.categories.length})</h3>
              {results.categories.map((c: any) => (
                <Link key={c.id} href="/admin/store/categories" className="block p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 transition font-bold text-slate-700 dark:text-slate-300">
                  📁 {c.name}
                </Link>
              ))}
            </div>

            {/* Branches */}
            <div className="space-y-3">
              <h3 className="font-black text-sm text-slate-400 border-b pb-2">الأفرع ({results.branches.length})</h3>
              {results.branches.map((b: any) => (
                <Link key={b.id} href={`/admin/store/branches?categoryId=${b.categoryId}`} className="block p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 transition">
                  <span className="font-bold text-slate-700 dark:text-slate-300">🌿 {b.name}</span>
                  <p className="text-[10px] text-slate-400 font-bold">في قسم: {b.category.name}</p>
                </Link>
              ))}
            </div>

            {/* Products */}
            <div className="space-y-3">
              <h3 className="font-black text-sm text-slate-400 border-b pb-2">المنتجات ({results.products.length})</h3>
              {results.products.map((p: any) => (
                <Link key={p.id} href={`/admin/store/products?branchId=${p.branchId}`} className="block p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 transition">
                  <span className="font-bold text-slate-700 dark:text-slate-300">📦 {p.name}</span>
                  <p className="text-[10px] text-slate-400 font-bold">{p.branch.category.name} › {p.branch.name}</p>
                </Link>
              ))}
            </div>
          </div>

          {results.categories.length === 0 && results.branches.length === 0 && results.products.length === 0 && (
            <p className="text-center py-10 text-slate-400 font-bold">لم يتم العثور على نتائج مطابقة.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {menus.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none hover:border-violet-400 dark:hover:border-violet-500 transition-all duration-300"
          >
            <div className={`w-16 h-16 ${m.color} rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-lg transform group-hover:scale-110 transition-transform`}>
              {m.emoji}
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">{m.title}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
