import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomProductRequest } from "@/components/custom-product-request";
import { ProductListClient } from "./product-list-client";

export const revalidate = 3600; // تحديث الصفحة كل ساعة بدلاً من جلبها في كل ثانية

export default async function BranchPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const [branch, storeSettings] = await Promise.all([
    prisma.storeBranch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        photoUrl: true,
        categoryId: true,
        parentBranchId: true,
        category: { select: { name: true } },
        parentBranch: { select: { name: true } },
        _count: { select: { products: true } },
      }
    }),
    prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "customer", section: "store_general" } },
      select: { config: true }
    })
  ]);

  if (!branch) return notFound();

  const productBg = (storeSettings?.config as any)?.product_card_bg_url;
  const productBgOpacity = (storeSettings?.config as any)?.product_card_bg_opacity;
  const categoryName = branch.category?.name || "قسم غير محدد";

  return (
    <div className="space-y-6 md:space-y-10 pb-10 px-2" dir="rtl">
      <nav className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-bold text-slate-400 mb-4">
        <Link href="/store" className="hover:text-violet-600 transition">🏠 المتجر</Link>
        <span>/</span>
        <Link href={`/store/c/${branch.categoryId}`} className="hover:text-violet-600 transition">{categoryName}</Link>
        {branch.parentBranch && (
          <>
            <span>/</span>
            <Link href={`/store/b/${branch.parentBranchId}`} className="hover:text-violet-600 transition">{branch.parentBranch.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-900 dark:text-white">{branch.name}</span>
      </nav>

      <section className="relative overflow-hidden p-6 md:p-10 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 md:gap-10">
          <div className="w-20 h-20 md:w-32 md:h-32 rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 border-2 border-slate-100 dark:border-slate-700">
            {branch.photoUrl ? (
              <img src={branch.photoUrl} alt={branch.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🌿</div>
            )}
          </div>
          <div className="text-center md:text-right">
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white">{branch.name}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                <span className="text-sm text-slate-500 font-bold">{categoryName}</span>
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full hidden md:block"></span>
                <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px] md:text-xs font-black px-3 py-1 rounded-full">
                    {branch._count.products} منتج متوفر
                </span>
            </div>
          </div>
        </div>
      </section>


      <CustomProductRequest />

      <div className="space-y-6">
        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
          المنتجات
        </h2>
        <ProductListClient branchId={id} />
      </div>
    </div>
  );
}