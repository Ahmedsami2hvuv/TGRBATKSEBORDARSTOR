import { prisma } from "@/lib/prisma";
import { ProductListClient } from "./product-list-client";
import Link from "next/link";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: { searchParams: Promise<{ branchId?: string, q?: string, page?: string }> }) {
  const searchParams = await props.searchParams;
  const branchId = searchParams?.branchId;
  const q = searchParams?.q || "";
  const page = parseInt(searchParams?.page || "1");
  const pageSize = 30; // تقليل عدد العناصر في الصفحة الواحدة لتسريع التحميل

  const icons = await getGlobalIcons();

  try {
    const whereClause: any = {
      AND: [
        branchId ? { branchId } : {},
        q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        } : {}
      ]
    };

    // جلب البيانات مع تحديد الحقول المضمونة فقط
    const [productsRaw, totalCount] = await Promise.all([
      prisma.storeProduct.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          purchasePrice: true,
          salePrice: true,
          photoUrls: true,
          active: true,
          sequence: true,
          branchId: true,
          hasVariants: true,
          variantType: true,
          variants: {
            select: {
              id: true,
              name: true,
              purchasePrice: true,
              salePrice: true,
              sequence: true
            }
          },
          branch: {
            select: {
              id: true,
              name: true,
              category: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: [
          { sequence: "asc" },
          { createdAt: "desc" }
        ],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.storeProduct.count({ where: whereClause })
    ]);

    const branchesRaw = await prisma.storeBranch.findMany({
      select: {
        id: true,
        name: true,
        categoryId: true,
        category: {
          select: { id: true, name: true }
        }
      },
      orderBy: { sequence: "asc" },
    });

    // تحويل البيانات لضمان عدم وجود Decimal أو أنواع معقدة
    const products = productsRaw.map(p => {
      const salePriceNum = p.salePrice ? Number(p.salePrice) : 0;
      const purchasePriceNum = p.purchasePrice ? Number(p.purchasePrice) : 0;

      let imageUrl = "";
      if (Array.isArray(p.photoUrls) && p.photoUrls.length > 0) {
        imageUrl = p.photoUrls[0];
      } else if (typeof p.photoUrls === "string" && (p.photoUrls as string).length > 5) {
        imageUrl = p.photoUrls;
      }

      return {
        ...p,
        purchasePrice: purchasePriceNum,
        salePrice: salePriceNum,
        image: imageUrl,
        photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
        variants: p.variants.map(v => ({
          ...v,
          purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : 0,
          salePrice: v.salePrice ? Number(v.salePrice) : 0,
        }))
      };
    });

    const branches = branchesRaw.map(b => ({
        ...b,
        categoryName: b.category?.name || "عام"
    }));
    const selectedBranch = branchId ? branches.find((b: any) => b.id === branchId) : null;

    const totalPages = Math.ceil(totalCount / pageSize);

    // جلب الإعدادات العامة للخلفية
    const storeSettings = await prisma.uISystemSetting.findFirst({
      where: { target: "customer", section: "store_general" }
    });
    const config = (storeSettings?.config as any) || {};
    const productCardBgUrl = config.product_card_bg_url || "";

    return (
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              {selectedBranch ? `منتجات فرع: ${selectedBranch.name}` : "إدارة المنتجات"}
            </h1>
            <p className="text-xs text-slate-400 font-bold mt-1">
              {selectedBranch ? `القسم: ${selectedBranch.category?.name || "عام"}` : `عرض ${totalCount} منتج متاح في المتجر`}
            </p>
          </div>
          <div className="flex gap-2">
            {branchId && (
              <Link href="/abo1stor3hlaa2kbr8-47/store/products" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors">
                عرض الكل
              </Link>
            )}
            <Link href="/abo1stor3hlaa2kbr8-47/store" className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-100 transition-all hover:scale-105 active:scale-95">
              + إضافة منتج
            </Link>
          </div>
        </div>

        {/* Server Side Search */}
        <form className="flex gap-2">
           <input name="branchId" type="hidden" value={branchId || ""} />
           <div className="relative flex-1">
              <span className="absolute right-4 top-1/2 -translate-y-1/2">🔍</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="بحث سريع في قاعدة البيانات..."
                className="w-full pr-12 pl-4 py-3 rounded-2xl bg-white border-2 border-slate-100 focus:border-emerald-500 outline-none font-bold text-sm transition-all"
              />
           </div>
           <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm">بحث</button>
        </form>

        <ProductListClient
          initialProducts={products}
          branches={branches}
          defaultBranchId={branchId}
          productCardBgUrl={productCardBgUrl}
          icons={icons}
        />

        {/* Simple Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 pt-4">
            {page > 1 && (
              <Link
                href={`?${new URLSearchParams({ ...(branchId ? { branchId } : {}), ...(q ? { q } : {}), page: (page - 1).toString() })}`}
                className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50"
              >
                السابق
              </Link>
            )}
            <span className="font-black text-slate-500 text-sm">صفحة {page} من {totalPages}</span>
            {page < totalPages && (
              <Link
                href={`?${new URLSearchParams({ ...(branchId ? { branchId } : {}), ...(q ? { q } : {}), page: (page + 1).toString() })}`}
                className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50"
              >
                التالي
              </Link>
            )}
          </div>
        )}
      </div>
    );
  } catch (error: any) {
    console.error("Database Error in ProductsPage:", error);
    return (
      <div className="p-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-rose-100 m-6">
        <div className="text-5xl mb-4 text-rose-500">❌</div>
        <h1 className="text-xl font-black text-slate-900">خطأ في جلب البيانات</h1>
        <p className="text-slate-500 mt-2 text-sm font-bold">{error.message}</p>
        <Link href="/abo1stor3hlaa2kbr8-47/store/products" className="mt-6 inline-block px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">تحديث الصفحة</Link>
      </div>
    );
  }
}
